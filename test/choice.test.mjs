// The shared Choice widget (lib/widgets/choice.mjs; docs/M1-DESIGN.md §4.0): markup in
// ctx.shuffle order, one mistake per wrong pick, every outcome in words, and focus
// that never drops to the page. Level 1.2 runs on it (test/naming-your-service.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, q, qa, click } from './helpers/dom.mjs';
import { recordFocus } from './helpers/focus.mjs';
import { escapeHtml } from '../lib/lesson-kit.mjs';
import { choiceHtml, mountChoice, PENALTY, validateChoiceSpec } from '../lib/widgets/choice.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import nys from '../levels/naming-your-service.mjs';

// Render order is the reverse of this (the stub shuffle reverses): d, c, b, a.
const CHOICES = [
  { key: 'a', label: 'Alpha', why: 'a is not it.' },
  { key: 'b', label: 'Bravo', right: true, why: 'b is it.' },
  { key: 'c', label: 'Charlie', why: 'c is not it.' },
  { key: 'd', label: 'Delta', why: 'd is not it.' },
];

/** A counting stub ctx on a fresh DOM; `next` is an action button for onRight. */
function setup(choices = CHOICES, id = 'q1', extra = {}) {
  const dom = makeDom();
  const focus = recordFocus(dom.window);
  const counts = { mistakes: 0, onRight: 0 };
  const ctx = {
    ovBody: dom.body,
    ovActions: dom.actions,
    escapeHtml,
    shuffle: (arr) => [...arr].reverse(),
    mistake() {
      counts.mistakes += 1;
    },
  };
  dom.body.innerHTML = choiceHtml(ctx, choices, { id, ...extra });
  dom.actions.innerHTML = '<button id="next" disabled>Next</button>';
  const onRight = () => {
    counts.onRight += 1;
    const next = dom.actions.querySelector('#next');
    next.disabled = false;
    return next;
  };
  return { ctx, dom, focus, counts, onRight };
}

const picks = () => qa('[data-pick]').map((b) => b.dataset.pick);
const enabled = () => qa('[data-pick]').filter((b) => !b.disabled).map((b) => b.dataset.pick);
const feedback = (id = 'q1') => q(`#${id}-feedback`).textContent;

test('choiceHtml renders the choices in ctx.shuffle order and a live, focusable feedback region, hidden until set', () => {
  setup();
  assert.deepEqual(picks(), ['d', 'c', 'b', 'a']);
  assert.deepEqual(qa('#q1-choices [data-pick]').map((b) => b.textContent), ['Delta', 'Charlie', 'Bravo', 'Alpha']);
  assert.deepEqual(qa('[data-pick]').map((b) => b.getAttribute('type')), ['button', 'button', 'button', 'button']);
  assert.deepEqual(qa('[data-pick]').map((b) => b.hasAttribute('data-state')), [false, false, false, false]);
  const fb = q('#q1-feedback');
  assert.equal(fb.hidden, true);
  assert.equal(fb.hasAttribute('data-tone'), false);
  assert.equal(fb.getAttribute('role'), 'status');
  assert.equal(fb.getAttribute('aria-live'), 'polite');
  assert.equal(fb.getAttribute('tabindex'), '-1');
});

test('mounting focuses the first choice and changes nothing else', () => {
  const { ctx, focus, counts, onRight } = setup();
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  assert.equal(focus.last(), 'pick:d');
  assert.deepEqual(enabled(), ['d', 'c', 'b', 'a']);
  assert.deepEqual(counts, { mistakes: 0, onRight: 0 });
  assert.equal(feedback(), '');
});

test('a wrong pick costs one mistake, is marked and disabled, and says why in words', () => {
  const { ctx, focus, counts, onRight } = setup();
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  click('[data-pick="c"]');
  assert.equal(counts.mistakes, 1);
  assert.equal(counts.onRight, 0);
  assert.equal(q('[data-pick="c"]').disabled, true);
  assert.equal(q('[data-pick="c"]').getAttribute('data-state'), 'wrong');
  assert.deepEqual(enabled(), ['d', 'b', 'a'], 'only the wrong pick is disabled');
  assert.equal(feedback(), 'Not quite. c is not it.');
  // D7: a wrong answer costs a star, so it is the error tone, not neutral information.
  assert.equal(q('#q1-feedback').getAttribute('data-tone'), 'error');
  assert.equal(q('#q1-feedback').hidden, false);
  assert.equal(focus.last(), 'pick:b', 'focus moves to the next enabled choice');
  assert.equal(q('#next').disabled, true, 'a wrong pick does not unlock Next');
});

test('the right pick locks every choice, says why, calls onRight once and focuses its return', () => {
  const { ctx, focus, counts, onRight } = setup();
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  click('[data-pick="a"]');
  click('[data-pick="b"]');
  assert.deepEqual(counts, { mistakes: 1, onRight: 1 });
  assert.deepEqual(enabled(), [], 'every choice is disabled');
  assert.deepEqual(qa('[data-pick]').map((b) => `${b.dataset.pick}:${b.getAttribute('data-state') ?? ''}`), ['d:', 'c:', 'b:correct', 'a:wrong']);
  assert.equal(feedback(), 'Right. b is it.');
  assert.equal(q('#q1-feedback').getAttribute('data-tone'), 'success');
  assert.equal(focus.last(), '#next');
  assert.deepEqual(focus.unfocusable(), [], 'focused only enabled, connected elements');
});

test('after a wrong pick focus wraps around and skips disabled choices', () => {
  const { ctx, focus, onRight } = setup();
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  // Render order d, c, b, a.
  click('[data-pick="a"]');
  assert.equal(focus.last(), 'pick:d', 'from the last choice it wraps to the first');
  click('[data-pick="c"]');
  assert.equal(focus.last(), 'pick:b');
  click('[data-pick="d"]');
  assert.equal(focus.last(), 'pick:b', 'skips c (disabled) to b');
  assert.deepEqual(focus.unfocusable(), []);
});

test('an onRight that returns nothing hands focus to the feedback region', () => {
  const { ctx, focus } = setup();
  mountChoice(ctx, CHOICES, { id: 'q1', onRight: () => undefined });
  click('[data-pick="b"]');
  assert.equal(focus.last(), '#q1-feedback');
});

test('two choices on one screen keep their own buttons and feedback', () => {
  const { ctx, dom, counts, onRight } = setup();
  const other = [
    { key: 'x', label: 'X', right: true, why: 'x is it.' },
    { key: 'y', label: 'Y', why: 'y is not it.' },
  ];
  dom.body.innerHTML += choiceHtml(ctx, other, { id: 'q2' });
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  mountChoice(ctx, other, { id: 'q2', onRight });
  click('[data-pick="y"]');
  assert.equal(feedback('q2'), 'Not quite. y is not it.');
  assert.equal(feedback('q1'), '');
  click('[data-pick="x"]');
  assert.deepEqual(enabled(), ['d', 'c', 'b', 'a'], 'q2 being answered does not lock q1');
  assert.equal(counts.mistakes, 1);
});

test('mountChoice throws a TypeError unless exactly one choice is right', () => {
  const none = CHOICES.map(({ right, ...c }) => c);
  const two = CHOICES.map((c) => (c.key === 'a' ? { ...c, right: true } : c));
  for (const [name, choices] of [['none', none], ['two', two]]) {
    const { ctx, counts, onRight } = setup(choices);
    assert.throws(() => mountChoice(ctx, choices, { id: 'q1', onRight }), TypeError, name);
    assert.equal(typeof q('[data-pick="a"]').onclick, 'object', `${name}: nothing was wired`);
    assert.equal(counts.mistakes, 0);
  }
});

test('an id that is not a plain token is refused before it reaches a selector', () => {
  const { ctx, onRight } = setup();
  assert.throws(() => mountChoice(ctx, CHOICES, { id: 'a"b', onRight }), { name: 'TypeError', message: /plain token/ });
});

test('a key with quotes and markup characters round-trips through data-pick and still plays', () => {
  const key = `x"y'z<&>`;
  const choices = [
    { key, label: 'Odd', right: true, why: 'odd is it.' },
    { key: 'plain', label: 'Plain', why: 'plain is not it.' },
  ];
  const { ctx, counts, onRight } = setup(choices);
  assert.equal(qa('[data-pick]').length, 2, 'one button per choice');
  assert.deepEqual(picks(), ['plain', key]);
  mountChoice(ctx, choices, { id: 'q1', onRight });
  click(qa('[data-pick]').find((b) => b.dataset.pick === key));
  assert.equal(feedback(), 'Right. odd is it.');
  assert.equal(counts.onRight, 1);
});

test('a disabled choice ignores a click that gets through anyway', () => {
  const { ctx, counts, onRight } = setup();
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  click('[data-pick="b"]');
  q('[data-pick="a"]').onclick({});
  q('[data-pick="b"]').onclick({});
  assert.deepEqual(counts, { mistakes: 0, onRight: 1 });
  assert.equal(feedback(), 'Right. b is it.');
});

test('mountChoice refuses an id that is not a string', () => {
  const { ctx, onRight } = setup(CHOICES, 'nys');
  assert.throws(() => mountChoice(ctx, CHOICES, { id: ['nys'], onRight }), { name: 'TypeError', message: /string/ });
});

test('mountChoice refuses duplicate keys', () => {
  const dup = [...CHOICES, { key: 'a', label: 'Again', why: 'again.' }];
  const { ctx, onRight } = setup(dup);
  assert.throws(() => mountChoice(ctx, dup, { id: 'q1', onRight }), { name: 'TypeError', message: /unique/ });
});

test('mountChoice refuses a choice without a string why', () => {
  const noWhy = CHOICES.map((c) => (c.key === 'c' ? { key: 'c', label: 'Charlie' } : c));
  const { ctx, onRight } = setup(noWhy);
  assert.throws(() => mountChoice(ctx, noWhy, { id: 'q1', onRight }), { name: 'TypeError', message: /why/ });
});

test('mountChoice refuses choices that differ from the rendered buttons', () => {
  const fewer = CHOICES.filter((c) => c.key !== 'd');
  const more = [...CHOICES, { key: 'e', label: 'Echo', why: 'e is not it.' }];
  for (const [name, choices] of [['fewer', fewer], ['more', more]]) {
    const { ctx, onRight } = setup();
    assert.throws(() => mountChoice(ctx, choices, { id: 'q1', onRight }), { name: 'TypeError', message: /rendered/ }, name);
  }
});

test('focus goes to the feedback when onRight returns a disabled, detached or non-element target', () => {
  const targets = {
    disabled: () => q('#next'),
    detached: () => globalThis.document.createElement('button'),
    false: () => false,
  };
  for (const [name, target] of Object.entries(targets)) {
    const { ctx, focus } = setup();
    mountChoice(ctx, CHOICES, { id: 'q1', onRight: target });
    click('[data-pick="b"]');
    assert.equal(focus.last(), '#q1-feedback', name);
    assert.deepEqual(focus.unfocusable(), [], name);
  }
});

test('labelledBy names the choices as a group; without it there is no group role', () => {
  setup(CHOICES, 'q1', { labelledBy: 'q1-question' });
  assert.equal(q('#q1-choices').getAttribute('role'), 'group');
  assert.equal(q('#q1-choices').getAttribute('aria-labelledby'), 'q1-question');
  setup();
  assert.equal(q('#q1-choices').hasAttribute('role'), false);
  assert.equal(q('#q1-choices').hasAttribute('aria-labelledby'), false);
});

test('level 1.2 labels both of its choice groups with their question', () => {
  const dom = makeDom();
  const ctx = createLevelContext({
    level: { ...nys, scored: true, scoring: { parMs: null } },
    ovBody: dom.body,
    ovActions: dom.actions,
    now: () => 0,
    shuffle: (a) => a,
    onFinish: () => {},
    signal: new AbortController().signal,
  });
  nys.run(ctx);
  const question = () => q(`#${q('#nys-choices').getAttribute('aria-labelledby')}`)?.textContent;
  assert.equal(question(), 'What service name does its telemetry show up under?');
  click('[data-pick="fallback"]');
  click('#nys-next');
  q('#nys-env').value = 'OTEL_SERVICE_NAME=checkout\nOTEL_RESOURCE_ATTRIBUTES=service.version=1.4.2,deployment.environment.name=production';
  click('#nys-check');
  click('#nys-next');
  assert.equal(question(), 'Which service name does the SDK report?');
});

test('choiceHtml and mountChoice refuse a key that is not a non-empty string', () => {
  for (const [name, bad] of [['number', 1], ['empty', '']]) {
    const choices = CHOICES.map((c) => (c.key === 'c' ? { ...c, key: bad } : c));
    const { ctx, onRight } = setup();
    assert.throws(() => choiceHtml(ctx, choices, { id: 'q1' }), { name: 'TypeError', message: /^choice "q1": .*non-empty string/ }, name);
    assert.throws(() => mountChoice(ctx, choices, { id: 'q1', onRight }), { name: 'TypeError', message: /non-empty string/ }, name);
  }
});

test('the rendered keys are compared one by one, so a key holding a newline cannot pose as two', () => {
  const two = [
    { key: 'a', label: 'A', why: 'a.' },
    { key: 'b', label: 'B', right: true, why: 'b.' },
  ];
  const { ctx, onRight } = setup(two);
  const one = [{ key: 'a\nb', label: 'AB', right: true, why: 'ab.' }];
  assert.throws(() => mountChoice(ctx, one, { id: 'q1', onRight }), { name: 'TypeError', message: /rendered/ });
});

test('choiceHtml refuses a labelledBy that is not a plain token', () => {
  const { ctx } = setup();
  for (const bad of ['', 'a"b', 'two words']) {
    assert.throws(() => choiceHtml(ctx, CHOICES, { id: 'q1', labelledBy: bad }), { name: 'TypeError', message: /labelledBy/ }, JSON.stringify(bad));
  }
});

test('focus goes to the feedback when onRight returns an element that cannot take focus', () => {
  const { ctx, dom, focus } = setup();
  dom.actions.innerHTML += '<div id="plain">not focusable</div>';
  mountChoice(ctx, CHOICES, { id: 'q1', onRight: () => dom.actions.querySelector('#plain') });
  click('[data-pick="b"]');
  assert.equal(focus.last(), '#q1-feedback');
});

test('mountChoice refuses choices that are not an array, naming the question', () => {
  const { ctx, onRight } = setup();
  assert.throws(() => mountChoice(ctx, { a: CHOICES[0] }, { id: 'q1', onRight }), { name: 'TypeError', message: /^choice "q1": choices must be an array/ });
});

test('mountChoice refuses a null choice, naming the question', () => {
  const { ctx, onRight } = setup();
  assert.throws(() => mountChoice(ctx, [...CHOICES, null], { id: 'q1', onRight }), { name: 'TypeError', message: /^choice "q1": choice 4 is not an object/ });
});

test('choiceHtml and mountChoice join several problems; mountChoice also reports the content problems', () => {
  const { ctx } = setup();
  const choices = [null, { key: '' }];
  const message = (fn) => { try { fn(); } catch (e) { return e.message; } return undefined; };
  const shape = 'choice "q1": choice 0 is not an object; choice keys must be non-empty strings';
  assert.equal(message(() => choiceHtml(ctx, choices, { id: 'q1' })), shape);
  // choiceHtml checks the shape only; mountChoice runs the whole validateChoiceSpec.
  const full = message(() => mountChoice(ctx, choices, { id: 'q1', onRight: () => undefined }));
  assert.equal(full, `choice "q1": ${validateChoiceSpec(choices).join('; ')}`);
  assert.ok(full.startsWith(shape));
});

test('validateChoiceSpec: a valid spec has no problems', () => {
  assert.deepEqual(validateChoiceSpec(CHOICES), []);
});

test('validateChoiceSpec: zero or two right answers is a problem', () => {
  for (const [n, choices] of [
    [0, CHOICES.map((c) => ({ ...c, right: false }))],
    [2, CHOICES.map((c) => (c.key === 'a' ? { ...c, right: true } : c))],
  ]) {
    assert.deepEqual(validateChoiceSpec(choices), [`needs exactly one right answer, has ${n}`]);
  }
});

test('validateChoiceSpec: a duplicate key and a non-string why are problems', () => {
  assert.deepEqual(validateChoiceSpec(CHOICES.map((c) => (c.key === 'c' ? { ...c, key: 'a' } : c))), ['choice keys must be unique']);
  assert.deepEqual(validateChoiceSpec(CHOICES.map((c) => (c.key === 'c' ? { ...c, why: 3 } : c))), ['choice "c" needs a string why']);
});

test('validateChoiceSpec: null and non-arrays give a problem and never throw', () => {
  assert.deepEqual(validateChoiceSpec(null), ['choices must be an array']);
  assert.deepEqual(validateChoiceSpec([...CHOICES, null]), ['choice 4 is not an object']);
});

test('validateChoiceSpec collects every problem', () => {
  assert.deepEqual(validateChoiceSpec([null, { key: 'a', why: 1 }]), ['choice 0 is not an object', 'choice "a" needs a string why']);
  assert.deepEqual(validateChoiceSpec([null]), ['choice 0 is not an object']);
});

test('choiceHtml refuses choices that are not an array or hold a non-object, naming the question (#57)', () => {
  const { ctx } = setup();
  assert.throws(() => choiceHtml(ctx, { a: CHOICES[0] }, { id: 'q1' }), { name: 'TypeError', message: 'choice "q1": choices must be an array' });
  assert.throws(() => choiceHtml(ctx, undefined, { id: 'q1' }), { name: 'TypeError', message: 'choice "q1": choices must be an array' });
  for (const bad of [null, 'x', 7]) {
    assert.throws(() => choiceHtml(ctx, [CHOICES[0], bad], { id: 'q1' }), { name: 'TypeError', message: 'choice "q1": choice 1 is not an object' }, String(bad));
  }
});

test('labelledBy null means not given, like undefined (#57)', () => {
  setup(CHOICES, 'q1', { labelledBy: null });
  assert.equal(q('#q1-choices').hasAttribute('role'), false);
  assert.equal(q('#q1-choices').hasAttribute('aria-labelledby'), false);
});

test('#331 a new step opens at its top: mount focuses the first choice without scrolling to it', () => {
  const { ctx, dom, onRight } = setup();
  const calls = [];
  for (const b of qa('[data-pick]')) {
    const f = b.focus.bind(b);
    b.focus = (o) => { calls.push([b.dataset.pick, o]); f(o); };
  }
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  assert.deepEqual(calls, [['d', { preventScroll: true }]]);
});

// ---- the 50/50 joker (#371) ----------------------------------------------------------------

/** setup() with a ctx that also counts hint() (the cost of a 50/50) and a status line to read. */
function setupFifty(choices = CHOICES) {
  const s = setup(choices);
  s.counts.hints = 0;
  s.ctx.hint = () => {
    s.counts.hints += 1;
  };
  return s;
}
const hidden = () => qa('[data-pick]').filter((b) => b.hidden).map((b) => b.dataset.pick);
const visible = () => qa('[data-pick]').filter((b) => !b.hidden).map((b) => b.dataset.pick);
const fifty = () => q('#q1-fifty');
const FIVE = [...CHOICES, { key: 'e', label: 'Echo', why: 'e is not it.' }];
const SIX = [...FIVE, { key: 'f', label: 'Foxtrot', why: 'f is not it.' }];

test('B1 #371 a question with four or more answers offers one 50/50 button; fewer offer none', () => {
  setupFifty();
  assert.equal(qa('#q1-fifty').length, 1);
  assert.equal(fifty().disabled, false);
  assert.equal(fifty().classList.contains('ui-btn--hint'), true);
  assert.equal(fifty().textContent, 'Use 50/50 (costs 1 penalty)');
  setupFifty(CHOICES.filter((c) => c.key !== 'd'));
  assert.equal(qa('#q1-fifty').length, 0, 'three answers: no button');
});

test('B2 #371 the 50/50 removes two wrong answers picked by ctx.shuffle, costs one hint and no mistake, and says so', () => {
  const { ctx, focus, counts, onRight } = setupFifty();
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  click('#q1-fifty');
  // The reversed shuffle turns the wrong answers [a, c, d] into [d, c, a]: d and c go.
  assert.deepEqual(hidden(), ['d', 'c']);
  assert.deepEqual(qa('[data-pick]').filter((b) => b.hidden).map((b) => b.disabled), [true, true]);
  assert.deepEqual(visible(), ['b', 'a']);
  assert.deepEqual(enabled(), ['b', 'a']);
  assert.deepEqual(counts, { mistakes: 0, onRight: 0, hints: 1 });
  assert.equal(fifty().textContent, '50/50 used');
  assert.equal(fifty().disabled, true);
  assert.equal(feedback(), '50/50: two wrong answers are gone. 2 answers left.');
  assert.equal(q('#q1-feedback').getAttribute('data-tone'), 'neutral');
  assert.equal(focus.last(), 'pick:b', 'focus goes to the first visible answer in display order');
  assert.deepEqual(focus.unfocusable(), []);
  const again = setupFifty();
  again.ctx.shuffle = (arr) => [...arr];
  mountChoice(again.ctx, CHOICES, { id: 'q1', onRight: again.onRight });
  click('#q1-fifty');
  assert.deepEqual(hidden(), ['c', 'a'], 'an identity shuffle removes the first two wrong answers, a and c (listed in display order)');
});

test('B3 #371 the right answer is never removed, wherever the shuffle puts it', () => {
  const { ctx, onRight } = setupFifty();
  ctx.shuffle = (arr) => [...arr].sort((x, y) => (y.right ? 1 : 0) - (x.right ? 1 : 0));
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  click('#q1-fifty');
  assert.equal(visible().includes('b'), true);
  assert.equal(hidden().length, 2);
});

test('B4 #371 a second 50/50 click that gets through costs nothing and removes nothing more, even with six answers', () => {
  const { ctx, counts, onRight } = setupFifty(SIX);
  mountChoice(ctx, SIX, { id: 'q1', onRight });
  fifty().onclick();
  fifty().onclick();
  assert.equal(counts.hints, 1);
  assert.equal(hidden().length, 2);
});

test('B5 #371 after the right pick the 50/50 is spent: disabled, and a click that gets through is free', () => {
  const { ctx, counts, onRight } = setupFifty();
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  click('[data-pick="b"]');
  assert.equal(fifty().disabled, true);
  fifty().onclick();
  assert.equal(counts.hints, 0);
  assert.deepEqual(hidden(), []);
});

test('B6 #371 the 50/50 needs three wrong answers still open: four answers after one wrong pick is too few, five is enough', () => {
  const four = setupFifty();
  mountChoice(four.ctx, CHOICES, { id: 'q1', onRight: four.onRight });
  click('[data-pick="a"]');
  assert.equal(fifty().disabled, true);
  assert.equal(fifty().textContent, '50/50 (too few answers left)');
  const five = setupFifty(FIVE);
  mountChoice(five.ctx, FIVE, { id: 'q1', onRight: five.onRight });
  click('[data-pick="a"]');
  assert.equal(fifty().disabled, false);
  assert.equal(fifty().textContent, 'Use 50/50 (costs 1 penalty)');
  click('#q1-fifty');
  assert.equal(hidden().length, 2);
  assert.equal(enabled().length, 2, 'one wrong answer and the right one remain');
});

test('B7 #371 a removed answer cannot be picked, so focus after a wrong pick skips it', () => {
  const { ctx, focus, counts, onRight } = setupFifty();
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  click('#q1-fifty');
  click('[data-pick="a"]');
  assert.equal(focus.last(), 'pick:b', 'never d or c');
  assert.equal(counts.mistakes, 1);
  q('[data-pick="d"]').onclick({});
  assert.equal(counts.mistakes, 1, 'a removed answer is not a mistake');
  assert.equal(fifty().textContent, '50/50 used', 'a wrong pick after the 50/50 does not relabel it too few');
});

test('B7b #371 a wrong pick then a 50/50 keeps the why and adds the 50/50 line', () => {
  const { ctx, onRight } = setupFifty(FIVE);
  mountChoice(ctx, FIVE, { id: 'q1', onRight });
  click('[data-pick="a"]');
  assert.equal(feedback(), 'Not quite. a is not it.');
  click('#q1-fifty');
  assert.equal(q('#q1-feedback').textContent.includes('Not quite. a is not it.'), true);
  assert.equal(q('#q1-feedback').textContent.includes('50/50: two wrong answers are gone. 2 answers left.'), true);
  assert.equal(q('#q1-feedback').getAttribute('data-tone'), 'neutral');
});

test('B5b #371 after the right pick the spent 50/50 reads "not needed"', () => {
  const { ctx, onRight } = setupFifty();
  mountChoice(ctx, CHOICES, { id: 'q1', onRight });
  click('[data-pick="b"]');
  assert.equal(fifty().textContent, '50/50 (not needed)');
});

test('B10 #371 keep: the 50/50 never removes a keep answer, and needs two removable wrong answers', () => {
  const KEEP = SIX.map((c) => (c.key === 'a' || c.key === 'c' ? { ...c, keep: true } : c));
  // The identity shuffle would remove a and c first; keep skips them: b stays, d and e go.
  const k = setupFifty(KEEP);
  k.ctx.shuffle = (arr) => [...arr];
  mountChoice(k.ctx, KEEP, { id: 'q1', onRight: k.onRight });
  click('#q1-fifty');
  assert.deepEqual(hidden(), ['e', 'd'], 'listed in display order');
  // Four answers, two of the three wrong ones kept: one removable answer is too few.
  const FOUR = CHOICES.map((c) => (c.key === 'a' || c.key === 'c' ? { ...c, keep: true } : c));
  const f = setupFifty(FOUR);
  mountChoice(f.ctx, FOUR, { id: 'q1', onRight: f.onRight });
  assert.equal(fifty().disabled, true);
  assert.equal(fifty().textContent, '50/50 (too few answers left)');
  fifty().onclick();
  assert.deepEqual(hidden(), []);
  assert.equal(f.counts.hints, 0);
});

test('B11 #371 keep is validated: a boolean, and never on the right answer', () => {
  const bad = (patch) => validateChoiceSpec(CHOICES.map((c) => (c.key === patch.key ? { ...c, ...patch } : c)));
  assert.deepEqual(bad({ key: 'a', keep: true }), []);
  assert.deepEqual(bad({ key: 'a', keep: false }), []);
  assert.equal(bad({ key: 'a', keep: 'yes' }).length, 1);
  assert.equal(bad({ key: 'b', keep: true }).length, 1);
});

test('B8 #371 the penalty and the how-to-play hint line name the 50/50', () => {
  assert.equal(PENALTY.costs, 'a wrong pick, a 50/50');
});

test('B9 #371 with the real level context a 50/50 then the right pick finishes with no mistake and one hint', () => {
  const dom = makeDom();
  recordFocus(dom.window);
  const finished = [];
  const ctx = createLevelContext({
    level: { id: 'fifty-fixture', scored: true, scoring: { parMs: null } },
    ovBody: dom.body,
    ovActions: dom.actions,
    now: () => 0,
    shuffle: (a) => [...a].reverse(),
    onFinish: (id, result) => finished.push(result),
    signal: new AbortController().signal,
  });
  dom.body.innerHTML = choiceHtml(ctx, CHOICES, { id: 'q1' });
  mountChoice(ctx, CHOICES, { id: 'q1', onRight: () => undefined });
  click('#q1-fifty');
  click('[data-pick="b"]');
  ctx.finish({ text: 'done' });
  assert.equal(finished.length, 1);
  assert.deepEqual({ mistakes: finished[0].mistakes, hintsUsed: finished[0].hintsUsed, stars: finished[0].stars }, { mistakes: 0, hintsUsed: 1, stars: 4 });
});
