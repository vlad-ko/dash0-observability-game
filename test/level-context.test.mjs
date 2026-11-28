// lib/level-context.mjs: the one ctx a level's run() receives, in the app and the
// harness. Spec: docs/FOUNDATION.md §2.6 and §6 F3 level-context.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDom } from './helpers/dom.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import { lesson } from '../lib/ui/index.mjs';
import { mountSide } from '../lib/widgets/help-ladder.mjs';
import { escapeHtml } from '../lib/lesson-kit.mjs';
import { sideColumn } from '../lib/ui/index.mjs';

const NOW = 1767225600000; // 2026-01-01T00:00:00.000Z
const LEVEL_A = { id: 'lvl-a', scored: true, scoring: { parMs: null } };

function setup({
  level = LEVEL_A,
  now = () => NOW,
  controller = new AbortController(),
  onFinish,
  reportError,
  onWidget,
} = {}) {
  const dom = makeDom();
  const calls = [];
  const reported = [];
  const ctx = createLevelContext({
    level,
    ovBody: dom.body,
    ovActions: dom.actions,
    now,
    shuffle: (a) => a,
    reduceMotion: true,
    onFinish: onFinish ?? ((...args) => calls.push(args)),
    signal: controller.signal,
    reportError: reportError ?? ((e) => reported.push(e)),
    onWidget,
  });
  return { dom, ctx, calls, controller, reported };
}

test('renderStep fills body and actions and scrolls the body to the top', () => {
  const { dom, ctx } = setup();
  dom.actions.innerHTML = '<button>old</button>';
  dom.body.scrollTop = 50;
  ctx.renderStep('<p>x</p>');
  assert.equal(dom.body.innerHTML, '<p>x</p>');
  assert.equal(dom.actions.innerHTML, '');
  assert.equal(dom.body.scrollTop, 0);
  ctx.renderStep('<p>y</p>', '<button id="go">Go</button>');
  assert.equal(dom.actions.innerHTML, '<button id="go">Go</button>');
  ctx.renderStep('<p>z</p>', null);
  assert.equal(dom.actions.innerHTML, '');
});

test('ctx.screen counts the screens the level has drawn: 0 before the first, then one per renderStep, empty actions included', () => {
  const { ctx } = setup();
  assert.equal(ctx.screen, 0);
  ctx.renderStep('<p>a</p>', '<button>Go</button>');
  assert.equal(ctx.screen, 1);
  ctx.renderStep('<p>b</p>');
  ctx.renderStep('<p>c</p>', '');
  assert.equal(ctx.screen, 3);
});

test('ctx exposes speech, escapeHtml, reduceMotion, the overlay elements and the signal', () => {
  const { dom, ctx, controller } = setup();
  // The lesson voice is the kit's glow card (#158), its API unchanged.
  assert.equal(ctx.speech('<b>hi</b>'), lesson('<b>hi</b>'));
  assert.equal(ctx.escapeHtml("<it's>"), '&lt;it&#39;s&gt;');
  assert.equal(ctx.reduceMotion, true);
  assert.equal(ctx.ovBody, dom.body);
  assert.equal(ctx.ovActions, dom.actions);
  assert.equal(ctx.signal, controller.signal);
});

test('ctx.shuffle returns a new array even when the injected shuffle is identity', () => {
  const { ctx } = setup();
  const input = Object.freeze([1, 2, 3]);
  const out = ctx.shuffle(input);
  assert.notEqual(out, input);
  assert.deepEqual(out, [1, 2, 3]);
  assert.deepEqual(input, [1, 2, 3]);
});

test('two mistakes then finish scores 3 stars and reports once to onFinish', () => {
  const { ctx, calls } = setup();
  ctx.mistake();
  ctx.mistake();
  const result = ctx.finish({ cards: ['c1'] });
  assert.deepEqual(result, { stars: 3, cards: ['c1'], text: '' });
  assert.deepEqual(calls, [
    ['lvl-a', { stars: 3, cards: ['c1'], text: '', at: '2026-01-01T00:00:00.000Z', mistakes: 2, hintsUsed: 0 }],
  ]);
});

test('onFinish carries the mistakes and hints of the run; a guide question counts as a hint', () => {
  const { ctx, calls } = setup();
  ctx.mistake();
  ctx.hint();
  ctx.askedGuide();
  ctx.finish();
  assert.equal(calls[0][1].mistakes, 1);
  assert.equal(calls[0][1].hintsUsed, 2);
});

test('a hint costs a star like a mistake', () => {
  const { ctx } = setup();
  ctx.hint();
  assert.equal(ctx.finish({ text: 'done' }).stars, 4);
});

test('finish with no argument is a clean 5-star run with empty text and cards', () => {
  const { ctx } = setup();
  assert.deepEqual(ctx.finish(), { stars: 5, cards: [], text: '' });
});

const PAR_60S = { id: 'lvl-a', scored: true, scoring: { parMs: 60000 } };

test('elapsed time is measured from creation: 61 s over a 60 s par costs a star', () => {
  const times = [NOW, NOW + 61000];
  const { ctx, calls } = setup({ level: PAR_60S, now: () => times.shift() });
  assert.equal(ctx.finish({ text: 'slow' }).stars, 4);
  assert.equal(calls[0][1].at, '2026-01-01T00:01:01.000Z');
});

test('59 s under a 60 s par keeps 5 stars', () => {
  const times = [NOW, NOW + 59000];
  const { ctx } = setup({ level: PAR_60S, now: () => times.shift() });
  assert.equal(ctx.finish({ text: 'quick' }).stars, 5);
});

test('a non-finite or out-of-range clock counts as no elapsed time and no date', () => {
  for (const bad of [NaN, 1e20]) {
    const times = [NOW, bad];
    const { ctx, calls, reported } = setup({ level: PAR_60S, now: () => times.shift() });
    assert.equal(ctx.finish({ text: 'clock' }).stars, 5);
    assert.equal(calls[0][1].at, null);
    assert.equal(reported.length, 1, 'a broken clock is reported');
  }
});

test('an onFinish that throws is reported; the player still gets the result once', () => {
  const boom = new Error('storage exploded');
  const { ctx, reported } = setup({
    onFinish: () => {
      throw boom;
    },
  });
  assert.deepEqual(ctx.finish({ text: 'done' }), { stars: 5, cards: [], text: 'done' });
  assert.deepEqual(reported, [boom]);
  assert.equal(ctx.finish({ text: 'again' }), null);
});

test('a throwing clock at finish: elapsed 0, no date, reported, one onFinish', () => {
  let n = 0;
  const now = () => {
    if (n++ > 0) throw new Error('clock gone');
    return NOW;
  };
  const { ctx, calls, reported } = setup({ level: PAR_60S, now });
  assert.equal(ctx.finish({ text: 'done' }).stars, 5);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].at, null);
  assert.equal(reported.length, 1);
});

test('a text whose toString throws becomes empty text, reported, one onFinish', () => {
  const { ctx, calls, reported } = setup();
  const text = {
    toString() {
      throw new Error('no string');
    },
  };
  assert.equal(ctx.finish({ text }).text, '');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].text, '');
  assert.equal(reported.length, 1);
});

test('a reportError that throws is swallowed; onFinish still fires once', () => {
  const reportError = () => {
    throw new Error('logger down');
  };
  const { ctx, calls } = setup({ level: PAR_60S, now: () => NaN, reportError });
  assert.deepEqual(ctx.finish({ text: 'x' }), { stars: 5, cards: [], text: 'x' });
  assert.equal(calls.length, 1);
  const thrower = setup({
    reportError,
    onFinish: () => {
      throw new Error('store down');
    },
  });
  assert.deepEqual(thrower.ctx.finish(), { stars: 5, cards: [], text: '' });
});

test('if building the result throws, nothing is latched and finish can be retried', () => {
  const { ctx, calls } = setup();
  const cards = ['c1'];
  cards[Symbol.iterator] = () => {
    throw new Error('bad cards');
  };
  assert.throws(() => ctx.finish({ cards }), /bad cards/);
  assert.equal(calls.length, 0);
  assert.ok(ctx.finish({ text: 'retry' }));
  assert.equal(calls.length, 1);
});

test('reportError defaults to console.error', (t) => {
  const seen = t.mock.method(console, 'error', () => {});
  const dom = makeDom();
  const ctx = createLevelContext({
    level: LEVEL_A,
    ovBody: dom.body,
    ovActions: dom.actions,
    onFinish: () => {
      throw new Error('x');
    },
    signal: new AbortController().signal,
  });
  ctx.finish();
  assert.equal(seen.mock.callCount(), 1);
});

test('finish(null) is a clean finish; non-string text is stringified', () => {
  assert.deepEqual(setup().ctx.finish(null), { stars: 5, cards: [], text: '' });
  assert.equal(setup().ctx.finish({ text: 42 }).text, '42');
  assert.equal(setup().ctx.finish({ text: null }).text, '');
});

test('the caller and onFinish get separate copies of cards', () => {
  const { ctx, calls } = setup();
  const cards = ['c1'];
  const result = ctx.finish({ cards });
  assert.notEqual(result.cards, cards);
  assert.notEqual(result.cards, calls[0][1].cards);
  result.cards.push('c2');
  assert.deepEqual(calls[0][1].cards, ['c1']);
  assert.deepEqual(cards, ['c1']);
});

test('a second finish returns null and does not call onFinish again', () => {
  const { ctx, calls } = setup();
  assert.ok(ctx.finish({ text: 'first' }));
  assert.equal(ctx.finish({ text: 'second' }), null);
  assert.equal(calls.length, 1);
});

test('finish after the overlay closed (signal aborted) returns null and reports nothing', () => {
  const { ctx, calls, controller } = setup();
  controller.abort();
  assert.equal(ctx.finish({ text: 'late' }), null);
  assert.equal(calls.length, 0);
});

test('non-array cards become an empty list', () => {
  const { ctx, calls } = setup();
  assert.deepEqual(ctx.finish({ cards: 'c1' }).cards, []);
  assert.deepEqual(calls[0][1].cards, []);
});

test('finish credits the level the ctx was created for, not whichever opened last', () => {
  const shared = new AbortController();
  const calls = [];
  const dom = makeDom();
  const make = (id) =>
    createLevelContext({
      level: { id, scored: true, scoring: { parMs: null } },
      ovBody: dom.body,
      ovActions: dom.actions,
      now: () => NOW,
      shuffle: (a) => a,
      reduceMotion: true,
      onFinish: (...args) => calls.push(args),
      signal: shared.signal,
    });
  const a = make('lvl-a');
  make('lvl-b');
  a.finish();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'lvl-a');
});

test('createLevelContext refuses missing deps', () => {
  const dom = makeDom();
  const base = {
    level: LEVEL_A,
    ovBody: dom.body,
    ovActions: dom.actions,
    signal: new AbortController().signal,
    onFinish: () => {},
  };
  assert.throws(() => createLevelContext({ ...base, onFinish: undefined }), TypeError);
  assert.throws(() => createLevelContext({ ...base, level: {} }), TypeError);
  assert.throws(() => createLevelContext({ ...base, signal: undefined }), TypeError);
  assert.throws(() => createLevelContext({ ...base, ovBody: undefined }), TypeError);
  assert.throws(() => createLevelContext({ ...base, ovActions: null }), TypeError);
  assert.throws(() => createLevelContext({ ...base, reportError: 'log' }), TypeError);
});

test('ctx.telemetry is the injected facade, null when absent', () => {
  const facade = { sessionId: 's-1', status: () => ({ state: 'off', host: null }) };
  const dom = makeDom();
  const base = {
    level: LEVEL_A,
    ovBody: dom.body,
    ovActions: dom.actions,
    signal: new AbortController().signal,
    onFinish: () => {},
  };
  assert.equal(createLevelContext({ ...base, telemetry: facade }).telemetry, facade);
  assert.equal(createLevelContext(base).telemetry, null);
  assert.equal(createLevelContext({ ...base, telemetry: undefined }).telemetry, null);
});

test('#17 P3 askedGuide costs one hint at finish and notifies once; off and abort stop it', () => {
  const { ctx, controller } = setup();
  let heard = 0;
  const off = ctx.onGuideHint(() => { heard += 1; });
  ctx.askedGuide();
  assert.equal(heard, 1);
  off();
  ctx.askedGuide();
  assert.equal(heard, 1, 'off stops the listener');
  assert.equal(ctx.finish().stars, 3, 'two answered questions are two hints');
  const second = setup();
  let late = 0;
  second.ctx.onGuideHint(() => { late += 1; });
  second.controller.abort();
  second.ctx.askedGuide();
  assert.equal(late, 0, 'abort drops the listeners');
  assert.equal(controller.signal.aborted, false);
});

test('#17 P3 a listener that throws is reported and does not stop the ask', () => {
  const { ctx, reported } = setup();
  let heard = 0;
  ctx.onGuideHint(() => { throw new Error('boom'); });
  ctx.onGuideHint(() => { heard += 1; });
  ctx.askedGuide();
  assert.equal(reported.length, 1);
  assert.equal(heard, 1);
  assert.equal(ctx.finish().stars, 4);
});

test('#17 P3 the optional guide dep is passed through, null when absent', () => {
  assert.equal(setup().ctx.guide, null);
  const guide = { configured: true };
  const dom = makeDom();
  const ctx = createLevelContext({ level: LEVEL_A, ovBody: dom.body, ovActions: dom.actions, onFinish() {}, signal: new AbortController().signal, guide });
  assert.equal(ctx.guide, guide);
});

test('#17 P3 board stars equal level stars after one guide ask and one hint', () => {
  const { ctx, dom } = setup();
  dom.body.innerHTML = `<div id="box">${sideColumn({ id: 'g1', titleHtml: 'Done', counts: [{ key: 'wrong', label: '' }], hints: true, ruleHtml: '' })}</div>`;
  const side = mountSide(ctx, dom.body.querySelector('#box'), 'g1', {});
  const draw = (hints) => side.score({ wrong: 0, wrongLabel: 'wrong', hints, done: false });
  draw(0);
  ctx.askedGuide();
  ctx.hint();
  const board = draw(1);
  assert.equal(board, ctx.finish().stars);
  assert.equal(board, 3);
});

test('#17 P3 an ask after finish is no charge and tells nobody', () => {
  const { ctx, calls } = setup();
  let heard = 0;
  ctx.onGuideHint(() => { heard += 1; });
  const result = ctx.finish();
  ctx.askedGuide();
  assert.equal(heard, 0);
  assert.equal(result.stars, 5);
  assert.equal(calls.length, 1);
});

test('widget(key) tells onWidget which widget the step now shows; nothing after the signal aborts', () => {
  const seen = [];
  const { ctx, controller } = setup({ onWidget: (k) => seen.push(k) });
  ctx.widget('choice');
  ctx.widget('sort');
  assert.deepEqual(seen, ['choice', 'sort']);
  controller.abort();
  ctx.widget('build');
  assert.deepEqual(seen, ['choice', 'sort'], 'a stale step reports nothing');
});

test('widget(key) is a no-op without onWidget, and a throwing onWidget is reported, never thrown', () => {
  const { ctx } = setup();
  assert.doesNotThrow(() => ctx.widget('choice'));
  const { ctx: bad, reported } = setup({ onWidget: () => { throw new Error('boom'); } });
  assert.doesNotThrow(() => bad.widget('choice'));
  assert.equal(reported.length, 1);
});

test('createLevelContext refuses an onWidget that is not a function', () => {
  assert.throws(() => setup({ onWidget: 'nope' }), /onWidget/);
});

// ---- glossary terms in a drawn screen (#442) ----

test('renderStep draws each term once per screen, wires the body, and never glosses the actions', () => {
  const glossary = { terms: [{ id: 'span', name: 'Span unit', variants: [], definition: 'One unit of work.', act: 'a0', topic: 'Traces' }] };
  const dom = makeDom();
  const calls = [];
  const termPops = { wire: (root) => calls.push(['wire', root === dom.body]), closeAll: () => calls.push(['closeAll']) };
  const ctx = createLevelContext({
    level: LEVEL_A, ovBody: dom.body, ovActions: dom.actions, now: () => NOW, shuffle: (a) => a, reduceMotion: true,
    onFinish: () => {}, signal: new AbortController().signal, reportError: () => {}, glossary, termPops,
  });
  const g = (s) => `<span data-gloss="span">${s}</span>`;
  ctx.renderStep(`<p>${g('span')} and ${g('spans')}</p>`, `<button>${g('span')}</button>`);
  assert.equal(dom.body.querySelectorAll('[data-term]').length, 1);
  assert.equal(dom.body.querySelector('[role="tooltip"]').id, 'lvterm-1-1');
  assert.equal(dom.actions.innerHTML, `<button>${g('span')}</button>`);
  ctx.renderStep(`<p>${g('span')}</p>`);
  assert.equal(dom.body.querySelectorAll('[data-term]').length, 1, 'a new screen is a new scope');
  assert.equal(dom.body.querySelector('[role="tooltip"]').id, 'lvterm-2-1');
  assert.deepEqual(calls, [['closeAll'], ['wire', true], ['closeAll'], ['wire', true]]);
});

test('renderStep without a glossary or term popovers reads a marked term as plain words', () => {
  const { dom, ctx } = setup();
  ctx.renderStep('<p>a <span data-gloss="span">span</span></p>');
  assert.equal(dom.body.innerHTML, '<p>a span</p>');
});

test('renderStep after the signal aborts draws but never touches the term popovers', () => {
  const dom = makeDom();
  const calls = [];
  const controller = new AbortController();
  const ctx = createLevelContext({
    level: LEVEL_A, ovBody: dom.body, ovActions: dom.actions, now: () => NOW, shuffle: (a) => a, reduceMotion: true,
    onFinish: () => {}, signal: controller.signal, reportError: () => {}, termPops: { wire: () => calls.push('wire'), closeAll: () => calls.push('closeAll') },
  });
  controller.abort();
  ctx.renderStep('<p>x</p>');
  assert.deepEqual(calls, []);
});

// ---- ctx.gloss and ctx.wireTerms: marked terms in feedback share the screen (#442) ----

const TERMS = {
  terms: [
    { id: 'span', name: 'Span unit', variants: [], definition: 'One unit of work.', act: 'a0', topic: 'Traces' },
    { id: 'trace', name: 'Trace path', variants: [], definition: 'The path of one request.', act: 'a0', topic: 'Traces' },
  ],
};
const g = (shown, ref) => `<span data-gloss="${ref}">${shown}</span>`;

function glossSetup({ glossary = TERMS, termPops, controller = new AbortController() } = {}) {
  const dom = makeDom();
  const ctx = createLevelContext({
    level: LEVEL_A, ovBody: dom.body, ovActions: dom.actions, now: () => NOW, shuffle: (a) => a, reduceMotion: true,
    onFinish: () => {}, signal: controller.signal, reportError: () => {}, glossary, termPops,
  });
  return { dom, ctx, controller };
}

test('ctx.gloss shares the screen renderStep drew, and a new screen restarts the numbering', () => {
  const { ctx } = glossSetup();
  ctx.renderStep(`<p>${g('span', 'span')}</p>`);
  const html = ctx.gloss(`<p>${g('span', 'span')} and ${g('trace', 'trace')}</p>`, 'fb');
  assert.equal((html.match(/data-term/g) ?? []).length, 1, 'span is already on the screen');
  assert.ok(html.includes('id="lvterm-1-2"'), html);
  ctx.renderStep('<p>plain</p>');
  assert.ok(ctx.gloss(g('trace', 'trace'), 'fb').includes('id="lvterm-2-1"'));
});

test('ctx.gloss releases what its owner drew before, so replaced feedback gives its terms back', () => {
  const { ctx } = glossSetup();
  ctx.renderStep('<p>plain</p>');
  const owner = {};
  assert.ok(ctx.gloss(g('trace', 'trace'), owner).includes('lvterm-1-1'));
  assert.ok(ctx.gloss(g('trace', 'trace'), owner).includes('lvterm-1-2'), 'the same owner may draw it again');
  assert.equal(ctx.gloss(g('trace', 'trace'), {}), 'trace', 'another owner may not while it is on screen');
});

test('a body with no gloss span still opens the screen, so feedback can draw a term', () => {
  const { ctx } = glossSetup();
  ctx.renderStep('<p>plain words</p>');
  assert.ok(ctx.gloss(g('span', 'span'), 'fb').includes('data-term'));
});

test('ctx.gloss before the first renderStep, or with no glossary, reads plain words; wireTerms is safe with no popovers', () => {
  const early = glossSetup().ctx;
  assert.equal(early.gloss(`a ${g('span', 'span')}`, 'fb'), 'a span');
  assert.doesNotThrow(() => early.wireTerms());
  const none = glossSetup({ glossary: null }).ctx;
  none.renderStep('<p>x</p>');
  assert.equal(none.gloss(g('span', 'span'), 'fb'), 'span');
  assert.equal(none.gloss('<p>no span</p>', 'fb'), '<p>no span</p>');
});

test('wireTerms wires the card body, and nothing after the signal aborts', () => {
  const calls = [];
  const { dom, ctx, controller } = glossSetup({ termPops: { wire: (root) => calls.push(root === dom.body ? 'body' : 'other'), closeAll: () => {} } });
  ctx.renderStep('<p>x</p>');
  calls.length = 0;
  ctx.wireTerms();
  assert.deepEqual(calls, ['body']);
  controller.abort();
  ctx.wireTerms();
  assert.equal(calls.length, 1);
});
