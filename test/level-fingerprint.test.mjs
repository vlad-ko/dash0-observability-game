// tools/level-fingerprint.mjs: a canonical, order-independent text form of every level's exports,
// diffed before and after a content move to prove nothing the player sees changed (#391).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, shownValue, writeFingerprints } from '../tools/level-fingerprint.mjs';
import { ACTS } from '../levels/index.mjs';

test('shownValue unwraps gloss spans and nothing else, at any depth', () => {
  const fn = () => {};
  const out = shownValue({ a: 'x <span data-gloss="span">spans</span>', b: 'p99 < 1s', c: [{ d: '<span data-gloss="">Signals</span>' }], f: fn, n: 3, z: null });
  assert.deepEqual(out, { a: 'x spans', b: 'p99 < 1s', c: [{ d: 'Signals' }], f: fn, n: 3, z: null });
  assert.equal(shownValue('<span data-gloss="a">1</span> and <span data-gloss="b">2</span>'), '1 and 2', 'each span on its own, not greedy');
  const re = /x/;
  assert.equal(shownValue(re), re, 'a non-plain object is left whole');
});

test('canonical sorts keys, keeps array order and prints a function as "[function]"', () => {
  assert.equal(canonical({ b: 1, a: [2, 1], f() {} }), '{"a":[2,1],"b":1,"f":"[function]"}');
});

test('canonical does not depend on key order, at any depth', () => {
  assert.equal(canonical({ x: { b: 1, a: 2 }, y: 3 }), canonical({ y: 3, x: { a: 2, b: 1 } }));
});

test('canonical tells two different values apart', () => {
  assert.notEqual(canonical({ a: [1, 2] }), canonical({ a: [2, 1] }));
  assert.notEqual(canonical({ a: 'x' }), canonical({ a: 'y' }));
  assert.notEqual(canonical({ a: undefined }), canonical({ a: null }));
});

test('a level fingerprint holds its copy, its default export and every named export', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fp-c-'));
  try {
    await writeFingerprints(dir);
    const exported = Object.keys(await import('../levels/baggage.mjs')).sort();
    assert.ok(exported.includes('CONTENT') && exported.includes('default'), 'baggage has a named export besides default');
    const written = Object.keys(JSON.parse(readFileSync(join(dir, 'baggage.json'), 'utf8'))).sort();
    assert.deepEqual(written, exported, 'baggage.json has one top-level key per export of the module');
    const text = readFileSync(join(dir, 'good-alerts.json'), 'utf8');
    assert.ok(text.includes('The counter only grows, so a bigger threshold only delays the page'), 'a wrong-answer why is in the file');
    assert.match(text, /^ {2}"default": /m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeFingerprints writes one file per level, twice the same', async () => {
  const ids = ACTS.flatMap((a) => [...a.levels, ...(a.boss ? [a.boss] : [])]).map((l) => l.id);
  const a = mkdtempSync(join(tmpdir(), 'fp-a-'));
  const b = mkdtempSync(join(tmpdir(), 'fp-b-'));
  try {
    await writeFingerprints(a);
    await writeFingerprints(b);
    const files = readdirSync(a).sort();
    assert.deepEqual(files, ids.map((id) => `${id}.json`).sort());
    for (const f of files) assert.equal(readFileSync(join(a, f), 'utf8'), readFileSync(join(b, f), 'utf8'), f);
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});
