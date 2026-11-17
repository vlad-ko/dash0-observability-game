// The shared content text rules (lib/content/text-rules.mjs, #391).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCode, checkPlain, isId } from '../lib/content/text-rules.mjs';

const DASH = String.fromCharCode(0x2014);

test('checkPlain: clean text has no problems', () => {
  assert.deepEqual(checkPlain('A plain sentence, with a comma.'), []);
});

test('checkPlain: leading or trailing whitespace is a problem', () => {
  for (const s of [' x', 'x ', 'x\n']) assert.ok(checkPlain(s).some((p) => p.includes('whitespace')), JSON.stringify(s));
});

test('checkPlain: control characters, including newline and tab inside, are a problem', () => {
  for (const s of ['a\u0000b', 'a\u007fb', 'a\nb', 'a\tb']) assert.ok(checkPlain(s).some((p) => p.includes('control')), JSON.stringify(s));
});

test('checkPlain: an em dash is a problem, an en dash and a hyphen are not', () => {
  assert.ok(checkPlain(`a ${DASH} b`).some((p) => p.includes('em dash')));
  assert.deepEqual(checkPlain('a – b - c'), []);
});

test('checkPlain: a non-string is a problem and never throws', () => {
  for (const v of [undefined, null, 7, {}, []]) assert.deepEqual(checkPlain(v), ['must be a string']);
});

test('checkCode: newlines and tabs inside are allowed, other control characters and an em dash are not', () => {
  assert.deepEqual(checkCode('a\n\tb'), []);
  assert.ok(checkCode('a\u0000b').some((p) => p.includes('control')));
  assert.ok(checkCode(`a${DASH}b`).some((p) => p.includes('em dash')));
  assert.ok(checkCode(' a').some((p) => p.includes('whitespace')));
  assert.deepEqual(checkCode(3), ['must be a string']);
});

test('isId: kebab-case ids of at most 64 characters', () => {
  assert.equal(isId('act-0'), true);
  assert.equal(isId('a'.repeat(64)), true);
  for (const v of ['a'.repeat(65), 'Bad', 'a_b', '-a', 'a-', '', 7, null]) assert.equal(isId(v), false, String(v));
});
