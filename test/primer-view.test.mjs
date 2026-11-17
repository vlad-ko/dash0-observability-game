// The act primer pop-up body (#389, lib/primer-view.mjs): one primerView screen drawn with the kit helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { primerView } from '../lib/primer.mjs';
import { INTERNAL_LABEL, primerBodyHtml } from '../lib/primer-view.mjs';

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
