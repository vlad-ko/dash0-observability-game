// levelSource (test/helpers/level-source.mjs): the one way a test reads a level's source text.
// Today it is the logic file; once a level's copy moves to content/core/levels/<id>.mjs it is
// the logic file plus the decoded string leaves of that file, so source scans keep seeing the copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { levelSource } from './helpers/level-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_ROOT = join(ROOT, 'test', 'fixtures', 'level-source');
const EM_DASH = String.fromCharCode(0x2014);

test('with no content file, levelSource is the level file exactly (every level)', () => {
  const ids = readdirSync(join(ROOT, 'levels')).filter((f) => f.endsWith('.mjs') && f !== 'index.mjs').map((f) => f.slice(0, -4));
  assert.ok(ids.length >= 50);
  for (const id of ids) {
    assert.equal(levelSource(id), readFileSync(join(ROOT, 'levels', `${id}.mjs`), 'utf8'), id);
  }
});

test('with a content file, the logic text comes first and the decoded leaves follow', () => {
  const logic = readFileSync(join(FIXTURE_ROOT, 'levels', 'x.mjs'), 'utf8');
  const out = levelSource('x', { root: FIXTURE_ROOT });
  assert.ok(out.startsWith(`${logic}\n`));
  assert.ok(out.includes('say "hi"'), 'JSON escapes are decoded, not copied raw');
  assert.ok(!out.includes('say \\"hi\\"'), 'the raw escaped form is not in the output');
  assert.ok(out.includes('plain leaf'), 'nested leaves are included');
  assert.ok(out.includes('in an array'), 'array leaves are included');
});

test('a dash in a content file is visible to a source scan', () => {
  const out = levelSource('x', { root: FIXTURE_ROOT });
  assert.ok(out.includes(EM_DASH), 'the em dash in the content fixture is found');
});

test('numbers and booleans in a content file are not text leaves', () => {
  const out = levelSource('x', { root: FIXTURE_ROOT });
  assert.ok(!out.includes('12345'));
});

test('a missing logic file throws rather than returning an empty string', () => {
  assert.throws(() => levelSource('does-not-exist', { root: FIXTURE_ROOT }), /ENOENT/);
});
