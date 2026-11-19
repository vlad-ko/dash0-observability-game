// levelSource (test/helpers/level-source.mjs): the one way a test reads a level's source text.
// It is the logic file plus the decoded string leaves of the level's content file
// (content/core/levels/<id>.mjs, which every level has), so source scans see the copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liveRegistry } from '../app.mjs';
import { levelSource } from './helpers/level-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_ROOT = join(ROOT, 'test', 'fixtures', 'level-source');
const EM_DASH = String.fromCharCode(0x2014);

test('every registered level has a content file', () => {
  const withoutContent = readdirSync(join(ROOT, 'levels'))
    .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs')
    .map((f) => f.slice(0, -4))
    .filter((id) => !existsSync(join(ROOT, 'content', 'core', 'levels', `${id}.mjs`)));
  const contentIds = readdirSync(join(ROOT, 'content', 'core', 'levels'))
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => f.slice(0, -4));
  assert.deepEqual(withoutContent, [], 'levels with no content file in content/core/levels/');
  assert.deepEqual(contentIds.sort(), Object.keys(liveRegistry().levels).sort(), 'the content files are exactly the registered levels');
});

test('with a content file, the logic text comes first and the decoded leaves follow', () => {
  const logic = readFileSync(join(FIXTURE_ROOT, 'levels', 'x.mjs'), 'utf8');
  const out = levelSource('x', { root: FIXTURE_ROOT });
  assert.ok(out.startsWith(`${logic}\n`));
  assert.ok(out.includes('say "hi"'), 'JSON escapes are decoded, not copied raw');
  assert.ok(!out.includes('say \\"hi\\"'), 'the raw escaped form is not in the output');
  assert.ok(out.includes('plain leaf'), 'nested leaves are included');
  assert.ok(out.includes('in an array'), 'array leaves are included');
  const lines = out.split('\n');
  assert.ok(lines.includes('plain leaf') && lines.includes('in an array'), 'each leaf is a whole line (the line-anchored scans depend on it)');
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
