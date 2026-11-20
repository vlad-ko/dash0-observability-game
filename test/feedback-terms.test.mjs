// Glossary terms in answer feedback (#442, docs/CONTENT.md §5.1, docs/FOUNDATION.md §2.14): feedback shares the screen's
// first use, so a term already on the screen stays plain words and a term not yet drawn becomes a term. Real level
// context and widgets on a linkedom DOM; the glossary names and definitions differ from the ids on purpose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { makeDom, q, click } from './helpers/dom.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { mountSide } from '../lib/widgets/help-ladder.mjs';
import { sideColumn } from '../lib/ui/index.mjs';

const GLOSSARY = {
  terms: [
    { id: 'span', name: 'Span unit', variants: [], definition: 'One unit of work.', act: 'a0', topic: 'Traces' },
    { id: 'trace', name: 'Trace path', variants: [], definition: 'The path of one request.', act: 'a0', topic: 'Traces' },
  ],
};
const g = (shown, ref) => `<span data-gloss="${ref}">${shown}</span>`;
const LEVEL = { id: 'lvl-a', scored: true, scoring: { parMs: null } };

function setup() {
  const dom = makeDom();
  const wired = [];
  const termPops = {
    wire: (root) => wired.push([...root.querySelectorAll('[data-term]')].map((t) => t.querySelector('button').textContent)),
    closeAll: () => {},
  };
  const ctx = createLevelContext({
    level: LEVEL, ovBody: dom.body, ovActions: dom.actions, now: () => 0, shuffle: (a) => a, reduceMotion: true,
    onFinish: () => {}, signal: new AbortController().signal, reportError: () => {}, glossary: GLOSSARY, termPops,
  });
  return { dom, ctx, wired };
}

const CHOICES = [
  { key: 'a', label: 'Alpha', right: true, why: 'Yes.' },
  { key: 'b', label: 'Bravo', why: `A ${g('trace', 'trace')} and a ${g('span', 'span')}.` },
  { key: 'c', label: 'Charlie', why: `Also a ${g('trace', 'trace')}.` },
  { key: 'd', label: 'Delta', keep: true, why: 'No.' },
  { key: 'e', label: 'Echo', why: 'No.' },
];

function mountQuestion(ctx) {
  ctx.renderStep(`<p>The ${g('span', 'span')} comes first.</p>${choiceHtml(ctx, CHOICES, { id: 'q' })}`, '<button id="next" disabled>Next</button>');
  mountChoice(ctx, CHOICES, { id: 'q', onRight: () => q('#next') });
}

const termsIn = (el) => [...el.querySelectorAll('[data-term]')];

test('choice feedback: a wrong pick draws a term the screen has not drawn, leaves the drawn one plain and wires it', () => {
  const { ctx, wired } = setup();
  mountQuestion(ctx);
  assert.equal(termsIn(q('#q-feedback')).length, 0);
  click(q('[data-pick="b"]'));
  const fb = q('#q-feedback');
  const terms = termsIn(fb);
  assert.equal(terms.length, 1, 'span is already in the lesson: only trace is a term');
  assert.equal(terms[0].querySelector('button').textContent, 'trace');
  assert.ok(terms[0].querySelector('[role="tooltip"]').textContent.includes('The path of one request.'));
  assert.equal(fb.innerHTML.includes('data-gloss'), false);
  assert.ok(fb.textContent.includes('a span.'), 'the plain span reads as words');
  assert.deepEqual(wired.at(-1), ['span', 'trace'], 'wired once drawn, over the whole card body');
});

test('choice feedback: replaced feedback gives its term back, so the next wrong answer draws it again', () => {
  const { ctx } = setup();
  mountQuestion(ctx);
  click(q('[data-pick="b"]'));
  const first = termsIn(q('#q-feedback'))[0].querySelector('[role="tooltip"]').id;
  click(q('[data-pick="c"]'));
  const again = termsIn(q('#q-feedback'));
  assert.equal(again.length, 1);
  assert.notEqual(again[0].querySelector('[role="tooltip"]').id, first, 'popover ids never repeat');
  assert.equal(termsIn(q('#ov-body')).length, 2, 'one in the lesson, one in the feedback: no duplicates on screen');
});

test('choice feedback: the 50/50 line replaces a wrong answer and keeps its text, with the term drawn once', () => {
  const { ctx } = setup();
  mountQuestion(ctx);
  click(q('[data-pick="b"]'));
  click(q('#q-fifty'));
  const fb = q('#q-feedback');
  assert.equal(termsIn(fb).length, 1);
  assert.ok(fb.textContent.includes('50/50'));
  assert.equal(fb.innerHTML.includes('data-gloss'), false);
});

test('help ladder: a hint draws its term, and a closing that repeats it stays plain while the hint is on screen', () => {
  const { dom, ctx } = setup();
  ctx.renderStep(`<div id="box">${sideColumn({ id: 'g1', titleHtml: 'Done', counts: [{ key: 'wrong', label: '' }], hints: true, ruleHtml: '' })}</div>`);
  const side = mountSide(ctx, dom.body.querySelector('#box'), 'g1', {});
  side.showHint(`<p>Look at the ${g('trace', 'trace')}.</p>`, { focus: false });
  const hint = dom.body.querySelector('[id="g1-hint-text"]');
  assert.equal(termsIn(hint).length, 1);
  assert.equal(hint.innerHTML.includes('data-gloss'), false);
  side.succeed({ line: 'Done', closing: `<p>The ${g('trace', 'trace')} and the ${g('span', 'span')}.</p>` });
  const closing = dom.body.querySelector('[id="g1-win-closing"]');
  assert.deepEqual(termsIn(closing).map((t) => t.querySelector('button').textContent), ['span'], 'trace is still in the hint');
  assert.equal(closing.innerHTML.includes('data-gloss'), false);
  assert.ok(closing.textContent.includes('The trace and'));
});

test('no widget but tell.mjs calls setFeedback: every answer line goes through the one seam', () => {
  const dir = new URL('../lib/widgets/', import.meta.url);
  const offenders = readdirSync(dir)
    .filter((f) => f.endsWith('.mjs') && f !== 'tell.mjs')
    .filter((f) => /\bsetFeedback\(/.test(readFileSync(new URL(f, dir), 'utf8')));
  assert.deepEqual(offenders, []);
});
