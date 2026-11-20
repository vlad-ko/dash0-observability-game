// Glossary terms in drawn text (lib/term-text.mjs, #442): the first-use rule, shared by primers and level screens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDom } from './helpers/dom.mjs';
import { createTermScope, glossHtml } from '../lib/term-text.mjs';

// Names and definitions deliberately differ from the ids, so a test that read the id instead would fail.
const GLOSSARY = {
  terms: [
    { id: 'span', name: 'Span unit', variants: [], definition: 'One unit of work.', act: 'a0', topic: 'Traces' },
    { id: 'trace', name: 'Trace path', variants: ['traces'], definition: 'The path of one request.', act: 'a0', topic: 'Traces' },
  ],
};
const gloss = (shown, ref = '') => `<span data-gloss="${ref}">${shown}</span>`;

test('glossHtml: the first resolved use of each term on a screen is a term, the rest and the unknown are plain words', () => {
  const html = `<p>A ${gloss('span', 'span')} and ${gloss('Span')} and ${gloss('x', 'nope')} and ${gloss('traces', 'trace')}</p>`;
  const dom = makeDom();
  dom.body.innerHTML = glossHtml(html, { glossary: GLOSSARY, prefix: 'lvterm-1' });
  const terms = [...dom.body.querySelectorAll('[data-term]')];
  assert.equal(terms.length, 2);
  assert.equal(terms[0].querySelector('button').textContent, 'span');
  const first = terms[0].querySelector('[role="tooltip"]');
  assert.equal(first.id, 'lvterm-1-1');
  assert.ok(first.textContent.includes('One unit of work.'));
  assert.ok(first.textContent.includes('Span unit'));
  assert.equal(terms[1].querySelector('button').textContent, 'traces');
  assert.equal(terms[1].querySelector('[role="tooltip"]').id, 'lvterm-1-2');
  for (const pop of dom.body.querySelectorAll('[role="tooltip"]')) pop.remove();
  assert.equal(dom.body.querySelector('p').textContent, 'A span and Span and x and traces');
  assert.equal(dom.body.innerHTML.includes('data-gloss'), false);
});

test('glossHtml: html with no gloss span is returned unchanged, and with no glossary every span is plain words', () => {
  const plain = '<p>One <b>span</b> &amp; more</p>';
  assert.equal(glossHtml(plain, { glossary: GLOSSARY, prefix: 'lvterm-1' }), plain);
  assert.equal(glossHtml(`<p>${gloss('span', 'span')}</p>`, { glossary: null, prefix: 'lvterm-1' }), '<p>span</p>');
});

test('glossHtml: a screen has its own scope, so the same term is a control again on the next screen', () => {
  const html = `<p>${gloss('span', 'span')}</p>`;
  const a = glossHtml(html, { glossary: GLOSSARY, prefix: 'lvterm-1' });
  const b = glossHtml(html, { glossary: GLOSSARY, prefix: 'lvterm-2' });
  assert.ok(a.includes('id="lvterm-1-1"'));
  assert.ok(b.includes('id="lvterm-2-1"'));
});

test('createTermScope: use() escapes the words it does not draw as a term', () => {
  const scope = createTermScope({ glossary: GLOSSARY, prefix: 'p' });
  assert.equal(scope.use('a<b', 'nope'), 'a&lt;b');
  assert.ok(scope.use('span', 'span').includes('data-term'));
  assert.equal(scope.use('Span unit', null), 'Span unit', 'the short form resolves by name, and the term is already drawn');
});
