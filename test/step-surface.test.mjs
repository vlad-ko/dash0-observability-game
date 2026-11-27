// #509 P3: the step surface contract. Every step is In the game or In Dash0; validatePlay's placement rules and
// runPlay's skip-when-unavailable rule are tested with a fixture step type (the real `dash0` type is P6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, q, qa, click } from './helpers/dom.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import { runPlay, STEP_TYPES, validatePlay } from '../lib/play.mjs';
import { buildRegistry } from '../lib/registry.mjs';
import { DASH0_SCREEN_NAMES, vocabularyHits } from '../lib/content/surface.mjs';
import { FIXTURE_CARD } from './fixtures/play-level.mjs';

const NOW = 1767225600000;

/** A step type that is In Dash0 and has a mechanic and a Hint button, so counting it anywhere shows. */
const REMOTE = {
  key: 'remote',
  surface: 'dash0',
  mechanic: 'query',
  wide: false,
  labelled: false,
  reason: 'Do the task in Dash0',
  idOf: (spec) => spec.id,
  validate: () => [],
  hints: () => false,
  render: (ctx, spec) => `<p id="${spec.id}-body">Do it in Dash0.</p>`,
  mount: (ctx, spec, { onDone }) => onDone(),
};
const TYPES = { ...STEP_TYPES, remote: REMOTE };

const choiceStep = (id) => ({
  intro: 'Which signal tells you where a request spent its time?',
  question: 'Pick one.',
  choice: { id, choices: [{ key: 'a', label: 'A metric', why: 'It aggregates.' }, { key: 'b', label: 'A trace', right: true, why: 'Spans carry timing.' }] },
});
const remoteStep = (id) => ({ intro: 'Now do it in Dash0.', remote: { id } });
const playOf = (...steps) => ({ prefix: 'sf', finish: 'You did it, and the level is done.', steps });

test('every live step type says where it happens, and all of them are in the game', () => {
  for (const [key, type] of Object.entries(STEP_TYPES)) assert.equal(type.surface, 'game', key);
});

test('validatePlay returns the surfaces in order of first appearance', () => {
  assert.deepEqual(validatePlay(playOf(choiceStep('c1'))).surfaces, ['game']);
  assert.deepEqual(validatePlay(playOf(choiceStep('c1'), remoteStep('r1')), TYPES).surfaces, ['game', 'dash0']);
  assert.deepEqual(validatePlay(playOf(choiceStep('c1'), remoteStep('r1'), choiceStep('c2')), TYPES).errors, []);
});

test('a level needs a game step, and a dash0 step is never step 1', () => {
  const only = validatePlay(playOf(remoteStep('r1')), TYPES);
  assert.ok(only.errors.some((e) => /step 1 cannot be In Dash0/.test(e)), only.errors.join('|'));
  assert.ok(only.errors.some((e) => /at least one step in the game/.test(e)), only.errors.join('|'));
  const first = validatePlay(playOf(remoteStep('r1'), choiceStep('c1')), TYPES);
  assert.equal(first.errors.length, 1);
  assert.match(first.errors[0], /step 1 cannot be In Dash0/);
  assert.deepEqual(validatePlay(playOf(choiceStep('c1'), remoteStep('r1')), TYPES).errors, []);
});

test('mechanics, widgets and hintless come from game steps only', () => {
  const play = playOf(choiceStep('c1'), remoteStep('r1'));
  const got = validatePlay(play, TYPES);
  assert.deepEqual({ mechanics: got.mechanics, widgets: got.widgets, hintless: got.hintless }, { mechanics: [], widgets: ['choice'], hintless: [] });
  assert.deepEqual(validatePlay(playOf(choiceStep('c1')), TYPES).widgets, got.widgets);
});

test('the registry exposes surfaces, and a run level is in the game', () => {
  const kit = { validatePlay, runPlay };
  const reg = buildRegistry(
    [{ id: 'a', no: 0, levels: [{ id: 'sf-run', no: '0.1', name: 'n', icon: '*', rewardTitle: 'r', mechanics: ['sort'], run() {} }], boss: null }],
    { deck: [FIXTURE_CARD], nodeIds: [], play: kit },
  );
  assert.deepEqual(reg.levels['sf-run'].surfaces, ['game']);
});

/** Open `play` with the real ctx; `available` is what the task server says (undefined: no ctx.dash0Task at all). */
function open(play, available) {
  const dom = makeDom();
  const ctx = createLevelContext({
    level: { id: 'sf' }, ovBody: dom.body, ovActions: dom.actions, now: () => NOW, shuffle: (a) => a,
    reduceMotion: true, onFinish: () => {}, signal: new AbortController().signal, reportError: (e) => { throw e; },
  });
  let asked = 0;
  if (available !== undefined) ctx.dash0Task = { available: () => (asked++, available) };
  runPlay({ id: 'sf', cards: [], play }, ctx, TYPES);
  return { ctx, asked: () => asked };
}
const surfaceNow = () => qa('[data-surface]').map((el) => el.getAttribute('data-surface'));

test('runPlay marks each screen with its step type\'s surface and shows the chip', () => {
  open(playOf(choiceStep('c1'), remoteStep('r1')), true);
  assert.deepEqual(surfaceNow(), ['game']);
  assert.equal(q('.ui-step .ui-chip').textContent, 'In the game');
  click('[data-pick="b"]');
  click('#sf-next');
  assert.deepEqual(surfaceNow(), ['dash0']);
  assert.equal(q('.ui-step .ui-chip').textContent, 'In Dash0');
});

test('with the task server available the dash0 steps stay in the run', () => {
  const run = open(playOf(choiceStep('c1'), remoteStep('r1'), choiceStep('c2')), true);
  assert.equal(q('#sf-finish') === null, true);
  click('[data-pick="b"]');
  click('#sf-next');
  assert.ok(q('#r1-body'), 'the dash0 step is shown');
  click('#sf-next');
  assert.ok(q('#sf-finish'), 'the last step is Finish');
  assert.equal(run.asked(), 1, 'availability is read once, when the level opens');
});

test('without the task server the dash0 steps are left out, and the last game step shows Finish', () => {
  for (const available of [false, undefined]) {
    const run = open(playOf(choiceStep('c1'), remoteStep('r1')), available);
    assert.equal(q('#sf-next') === null, true, `available ${available}: one game step is the last`);
    assert.ok(q('#sf-finish'), `available ${available}: Finish`);
    assert.equal(q('#r1-body') === null, true);
    if (available === false) assert.equal(run.asked(), 1);
  }
  open(playOf(choiceStep('c1'), remoteStep('r1'), choiceStep('c2')), false);
  click('[data-pick="b"]');
  click('#sf-next');
  assert.equal(q('#r1-body') === null, true, 'the dash0 step in the middle is skipped');
  assert.ok(q('#sf-finish'));
});

test('availability is not asked again once the level is open', () => {
  const run = open(playOf(choiceStep('c1'), remoteStep('r1'), choiceStep('c2')), false);
  click('[data-pick="b"]');
  click('#sf-next');
  click('[data-pick="b"]');
  click('#sf-finish');
  assert.equal(run.asked(), 1);
});

test('the vocabulary check finds a Dash0 screen name or "simulated Dash0" in a title, and nothing else', () => {
  assert.deepEqual(DASH0_SCREEN_NAMES, ['Trace Explorer', 'Trace View', 'Span Sidebar', 'Log Explorer', 'Metric Explorer', 'Dashboards', 'Check Rules', 'Auth Tokens']);
  for (const name of DASH0_SCREEN_NAMES) assert.deepEqual(vocabularyHits([`The ${name} page`]), [{ name, title: `The ${name} page` }], name);
  assert.deepEqual(vocabularyHits(['Practice: a simulated Dash0, not yours'])[0].name, 'simulated Dash0');
  assert.deepEqual(vocabularyHits(['Pick the span', 'Your own dashboards', 'The trace explorer']), []);
});
