// The stored act-primer state (lib/primer-prefs.mjs, #389, docs/FOUNDATION.md §2.12).
// Its own key, never oncall.progress; merging only moves up; a corrupt value is overwritten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeStorage } from './helpers/fake-storage.mjs';
import { PRIMER_KEY, mergePrimerEntry, readPrimers, recordPrimer } from '../lib/primer-prefs.mjs';

const at = (value) => fakeStorage({ initial: value === undefined ? {} : { [PRIMER_KEY]: value } });
const read = (store) => readPrimers(() => store);
const blocked = () => {
  throw new Error('blocked');
};
const entry = (seen, skipped, readIds) => ({ seen, skipped, read: readIds });

test('PRIMER_KEY is its own key, not the progress key', () => {
  assert.equal(PRIMER_KEY, 'oncall.primers');
});

test('readPrimers: absent is fresh and empty', () => {
  const r = read(at());
  assert.equal(r.status, 'fresh');
  assert.equal(r.acts.size, 0);
});

test('readPrimers: a stored value is ok and cleaned', () => {
  const r = read(at('{"v":1,"acts":{"act-0":{"seen":true,"skipped":false,"read":["b-two","a-one","Bad Id",7,"a-one"]},"act-9":{"seen":"yes"},"x":5}}'));
  assert.equal(r.status, 'ok');
  assert.deepEqual([...r.acts.keys()], ['act-0', 'act-9']);
  assert.deepEqual(r.acts.get('act-0'), entry(true, false, ['a-one', 'b-two']));
  assert.deepEqual(r.acts.get('act-9'), entry(false, false, []));
});

test('readPrimers: bad JSON or the wrong shape is corrupt and empty', () => {
  for (const text of ['{bad', '[]', '"x"', '{"v":1}', '{"acts":{}}', '{"v":1,"acts":[]}']) {
    const r = read(at(text));
    assert.equal(r.status, 'corrupt', text);
    assert.equal(r.acts.size, 0, text);
  }
});

test('readPrimers: a newer version is future', () => {
  assert.equal(read(at('{"v":2,"acts":{}}')).status, 'future');
});

test('readPrimers: a throwing getter or getItem is unavailable and empty', () => {
  for (const getStorage of [blocked, () => fakeStorage({ throwOn: ['getItem'] })]) {
    const r = readPrimers(getStorage);
    assert.equal(r.status, 'unavailable');
    assert.equal(r.acts.size, 0);
  }
});

test('recordPrimer: merge only goes up, keeps what was stored, and writes exactly once', () => {
  const store = at('{"v":1,"acts":{"act-0":{"seen":true,"skipped":false,"read":["c-two"]}}}');
  assert.deepEqual(recordPrimer(() => store, 'act-0', { read: ['c-one'] }), { saved: true });
  assert.equal(store.sets.length, 1);
  assert.equal(store.data.get(PRIMER_KEY), '{"v":1,"acts":{"act-0":{"seen":true,"skipped":false,"read":["c-one","c-two"]}}}');
});

test('readPrimers: an older version reads as ok', () => {
  const r = read(at('{"v":0,"acts":{"act-0":{"seen":true}}}'));
  assert.equal(r.status, 'ok');
  assert.equal(r.acts.get('act-0').seen, true);
});

test('readPrimers: read-side caps keep at most 50 acts and 50 read ids per act', () => {
  const acts = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`act-${String(i).padStart(2, '0')}`, { seen: true, read: [] }]));
  assert.equal(read(at(JSON.stringify({ v: 1, acts }))).acts.size, 50);
  const many = Array.from({ length: 60 }, (_, i) => `c-${String(i).padStart(2, '0')}`);
  assert.equal(read(at(JSON.stringify({ v: 1, acts: { 'act-0': { read: many } } }))).acts.get('act-0').read.length, 50);
});

test('recordPrimer: a null change is a no-op merge, not a throw', () => {
  const store = at();
  assert.deepEqual(recordPrimer(() => store, 'act-0', null), { saved: true });
  assert.deepEqual(read(store).acts.get('act-0'), entry(false, false, []));
});

test('recordPrimer: seen and skipped are never unset by a later record', () => {
  const store = at();
  recordPrimer(() => store, 'act-0', { seen: true, skipped: true });
  recordPrimer(() => store, 'act-0', { seen: false, skipped: false });
  assert.deepEqual(read(store).acts.get('act-0'), entry(true, true, []));
});

test('mergePrimerEntry: commutative, idempotent, associative', () => {
  const a = entry(true, false, ['c-one']);
  const b = entry(false, true, ['c-two', 'c-one']);
  const c = entry(false, false, ['c-three']);
  assert.deepEqual(mergePrimerEntry(a, b), mergePrimerEntry(b, a));
  assert.deepEqual(mergePrimerEntry(a, a), a);
  assert.deepEqual(mergePrimerEntry(mergePrimerEntry(a, b), c), mergePrimerEntry(a, mergePrimerEntry(b, c)));
  assert.deepEqual(mergePrimerEntry(a, b), entry(true, true, ['c-one', 'c-two']));
  assert.deepEqual(mergePrimerEntry(undefined, undefined), entry(false, false, []));
});

test('recordPrimer: a newer version is refused and left byte-unchanged', () => {
  const text = '{"v":2,"acts":{"act-0":{"seen":true}},"x":1}';
  const store = at(text);
  assert.deepEqual(recordPrimer(() => store, 'act-0', { seen: true }), { saved: false, reason: 'future' });
  assert.equal(store.sets.length, 0);
  assert.equal(store.data.get(PRIMER_KEY), text);
});

test('recordPrimer: a throwing setItem, getItem or getter is unavailable', () => {
  assert.deepEqual(recordPrimer(() => fakeStorage({ throwOn: ['setItem'] }), 'act-0', { seen: true }), { saved: false, reason: 'unavailable' });
  assert.deepEqual(recordPrimer(() => fakeStorage({ throwOn: ['getItem'] }), 'act-0', { seen: true }), { saved: false, reason: 'unavailable' });
  assert.deepEqual(recordPrimer(blocked, 'act-0', { seen: true }), { saved: false, reason: 'unavailable' });
});

test('recordPrimer: a corrupt value is overwritten with no backup key', () => {
  const store = at('{bad');
  assert.deepEqual(recordPrimer(() => store, 'act-0', { seen: true }), { saved: true });
  assert.equal(store.data.get(PRIMER_KEY), '{"v":1,"acts":{"act-0":{"seen":true,"skipped":false,"read":[]}}}');
  assert.deepEqual([...store.data.keys()], [PRIMER_KEY]);
});

test('recordPrimer: unknown acts and unknown chapter ids already stored are kept', () => {
  const store = at('{"v":1,"acts":{"act-77":{"seen":true,"skipped":false,"read":["gone-chapter"]}}}');
  recordPrimer(() => store, 'act-0', { read: ['c-one'] });
  const r = read(store);
  assert.deepEqual(r.acts.get('act-77'), entry(true, false, ['gone-chapter']));
  assert.deepEqual(r.acts.get('act-0'), entry(false, false, ['c-one']));
});

test('recordPrimer: a 51st act is full and nothing is written', () => {
  const acts = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`act-${i + 10}`, { seen: true, skipped: false, read: [] }]));
  const text = JSON.stringify({ v: 1, acts });
  const store = at(text);
  assert.deepEqual(recordPrimer(() => store, 'act-0', { seen: true }), { saved: false, reason: 'full' });
  assert.equal(store.sets.length, 0);
  assert.equal(store.data.get(PRIMER_KEY), text);
  assert.deepEqual(recordPrimer(() => store, 'act-10', { read: ['c-one'] }), { saved: true }, 'a stored act still fits');
});

test('recordPrimer: more than 50 read ids for one act is full', () => {
  const store = at();
  const many = Array.from({ length: 51 }, (_, i) => `c-${i}`);
  assert.deepEqual(recordPrimer(() => store, 'act-0', { read: many }), { saved: false, reason: 'full' });
  assert.equal(store.sets.length, 0);
});

test('recordPrimer: a bad act id writes nothing', () => {
  const store = at();
  assert.deepEqual(recordPrimer(() => store, 'Bad Id', { seen: true }), { saved: false, reason: 'invalid' });
  assert.equal(store.sets.length, 0);
});
