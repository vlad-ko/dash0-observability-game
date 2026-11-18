// The tools that prove a level's words survived a move into a content file (#391):
// tools/js-strings.mjs (the string literals of a source file) and tools/level-words.mjs (wordDiff).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { literalSites } from '../tools/js-strings.mjs';
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

test('wordDiff: tags do not count, and a content id is not an added word', () => {
  const c = content();
  c.rows[1].label = '<b>Never</b>';
  assert.deepEqual(wordDiff(OLD, NEW, c), { lost: [], added: [] });
  c.rows.push({ id: 'zzz', label: 'Never' });
  assert.deepEqual(wordDiff(OLD, NEW, c).added, ['Never']);
});
