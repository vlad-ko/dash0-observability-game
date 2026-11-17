// Text placeholders: `{{name}}` in content (lib/content/placeholders.mjs, #391, docs/CONTENT.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fill } from '../lib/content/placeholders.mjs';

test('fill: replaces each placeholder and reports the names used', () => {
  const r = fill('{{a}} + {{b-2}} = {{a}}{{b-2}}', { a: 'x', 'b-2': 'y' });
  assert.equal(r.text, 'x + y = xy');
  assert.deepEqual([...r.used].sort(), ['a', 'b-2']);
  assert.deepEqual(r.errors, []);
});

test('fill: text with no placeholder comes back unchanged', () => {
  const r = fill('plain <code>x</code> & more', {});
  assert.equal(r.text, 'plain <code>x</code> & more');
  assert.equal(r.used.size, 0);
});

test('fill: a name with no value is an error and the placeholder stays, never an empty string', () => {
  const r = fill('a {{gone}} b', { other: 1 }, 'play.finish');
  assert.equal(r.text, 'a {{gone}} b');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /play\.finish: .*\{\{gone\}\}.* no value/);
});

test('fill: a name on the prototype is not a value', () => {
  for (const name of ['constructor']) {
    const r = fill(`{{${name}}}`, {});
    assert.equal(r.errors.length, 1, name);
    assert.match(r.errors[0], /has no value/, name);
    assert.equal(r.text, `{{${name}}}`);
  }
});

test('fill: every other {{ is malformed', () => {
  for (const s of ['{{ a }}', '{{A}}', '{{1a}}', '{{}}', '{{a', '{{a}', '{{a-b c}}', '{{{a}}}x{{']) {
    const r = fill(s, { a: 1, 'a-b': 2 });
    assert.ok(r.errors.some((e) => /malformed/.test(e)), `${s} -> ${JSON.stringify(r.errors)}`);
  }
});

test('fill: a lone }} is plain text, as in shipped YAML copy', () => {
  const line = 'policies: [{name: slow, type: latency, latency: {threshold_ms: 500}}]';
  const r = fill(line, {});
  assert.equal(r.text, line);
  assert.deepEqual(r.errors, []);
});

test('fill: one pass, an inserted value is never scanned again', () => {
  const r = fill('{{a}}', { a: '{{b}}', b: 'x' });
  assert.equal(r.text, '{{b}}');
  assert.deepEqual(r.errors, []);
  assert.deepEqual([...r.used], ['a']);
});

test('fill: numbers print with String, zero included; other types and non-finite numbers are errors', () => {
  assert.equal(fill('{{n}}|{{z}}|{{f}}', { n: 5, z: 0, f: 1.5 }).text, '5|0|1.5');
  for (const bad of [NaN, Infinity, true, null, {}, [], () => 1, 10n]) {
    const r = fill('{{v}}', { v: bad });
    assert.equal(r.errors.length, 1, String(bad));
    assert.equal(r.text, '{{v}}');
  }
});

test('fill: an empty string is a value', () => {
  const r = fill('[{{e}}]', { e: '' });
  assert.equal(r.text, '[]');
  assert.deepEqual(r.errors, []);
});

test('fill: never throws, and finds every error in one string', () => {
  const r = fill('{{a}} {{ b }} {{c}}', {});
  assert.equal(r.errors.length, 3);
});
