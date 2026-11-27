// The glossary (content/core/glossary/, one file per act, #427, #428): the real files are clean, each rule rejects a
// crafted bad input, the lookup maps names and variants to ids, and docs/GLOSSARY.md is exactly what the files generate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ACTS } from '../levels/index.mjs';
import { GLOSSARY, GLOSSARY_FILES } from '../content/core/glossary/index.mjs';
import { LIMITS, TOPIC_ORDER, glossaryDoc, glossaryIndex, joinGlossaryFiles, validateGlossary, validateGlossaryFiles } from '../lib/glossary.mjs';
import { readJsonModule } from './helpers/content-files.mjs';

const actIds = ACTS.map((a) => a.id);
const term = (over = {}) => ({ id: 'span', name: 'Span', variants: ['spans'], definition: 'One timed operation.', act: 'act-2', topic: 'Traces', ...over });
const gloss = (...terms) => ({ terms });
const problems = (g) => validateGlossary(g, { actIds });
const has = (g, re) => problems(g).some((p) => re.test(p));
// A file of the per-act layout: its terms carry no `act`, the file name says it.
const fileTerm = (over = {}) => { const { act, ...rest } = term(over); void act; return rest; };
const file = (name, ...terms) => ({ name, glossary: { terms } });
const fileProblems = (...files) => validateGlossaryFiles(files, { actIds });
const fileHas = (files, re) => validateGlossaryFiles(files, { actIds }).some((p) => re.test(p));

test('the shipped glossary files validate against the live registry acts', () => {
  assert.deepEqual(validateGlossaryFiles(GLOSSARY_FILES, { actIds }), []);
  assert.deepEqual(problems(GLOSSARY), []);
  assert.equal(GLOSSARY.terms.length, 215);
});

test('every glossary file is strict JSON with no duplicate keys, named general or after an act, and equals what the import gives', () => {
  for (const { name, glossary } of GLOSSARY_FILES) {
    const { value, errors } = readJsonModule(new URL(`../content/core/glossary/${name}.mjs`, import.meta.url));
    assert.deepEqual(errors, [], name);
    assert.deepEqual(value, glossary, name);
  }
});

test('every act with a glossary file is in the collector, in act order after general', () => {
  assert.deepEqual(GLOSSARY_FILES.map((f) => f.name), ['general', ...actIds.filter((id) => GLOSSARY_FILES.some((f) => f.name === id))]);
});

test('every .mjs file in content/core/glossary/ is in the collector, so no file drops its terms silently', () => {
  const onDisk = readdirSync(new URL('../content/core/glossary/', import.meta.url))
    .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs')
    .map((f) => f.slice(0, -'.mjs'.length))
    .sort();
  assert.deepEqual(GLOSSARY_FILES.map((f) => f.name).sort(), onDisk);
});

test('joinGlossaryFiles adds act from the file name: general gives null', () => {
  const joined = joinGlossaryFiles([file('general', fileTerm({ id: 'hint', name: 'Hint', variants: [] })), file('act-3', fileTerm())]);
  assert.deepEqual(joined.terms.map((t) => [t.id, t.act]), [['hint', null], ['span', 'act-3']]);
});

test('a duplicate id across two files is refused', () => {
  assert.ok(fileHas([file('act-2', fileTerm()), file('act-3', fileTerm({ name: 'Other', variants: [] }))], /act-3\.terms\[0\]\.id: duplicate id "span"/));
});

test('a duplicate name or variant across two files is refused', () => {
  const other = (over) => fileTerm({ id: 'other', name: 'Other', variants: [], ...over });
  assert.ok(fileHas([file('act-2', fileTerm()), file('act-3', other({ name: 'SPAN' }))], /act-3\.terms\[0\]\.name: "SPAN" is already used by "span"/));
  assert.ok(fileHas([file('act-2', fileTerm()), file('act-3', other({ variants: ['Spans'] }))], /act-3\.terms\[0\]\.variants\[0\]: "Spans" is already used by "span"/));
});

test('a file named for an act that does not exist is refused, and so is a repeated file name', () => {
  assert.ok(fileHas([file('act-99', fileTerm())], /act-99: file name must be "general" or an act id in the registry/));
  assert.ok(fileHas([file('act-2', fileTerm()), file('act-2', fileTerm({ id: 'other', name: 'Other', variants: [] }))], /act-2: more than one file/));
});

test('a term in a file that still has an act key is refused: the file name says the act', () => {
  assert.ok(fileHas([file('act-2', term())], /act-2\.terms\[0\]\.act: unknown key/));
});

test('a file that is not { terms: [...] } is refused, and clean files have no problems', () => {
  assert.ok(fileHas([{ name: 'act-2', glossary: {} }], /act-2\.terms: must be a non-empty array/));
  assert.ok(fileHas([{ name: 'act-2', glossary: { terms: [fileTerm()], extra: 1 } }], /act-2\.extra: unknown key/));
  assert.ok(fileHas('x', /files: must be a non-empty array/));
  assert.deepEqual(fileProblems(file('general', fileTerm({ id: 'hint', name: 'Hint', variants: [], topic: 'Foundations' })), file('act-2', fileTerm())), []);
  assert.doesNotThrow(() => validateGlossaryFiles([null, 3, { name: 'act-2' }], {}));
});

test('a topic must be one of TOPIC_ORDER', () => {
  assert.ok(has(gloss(term({ topic: 'Misc' })), /topic: "Misc" is not one of the topics/));
  assert.deepEqual([...TOPIC_ORDER], ['Foundations', 'OpenTelemetry', 'Traces', 'Metrics', 'Logs', 'Collector', 'Reliability', 'Dash0']);
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

test('glossaryIndex: when two terms claim one key, the first term wins, whatever the case', () => {
  const first = term({ id: 'first', name: 'First', variants: ['Spans'] });
  const second = term({ id: 'second', name: 'Second', variants: ['spans', 'SPANS'] });
  const index = glossaryIndex(gloss(first, second));
  assert.equal(index.get('spans'), 'first');
  assert.equal(index.get('second'), 'second', 'the second term keeps its own keys');
  assert.equal(glossaryIndex(gloss(second, first)).get('spans'), 'second');
});

test('glossaryIndex over the shipped glossary resolves each term by its name', () => {
  const index = glossaryIndex(GLOSSARY);
  for (const t of GLOSSARY.terms) {
    assert.equal(index.get(t.name.toLowerCase()), t.id, t.id);
    for (const v of t.variants) assert.equal(index.get(v.toLowerCase()), t.id, `${t.id}: ${v}`);
  }
});

test('glossaryDoc groups terms by topic in TOPIC_ORDER, the terms of a topic in the order given, one bullet each, with the act', () => {
  const doc = glossaryDoc(gloss(
    term({ id: 'a', name: 'A', variants: [], definition: 'First.', act: 'act-2', topic: 'Traces' }),
    term({ id: 'b', name: 'B', variants: [], definition: 'Second.', act: null, topic: 'Foundations' }),
    term({ id: 'c', name: 'C', variants: [], definition: 'Third.', act: 'act-3', topic: 'Traces' }),
  ));
  assert.match(doc, /generated/i);
  assert.match(doc, /content\/core\/glossary\//);
  assert.doesNotMatch(doc, /glossary\.mjs/);
  assert.match(doc, /node tools\/build-glossary-doc\.mjs/);
  const tracesAt = doc.indexOf('## Traces');
  const foundationsAt = doc.indexOf('## Foundations');
  assert.ok(foundationsAt > 0 && tracesAt > foundationsAt, 'Foundations comes first although its term came second');
  assert.match(doc, /## Foundations\n\n- \*\*B\*\*: Second\.\n\n## Traces\n\n- \*\*A\*\*: First\. \(Act 2\)\n- \*\*C\*\*: Third\. \(Act 3\)\n/);
});

test('a topic outside TOPIC_ORDER is still shown, after the known ones', () => {
  const doc = glossaryDoc(gloss(term({ id: 'a', name: 'A', topic: 'Misc' }), term({ id: 'b', name: 'B', topic: 'Dash0' })));
  assert.ok(doc.indexOf('## Dash0') < doc.indexOf('## Misc'));
});

test('the shipped doc lists the general terms first within a topic, then the acts in act order', () => {
  const foundations = glossaryDoc(GLOSSARY).split('## Metrics')[0].split('## OpenTelemetry')[0];
  const at = (name) => foundations.indexOf(`- **${name}**`);
  assert.ok(at('Hint') > 0 && at('Hint') < at('Observability') && at('Observability') < at('Cardinality'));
});

test('docs/GLOSSARY.md is exactly what `node tools/build-glossary-doc.mjs` writes from the files', () => {
  const committed = readFileSync(new URL('../docs/GLOSSARY.md', import.meta.url), 'utf8');
  assert.equal(committed, glossaryDoc(GLOSSARY), 'run: node tools/build-glossary-doc.mjs');
});
