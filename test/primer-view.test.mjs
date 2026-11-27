// The act primer pop-up and zone bodies (#389, #410, lib/primer-view.mjs): one primerView or primerZoneView screen drawn with the kit helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { primerView, primerZoneView } from '../lib/primer.mjs';
import { INTERNAL_LABEL, primerBodyHtml, primerZoneHtml } from '../lib/primer-view.mjs';

const link = (over = {}) => ({ type: 'link', kind: 'docs', label: 'Dash0 docs', url: 'https://www.dash0.com/docs', audience: 'public', ...over });
const source = (over = {}) => {
  const { type, ...rest } = link(over);
  return rest;
};

const PRIMER = {
  act: 'a0', placeholder: false, title: 'Primer',
  overview: [
    { type: 'paragraph', text: 'First paragraph.' },
    { type: 'list', items: ['one', 'two', 'three'] },
    { type: 'list', ordered: true, items: ['a', 'b'] },
    { type: 'code', text: 'export A=1\nexport B=2', wrap: true },
    { type: 'code', text: 'plain' },
    { type: 'callout', tone: 'warning', text: 'Mind the gap.' },
    link(),
    link({ kind: 'claap', label: 'Team video', url: 'https://app.claap.io/x', audience: 'internal' }),
  ],
  chapters: [
    { id: 'c-one', title: 'One', blocks: [{ type: 'paragraph', text: 'Body.' }], sources: [source(), source({ kind: 'claap', label: 'Internal talk', url: 'https://claap.io/t', audience: 'internal' })] },
  ],
};

const draw = (view, opts) => parseHTML(`<!doctype html><body><div id="r">${primerBodyHtml(view, opts)}</div></body>`).document.getElementById('r');
const overview = () => draw(primerView(PRIMER, -1));

test('a paragraph is a p inside the prose block', () => {
  assert.equal(overview().querySelector('.ui-prose p').textContent, 'First paragraph.');
});

test('a list is a ul or an ol with one li per item', () => {
  const root = overview();
  assert.equal(root.querySelectorAll('ul:not([class]) > li').length, 3);
  assert.equal(root.querySelectorAll('ol > li').length, 2);
});

test('code is a pre.ui-code that soft-wraps only when asked', () => {
  const pres = [...overview().querySelectorAll('pre.ui-code')];
  assert.equal(pres.length, 2);
  assert.equal(pres[0].querySelector('code').textContent, 'export A=1\nexport B=2');
  assert.equal(pres[0].hasAttribute('data-wrap'), true);
  assert.equal(pres[1].hasAttribute('data-wrap'), false);
});

test('a callout is a note that opens with a chip naming its tone', () => {
  const note = overview().querySelector('.ui-note');
  assert.equal(note.querySelector('.ui-chip').textContent, 'Warning');
  assert.equal(note.querySelector('.ui-chip').getAttribute('data-tone'), 'attention');
  assert.match(note.textContent, /Mind the gap\./);
});

test('every callout tone has its own chip tone', () => {
  const tones = {};
  for (const tone of ['note', 'tip', 'warning']) {
    const v = primerView({ ...PRIMER, overview: [{ type: 'callout', tone, text: 'x' }] }, -1);
    tones[tone] = draw(v).querySelector('.ui-note .ui-chip').getAttribute('data-tone');
  }
  assert.deepEqual(tones, { note: 'neutral', tip: 'hint', warning: 'attention' });
});

test('an external link opens in a new tab without giving the page its opener', () => {
  for (const a of overview().querySelectorAll('a')) {
    assert.equal(a.getAttribute('target'), '_blank');
    assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
    assert.match(a.getAttribute('href'), /^https:\/\//);
    assert.equal(a.hasAttribute('class'), false, 'a link is classless');
  }
});

test('an internal link says Dash0 team only and a public one does not', () => {
  const rows = [...overview().querySelectorAll('.ui-prose p')].filter((p) => p.querySelector('a'));
  assert.equal(rows.length, 2);
  const [pub, internal] = rows;
  assert.equal(pub.textContent.includes(INTERNAL_LABEL), false);
  assert.equal(internal.textContent.includes(INTERNAL_LABEL), true);
  assert.equal(internal.querySelector('.ui-chip[data-tone="attention"]').textContent, INTERNAL_LABEL);
  assert.match(pub.querySelector('.ui-chip').textContent, /docs/i, 'the kind chip');
});

test('text is escaped: markup in a primer never becomes an element', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const v = primerView({
    ...PRIMER,
    overview: [{ type: 'paragraph', text: evil }, { type: 'list', items: [evil] }, { type: 'code', text: evil }, { type: 'callout', tone: 'note', text: evil }, link({ label: evil })],
  }, -1);
  const root = draw(v);
  assert.equal(root.querySelectorAll('img').length, 0);
  assert.ok(root.textContent.includes(evil));
});

test('a link address cannot break out of its attribute, and a non-https address is not a link', () => {
  const quote = primerView({ ...PRIMER, overview: [link({ url: 'https://x.test/?a="b" onmouseover="alert(1)' })] }, -1);
  const a = draw(quote).querySelector('a');
  assert.equal(a.getAttributeNames().sort().join(), 'href,rel,target');
  const bad = primerView({ ...PRIMER, overview: [link({ url: 'javascript:alert(1)' })] }, -1);
  assert.equal(draw(bad).querySelectorAll('a').length, 0);
});

test('nothing it draws carries a style, an event handler or an Alpine attribute', () => {
  for (const screen of [-1, 0]) {
    const root = draw(primerView(PRIMER, screen), { draft: true });
    for (const el of root.querySelectorAll('*')) {
      for (const name of el.getAttributeNames()) {
        assert.equal(/^(style$|on|x-|@|:)/.test(name), false, `${el.localName} has ${name}`);
      }
    }
  }
});

test('a chapter shows its position, its blocks, then Sources with one link per source', () => {
  const root = draw(primerView(PRIMER, 0));
  const eyebrows = [...root.querySelectorAll('.ui-eyebrow')].map((e) => e.textContent);
  assert.deepEqual(eyebrows, ['Chapter 1 of 1', 'Sources']);
  assert.equal(root.querySelector('.ui-prose p').textContent, 'Body.');
  const items = [...root.querySelectorAll('li')];
  assert.equal(items.length, 2);
  assert.equal(items.every((li) => li.querySelectorAll('a').length === 1), true);
  assert.equal(items[0].textContent.includes(INTERNAL_LABEL), false);
  assert.equal(items[1].textContent.includes(INTERNAL_LABEL), true);
});

test('the overview has no position or Sources, and a placeholder primer is marked Draft', () => {
  const plain = overview();
  assert.deepEqual([...plain.querySelectorAll('.ui-eyebrow')].map((e) => e.textContent), []);
  assert.equal(plain.textContent.includes('Draft'), false);
  const draft = draw(primerView(PRIMER, -1), { draft: true });
  assert.equal(draft.querySelector('.ui-chip').textContent, 'Draft');
  assert.equal(draft.querySelector('.ui-chip').getAttribute('data-tone'), 'neutral');
});

// ---- the zone (#410) ----
const chap = (id, title) => ({ id, title, blocks: [{ type: 'paragraph', text: `About ${id}.` }], sources: [source()] });
const THREE = { ...PRIMER, chapters: [chap('c-one', 'One'), chap('c-two', 'Two'), chap('c-three', 'Three')] };
const drawZone = (primer, screen, stored, opts) =>
  parseHTML(`<!doctype html><body><div id="r">${primerZoneHtml(primerZoneView(primer, screen, stored, {}), opts)}</div></body>`).document.getElementById('r');

test('#509 the zone is not a step: no data-surface and no surface chip', () => {
  const root = drawZone(THREE, 1, { read: ['c-one'] });
  assert.equal(root.querySelectorAll('[data-surface]').length, 0);
  assert.equal(root.querySelector('.ui-step').firstElementChild.matches('.ui-chip'), false);
});

test('the zone is a wide step with a split: the chapter in the main column, the chapter list beside it', () => {
  const root = drawZone(THREE, 1, { read: ['c-one'] });
  assert.equal(root.firstElementChild.matches('.ui-step.ui-step--wide'), true);
  assert.equal(root.querySelectorAll('.ui-step.ui-step--wide > .ui-split').length, 1);
  const main = root.querySelector('.ui-split-main');
  assert.deepEqual([...main.querySelectorAll('.ui-eyebrow')].map((e) => e.textContent), ['Chapter 2 of 3', 'Sources']);
  const items = [...root.querySelectorAll('nav[aria-label="Chapters"] ol > li')];
  assert.equal(items.length, 3);
  const current = root.querySelectorAll('li[aria-current="step"]');
  assert.equal(current.length, 1);
  assert.equal(current[0].querySelector('button') === null, true);
  assert.equal(current[0].textContent.includes('Two'), true);
  assert.equal(root.querySelector('#primer-go-1') === null, true);
  for (const i of [0, 2]) {
    const b = root.querySelector(`#primer-go-${i}`);
    assert.equal(b.matches('button.ui-btn.ui-btn--ghost'), true);
  }
  const chips = root.querySelectorAll('.ui-chip[data-tone="success"]');
  assert.equal(chips.length, 1);
  assert.equal(chips[0].textContent, 'Read');
  assert.equal(items[0].contains(chips[0]), true);
});

test('the zone escapes a chapter title', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const primer = { ...THREE, chapters: [chap('c-one', evil), chap('c-two', evil), chap('c-three', 'Three')] };
  const root = drawZone(primer, 0, undefined);
  assert.equal(root.querySelectorAll('img').length, 0);
  assert.ok(root.textContent.includes(evil));
});

// ---- glossary terms (#429) ----
const GLOSSARY = {
  terms: [
    { id: 'signal', name: 'Signal', variants: ['signals'], definition: 'A kind of telemetry.', act: 'act-0', topic: 'Foundations' },
    { id: 'span', name: 'Span', variants: [], definition: 'One unit of work & <more>.', act: 'act-1', topic: 'Traces' },
  ],
};
const para = (text) => ({ type: 'paragraph', text });
const termPrimer = (overview, chapters) => ({
  ...PRIMER,
  overview,
  chapters: chapters.map((blocks, i) => ({ id: `c-${i}`, title: `T${i}`, blocks, sources: [source()] })),
});
const drawT = (primer, screen) => {
  const view = screen === -1 ? primerView(primer, -1) : primerZoneView(primer, screen, undefined, {});
  const html = screen === -1 ? primerBodyHtml(view, { glossary: GLOSSARY }) : primerZoneHtml(view, { glossary: GLOSSARY });
  return parseHTML(`<!doctype html><body><div id="r">${html}</div></body>`).document.getElementById('r');
};
const termsIn = (root) => [...root.querySelectorAll('[data-term]')];
const shownOf = (t) => t.querySelector('button').textContent;

test('terms: the first marked use of a term in a chapter is a term control, later uses are plain text', () => {
  const p = termPrimer([para('x')], [[para('A [[signal]], then [[signals]] and [[Signal|signal]].')]]);
  const root = drawT(p, 0);
  const terms = termsIn(root);
  assert.equal(terms.length, 1);
  assert.equal(shownOf(terms[0]), 'signal');
  const text = root.querySelector('.ui-prose p').textContent;
  assert.match(text, /then signals and Signal\./, 'later uses read as the shown text');
  assert.equal(root.querySelector('.ui-prose p').querySelectorAll('button').length, 1);
  assert.equal(root.textContent.includes('[['), false);
  assert.equal(root.textContent.includes('|signal'), false);
});

test('terms: "first" runs across a chapter, in paragraphs, list items and callouts, in the order read', () => {
  const p = termPrimer([para('x')], [[
    para('Plain.'),
    { type: 'list', items: ['one [[signal]]', 'two [[signal]] and [[span]]'] },
    { type: 'callout', tone: 'tip', text: 'A [[span]] and [[signal]].' },
    para('Again [[span]].'),
  ]]);
  const root = drawT(p, 0);
  const terms = termsIn(root);
  assert.deepEqual(terms.map(shownOf), ['signal', 'span'], 'two terms, each once');
  const items = [...root.querySelectorAll('li')];
  assert.equal(items[0].querySelectorAll('[data-term]').length, 1, 'the first list item holds the first use of signal');
  assert.equal(items[1].querySelectorAll('[data-term]').length, 1, 'the second holds the first use of span');
  assert.equal(root.querySelector('.ui-note').querySelectorAll('[data-term]').length, 0, 'both were already used');
});

test('terms: each chapter starts over, and so does the overview', () => {
  const body = [para('Use [[signal]] then [[signal]].')];
  const p = termPrimer(body, [body, body]);
  for (const screen of [-1, 0, 1]) {
    const terms = termsIn(drawT(p, screen));
    assert.equal(terms.length, 1, `screen ${screen}`);
  }
});

test('terms: unmarked text never changes, even a word that is a term name', () => {
  const p = termPrimer([para('A signal and a span.')], [[para('A signal and a span.')]]);
  for (const screen of [-1, 0]) {
    const root = drawT(p, screen);
    assert.equal(termsIn(root).length, 0);
    assert.equal(root.querySelector('.ui-prose p').textContent, 'A signal and a span.');
  }
});

test('terms: the control is a button described by a tooltip that is always in the DOM and hidden, with the name and definition', () => {
  const root = drawT(termPrimer([para('A [[unit|span]].')], [[para('x')]]), -1);
  const [term] = termsIn(root);
  const button = term.querySelector('button');
  assert.equal(button.getAttribute('type'), 'button');
  const pop = root.querySelector(`#${button.getAttribute('aria-describedby')}`);
  assert.ok(pop, 'aria-describedby names an element');
  assert.equal(term.contains(pop), true);
  assert.equal(pop.getAttribute('role'), 'tooltip');
  assert.equal(pop.hasAttribute('hidden'), true);
  assert.equal(button.textContent, 'unit', 'the shown text, not the term name');
  assert.match(pop.textContent, /^Span/);
  assert.equal(pop.textContent.includes('One unit of work & <more>.'), true, 'the definition, as text');
  assert.equal(pop.querySelectorAll('more').length, 0, 'escaped');
});

test('terms: every popover id on a screen is unique, and the pop-up and the zone never share one', () => {
  const p = termPrimer([para('[[signal]] [[span]]')], [[para('[[signal]] [[span]]')]]);
  const ids = (root) => termsIn(root).map((t) => t.querySelector('[role="tooltip"]').id);
  const overview = ids(drawT(p, -1));
  const chapter = ids(drawT(p, 0));
  assert.equal(new Set(overview).size, 2);
  assert.equal(new Set([...overview, ...chapter]).size, 4);
});

test('terms: no glossary, or a term it does not define, draws the shown text and never the marker', () => {
  const p = termPrimer([para('A [[signal]] and [[ghost|nope]].')], [[para('x')]]);
  const none = parseHTML(`<!doctype html><body><div id="r">${primerBodyHtml(primerView(p, -1))}</div></body>`).document.getElementById('r');
  assert.equal(termsIn(none).length, 0);
  assert.equal(none.querySelector('p').textContent, 'A signal and ghost.');
  const unknown = drawT(p, -1);
  assert.deepEqual(termsIn(unknown).map(shownOf), ['signal']);
  assert.equal(unknown.querySelector('p').textContent.includes('[['), false);
});

test('terms: a broken marker in a primer that skipped validation is shown as written, escaped', () => {
  const root = drawT(termPrimer([para('Odd [[<b>x')], [[para('x')]]), -1);
  assert.equal(root.querySelectorAll('b').length, 0);
  assert.equal(root.querySelector('p').textContent, 'Odd [[<b>x');
});

test('terms: a term in the zone sits in the main column, and the chapter list has none', () => {
  const root = drawT(termPrimer([para('x')], [[para('A [[signal]].')]]), 0);
  assert.equal(root.querySelector('.ui-split-main').querySelectorAll('[data-term]').length, 1);
  assert.equal(root.querySelector('nav').querySelectorAll('[data-term]').length, 0);
});

test('terms: nothing the term draws carries a style, an event handler or an Alpine attribute', () => {
  const root = drawT(termPrimer([para('A [[signal]] [[span]].')], [[para('A [[signal]].')]]), -1);
  for (const el of root.querySelectorAll('*')) {
    for (const name of el.getAttributeNames()) assert.equal(/^(style$|on|x-|@|:)/.test(name), false, `${el.localName} has ${name}`);
  }
});

test('nothing the zone draws carries a style, an event handler or an Alpine attribute', () => {
  for (const screen of [0, 2]) {
    const root = drawZone(THREE, screen, { read: ['c-one'] }, { draft: true });
    for (const el of root.querySelectorAll('*')) {
      for (const name of el.getAttributeNames()) {
        assert.equal(/^(style$|on|x-|@|:)/.test(name), false, `${el.localName} has ${name}`);
      }
    }
  }
});
