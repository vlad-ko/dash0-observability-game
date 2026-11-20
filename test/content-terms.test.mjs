// The glossary term marker in primer text (lib/content/terms.mjs, #429, docs/PRIMERS.md "Marking glossary terms"):
// parsing, the shown text that length limits count, and the lookup that resolves a marker to a term.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMarker, parseTerms, shownText, termLookup } from '../lib/content/terms.mjs';

const GLOSSARY = {
  terms: [
    { id: 'signal', name: 'Signal', variants: ['signals'], definition: 'A kind of telemetry.', act: 'act-0', topic: 'Foundations' },
    { id: 'span', name: 'Span', variants: [], definition: 'One unit of work.', act: 'act-1', topic: 'Traces' },
  ],
};

test('text with no marker is one plain part', () => {
  assert.deepEqual(parseTerms('Plain text, with [one] bracket.'), { ok: true, parts: [{ text: 'Plain text, with [one] bracket.' }] });
  assert.deepEqual(parseTerms('a[0]'), { ok: true, parts: [{ text: 'a[0]' }] });
});

test('a marker is the shown text and, after a bar, the term id; text around it stays', () => {
  assert.deepEqual(parseTerms('A [[span|span]] and [[signals]] end.'), {
    ok: true,
    parts: [{ text: 'A ' }, { shown: 'span', ref: 'span' }, { text: ' and ' }, { shown: 'signals', ref: null }, { text: ' end.' }],
  });
});

test('a marker at either end of the text is found', () => {
  assert.deepEqual(parseTerms('[[a]]').parts, [{ shown: 'a', ref: null }]);
  assert.deepEqual(parseTerms('[[a]][[b|c]]').parts, [{ shown: 'a', ref: null }, { shown: 'b', ref: 'c' }]);
});

test('broken markers are named, never thrown', () => {
  const bad = {
    '[[open': /not closed/,
    'close]]': /no opening/,
    '[[a [[b]] c]]': /nested/,
    '[[a[[b]]': /nested/,
    '[[]]': /no shown text/,
    '[[|span]]': /no shown text/,
    '[[ a ]]': /space/,
    '[[a|b|c]]': /one bar/,
    '[[a[b]]]': /bracket/,
  };
  for (const [text, why] of Object.entries(bad)) {
    const r = parseTerms(text);
    assert.equal(r.ok, false, text);
    assert.match(r.problem, why, text);
  }
  for (const v of [undefined, null, 4, {}]) assert.equal(parseTerms(v).ok, false);
});

test('shownText is what a reader sees, so a length limit counts it and not the marker', () => {
  assert.equal(shownText('A [[span|span]] and [[signals]].'), 'A span and signals.');
  assert.equal(shownText('no marker'), 'no marker');
  assert.equal(shownText('broken [[ marker'), 'broken [[ marker', 'a broken marker is judged elsewhere; the text is returned as written');
});

test('hasMarker is true for any bracket pair, so a title can refuse one', () => {
  assert.equal(hasMarker('x [[a]] y'), true);
  assert.equal(hasMarker('open [[ only'), true);
  assert.equal(hasMarker('close ]] only'), true);
  assert.equal(hasMarker('arr[0] is fine'), false);
});

test('termLookup resolves by id, or by name or variant without regard to case', () => {
  const look = termLookup(GLOSSARY);
  assert.equal(look.resolve('anything', 'span').id, 'span');
  assert.equal(look.resolve('SIGNALS', null).id, 'signal');
  assert.equal(look.resolve('signal', null).name, 'Signal');
  assert.equal(look.resolve('x', 'nope'), null);
  assert.equal(look.resolve('nothing', null), null);
  assert.equal(termLookup(null).resolve('signal', null), null);
  assert.equal(termLookup(GLOSSARY), look, 'one lookup per glossary');
});
