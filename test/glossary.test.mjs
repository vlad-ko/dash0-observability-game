// The glossary (content/core/glossary.mjs, #428): the real module is clean, each rule rejects a crafted
// bad input, the lookup maps names and variants to ids, and docs/GLOSSARY.md is exactly what the module generates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTS } from '../levels/index.mjs';
import GLOSSARY from '../content/core/glossary.mjs';
import { LIMITS, glossaryDoc, glossaryIndex, validateGlossary } from '../lib/glossary.mjs';
import { readJsonModule } from './helpers/content-files.mjs';

const actIds = ACTS.map((a) => a.id);
const term = (over = {}) => ({ id: 'span', name: 'Span', variants: ['spans'], definition: 'One timed operation.', act: 'act-2', topic: 'Traces', ...over });
const gloss = (...terms) => ({ terms });
const problems = (g) => validateGlossary(g, { actIds });
const has = (g, re) => problems(g).some((p) => re.test(p));

test('the shipped glossary validates against the live registry acts', () => {
  assert.deepEqual(problems(GLOSSARY), []);
  assert.ok(GLOSSARY.terms.length >= 97, 'every old entry is in, so at least 97 terms');
});

test('the module file is strict JSON with no duplicate keys, and equals what the import gives', () => {
  const url = new URL('../content/core/glossary.mjs', import.meta.url);
  const { value, errors } = readJsonModule(url);
  assert.deepEqual(errors, []);
  assert.deepEqual(value, GLOSSARY);
});

test('a clean crafted glossary has no problems', () => {
  assert.deepEqual(problems(gloss(term(), term({ id: 'hint', name: 'Hint', variants: [], act: null, topic: 'Foundations' }))), []);
});

test('a glossary that is not { terms: [...] } is refused, whatever it is given', () => {
  for (const bad of [null, undefined, 3, 'x', [], {}, { terms: {} }, { terms: [] }]) assert.ok(problems(bad).length > 0, String(bad));
  assert.ok(has({ terms: [term()], extra: 1 }, /extra: unknown key/));
});

test('a term that is not an object, or has an unknown key, is refused', () => {
  assert.ok(has(gloss(null), /terms\[0\]: must be an object/));
  assert.ok(has(gloss(term({ colour: 'red' })), /colour: unknown key/));
});

test('an id must be lowercase kebab and unique', () => {
  assert.ok(has(gloss(term({ id: 'Span' })), /id: must be a kebab-case id/));
  assert.ok(has(gloss(term({ id: 'a_b' })), /id: must be a kebab-case id/));
  assert.ok(has(gloss(term({ id: undefined })), /id: must be a kebab-case id/));
  assert.ok(has(gloss(term(), term({ name: 'Other', variants: [] })), /duplicate id "span"/));
});

test('a name must be plain text of 1 to 60 characters', () => {
  assert.ok(has(gloss(term({ name: '' })), /name: must be 1-60 characters/));
  assert.ok(has(gloss(term({ name: 'x'.repeat(LIMITS.name + 1) })), /name: must be 1-60 characters/));
  assert.ok(has(gloss(term({ name: ' Span' })), /name: must not start or end with whitespace/));
  assert.ok(has(gloss(term({ name: 3 })), /name: must be a string/));
});

test('names and variants share one case-insensitive key space', () => {
  const other = (over) => term({ id: 'other', name: 'Other', variants: [], ...over });
  assert.ok(has(gloss(term(), other({ name: 'SPAN' })), /name: "SPAN" is already used by "span"/));
  assert.ok(has(gloss(term(), other({ variants: ['Spans'] })), /variants\[0\]: "Spans" is already used by "span"/));
  assert.ok(has(gloss(term(), other({ variants: ['span'] })), /variants\[0\]: "span" is already used by "span"/));
  assert.ok(has(gloss(term({ variants: ['Span'] })), /variants\[0\]: "Span" is already used by "span"/));
  assert.ok(has(gloss(term({ variants: ['spans', 'SPANS'] })), /variants\[1\]: "SPANS" is already used by "span"/));
});

test('variants must be an array of plain, non-empty strings', () => {
  assert.ok(has(gloss(term({ variants: 'spans' })), /variants: must be an array/));
  assert.ok(has(gloss(term({ variants: [''] })), /variants\[0\]: must be 1-60 characters/));
  assert.ok(has(gloss(term({ variants: [4] })), /variants\[0\]: must be a string/));
  assert.ok(has(gloss(term({ variants: undefined })), /variants: must be an array/));
});

test('a definition must be 1 to 240 characters', () => {
  assert.ok(has(gloss(term({ definition: '' })), /definition: must be 1-240 characters/));
  assert.ok(has(gloss(term({ definition: 'x'.repeat(LIMITS.definition + 1) })), /definition: must be 1-240 characters/));
  assert.deepEqual(problems(gloss(term({ definition: 'x'.repeat(LIMITS.definition) }))), []);
  assert.ok(has(gloss(term({ definition: undefined })), /definition: must be a string/));
});

test('a definition has no em dash, no edge whitespace and no control characters', () => {
  assert.ok(has(gloss(term({ definition: `One ${String.fromCharCode(0x2014)} two.` })), /definition: must not contain an em dash/));
  assert.ok(has(gloss(term({ definition: 'One. ' })), /definition: must not start or end with whitespace/));
  assert.ok(has(gloss(term({ definition: 'One.\nTwo.' })), /definition: must not contain control characters/));
});

test('a definition, a name and a variant carry no markup', () => {
  for (const bad of ['A <b>bold</b> span.', 'Use `code` here.', 'It is **bold**.', 'See [docs](https://x.y).', 'A <!-- note -->']) {
    assert.ok(has(gloss(term({ definition: bad })), /definition: must be plain text, without markup/), bad);
  }
  assert.ok(has(gloss(term({ name: '<i>Span</i>' })), /name: must be plain text, without markup/));
  assert.ok(has(gloss(term({ variants: ['`spans`'] })), /variants\[0\]: must be plain text, without markup/));
  assert.deepEqual(problems(gloss(term({ definition: 'A p99 < 1s check, and a span_metrics connector.' }))), []);
});

test('an act must be null or an act id in the registry', () => {
  assert.ok(has(gloss(term({ act: 'act-99' })), /act: "act-99" is not an act in the registry/));
  assert.ok(has(gloss(term({ act: undefined })), /act: undefined is not an act in the registry/));
  assert.ok(has(gloss(term({ act: 2 })), /act: 2 is not an act in the registry/));
  assert.deepEqual(problems(gloss(term({ act: null }))), []);
});

test('a topic must be plain text of 1 to 60 characters', () => {
  assert.ok(has(gloss(term({ topic: '' })), /topic: must be 1-60 characters/));
  assert.ok(has(gloss(term({ topic: undefined })), /topic: must be a string/));
});

test('validateGlossary reports every problem with its path and never throws', () => {
  const p = validateGlossary(gloss(term({ id: 'X', definition: '' })), {});
  assert.ok(p.some((m) => m.startsWith('terms[0].id:')));
  assert.ok(p.some((m) => m.startsWith('terms[0].act:')), 'no actIds given: no act is known');
  assert.doesNotThrow(() => validateGlossary(Symbol.iterator));
});

test('glossaryIndex maps every lowercase name and variant to its term id', () => {
  const index = glossaryIndex(gloss(term(), term({ id: 'quantile', name: 'Quantile / percentile', variants: ['Percentiles'], topic: 'Metrics' })));
  assert.equal(index.get('span'), 'span');
  assert.equal(index.get('spans'), 'span');
  assert.equal(index.get('quantile / percentile'), 'quantile');
  assert.equal(index.get('percentiles'), 'quantile');
  assert.equal(index.get('Span'), undefined, 'keys are lowercase; callers lowercase what they look up');
  assert.equal(index.size, 4);
});

test('glossaryIndex over the shipped glossary resolves each term by its name', () => {
  const index = glossaryIndex(GLOSSARY);
  for (const t of GLOSSARY.terms) {
    assert.equal(index.get(t.name.toLowerCase()), t.id, t.id);
    for (const v of t.variants) assert.equal(index.get(v.toLowerCase()), t.id, `${t.id}: ${v}`);
  }
});

test('glossaryDoc groups terms by topic in first-seen order, one bullet each, with the act', () => {
  const doc = glossaryDoc(gloss(
    term({ id: 'a', name: 'A', variants: [], definition: 'First.', act: 'act-2', topic: 'Traces' }),
    term({ id: 'b', name: 'B', variants: [], definition: 'Second.', act: null, topic: 'Foundations' }),
    term({ id: 'c', name: 'C', variants: [], definition: 'Third.', act: 'act-3', topic: 'Traces' }),
  ));
  assert.match(doc, /generated/i);
  assert.match(doc, /content\/core\/glossary\.mjs/);
  assert.match(doc, /node tools\/build-glossary-doc\.mjs/);
  const tracesAt = doc.indexOf('## Traces');
  const foundationsAt = doc.indexOf('## Foundations');
  assert.ok(tracesAt > 0 && foundationsAt > tracesAt);
  assert.match(doc, /- \*\*A\*\*: First\. \(Act 2\)\n- \*\*C\*\*: Third\. \(Act 3\)\n\n## Foundations\n\n- \*\*B\*\*: Second\.\n/);
});

test('docs/GLOSSARY.md is exactly what `node tools/build-glossary-doc.mjs` writes from the module', () => {
  const committed = readFileSync(new URL('../docs/GLOSSARY.md', import.meta.url), 'utf8');
  assert.equal(committed, glossaryDoc(GLOSSARY), 'run: node tools/build-glossary-doc.mjs');
});
