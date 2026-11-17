// tools/level-fingerprint.mjs: a canonical, order-independent text form of every level's exports,
// diffed before and after a content move to prove nothing the player sees changed (#391).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, writeFingerprints } from '../tools/level-fingerprint.mjs';
import { ACTS } from '../levels/index.mjs';

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
