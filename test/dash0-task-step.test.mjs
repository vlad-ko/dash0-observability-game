// #509 P6: the In Dash0 step type (lib/widgets/dash0-task*.mjs) played through runPlay with the real STEP_TYPES.dash0 and a
// fake task client: the link allowlist, what costs a mistake, the skipped task when the server is off or signed out, the
// paused clock, the finish-text rule, no Ask the guide, and "Finish without the In Dash0 task" when the server goes down mid-step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, q, qa, click } from './helpers/dom.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import { runPlay, STEP_TYPES, validatePlay } from '../lib/play.mjs';
import { createDash0TaskClient, isDash0AppUrl } from '../lib/dash0-task/client.mjs';
import { findStep, guideAllowed } from '../lib/guide/context.mjs';
import { howToView } from '../lib/how-to-play.mjs';
import { DOWN_AFTER, validateDash0Spec } from '../lib/widgets/dash0-task.mjs';
import { stepsOf } from './helpers/step-drivers.mjs';
import { bindText } from '../lib/content/bind.mjs';
import { checkPlain } from '../lib/content/text-rules.mjs';
import { externalLink } from '../lib/ui/index.mjs';
import COPY from '../content/core/ui/dash0-task.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
const GOOD_LINK = 'https://app.dash0.com/goto/traces/explorer?from=now-30m&to=now';
const STARTED = { ok: true, attemptId: 'a1', link: GOOD_LINK, tag: 'k3j9x2m4q1', readyAfterS: 30, expiresAt: 1767229200000 };
const PASS = { outcome: 'pass', charge: false };

const choiceStep = (id) => ({
  intro: 'Which signal tells you where a request spent its time?',
  question: 'Pick one.',
  choice: { id, choices: [{ key: 'a', label: 'A metric', why: 'It aggregates.' }, { key: 'b', label: 'A trace', right: true, why: 'Spans carry timing.' }] },
});
const dash0Spec = (id = 'd1', extra = {}) => ({ id, task: 'its-us-find', grader: 'seeded', answers: ['operation'], fields: [{ key: 'operation', label: 'The operation', hint: 'Read it off the chart.' }], ...extra });
const dash0Step = (id = 'd1', extra) => ({ intro: 'Now find the slowest route in Dash0.', dash0: dash0Spec(id, extra) });
const playOf = (...steps) => ({ prefix: 'sf', finish: 'You did it, and the level is done.', steps });
const FULL = () => playOf(choiceStep('c1'), dash0Step('d1'), choiceStep('c2'));

/** A fake task client: `start` and `check` answer from the lists (the last answer repeats), every call is recorded. */
function fakeApi({ starts = [STARTED], checks = [PASS], available = true, reason = null } = {}) {
  const calls = [];
  const next = (list, n) => list[Math.min(n, list.length - 1)];
  let down = null;
  const api = {
    calls,
    skipped: [],
    passes: [],
    available: () => available,
    reason: () => reason,
    isDash0AppUrl,
    start: async (task) => {
      const n = calls.filter((c) => c[0] === 'start').length;
      calls.push(['start', task]);
      return next(starts, n);
    },
    check: async (task, attemptId, answer) => {
      const n = calls.filter((c) => c[0] === 'check').length;
      calls.push(['check', task, attemptId, ...(answer === undefined ? [] : [answer])]); // a readback check passes no answer
      return next(checks, n);
    },
    skip: (ids, cause) => { api.skipped.push([ids, cause]); down = cause; },
    passed: (task) => api.passes.push(task),
    downCause: () => down,
  };
  return api;
}

/** Open `play` on the real ctx. `clock.t` is the level clock; `types` for a fixture type. */
function open(play, { api, level = { id: 'sf', scored: true, scoring: { parMs: null } }, clock = { t: 0 }, types = STEP_TYPES, guide = null } = {}) {
  const dom = makeDom();
  const results = [];
  const ctx = createLevelContext({
    level, ovBody: dom.body, ovActions: dom.actions, now: () => clock.t, shuffle: (a) => a, reduceMotion: true,
    onFinish: (id, r) => results.push(r), signal: new AbortController().signal, reportError: (e) => { throw e; }, guide,
  });
  if (api) ctx.dash0Task = api;
  let mistakes = 0;
  const realMistake = ctx.mistake;
  ctx.mistake = () => { mistakes += 1; realMistake(); };
  runPlay({ ...level, cards: [], play }, ctx, types);
  return { ctx, results, clock, mistakes: () => mistakes };
}
/** To the In Dash0 step of FULL(): the choice step, then Next. */
const toTask = () => { click('[data-pick="b"]'); click('#sf-next'); };
const start = async () => { click('#d1-start'); await settle(); };
const check = async (text = '412') => { click({ type: '#d1-f-operation', text }); click('#d1-check-operation'); await settle(); };
const feedback = () => q('#d1-feedback').textContent;

test('the link: a deep link on app.dash0.com is an anchor that opens a new tab safely; any other origin draws no anchor', async () => {
  const run = open(FULL(), { api: fakeApi() });
  toTask();
  await start();
  const a = q('#d1-open');
  assert.ok(a, 'a good link is drawn');
  assert.equal(a.getAttribute('href'), GOOD_LINK);
  assert.equal(a.getAttribute('target'), '_blank');
  assert.deepEqual(a.getAttribute('rel').split(' ').sort(), ['noopener', 'noreferrer']);
  assert.equal(a.textContent, COPY.open);
  assert.ok(run);
  for (const link of ['https://evil.example/goto', 'https://app.dash0.com.evil.example/', 'https://app.dash0.com@evil.example/', 'http://app.dash0.com/', 'javascript:alert(1)']) {
    open(FULL(), { api: fakeApi({ starts: [{ ...STARTED, link }] }) });
    toTask();
    await start();
    assert.equal(q('#d1-open') === null, true, link);
    assert.equal(qa('#ov-body a, a').length, 0, `no anchor at all for ${link}`);
    assert.ok(q('#d1-f-operation'), 'the task itself still runs');
  }
});

test('a started task shows the tag, when the data is ready and, for a readback task, the asset name', async () => {
  open(FULL(), { api: fakeApi({ starts: [{ ...STARTED, name: 'oncall-k3j9x2m4q1-p95-a1b2' }] }) });
  toTask();
  assert.equal(q('#d1-task').hasAttribute('hidden'), true, 'the fields wait for Start');
  await start();
  assert.equal(q('#d1-task').hasAttribute('hidden'), false);
  const text = q('#d1-info').textContent;
  assert.match(text, /oncall-k3j9x2m4q1-p95-a1b2/);
  assert.match(text, /k3j9x2m4q1/);
  assert.match(text, /30 seconds/);
  open(FULL(), { api: fakeApi() });
  toTask();
  await start();
  assert.doesNotMatch(q('#d1-info').textContent, /oncall-/, 'a seeded task has no asset name');
});

test('a step with several questions has a Check for each, one question per call, and passes when every one has passed', async () => {
  const two = dash0Step('d1', { answers: ['operation', 'faultCode'], fields: [{ key: 'operation', label: 'The operation' }, { key: 'faultCode', label: 'The fault code' }] });
  const api = fakeApi({ checks: [PASS, { outcome: 'fail', charge: true, reason: 'answer' }, PASS] });
  const run = open(playOf(choiceStep('c1'), two), { api });
  toTask();
  await start();
  click({ type: '#d1-f-operation', text: 'POST /pay' });
  click('#d1-check-operation');
  await settle();
  assert.equal(q('#sf-finish').disabled, true, 'one question is not the step');
  assert.match(feedback(), /1 to go/);
  assert.equal(q('#d1-check-operation').disabled, true, 'a passed question is locked');
  click({ type: '#d1-f-faultCode', text: '500' });
  click('#d1-check-faultCode');
  await settle();
  assert.equal(run.mistakes(), 1);
  assert.equal(q('#sf-finish').disabled, true);
  click('#d1-check-faultCode');
  await settle();
  assert.equal(q('#sf-finish').disabled, false, 'every question passed');
  assert.deepEqual(api.calls.filter((c) => c[0] === 'check').map((c) => c[3]), [{ question: 'operation', value: 'POST /pay' }, { question: 'faultCode', value: '500' }, { question: 'faultCode', value: '500' }]);
  assert.deepEqual(api.passes, ['its-us-find'], 'passed once, at the end');
});

test('Check sends the answer fields to the client; the answer is read from the fields, trimmed', async () => {
  const api = fakeApi();
  open(FULL(), { api });
  toTask();
  await start();
  await check('  412 ');
  assert.deepEqual(api.calls, [['start', 'its-us-find'], ['check', 'its-us-find', 'a1', { question: 'operation', value: '412' }]]);
});

test('a charged fail calls mistake once; an uncharged fail and an inconclusive result call it never and say why and when to retry; pass enables Next', async () => {
  const api = fakeApi({
    checks: [
      { outcome: 'fail', charge: true, field: 'operation' },
      { outcome: 'fail', charge: false, reason: 'default', retryAfterS: 7 },
      { outcome: 'inconclusive', charge: false, reason: 'settling', retryAfterS: 30 },
      PASS,
    ],
  });
  const run = open(FULL(), { api });
  toTask();
  await start();
  await check();
  assert.equal(run.mistakes(), 1, 'charged fail: one mistake');
  assert.match(feedback(), /The operation/, 'it names the field');
  assert.equal(q('#d1-feedback').getAttribute('data-tone'), 'error');
  assert.equal(q('#sf-next').disabled, true);
  await check();
  assert.equal(run.mistakes(), 1, 'an uncharged fail costs nothing');
  assert.match(feedback(), /Try again in 7 seconds/);
  assert.equal(q('#sf-next').disabled, true);
  await check();
  assert.equal(run.mistakes(), 1, 'an inconclusive result costs nothing');
  assert.match(feedback(), /still receiving your data/);
  assert.match(feedback(), /Try again in 30 seconds/);
  assert.equal(q('#d1-feedback').getAttribute('data-tone'), 'neutral', 'not an error tone');
  assert.equal(q('#sf-next').disabled, true);
  assert.equal(q('#d1-retry').textContent, COPY.retry, 'Retry is a button');
  click('#d1-retry');
  await settle();
  assert.equal(api.calls.filter((c) => c[0] === 'check').length, 4, 'Retry checks again');
  assert.equal(run.mistakes(), 1);
  assert.equal(q('#sf-next').disabled, false, 'pass enables Next');
  assert.deepEqual(api.passes, ['its-us-find']);
  assert.equal(q('#d1-check-operation').disabled, true, 'nothing more to check');
  assert.equal(q('#d1-feedback').getAttribute('data-tone'), 'success');
});

test('Finish is enabled by a pass on the last step too, and the level finishes with the finish text', async () => {
  const run = open(playOf(choiceStep('c1'), dash0Step('d1')), { api: fakeApi() });
  toTask();
  await start();
  assert.equal(q('#sf-finish').disabled, true);
  await check();
  assert.equal(q('#sf-finish').disabled, false);
  click('#sf-finish');
  assert.equal(run.results.length, 1);
  assert.equal(run.results[0].text, 'You did it, and the level is done.');
});

test('a late answer after the step was left draws and charges nothing', async () => {
  let release;
  const api = fakeApi();
  api.check = () => new Promise((resolve) => { release = resolve; });
  const run = open(FULL(), { api });
  toTask();
  await start();
  click({ type: '#d1-f-operation', text: '1' });
  click('#d1-check-operation');
  q('#ov-body').innerHTML = '';
  release({ outcome: 'fail', charge: true });
  await settle();
  assert.equal(run.mistakes(), 0);
});

test('a restart result (a stale or expired attempt) offers Start again, not a plain retry, and a fresh attempt replaces it', async () => {
  const api = fakeApi({ starts: [STARTED, { ...STARTED, attemptId: 'a2' }], checks: [{ outcome: 'inconclusive', charge: false, reason: 'expired', restart: true }, PASS] });
  const run = open(FULL(), { api });
  toTask();
  await start();
  await check();
  assert.match(feedback(), /ran out of time/);
  assert.equal(q('#d1-retry').textContent, COPY.restart);
  click('#d1-retry');
  await settle();
  await check();
  assert.deepEqual(api.calls.map((c) => c[0]), ['start', 'check', 'start', 'check']);
  assert.equal(api.calls[3][2], 'a2', 'the new attempt is the one checked');
  assert.equal(q('#sf-next').disabled, false);
  assert.equal(run.mistakes(), 0);
});

test('off or signed out: no task call at all, the step is left out, the cause and the task id are handed to skip', () => {
  for (const reason of ['off', 'signed-out']) {
    const api = fakeApi({ available: false, reason });
    open(FULL(), { api });
    assert.equal(q('#d1-start') === null, true, `${reason}: no Start`);
    click('[data-pick="b"]');
    click('#sf-next');
    assert.equal(q('#d1-start') === null, true, `${reason}: the middle step is gone`);
    assert.ok(q('[data-pick="b"]'), `${reason}: the next screen is the game step`);
    assert.deepEqual(api.calls, [], `${reason}: nothing asked`);
    assert.deepEqual(api.skipped, [[['its-us-find'], reason]], reason);
  }
});

test('with the real client, a signed-out player sends no POST and the step is skipped', async () => {
  const requests = [];
  const client = createDash0TaskClient({
    fetch: async (url, init = {}) => (requests.push(init.method ?? 'GET'), { status: 200, json: async () => ({ v: 1, on: true }) }),
    signedIn: () => false,
  });
  await client.load();
  const skipped = [];
  open(FULL(), { api: { ...client, skip: (ids, cause) => skipped.push([ids, cause]) } });
  assert.equal(q('#d1-start') === null, true);
  assert.deepEqual(requests, ['GET'], 'only the status read');
  assert.deepEqual(skipped, [[['its-us-find'], 'signed-out']]);
});

test('with the real client, a Start that gets 400 {field: v} three times is an outage: the skip is offered; a seeded Check with 400 {field: answer} is refused', async () => {
  const reply = (status, body) => ({ status, json: async () => body });
  const make = (post) => createDash0TaskClient({ fetch: async (url, init = {}) => (init.method === 'POST' ? post(JSON.parse(init.body)) : reply(200, { v: 1, on: true })), signedIn: () => true });
  const bad = make(() => reply(400, { ok: false, error: 'bad-request', field: 'v' }));
  await bad.load();
  const skipped = [];
  open(FULL(), { api: { ...bad, skip: (ids, cause) => skipped.push([ids, cause]) } });
  toTask();
  await start();
  for (let i = 0; i < DOWN_AFTER - 1; i++) { click('#d1-retry'); await settle(); }
  assert.ok(q('#d1-skip'), 'three contract 400s: finish without the task');
  click('#d1-skip');
  assert.deepEqual(skipped, [[['its-us-find'], 'off']]);
  const okStart = { v: 1, ok: true, attemptId: 'a1', link: GOOD_LINK, tag: 'k3j9x2m4q1', readyAfterS: 30, expiresAt: 1 };
  const refuse = make((b) => (b.op === 'start' ? reply(200, okStart) : reply(400, { ok: false, error: 'bad-request', field: 'answer' })));
  await refuse.load();
  open(FULL(), { api: { ...refuse, skip: () => assert.fail('never skipped') } });
  toTask();
  await start();
  for (let i = 0; i < DOWN_AFTER + 1; i++) await check();
  assert.equal(q('#d1-skip') === null, true);
  assert.match(feedback(), new RegExp(COPY.reasons.refused));
});

test('no ctx.dash0Task (debug, no fetch): the step is left out and nothing is said', () => {
  const run = open(FULL(), {});
  assert.equal(run.ctx.dash0Task, null);
  assert.equal(q('#d1-start') === null, true);
  assert.ok(q('[data-pick="b"]'));
});

test('par covers the game steps only: the clock is paused while the In Dash0 step is on screen', async () => {
  const level = { id: 'sf', scored: true, scoring: { parMs: 1000 } };
  const clock = { t: 0 };
  const run = open(FULL(), { api: fakeApi(), level, clock });
  clock.t = 100;
  toTask();
  await start();
  clock.t = 100000; // 100 seconds in Dash0
  await check();
  click('#sf-next');
  clock.t = 100200;
  click('[data-pick="b"]');
  clock.t = 100300;
  click('#sf-finish');
  assert.equal(run.results[0].stars, 5, 'about 300 ms of game time is under the 1000 ms par');
  // the same level without the task takes as long as its game steps
  const plain = { t: 0 };
  const game = open(FULL(), { api: fakeApi({ available: false, reason: 'off' }), level, clock: plain });
  plain.t = 300;
  click('[data-pick="b"]');
  click('#sf-next');
  click('[data-pick="b"]');
  click('#sf-finish');
  assert.equal(game.results[0].stars, run.results[0].stars, 'par does not depend on whether the task ran');
});

test('par still bites after the In Dash0 step: game time over par on the steps after it costs a star (the clock runs again)', async () => {
  const level = { id: 'sf', scored: true, scoring: { parMs: 1000 } };
  const clock = { t: 0 };
  const run = open(FULL(), { api: fakeApi(), level, clock });
  clock.t = 100;
  toTask();
  await start();
  clock.t = 100000; // 100 seconds in Dash0: not counted
  await check();
  click('#sf-next');
  clock.t = 108000; // 8 seconds on the game step after it: over the 1000 ms par
  click('[data-pick="b"]');
  click('#sf-finish');
  assert.ok(run.results[0].stars < 5, `over par after the task is a star lost, got ${run.results[0].stars}`);
});

test('a level that ends on the In Dash0 step does not count the time in Dash0 either', async () => {
  const level = { id: 'sf', scored: true, scoring: { parMs: 1000 } };
  const clock = { t: 0 };
  const run = open(playOf(choiceStep('c1'), dash0Step('d1')), { api: fakeApi(), level, clock });
  clock.t = 200;
  toTask();
  await start();
  clock.t = 500000;
  await check();
  click('#sf-finish');
  assert.equal(run.results[0].stars, 5);
});

test('the level clock: pause and resume are idempotent and the time stopped is never counted', () => {
  const dom = makeDom();
  const clock = { t: 0 };
  const results = [];
  const ctx = createLevelContext({
    level: { id: 'x', scored: true, scoring: { parMs: 1000 } }, ovBody: dom.body, ovActions: dom.actions, now: () => clock.t,
    onFinish: (id, r) => results.push(r), signal: new AbortController().signal,
  });
  ctx.resumeClock();
  clock.t = 100;
  ctx.pauseClock();
  clock.t = 5000;
  ctx.pauseClock();
  clock.t = 9000;
  ctx.resumeClock();
  ctx.resumeClock();
  clock.t = 9200;
  ctx.finish({ text: 'done' });
  assert.equal(results[0].stars, 5, '300 ms of play');
});

test('validatePlay: a finish text that refers to an In Dash0 step is refused', () => {
  const ok = validatePlay(FULL());
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.surfaces, ['game', 'dash0']);
  assert.deepEqual(ok.widgets, ['choice'], 'the In Dash0 step adds no widget, mechanic or help');
  for (const finish of [
    'You found it In Dash0 and the level is done.',
    'You read the its-us-find result and the level is done.',
    'Your d1 answer was right, so the level is done.',
  ]) {
    const got = validatePlay({ ...FULL(), finish });
    assert.equal(got.errors.length, 1, finish);
    assert.match(got.errors[0], /play\.finish refers to the In Dash0 step|play\.finish refers to an In Dash0 step/, finish);
  }
  assert.deepEqual(validatePlay({ ...FULL(), finish: 'The d10 route is slow; sort it out, and the level is done.' }).errors, [], 'a word that only contains the id is fine');
  // a level with no In Dash0 step may say anything about Dash0
  assert.deepEqual(validatePlay(playOf(choiceStep('c1'))).errors, []);
  assert.deepEqual(validatePlay({ ...playOf(choiceStep('c1')), finish: 'Now you can read it In Dash0 and the level is done.' }).errors, []);
});

test('the In Dash0 spec: id, task, grader and, for a seeded task, answers with a labelled field each', () => {
  assert.deepEqual(validateDash0Spec(dash0Spec()), []);
  assert.deepEqual(validateDash0Spec(dash0Spec('d1', { answers: ['faultCode', 'traceId'], fields: [{ key: 'faultCode', label: 'F' }, { key: 'traceId', label: 'T' }] })), [], 'question ids are plain words, camelCase allowed');
  assert.deepEqual(validateDash0Spec({ id: 'd1', task: 'connect-test-span', grader: 'readback' }), [], 'a readback task has no answers and no fields');
  const readback = (extra) => validateDash0Spec({ id: 'd1', task: 'connect-test-span', grader: 'readback', ...extra });
  assert.ok(readback({ answers: ['name'] }).some((p) => /readback task has no answers/.test(p)));
  assert.ok(readback({ fields: [{ key: 'name', label: 'N' }] }).some((p) => /readback task has no fields/.test(p)));
  assert.ok(readback({ answers: [], fields: [] }).length === 2, 'even empty lists are refused');
  assert.ok(validateDash0Spec({ id: 'd1', task: 'its-us-find', grader: 'seeded' }).some((p) => /non-empty/.test(p)), 'a seeded task needs its answers');
  // the server's question ids: letters only, 1 to 40 of them (api/dash0-task.mjs)
  for (const key of ['p95', 'fault_code', 'fault-code', '', 'a'.repeat(41), '9a']) {
    assert.ok(validateDash0Spec(dash0Spec('d1', { answers: [key], fields: [{ key, label: 'L' }] })).length > 0, `"${key}" is not a question id`);
  }
  assert.deepEqual(validateDash0Spec(dash0Spec('d1', { answers: ['a'.repeat(40)], fields: [{ key: 'a'.repeat(40), label: 'L' }] })).filter((p) => /question ids/.test(p)), [], '40 letters is the longest (the task still has to know the question)');
  const bad = (extra, re) => assert.ok(validateDash0Spec(dash0Spec('d1', extra)).some((p) => re.test(p)), JSON.stringify(extra));
  bad({ grader: 'magic' }, /grader/);
  bad({ task: 'Not Kebab' }, /task/);
  bad({ task: undefined }, /task/);
  bad({ extra: 1 }, /unknown key "extra"/);
  bad({ answers: [], fields: [] }, /non-empty/);
  bad({ answers: undefined }, /non-empty/);
  bad({ answers: ['p-95'], fields: [{ key: 'p-95', label: 'L' }] }, /question ids/);
  bad({ answers: ['operation', 'operation'] }, /unique/);
  bad({ answers: ['operation', 'other'] }, /"other" has no field/);
  bad({ fields: [] }, /"operation" has no field/);
  bad({ fields: [{ key: 'operation', label: 'L' }, { key: 'extra', label: 'E' }] }, /"extra" is not in answers/);
  bad({ fields: [{ key: 'operation', label: ' ' }] }, /needs a label/);
  bad({ fields: [{ key: 'operation', label: 'L', secret: 'x' }] }, /unknown key "secret"/);
  bad({ fields: 'no' }, /fields must be an array/);
  assert.deepEqual(validateDash0Spec(null), ['spec: not an object']);
  // through validatePlay, the problem names the step
  const got = validatePlay(playOf(choiceStep('c1'), dash0Step('d1', { grader: 'nope' })));
  assert.ok(got.errors.some((e) => /step 2 \(dash0 "d1"\): spec grader/.test(e)), got.errors.join('|'));
});

test('the guide is not mounted on an In Dash0 step, even when the step type has hints', () => {
  const guide = { configured: true, ask: async () => ({}) };
  const withHints = { ...STEP_TYPES, dash0: { ...STEP_TYPES.dash0, hints: () => true } };
  for (const types of [STEP_TYPES, withHints]) {
    open(FULL(), { api: fakeApi(), guide, types });
    assert.ok(q('#guide-q'), 'the game step has the guide');
    click('[data-pick="b"]');
    click('#sf-next');
    assert.ok(q('#d1-start'), 'now on the In Dash0 step');
    assert.equal(q('#guide-q') === null, true, 'no guide on the In Dash0 step');
  }
  const spec = dash0Spec();
  assert.equal(guideAllowed(STEP_TYPES.dash0, spec), false);
  assert.equal(guideAllowed(withHints.dash0, spec), false);
  assert.equal(guideAllowed(STEP_TYPES.choice, {}), true, 'the rule is only about In Dash0');
});

test('findStep finds an In Dash0 step by its widget id, with the real type', () => {
  const level = { play: FULL() };
  const got = findStep(level, 'd1');
  assert.equal(got.type, STEP_TYPES.dash0);
  assert.equal(got.spec.task, 'its-us-find');
  assert.equal(findStep(level, 'c2').type, STEP_TYPES.choice);
  assert.equal(findStep(level, 'nope'), null);
});

test('the step drivers know the runPlay filter: the harness has no task server, so In Dash0 steps are left out', () => {
  const level = { play: FULL() };
  assert.deepEqual(stepsOf(level).map((s) => s.key), ['choice', 'choice']);
  assert.deepEqual(stepsOf(level, { dash0: true }).map((s) => s.key), ['choice', 'dash0', 'choice']);
  assert.equal(stepsOf(level, { dash0: true })[1].driver, undefined, 'no driver: a fake client plays it');
});

test('the How to play topic for In Dash0 is added only when the task server is on, and says what it costs', () => {
  const level = { widgets: ['choice'], surfaces: ['game', 'dash0'], hintless: [], scored: true, scoring: { parMs: null } };
  assert.deepEqual(howToView(level).topics.map((t) => t.key), ['choice']);
  assert.deepEqual(howToView(level, { dash0: true }).topics.map((t) => t.key), ['choice', 'dash0']);
  assert.deepEqual(howToView({ ...level, surfaces: ['game'] }, { dash0: true }).topics.map((t) => t.key), ['choice'], 'a level with no In Dash0 step has no such topic');
  const dash0 = howToView(level, { dash0: true }).topics[1];
  assert.equal(dash0.title, 'In Dash0');
  assert.match(dash0.parts.find((p) => p.label === 'What costs a star').text, /wrong answer/);
});

// ---- the server goes down while the player is on the step (D7) ----

const down = (cause) => ({ outcome: 'inconclusive', charge: false, reason: cause, down: cause });
const unsure = { outcome: 'inconclusive', charge: false, reason: 'network', retryAfterS: 60 };

test('a 503 or a 401 on Check offers "Finish without the In Dash0 task" at once; it records the skip, costs nothing and opens Next', async () => {
  for (const cause of ['off', 'signed-out']) {
    const api = fakeApi({ checks: [down(cause)] });
    const run = open(FULL(), { api });
    toTask();
    await start();
    assert.equal(q('#d1-skip') === null, true, 'not offered while all is well');
    await check();
    assert.ok(q('#d1-skip'), `${cause}: offered`);
    assert.equal(q('#d1-skip').textContent, 'Finish without the In Dash0 task');
    assert.equal(q('#sf-next').disabled, true, 'not yet skipped');
    click('#d1-skip');
    assert.deepEqual(api.skipped, [[['its-us-find'], cause]], cause);
    assert.equal(q('#sf-next').disabled, false, `${cause}: never stuck`);
    assert.equal(run.mistakes(), 0, 'no star lost');
    assert.equal(feedback(), COPY.notices[cause], 'the player is told what to do later');
    assert.equal(q('#d1-check-operation').disabled, true);
  }
});

test('Start itself can find the server down: the same offer', async () => {
  const api = fakeApi({ starts: [{ ok: false, outcome: 'inconclusive', reason: 'off', down: 'off' }] });
  open(FULL(), { api });
  toTask();
  await start();
  assert.ok(q('#d1-skip'));
  assert.equal(q('#d1-info').textContent, '', 'no task was started');
  click('#d1-skip');
  assert.deepEqual(api.skipped, [[['its-us-find'], 'off']]);
  assert.equal(q('#sf-next').disabled, false);
});

test(`${DOWN_AFTER} checks in a row that cannot be judged offer it; "still arriving" does not count, a verdict resets the count`, async () => {
  const settling = { outcome: 'inconclusive', charge: false, reason: 'settling', retryAfterS: 20 };
  const api = fakeApi({ checks: [unsure, unsure, settling, unsure] });
  const run = open(FULL(), { api });
  toTask();
  await start();
  await check();
  await check();
  assert.equal(q('#d1-skip') === null, true, 'two are not enough');
  await check();
  assert.equal(q('#d1-skip') === null, true, 'settling is not a failure of the server');
  await check();
  assert.ok(q('#d1-skip'), 'the third that cannot be judged');
  assert.equal(run.mistakes(), 0);
  // a wrong answer is a verdict: it resets the count
  const api2 = fakeApi({ checks: [unsure, unsure, { outcome: 'fail', charge: true }, unsure, unsure] });
  open(FULL(), { api: api2 });
  toTask();
  await start();
  for (let i = 0; i < 5; i++) await check();
  assert.equal(q('#d1-skip') === null, true, 'a fail between them starts the count again');
  assert.equal(api2.skipped.length, 0);
});

test('Retry after an inconclusive result keeps working, and a later pass never needs the skip', async () => {
  const api = fakeApi({ checks: [unsure, unsure, unsure, PASS] });
  open(FULL(), { api });
  toTask();
  await start();
  await check();
  await check();
  await check();
  assert.ok(q('#d1-skip'));
  click('#d1-retry');
  await settle();
  assert.equal(q('#sf-next').disabled, false, 'the server came back and the answer passed');
  assert.deepEqual(api.skipped, []);
  assert.equal(q('#d1-skip') === null, true, 'the offer goes away once the task is done');
});

test('after one skip, a later In Dash0 step of the same level is skipped at once, without asking the server again', async () => {
  const api = fakeApi({ checks: [down('off')] });
  const run = open(playOf(choiceStep('c1'), dash0Step('d1'), readbackStep('d2'), choiceStep('c2')), { api });
  toTask();
  await start();
  await check();
  click('#d1-skip');
  click('#sf-next');
  assert.ok(q('#d2-start'), 'the second In Dash0 step is on screen');
  assert.equal(q('#sf-next').disabled, false, 'already open');
  assert.equal(q('#d2-feedback').textContent, COPY.notices.off);
  assert.deepEqual(api.skipped, [[['its-us-find'], 'off'], [['connect-test-span'], 'off']]);
  assert.deepEqual(api.calls.map((c) => c[0]), ['start', 'check'], 'no second start');
  assert.equal(run.mistakes(), 0);
  click('#sf-next');
  assert.ok(q('[data-pick="b"]'), 'back in the game');
});

test('content binds an In Dash0 step: text and field labels from the content, task, grader and answer keys from the logic', () => {
  const logic = { id: 'lv', play: { prefix: 'p', steps: [{ dash0: { id: 'd1', task: 'its-us-find', grader: 'seeded', answers: ['operation'] } }] } };
  const text = { id: 'lv', play: { finish: 'You did the thing well.', steps: [{ intro: 'Find it.', question: 'How slow?', dash0: { id: 'd1', fields: [{ key: 'operation', label: 'The operation', hint: 'Read the chart.' }] } }] } };
  const got = bindText(text, logic);
  assert.deepEqual(got.errors, []);
  assert.deepEqual(got.value.play.steps[0].dash0, { id: 'd1', task: 'its-us-find', grader: 'seeded', answers: ['operation'], fields: [{ key: 'operation', label: 'The operation', hint: 'Read the chart.' }] });
  assert.deepEqual(validateDash0Spec(got.value.play.steps[0].dash0), []);
  // the logic-only keys may not be written in the content
  const bad = bindText({ ...text, play: { ...text.play, steps: [{ ...text.play.steps[0], dash0: { id: 'd1', task: 'x-task', fields: [] } }] } }, logic);
  assert.ok(bad.errors.some((e) => /task/.test(e)), bad.errors.join('|'));
});

test('the words of the In Dash0 step follow the text rules and cover every cause the client can name', () => {
  const strings = [];
  const walk = (v) => (typeof v === 'string' ? strings.push(v) : Object.values(v).forEach(walk));
  walk(COPY);
  for (const s of strings) assert.deepEqual(checkPlain(s), [], s);
  for (const reason of ['off', 'signed-out', 'settling', 'cooldown', 'not-visible', 'upstream', 'not-sent', 'ingest', 'answer', 'network', 'rate-limited', 'expired', 'stale', 'unavailable', 'default']) assert.ok(COPY.reasons[reason], reason);
  assert.deepEqual(Object.keys(COPY.notices).sort(), ['off', 'signed-out']);
  assert.equal(COPY.skip, 'Finish without the In Dash0 task');
  for (const s of strings) assert.doesNotMatch(s, /task server/i, 'a player never reads "task server": it is Dash0');
  assert.equal(COPY.reasons['signed-out'], 'Sign in with your dash0.com account to try again, or finish the level without this task.');
  const howTo = JSON.stringify(howToView({ widgets: ['choice'], surfaces: ['game', 'dash0'], hintless: [], scored: true, scoring: { parMs: null } }, { dash0: true }));
  assert.doesNotMatch(howTo, /task server/i);
});

test('the kit link opens a new tab safely, escapes its address, and takes only https', () => {
  assert.equal(
    externalLink({ id: 'go', label: 'Open in Dash0', href: 'https://app.dash0.com/goto/x?a=1&b="2"' }),
    '<a class="ui-btn ui-btn--ghost" id="go" href="https://app.dash0.com/goto/x?a=1&amp;b=&quot;2&quot;" target="_blank" rel="noopener noreferrer">Open in Dash0</a>',
  );
  for (const href of ['http://app.dash0.com/', 'javascript:alert(1)', '/local', '//evil.example/x', 'https://a b/', undefined]) assert.throws(() => externalLink({ label: 'x', href }), /externalLink/, String(href));
});

// ---- readback: no answer, no field ----

const readbackStep = (id = 'd1') => ({ intro: 'Build the asset in Dash0.', dash0: { id, task: 'connect-test-span', grader: 'readback' } });

test('a readback task draws one Check with no field and sends no answer; a wrong asset is a charged fail with its own words', async () => {
  const api = fakeApi({ starts: [{ ...STARTED, name: 'oncall-k3j9x2m4q1-board-a1b2' }], checks: [{ outcome: 'fail', charge: true }, PASS] });
  const play = playOf(choiceStep('c1'), readbackStep());
  assert.deepEqual(validatePlay(play).errors, []);
  const run = open(play, { api });
  toTask();
  assert.equal(q('#d1-check').disabled, true, 'nothing to check before Start');
  await start();
  assert.equal(qa('#d1-task input').length, 0, 'no field');
  assert.equal(q('#d1-check').disabled, false);
  click('#d1-check');
  await settle();
  assert.deepEqual(api.calls[1], ['check', 'connect-test-span', 'a1'], 'no answer argument at all');
  assert.equal(run.mistakes(), 1);
  assert.equal(feedback(), COPY.failedAsset);
  click('#d1-check');
  await settle();
  assert.equal(q('#sf-finish').disabled, false);
  assert.deepEqual(api.passes, ['connect-test-span']);
});

// ---- a safe restart (a 409 or a 410) ----

const TWO = () => dash0Step('d1', { answers: ['operation', 'faultCode'], fields: [{ key: 'operation', label: 'The operation' }, { key: 'faultCode', label: 'The fault code' }] });
const stale = { outcome: 'inconclusive', charge: false, reason: 'stale', restart: true };

test('Start again after a 409 resets every field: the question that had passed is open and empty, and the step can pass', async () => {
  const api = fakeApi({ starts: [STARTED, { ...STARTED, attemptId: 'a2' }], checks: [PASS, stale, PASS, PASS] });
  const run = open(playOf(choiceStep('c1'), TWO()), { api });
  toTask();
  await start();
  click({ type: '#d1-f-operation', text: 'POST /pay' });
  click('#d1-check-operation');
  await settle();
  assert.equal(q('#d1-f-operation').disabled, true, 'the first question passed and is locked');
  click({ type: '#d1-f-faultCode', text: '500' });
  click('#d1-check-faultCode');
  await settle();
  assert.equal(q('#d1-retry').textContent, COPY.restart);
  assert.equal(q('#d1-check-operation').disabled, true, 'no attempt: nothing to check');
  assert.equal(q('#d1-check-faultCode').disabled, true, 'no attempt: nothing to check');
  click('#d1-retry');
  await settle();
  for (const key of ['operation', 'faultCode']) {
    assert.equal(q(`#d1-f-${key}`).disabled, false, `${key} is open again`);
    assert.equal(q(`#d1-f-${key}`).value, '', `${key} is empty again`);
    assert.equal(q(`#d1-check-${key}`).disabled, false, `${key} can be checked`);
  }
  click({ type: '#d1-f-operation', text: 'POST /pay' });
  click('#d1-check-operation');
  await settle();
  click({ type: '#d1-f-faultCode', text: '500' });
  click('#d1-check-faultCode');
  await settle();
  assert.equal(q('#sf-finish').disabled, false, 'every question passed on the new attempt');
  assert.deepEqual(api.calls.filter((c) => c[0] === 'check').map((c) => c[2]), ['a1', 'a1', 'a2', 'a2']);
  assert.deepEqual(api.passes, ['its-us-find']);
  assert.equal(run.mistakes(), 0);
});

test('Check stays disabled while there is no attempt: before Start, after a failed Start and after a 410', async () => {
  const api = fakeApi({ starts: [{ ok: false, outcome: 'inconclusive', reason: 'ingest', retryAfterS: 10 }, STARTED], checks: [{ ...stale, reason: 'expired' }] });
  open(FULL(), { api });
  toTask();
  assert.equal(q('#d1-check-operation').disabled, true, 'before Start');
  await start();
  assert.equal(q('#d1-check-operation').disabled, true, 'Start failed: still no attempt');
  click('#d1-retry');
  await settle();
  assert.equal(q('#d1-check-operation').disabled, false, 'an attempt');
  await check();
  assert.equal(q('#d1-check-operation').disabled, true, 'the attempt expired');
});

// ---- only a real outage counts towards "Finish without the In Dash0 task" ----

const inconclusive = (reason) => ({ outcome: 'inconclusive', charge: false, reason, retryAfterS: 5 });

test('cooldown, answer, settling, rate-limited and not-sent never count: any number of them offers no skip', async () => {
  for (const reason of ['cooldown', 'answer', 'settling', 'rate-limited', 'not-sent']) {
    const api = fakeApi({ checks: [inconclusive(reason)] });
    const run = open(FULL(), { api });
    toTask();
    await start();
    for (let i = 0; i < DOWN_AFTER + 2; i++) await check();
    assert.equal(q('#d1-skip') === null, true, `${reason}: no skip, however often`);
    assert.deepEqual(api.skipped, [], reason);
    assert.equal(q('#sf-next').disabled, true, `${reason}: the step still has to be done`);
    assert.equal(run.mistakes(), 0);
  }
});

test('not-visible counts for a seeded task only 3 x readyAfterS after its Start (a slow Dash0 is not a missing one): the third then offers the skip, with its own line', async () => {
  const api = fakeApi({ checks: [inconclusive('not-visible')] });
  const clock = { t: 1000 };
  const run = open(FULL(), { api, clock });
  toTask();
  await start(); // the attempt starts at t = 1 s
  const checkAt = async (s) => { clock.t = 1000 + s * 1000; await check(); };
  for (const s of [31, 37, 43]) await checkAt(s);
  assert.equal(q('#d1-skip') === null, true, 'three not-visible inside 90 s are a slow Dash0: nothing is offered');
  // the early ones neither count nor reset: after 90 s it takes DOWN_AFTER more
  await checkAt(91);
  await checkAt(97);
  assert.equal(q('#d1-skip') === null, true, 'two after 90 s are not enough');
  await checkAt(103);
  assert.ok(q('#d1-skip'), 'the third after 90 s');
  assert.ok(feedback().includes(COPY.offerNoData), 'it says the data has not shown up');
  assert.doesNotMatch(feedback(), /not answering/, 'Dash0 did answer: it found no data');
  click('#d1-skip');
  assert.deepEqual(api.skipped, [[['its-us-find'], 'off']]);
  assert.equal(run.mistakes(), 0);
  // an outage in the count keeps the outage line
  const api2 = fakeApi({ checks: [inconclusive('not-visible'), inconclusive('upstream'), inconclusive('network')] });
  const clock2 = { t: 0 };
  open(FULL(), { api: api2, clock: clock2 });
  toTask();
  await start();
  clock2.t = 100_000;
  for (let i = 0; i < 3; i++) await check();
  assert.ok(q('#d1-skip'));
  assert.ok(feedback().includes(COPY.offer));
  const rb = fakeApi({ checks: [inconclusive('not-visible')] });
  const rbClock = { t: 0 };
  open(playOf(choiceStep('c1'), readbackStep()), { api: rb, clock: rbClock });
  toTask();
  await start();
  rbClock.t = 1e9; // long after the data should have shown
  for (let i = 0; i < DOWN_AFTER + 2; i++) { click('#d1-check'); await settle(); }
  assert.equal(q('#d1-skip') === null, true, 'a readback task never gives up on not-visible');
  assert.deepEqual(rb.skipped, []);
});

test('network, unavailable, upstream and ingest do count: the third offers the skip, and it is recorded as off', async () => {
  for (const reason of ['network', 'unavailable', 'upstream', 'ingest']) {
    const api = fakeApi({ checks: [inconclusive(reason)] });
    open(FULL(), { api });
    toTask();
    await start();
    await check();
    await check();
    assert.equal(q('#d1-skip') === null, true, `${reason}: two are not enough`);
    await check();
    assert.ok(q('#d1-skip'), `${reason}: the third`);
    click('#d1-skip');
    assert.deepEqual(api.skipped, [[['its-us-find'], 'off']], reason);
  }
});

test('paced results between outages neither reset nor add to the count; a 401 keeps its own cause and does not say Dash0 is silent', async () => {
  const api = fakeApi({ checks: [inconclusive('network'), inconclusive('cooldown'), inconclusive('upstream'), inconclusive('settling'), inconclusive('ingest')] });
  open(FULL(), { api });
  toTask();
  await start();
  for (let i = 0; i < 4; i++) await check();
  assert.equal(q('#d1-skip') === null, true, 'two outages and two paced results');
  await check();
  assert.ok(q('#d1-skip'), 'the third outage');
  const api2 = fakeApi({ checks: [inconclusive('network'), inconclusive('cooldown'), { outcome: 'inconclusive', charge: false, reason: 'signed-out', down: 'signed-out' }] });
  open(FULL(), { api: api2 });
  toTask();
  await start();
  for (let i = 0; i < 3; i++) await check();
  assert.equal(feedback(), COPY.reasons['signed-out'], 'sign in, or finish without the task; never "not answering"');
  assert.doesNotMatch(feedback(), /not answering/);
  click('#d1-skip');
  assert.deepEqual(api2.skipped, [[['its-us-find'], 'signed-out']]);
});

test(`${DOWN_AFTER} refused answers (the server's 400 or 413) are the player's input, not an outage: no skip offer, no charge, and the words say so`, async () => {
  const refused = { outcome: 'inconclusive', charge: false, reason: 'refused' };
  const api = fakeApi({ checks: [refused] });
  const run = open(FULL(), { api });
  toTask();
  await start();
  for (let i = 0; i < DOWN_AFTER + 1; i++) await check();
  assert.equal(q('#d1-skip') === null, true, 'a healthy server is never given up on for refusing an answer');
  assert.deepEqual(api.skipped, []);
  assert.equal(run.mistakes(), 0);
  assert.match(q('#d1-feedback').textContent, /Dash0 could not take that answer\. Change it and try again\./);
  assert.doesNotMatch(q('#d1-feedback').textContent, /not answering/);
  assert.doesNotMatch(q('#d1-feedback').textContent, /seconds/, 'no wait is named');
});

test('an answer over 200 characters is refused here: a message, no request, no charge', async () => {
  const api = fakeApi();
  const run = open(FULL(), { api });
  toTask();
  await start();
  const before = api.calls.length;
  await check('x'.repeat(201));
  assert.equal(api.calls.length, before, 'nothing was sent');
  assert.match(q('#d1-feedback').textContent, /That answer is too long\. Type just the value\./);
  assert.equal(run.mistakes(), 0);
  assert.equal(q('#d1-check-operation').disabled, false, 'the field is still open');
  await check('x'.repeat(200));
  assert.equal(api.calls.length, before + 1, '200 characters go');
});

// linkedom has no focus model: track focus() calls and serve them as document.activeElement (as test/game.test.mjs does).
function trackFocus() {
  let active = globalThis.document.body;
  Object.defineProperty(globalThis.document, 'activeElement', { get: () => active, configurable: true });
  globalThis.window.HTMLElement.prototype.focus = function focus() { active = this; };
}

test('focus stays inside the step: after a wrong Check, after a partial pass, and after a redrawn Retry', async () => {
  const wrong = { outcome: 'fail', charge: true };
  const api = fakeApi({ checks: [wrong, PASS] });
  const run = open(FULL(), { api });
  toTask();
  await start();
  trackFocus();
  const doc = globalThis.document;
  q('#d1-check-operation').focus();
  click({ type: '#d1-f-operation', text: '412' });
  q('#d1-check-operation').focus();
  click('#d1-check-operation');
  assert.equal(doc.activeElement.id, 'd1-check-operation', 'the pressed Check keeps focus while it runs');
  assert.equal(q('#d1-check-operation').disabled, false, 'a focused button is never disabled: a browser would drop focus to the page');
  assert.equal(q('#d1-check-operation').getAttribute('aria-disabled'), 'true', 'a second press is still refused, and said so');
  await settle();
  assert.notEqual(doc.activeElement.localName, 'body', 'not thrown to the page after a wrong answer');
  assert.equal(doc.activeElement.id, 'd1-check-operation');
  assert.equal(run.mistakes(), 1);
  assert.equal(q('#d1-check-operation').getAttribute('aria-disabled'), null, 'free again once the result is in');
});

test('focus after a partial pass goes to the next open field; Retry redrawn keeps focus', async () => {
  const spec = { answers: ['operation', 'faultCode'], fields: [{ key: 'operation', label: 'The operation' }, { key: 'faultCode', label: 'The fault code' }] };
  const api = fakeApi({ checks: [PASS] });
  open(playOf(dash0Step('d1', spec)), { api });
  trackFocus();
  await start();
  const doc = globalThis.document;
  q('#d1-check-operation').focus();
  click('#d1-check-operation');
  await settle();
  assert.notEqual(doc.activeElement.localName, 'body');
  assert.equal(doc.activeElement.id, 'd1-f-faultCode', 'the next open field');
  // Retry: a network error draws Retry; pressing it again draws a new Retry that must keep focus
  const api2 = fakeApi({ checks: [unsure] });
  open(FULL(), { api: api2 });
  trackFocus(); // a new level, a new document
  toTask();
  await start();
  const doc2 = globalThis.document;
  q('#d1-check-operation').focus();
  click('#d1-check-operation');
  await settle();
  q('#d1-retry').focus();
  click('#d1-retry');
  await settle();
  assert.equal(doc2.activeElement.id, 'd1-retry', 'the redrawn Retry has focus');
});

test('a Check that gets a 409 or a 410 moves focus to Start again, for a seeded and a readback task', async () => {
  const cases = [
    ['seeded 409', FULL(), stale, '#d1-check-operation', async () => { click({ type: '#d1-f-operation', text: '412' }); }],
    ['seeded 410', FULL(), { ...stale, reason: 'expired' }, '#d1-check-operation', async () => { click({ type: '#d1-f-operation', text: '412' }); }],
    ['readback 409', playOf(choiceStep('c1'), readbackStep()), stale, '#d1-check', async () => {}],
    ['readback 410', playOf(choiceStep('c1'), readbackStep()), { ...stale, reason: 'expired' }, '#d1-check', async () => {}],
  ];
  for (const [name, play, res, btn, fill] of cases) {
    const api = fakeApi({ checks: [res] });
    open(play, { api });
    toTask();
    await start();
    trackFocus();
    await fill();
    q(btn).focus();
    click(btn);
    await settle();
    assert.equal(q(btn).disabled, true, `${name}: no attempt to check`);
    assert.equal(globalThis.document.activeElement.id, 'd1-retry', `${name}: focus is on Start again`);
    assert.equal(q('#d1-retry').textContent, COPY.restart, name);
  }
});

test('a 409 does not steal focus when the Check did not have it', async () => {
  const api = fakeApi({ checks: [stale] });
  open(FULL(), { api });
  toTask();
  await start();
  trackFocus();
  q('#d1-f-operation').focus();
  click({ type: '#d1-f-operation', text: '412' });
  click('#d1-check-operation');
  await settle();
  assert.equal(globalThis.document.activeElement.id, 'd1-f-operation');
});

// ---- tasks pinned to their grader (#515 R9) ----

test('validation refuses a task the server does not know, and a grader or a question that does not match the task', () => {
  const unknown = validateDash0Spec(dash0Spec('d1', { task: 'made-up-task' }));
  assert.ok(unknown.some((p) => /not a task the server knows/.test(p)), unknown.join('|'));
  assert.ok(validatePlay(playOf(choiceStep('c1'), dash0Step('d1', { task: 'made-up-task' }))).errors.length > 0, 'a level cannot ship it');
  const seededAsReadback = validateDash0Spec({ id: 'd1', task: 'its-us-find', grader: 'readback' });
  assert.ok(seededAsReadback.some((p) => /graded as seeded, not readback/.test(p)), seededAsReadback.join('|'));
  const readbackAsSeeded = validateDash0Spec(dash0Spec('d1', { task: 'connect-test-span' }));
  assert.ok(readbackAsSeeded.some((p) => /graded as readback, not seeded/.test(p)), readbackAsSeeded.join('|'));
  const badQuestion = validateDash0Spec(dash0Spec('d1', { answers: ['whatever'], fields: [{ key: 'whatever', label: 'W' }] }));
  assert.ok(badQuestion.some((p) => /not a question of task/.test(p)), badQuestion.join('|'));
  assert.deepEqual(validateDash0Spec(dash0Spec('d1')), []);
});
