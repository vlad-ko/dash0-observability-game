// The tools that prove a level's words survived a move into a content file (#391):
// tools/js-strings.mjs (the string literals of a source file) and tools/level-words.mjs (wordDiff).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeOnly, literalSites } from '../tools/js-strings.mjs';
import { wordDiff } from '../tools/level-words.mjs';

// One line per entry, so the expected line numbers below are the 1-based index.
const SOURCE = [
  // Joined so test/static.test.mjs's import scanner does not read the fixture as a real import.
  'import x from ' + "'./has space/a.mjs';", // 1
  "// 'comment word' and \"another\"", // 2
  "/* 'block word'", // 3
  " still 'inside' */", // 4
  "const re = /'not a string'/g;", // 5
  "const a = 'Hello ' +", // 6
  "  'there, friend.';", // 7
  "const t = `Count ${n > 1 ? 'many things' : `one ${'inner word'}`} here`;", // 8
  "const q = 'it\\'s \\u{1F9F3}';", // 9
  "const x = y / 2; const e = 'after division';", // 10
].join('\n');

test('literalSites: strings and templates only, comments, regexes and imports skipped', () => {
  const sites = literalSites(SOURCE);
  assert.deepEqual(sites.map((s) => s.pieces), [
    ['Hello there, friend.'],
    ['Count ', ' here'],
    ['many things'],
    ['one ', ''],
    ['inner word'],
    ["it's \u{1F9F3}"],
    ['after division'],
  ]);
  assert.deepEqual(sites.map((s) => s.line), [6, 8, 8, 8, 8, 9, 10]);
});

test('literalSites: a slash after ++ or --, or after a property named like a keyword, is division', () => {
  const src = [
    "n = i++ / 2; const a = 'word';",
    "k = obj.in / 2; const c = 'word3';",
    "n = i-- / 2; const d = 'word4';",
  ].join('\n');
  assert.deepEqual(literalSites(src).map((s) => s.pieces[0]), ['word', 'word3', 'word4']);
});

const OLD = [
  "export default { rows: [{ id: 'a', label: 'Fine in baggage' }, { id: 'b', label: 'Never' }], done: (n) => `Done with ${n} items.` };",
].join('\n');
const NEW = [
  "const VARS = { 'n': 3 };",
  "export default { rows: [{ id: 'a', right: true }], VARS };",
].join('\n');
const content = () => ({
  rows: [{ id: 'a', label: 'Fine in baggage' }, { id: 'b', label: 'Never' }],
  finish: 'Done with {{n}} items.',
});

test('wordDiff: a faithful move loses and adds nothing', () => {
  assert.deepEqual(wordDiff(OLD, NEW, content()), { lost: [], added: [] });
});

test('wordDiff: a typo in the content is a lost word and an added word', () => {
  const c = content();
  c.rows[0].label = 'Fine in bagage';
  assert.deepEqual(wordDiff(OLD, NEW, c), { lost: ['baggage'], added: ['bagage'] });
});

test('wordDiff: a dropped entry loses its words, sorted', () => {
  const c = content();
  delete c.finish;
  assert.deepEqual(wordDiff(OLD, NEW, c).lost, ['Done', 'items.', 'with']);
});

test('wordDiff: a dropped word that is also an id is still lost', () => {
  const oldSrc = "export default { rows: [{ id: 'checkout', label: 'The checkout service is slow' }] };";
  const newSrc = "export default { rows: [{ id: 'checkout', right: true }] };";
  const c = { rows: [{ id: 'checkout', label: 'The service is slow' }] };
  assert.deepEqual(wordDiff(oldSrc, newSrc, c), { lost: ['checkout'], added: [] });
});

test('wordDiff: a code literal equal to a fill-in name is never compared, however often the code writes it', () => {
  const oldSrc = "export default { done: (n) => `Sent to ${n}.` };";
  const twice = "const SLOTS = ['where-to'];\nconst fill = { 'where-to': 1 };\nexport default { SLOTS, fill };";
  assert.deepEqual(wordDiff(oldSrc, twice, { done: 'Sent to {{where-to}}.' }), { lost: [], added: [] });
  const unquotedKey = "const VARS = { host: 'x' };\nconst b = 'host';\nexport default { VARS, b };";
  assert.deepEqual(wordDiff(oldSrc, unquotedKey, { done: 'Sent to {{host}}.' }), { lost: [], added: ['x'] });
});

test('wordDiff: a code literal equal to a fill-in name cannot cancel a dropped word of the same spelling', () => {
  const oldSrc = "export default { done: (host) => `Sent to ${host}, the host is down.` };";
  const newSrc = "const SLOTS = ['host'];\nexport default { SLOTS };";
  assert.deepEqual(wordDiff(oldSrc, newSrc, { done: 'Sent to {{host}}, the is down.' }), { lost: ['host'], added: [] });
});

test('wordDiff: a whyNot entry keyed id or key is text, not an id', () => {
  const oldSrc = "export default { a: 'Old words' };";
  const newSrc = 'export default {};';
  const c = { a: 'Old words', item: { whyNot: { id: 'Brand new reason', key: 'Another one' } } };
  assert.deepEqual(wordDiff(oldSrc, newSrc, c), { lost: [], added: ['Another', 'Brand', 'new', 'one', 'reason'].sort() });
});

test('wordDiff: tags do not count, and a new content id the old file never had is an added word', () => {
  const c = content();
  c.rows[1].label = '<b>Never</b>';
  assert.deepEqual(wordDiff(OLD, NEW, c), { lost: [], added: [] });
  c.rows.push({ id: 'zzz', label: 'Never' });
  assert.deepEqual(wordDiff(OLD, NEW, c).added, ['Never', 'zzz']);
});

test('wordDiff: a new content id the code does not hold is reported as added when the old file never had it', () => {
  const oldSrc = "ctx.say('Restart the now');";
  const newSrc = 'export const run = {};';
  const c = { run: { a: 'Restart the now', steps2: [{ id: 'pod' }] } };
  assert.deepEqual(wordDiff(oldSrc, newSrc, c), { lost: [], added: ['pod'] });
});

test('codeOnly: comments, strings, regexes and template text are blanked, template expressions and line breaks stay', () => {
  const src = [
    'const a = say.one; // say.two',
    '/* say.three',
    '   say.four */ const b = "say.five";',
    'const c = `say.six ${say.seven} say.eight`;',
    'const d = /say.nine/g; const e = x / 2 + say.ten;',
  ].join('\n');
  const code = codeOnly(src);
  assert.equal(code.length, src.length, 'same length');
  assert.equal(code.split('\n').length, 5, 'same lines');
  assert.deepEqual([...code.matchAll(/\bsay\.([a-z]+)\b/g)].map((m) => m[1]), ['one', 'seven', 'ten']);
});

test('codeOnly: masks stay in step after a character outside the Basic Multilingual Plane (an emoji)', () => {
  const src = 'const e = "\u{1F600}"; const f = say.after; // say.no';
  const code = codeOnly(src);
  assert.equal(code.length, src.length, 'same length');
  assert.ok(!code.includes('/'), `the comment is blanked, slashes included: ${code}`);
  assert.deepEqual([...code.matchAll(/\bsay\.([a-z]+)\b/g)].map((m) => m[1]), ['after']);
});

test('wordDiff: an id equal to a fill-in name is still the old file\'s id, not an added or lost word', () => {
  const oldSrc = "export default { rows: [{ id: 'host', label: 'Sent' }] };";
  const newSrc = "const VARS = { 'host': 1 };\nexport default { VARS, rows: [{ id: 'host' }] };";
  assert.deepEqual(wordDiff(oldSrc, newSrc, { rows: [{ id: 'host', label: 'Sent {{host}}' }] }), { lost: [], added: [] });
});
