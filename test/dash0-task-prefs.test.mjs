// #509 P6 (D7): the In Dash0 tasks a player left out, per level (lib/dash0-task/prefs.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeStorage } from './helpers/fake-storage.mjs';
import { changeSkipped, clearSkipped, MAX_LEVELS, MAX_TASKS, readSkipped, recordSkipped, SKIPPED_KEY } from '../lib/dash0-task/prefs.mjs';

const stored = (store) => JSON.parse(store.data.get(SKIPPED_KEY));

test('a fresh store is empty and reading never writes', () => {
  const store = fakeStorage();
  const got = readSkipped(() => store);
  assert.equal(got.status, 'fresh');
  assert.equal(got.levels.size, 0);
  assert.equal(store.sets.length, 0);
});

test('record joins the ids already there, sorted, in one setItem; clear takes one out and drops an empty level', () => {
  const store = fakeStorage();
  assert.deepEqual(recordSkipped(() => store, 'lvl-a', ['t-b', 't-a']), { saved: true });
  assert.deepEqual(recordSkipped(() => store, 'lvl-a', ['t-a', 't-c']), { saved: true });
  assert.deepEqual(recordSkipped(() => store, 'lvl-b', ['t-z']), { saved: true });
  assert.deepEqual(stored(store), { v: 1, levels: { 'lvl-a': ['t-a', 't-b', 't-c'], 'lvl-b': ['t-z'] } });
  assert.equal(store.sets.length, 3);
  clearSkipped(() => store, 'lvl-a', 't-b');
  assert.deepEqual(readSkipped(() => store).levels.get('lvl-a'), ['t-a', 't-c']);
  clearSkipped(() => store, 'lvl-b', 't-z');
  assert.equal(readSkipped(() => store).levels.has('lvl-b'), false);
});

test('a change that changes nothing writes nothing', () => {
  const store = fakeStorage();
  clearSkipped(() => store, 'lvl-a', 't-a');
  assert.equal(store.sets.length, 0);
  recordSkipped(() => store, 'lvl-a', ['t-a']);
  recordSkipped(() => store, 'lvl-a', ['t-a']);
  assert.equal(store.sets.length, 1);
});

test('a corrupt value is overwritten, a newer version is never written, an unreadable store means memory only', () => {
  const corrupt = fakeStorage({ initial: { [SKIPPED_KEY]: '{nope' } });
  assert.equal(readSkipped(() => corrupt).status, 'corrupt');
  assert.deepEqual(recordSkipped(() => corrupt, 'lvl-a', ['t-a']), { saved: true });
  assert.deepEqual(stored(corrupt), { v: 1, levels: { 'lvl-a': ['t-a'] } });
  const future = fakeStorage({ initial: { [SKIPPED_KEY]: JSON.stringify({ v: 2, levels: { x: ['y'] } }) } });
  assert.deepEqual(recordSkipped(() => future, 'lvl-a', ['t-a']), { saved: false, reason: 'future' });
  assert.equal(future.sets.length, 0);
  const blocked = fakeStorage({ throwOn: ['getItem'] });
  assert.equal(readSkipped(() => blocked).status, 'unavailable');
  assert.deepEqual(recordSkipped(() => blocked, 'lvl-a', ['t-a']), { saved: false, reason: 'unavailable' });
  const full = fakeStorage({ throwOn: ['setItem'] });
  assert.deepEqual(recordSkipped(() => full, 'lvl-a', ['t-a']), { saved: false, reason: 'unavailable' });
});

test('bad ids and over-full stores are refused without writing; junk in a stored value is dropped', () => {
  const store = fakeStorage();
  assert.deepEqual(recordSkipped(() => store, 'Bad Id', ['t-a']), { saved: false, reason: 'invalid' });
  assert.deepEqual(recordSkipped(() => store, 'lvl-a', ['not valid!']), { saved: false, reason: 'invalid' });
  assert.deepEqual(recordSkipped(() => store, 'lvl-a', Array.from({ length: MAX_TASKS + 1 }, (_, i) => `t-${i}`)), { saved: false, reason: 'full' });
  assert.equal(store.sets.length, 0);
  const levels = Object.fromEntries(Array.from({ length: MAX_LEVELS }, (_, i) => [`lvl-${i}`, ['t-a']]));
  const crowded = fakeStorage({ initial: { [SKIPPED_KEY]: JSON.stringify({ v: 1, levels }) } });
  assert.deepEqual(changeSkipped(() => crowded, 'one-more', { add: ['t-a'] }), { saved: false, reason: 'full' });
  const junk = fakeStorage({ initial: { [SKIPPED_KEY]: JSON.stringify({ v: 1, levels: { 'lvl-a': ['t-a', 7, 'Bad Id'], 'Bad Level': ['t-a'], 'lvl-b': 'x', 'lvl-c': [] } }) } });
  assert.deepEqual([...readSkipped(() => junk).levels], [['lvl-a', ['t-a']]]);
});
