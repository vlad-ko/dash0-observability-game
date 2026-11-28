// Level 9.3 "Connect the game to Dash0" as a declarative play level (#509 P7.3): a sort step (what may go in a page's code), a choice
// step (which address a browser sender uses), then an In Dash0 step for the readback task 'connect-test-span'. This file rewrites the old
// hand-written level's test (the practice settings panel, the connect form, ctx.telemetry): the level no longer builds a form or reads
// the telemetry session; the send form is the widget's (test/dash0-send.test.mjs). It pins the shape, the answers, the words that tell the
// player what to do in Dash0, the step left out when the task server is off or the player is signed out, and that the source touches
// nothing it should not. The generic play-through (stars, slips) is the derived driver in test/levels-play.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDom, q, qa, click } from './helpers/dom.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import { runPlay, STEP_TYPES, validatePlay } from '../lib/play.mjs';
import { TASKS } from '../lib/dash0-task/tasks.mjs';
import { isDash0AppUrl } from '../lib/dash0-task/client.mjs';
import { vocabularyHits } from '../lib/content/surface.mjs';
import level from '../levels/connect-to-dash0.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const steps = level.play.steps;
const sortStep = steps.find((s) => s.sort);
const choiceStep = steps.find((s) => s.choice);
const dash0Step = steps.find((s) => s.dash0);

const settle = () => new Promise((resolve) => setImmediate(resolve));

/** The task client as runPlay sees it. `skip` records what a level without a task says; `start` answers like the task server. */
function fakeApi({ available, reason = null }) {
  const api = {
    skipped: [], calls: [], available: () => available, reason: () => reason, isDash0AppUrl,
    start: async (task) => { api.calls.push(['start', task]); return { ok: true, attemptId: 'a'.repeat(16), link: 'https://app.dash0.com/goto/traces/explorer?from=now-30m&to=now', tag: 'k3j9x2m4q1', readyAfterS: 30, expiresAt: 1767229200000, name: 'oncall-k3j9x2m4q1-connect-test-span-aaaaaa', dataset: 'game-ds' }; },
    check: async () => ({ outcome: 'pass', charge: false }),
    skip: (ids, cause) => api.skipped.push([ids, cause]), passed() {}, downCause: () => null,
  };
  return api;
}

/** Open the level on the real ctx. `telemetry` is handed to the context, so a step that reads it is caught. */
function open({ api, telemetry }) {
  const dom = makeDom();
  const results = [];
  let mistakes = 0;
  const ctx = createLevelContext({
    level, ovBody: dom.body, ovActions: dom.actions, now: () => 0, shuffle: (a) => a, reduceMotion: true,
    onFinish: (id, r) => results.push(r), signal: new AbortController().signal, reportError: (e) => { throw e; }, telemetry,
  });
  const realMistake = ctx.mistake;
  ctx.mistake = () => { mistakes += 1; realMistake(); };
  if (api) ctx.dash0Task = api;
  runPlay(level, ctx, STEP_TYPES);
  return { ctx, results, mistakes: () => mistakes };
}

const SORT_ANSWER = Object.fromEntries(sortStep.sort.items.map((it) => [it.id, it.bucket]));
/** Place every item the way a player does: pick it, then pick its bucket. */
const solveSort = (answer = SORT_ANSWER) => { for (const [id, bucket] of Object.entries(answer)) { click(`[data-item="${id}"]`); click(`[data-bucket="${bucket}"]`); } };
const solveChoice = () => click(`[data-pick="${choiceStep.choice.choices.find((c) => c.right).key}"]`);

test('the play has a sort step, a choice step, then an In Dash0 step, and the registry derives surfaces [game, dash0] and mechanics [sort]', () => {
  const v = validatePlay(level.play);
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.surfaces, ['game', 'dash0']);
  assert.deepEqual(v.mechanics, ['sort']);
  assert.deepEqual(steps.map((s) => Object.keys(s).find((k) => ['sort', 'choice', 'dash0'].includes(k))), ['sort', 'choice', 'dash0'], 'the game steps come first');
  assert.equal(level.run, undefined, 'a play level has no run');
  assert.equal(level.no, '9.3');
});

test('the In Dash0 step is the readback task connect-test-span: no questions, no fields, and the step draws the send form', () => {
  assert.ok(dash0Step, 'the level has an In Dash0 step');
  const spec = dash0Step.dash0;
  assert.equal(spec.task, 'connect-test-span');
  assert.equal(spec.grader, 'readback');
  assert.equal(TASKS['connect-test-span'].grader, 'readback');
  assert.equal(TASKS['connect-test-span'].send, 'test-span', 'the player sends the span, so the step draws the send form');
  assert.equal(spec.answers, undefined);
  assert.equal(spec.fields, undefined);
});

test('the brief names the real Dash0 places in words: the Ingesting permission, Settings, Auth Tokens and Endpoints, the OTLP via HTTP address, and the buttons', () => {
  const brief = dash0Step.intro;
  for (const word of [/auth token with only the Ingesting permission/, /Settings, then Auth Tokens/, /All datasets/, /Settings, then Endpoints/, /OTLP via HTTP address/, /without a path/, /Start the task/, /Send test span/, /press Check/, /Open in Dash0/, /game's organisation/]) assert.match(brief, word, `the brief says: ${word}`);
  assert.doesNotMatch(brief, /simulated|practice/i, 'it imitates no Dash0 screen');
});

test('no game screen titles itself with a Dash0 screen name or "simulated Dash0", and the words use UK spelling and no em dash', () => {
  const titles = [sortStep.question, choiceStep.question, ...sortStep.sort.buckets.map((b) => b.label), level.name, level.sub];
  assert.deepEqual(vocabularyHits(titles), []);
  const all = JSON.stringify(level.play) + level.name + level.sub;
  assert.doesNotMatch(all, /organization/i);
  assert.ok(!all.includes(String.fromCharCode(0x2014)), 'no em dash');
});

test('the finish text is the same whether or not the task ran: it never names the In Dash0 step or the task', () => {
  assert.doesNotMatch(level.play.finish, /\bin dash0\b/i);
  assert.ok(!level.play.finish.includes('connect-test-span') && !level.play.finish.includes(dash0Step.dash0.id));
});

test('the sort: only an Ingesting-only token, the endpoint and a dataset name may go in the page, and every wrong placement says why', () => {
  const { items, buckets } = sortStep.sort;
  assert.deepEqual(buckets.map((b) => b.id), ['ship', 'keep']);
  assert.deepEqual(items.filter((i) => i.bucket === 'ship').map((i) => i.id), ['ingest-token', 'endpoint', 'dataset-name']);
  assert.deepEqual(items.filter((i) => i.bucket === 'keep').map((i) => i.id), ['all-token', 'read-token', 'edge-token']);
  for (const it of items) {
    const other = it.bucket === 'ship' ? 'keep' : 'ship';
    assert.ok(typeof it.why === 'string' && it.why.length > 20, `${it.id}: has a why`);
    assert.ok(it.whyNot?.[other], `${it.id}: a wrong placement in ${other} says why`);
  }
  // The one token that may go in the page is the one whose permission is only Ingesting, and the labels of the others name theirs.
  assert.match(items.find((i) => i.id === 'ingest-token').label, /only the Ingesting permission/);
  assert.match(items.find((i) => i.id === 'all-token').label, /All permissions/);
  assert.match(items.find((i) => i.id === 'read-token').label, /Reading permission/);
  assert.match(items.find((i) => i.id === 'edge-token').label, /Signal Control edge permission/);
});

test('the choice: the OTLP via HTTP endpoint is the one right answer, and the gRPC decoy does not claim Dash0 refuses gRPC', () => {
  const { choices } = choiceStep.choice;
  assert.deepEqual(choices.filter((c) => c.right).map((c) => c.key), ['http']);
  assert.match(choices.find((c) => c.key === 'http').label, /OTLP via HTTP endpoint/);
  const grpc = choices.find((c) => c.key === 'grpc');
  assert.equal(grpc.keep, true, 'the gRPC decoy is the tempting near-miss the 50/50 keeps');
  assert.match(grpc.why, /does take OTLP over gRPC/, 'Dash0 does accept gRPC (hub OTLP page), so the why blames the browser');
  assert.match(grpc.why, /not supported in a browser/);
  assert.doesNotMatch(grpc.why, /cannot (accept|take)|does not (accept|take)|refuses/);
  assert.match(choices.find((c) => c.key === 'local').why, /4318/);
});

test('signed out: the In Dash0 step is left out, the sort and the choice play to Finish, and skip gets connect-test-span with signed-out', async () => {
  const api = fakeApi({ available: false, reason: 'signed-out' });
  const { results } = open({ api });
  assert.deepEqual(api.skipped, [[['connect-test-span'], 'signed-out']]);
  assert.ok(q('[data-item="ingest-token"]'), 'the sort is the first screen');
  solveSort();
  click('#ctd-next');
  assert.equal(q('#connect-send-start') === null, true, 'no Start for the task');
  solveChoice();
  assert.equal(q('#ctd-finish').disabled, false, 'the choice is the last step shown, so Finish is its button');
  assert.equal(q('#ctd-next') === null, true, 'there is no Next to a third step');
  click('#ctd-finish');
  await settle();
  assert.equal(results.length, 1, 'the level finished once');
  assert.equal(results[0].text, level.play.finish);
  assert.equal(results[0].stars, 5, 'a clean run of the two game steps is five stars');
});

test('with the task available the choice leads on to the In Dash0 step, whose Start draws the send form', async () => {
  const api = fakeApi({ available: true });
  const { results } = open({ api });
  solveSort();
  click('#ctd-next');
  solveChoice();
  assert.equal(q('#ctd-finish') === null, true, 'the choice is not the last step');
  click('#ctd-next');
  assert.ok(q('#connect-send-start'), 'the task starts on the player\'s press');
  assert.equal(q('#connect-send-send').hidden, true, 'the send form waits for Start');
  assert.deepEqual(api.skipped, [], 'nothing skipped');
  click('#connect-send-start');
  await settle();
  assert.deepEqual(api.calls, [['start', 'connect-test-span']]);
  assert.equal(q('#connect-send-send').hidden, false, 'the send form is drawn after Start');
  assert.ok(q('#connect-send-endpoint') && q('#connect-send-token'), 'an endpoint field and a token field');
  assert.equal(results.length, 0);
});

test('wrong answers cost: a misplaced item and a wrong address each count as a mistake, and the right ones cost nothing', () => {
  const api = fakeApi({ available: false, reason: 'off' });
  const { mistakes } = open({ api });
  click('[data-item="all-token"]');
  click('[data-bucket="ship"]'); // a token with All permissions in the page
  assert.equal(mistakes(), 1);
  solveSort();
  assert.equal(mistakes(), 1, 'the right placements cost nothing');
  click('#ctd-next');
  click('[data-pick="grpc"]');
  assert.equal(mistakes(), 2);
  solveChoice();
  assert.equal(mistakes(), 2);
});

test('the level never touches ctx.telemetry itself: the sort and the choice read nothing, signed out or with the task available', () => {
  const forbidden = new Proxy({}, {
    get: (_, prop) => { throw new Error(`the level read ctx.telemetry.${String(prop)}`); },
    has: () => { throw new Error('the level probed ctx.telemetry'); },
  });
  for (const api of [fakeApi({ available: false, reason: 'off' }), fakeApi({ available: true })]) {
    open({ api, telemetry: forbidden });
    solveSort();
    click('#ctd-next');
    solveChoice();
    assert.ok(qa('[data-pick]').length >= 2);
  }
});

test('the source keeps no form, no practice mode and no telemetry import, and never reads ctx.telemetry', () => {
  const src = readFileSync(join(ROOT, 'levels', 'connect-to-dash0.mjs'), 'utf8');
  const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gms)].map((m) => m[1]);
  assert.ok(imports.length >= 2, `the scan reads the imports (${imports.join(', ')})`);
  for (const spec of imports) assert.doesNotMatch(spec, /telemetry|otlp|dash0-task|ingress|practice/, `import ${spec}`);
  const code = src.replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/ctx\.telemetry|PRACTICE|liveAvailable|sendBatch|\.incident\(/.test(code), 'no code reads the session or the practice ingress');
});
