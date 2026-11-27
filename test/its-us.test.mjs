// The Act 9 boss "It's us" as a declarative play level (#509 P7.2): a game spot step, then an In Dash0 step for the task
// 'its-us-find'. This file rewrites the old hand-written boss's test (practice explorer, send screens, ctx.telemetry): the
// level no longer sends or reads anything. It pins the shape, the spot step's answer, the skipped In Dash0 step when signed
// out, that the boss never touches ctx.telemetry, and that its source imports nothing that could. The generic play-through
// (stars, slips) is the derived driver in test/levels-play.test.mjs; the In Dash0 widget itself is test/dash0-task-step.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDom, q, qa, click } from './helpers/dom.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import { runPlay, STEP_TYPES, validatePlay } from '../lib/play.mjs';
import { TASKS } from '../lib/dash0-task/tasks.mjs';
import { QUESTION } from '../lib/incident-lab.mjs';
import level from '../levels/its-us.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const steps = level.play.steps;
const dash0Step = steps.find((s) => s.dash0);
const spotStep = steps.find((s) => s.spot);

const settle = () => new Promise((resolve) => setImmediate(resolve));

/** The task client as runPlay sees it: only what the step needs to draw. `skip` records what a level without a task says. */
function fakeApi({ available, reason = null }) {
  const api = { skipped: [], available: () => available, reason: () => reason, skip: (ids, cause) => api.skipped.push([ids, cause]), passed() {}, downCause: () => null };
  return api;
}

/** Open the level on the real ctx. `telemetry` is handed to the context, so a boss that reads it is caught. */
function open({ api, telemetry }) {
  const dom = makeDom();
  const results = [];
  const ctx = createLevelContext({
    level, ovBody: dom.body, ovActions: dom.actions, now: () => 0, shuffle: (a) => a, reduceMotion: true,
    onFinish: (id, r) => results.push(r), signal: new AbortController().signal, reportError: (e) => { throw e; }, telemetry,
  });
  if (api) ctx.dash0Task = api;
  runPlay(level, ctx, STEP_TYPES);
  return { ctx, results };
}

/** A telemetry session that fails the test on any read: `ctx.telemetry.status()`, `.incident()`, `.sendBatch()`, a property probe. */
const forbiddenTelemetry = () => new Proxy({}, {
  get: (_, prop) => { throw new Error(`the boss read ctx.telemetry.${String(prop)}`); },
  has: () => { throw new Error('the boss probed ctx.telemetry'); },
});

/** Solve the spot step the way a player does: pick the fault line and Check. */
const solveSpot = () => { click(`[data-line="${spotStep.spot.faults[0]}"]`); click('#its-spot-check'); };

test('the play has a game step then an In Dash0 step, and the registry derives surfaces [game, dash0] and mechanics [spot]', () => {
  const v = validatePlay(level.play);
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.surfaces, ['game', 'dash0']);
  assert.deepEqual(v.mechanics, ['spot']);
  assert.deepEqual(steps.map((s) => Object.keys(s).find((k) => ['spot', 'dash0'].includes(k))), ['spot', 'dash0'], 'the game step is first');
  assert.equal(level.run, undefined, 'a play level has no run');
});

test('the In Dash0 step is the seeded task its-us-find with the four incident questions, each with a label and a hint', () => {
  assert.ok(dash0Step, 'the level has an In Dash0 step');
  const spec = dash0Step.dash0;
  assert.equal(spec.task, 'its-us-find');
  assert.equal(spec.grader, 'seeded');
  assert.deepEqual(spec.answers, [QUESTION.operation, QUESTION.faultCode, QUESTION.retryCount, QUESTION.traceId]);
  assert.deepEqual(spec.answers, [...TASKS['its-us-find'].answers], 'the questions are the task registry\'s');
  assert.deepEqual(spec.fields.map((f) => f.key), spec.answers, 'one field per question, in order');
  for (const f of spec.fields) {
    assert.ok(f.label.endsWith('?'), `${f.key}: the label is a question`);
    assert.ok(typeof f.hint === 'string' && f.hint.length > 10, `${f.key}: has a hint`);
  }
  for (const word of [/Trace Explorer/, /game\.attempt\.id/, /Span Sidebar/, /Trace View/, /span event/i]) assert.match(dash0Step.intro, word, `the brief says where to read: ${word}`);
});

test('the finish text is the same whether or not the task ran: it never names the In Dash0 step or the task', () => {
  assert.doesNotMatch(level.play.finish, /\bin dash0\b/i);
  assert.ok(!level.play.finish.includes('its-us-find') && !level.play.finish.includes(dash0Step.dash0.id));
});

test('the spot step: only the player\'s own span in error is the answer, and every other line fails the attempt id or the status', () => {
  const { lines, faults, whyNot } = spotStep.spot;
  const mine = spotStep.intro.match(/<code>(att-[0-9a-f]+)<\/code>/)[1];
  const idOf = (l) => l.text.match(/game\.attempt\.id=(\S+)/)[1];
  const statusOf = (l) => l.text.match(/status=(\w+)/)[1];
  const answer = lines.filter((l) => idOf(l) === mine && statusOf(l) === 'Error').map((l) => l.id);
  assert.deepEqual(faults, answer, 'the fault flags are exactly the lines that are mine and in error');
  for (const l of lines.filter((x) => !faults.includes(x.id))) assert.ok(whyNot[l.id], `${l.id}: a wrong pick says why`);
  // The decoys cover each way of being wrong: someone else's Error, one of my own that is not in error, and an id one slip away from mine.
  const others = lines.filter((l) => idOf(l) !== mine);
  assert.ok(others.some((l) => statusOf(l) === 'Error'), 'an Error span of another attempt');
  assert.ok(lines.some((l) => idOf(l) === mine && statusOf(l) !== 'Error'), 'a span of mine that is not in error');
  assert.ok(others.some((l) => statusOf(l) === 'Error' && idOf(l).length === mine.length && [...idOf(l)].filter((c, i) => c !== mine[i]).length <= 2), 'an id that differs from mine by a character or two');
  assert.ok(new Set(lines.map(idOf)).size >= 4, 'spans from several attempts');
});

test('signed out: the In Dash0 step is left out, the game step plays to Finish, and skip gets its-us-find with signed-out', async () => {
  const api = fakeApi({ available: false, reason: 'signed-out' });
  const { results } = open({ api });
  assert.ok(q('[data-line="mine-error"]'), 'the game step is the first screen');
  assert.deepEqual(api.skipped, [[['its-us-find'], 'signed-out']]);
  assert.equal(q('#its-find-start') === null, true, 'no Start for the task');
  solveSpot();
  assert.equal(q('#its-finish').disabled, false, 'the spot step is the last step, so Finish is its button');
  assert.equal(q('#its-next') === null, true, 'there is no Next to a second step');
  click('#its-finish');
  await settle();
  assert.equal(results.length, 1, 'the level finished once');
  assert.equal(results[0].text, level.play.finish);
});

test('with the task available the spot step leads on to the In Dash0 step', () => {
  const api = fakeApi({ available: true });
  const { results } = open({ api });
  solveSpot();
  assert.equal(q('#its-finish') === null, true, 'the spot step is not the last step');
  assert.equal(q('#its-next').disabled, false);
  click('#its-next');
  assert.equal(q('#its-find-start') !== null, true, 'the task starts on the player\'s press');
  assert.deepEqual(api.skipped, [], 'nothing skipped');
  assert.equal(results.length, 0);
});

test('the boss never touches ctx.telemetry: neither signed out nor with the task available, nor through a wrong pick', async () => {
  for (const api of [fakeApi({ available: false, reason: 'off' }), fakeApi({ available: true })]) {
    const { results } = open({ api, telemetry: forbiddenTelemetry() });
    click('[data-line="other-error-storage"]'); // a wrong Check
    click('#its-spot-check');
    click('[data-line="other-error-storage"]');
    solveSpot();
    if (api.available()) { click('#its-next'); assert.ok(q('#its-find-start')); continue; }
    click('#its-finish');
    await settle();
    assert.equal(results.length, 1);
  }
});

test('the source imports nothing from the incident lab or the telemetry session, and never reads ctx.telemetry', () => {
  const src = readFileSync(join(ROOT, 'levels', 'its-us.mjs'), 'utf8');
  const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gms)].map((m) => m[1]);
  assert.ok(imports.length >= 2, `the scan reads the imports (${imports.join(', ')})`);
  for (const spec of imports) assert.doesNotMatch(spec, /incident-lab|telemetry|otlp|dash0-task/, `import ${spec}`);
  assert.ok(!/ctx\.telemetry/.test(src.replace(/^\s*\/\/.*$/gm, '')), 'no code reads ctx.telemetry');
});

test('the old practice and send screens are gone: no practice filter, send button or simulated explorer on the first screens', () => {
  const api = fakeApi({ available: true });
  open({ api });
  assert.equal(qa('input[type="radio"][name^="its-f"]').length, 0, 'no practice filter radios');
  for (const sel of ['#its-practice', '#its-send', '#its-explorer']) assert.equal(q(sel) === null, true, sel);
});
