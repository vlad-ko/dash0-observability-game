// The shipped act primers (content/core/primers/, #389, docs/PRIMERS.md): valid against the live act
// ids, one strict-JSON file per primer, and every placeholder says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { ACTS } from '../levels/index.mjs';
import { PRIMERS } from '../content/core/primers/index.mjs';
import { validatePrimer, validatePrimers } from '../lib/primer.mjs';
import { readJsonModule } from './helpers/content-files.mjs';

const DIR = new URL('../content/core/primers/', import.meta.url);
const actIds = ACTS.map((a) => a.id);

test('every shipped primer validates against the live registry acts', () => {
  for (const p of PRIMERS) assert.deepEqual(validatePrimer(p, { actIds }), { ok: true, errors: [] }, p.act);
  assert.deepEqual(validatePrimers(PRIMERS, { actIds }), { ok: true, errors: [] });
});

test('the primers folder holds one <act>.mjs per primer and index.mjs, nothing else', () => {
  const files = readdirSync(DIR).filter((f) => f !== 'index.mjs').sort();
  assert.deepEqual(files, PRIMERS.map((p) => `${p.act}.mjs`).sort());
});

test('each primer file is strict JSON with no duplicate keys, and equals what the import gives', async () => {
  for (const p of PRIMERS) {
    const file = `${p.act}.mjs`;
    const { value, errors } = readJsonModule(new URL(file, DIR));
    assert.deepEqual(errors, [], file);
    assert.deepEqual(value, (await import(new URL(file, DIR))).default, file);
  }
});

test('every placeholder primer carries a PLACEHOLDER note, and act-0 is a placeholder in this phase', () => {
  for (const p of PRIMERS) {
    if (p.placeholder) assert.match(p.placeholderNote, /^PLACEHOLDER/, p.act);
  }
  assert.equal(PRIMERS.find((p) => p.act === 'act-0')?.placeholder, true);
});

test('no content file has a // Spec: line anywhere in its header (that marks level files)', () => {
  for (const p of PRIMERS) {
    const { comments } = readJsonModule(new URL(`${p.act}.mjs`, DIR));
    assert.ok(comments.length > 0, `${p.act}: a content file explains itself in a header comment`);
    assert.deepEqual(comments.filter((c) => /^\/\/\s*Spec:/.test(c)), [], p.act);
  }
});
