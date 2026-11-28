// #509 P7.1: the readback sender (lib/widgets/dash0-send.mjs) played through runPlay with the real In Dash0 step and a fake
// task client and a fake telemetry session: the form after Start, Check only after an accepted and connected send, the token
// (I1: emptied in the click, only ever given to telemetry.connect), the attempt id on the span, the dataset from the start
// response, what costs a mistake (nothing here), the skip when Dash0 is unavailable, and the filter hint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeDom, q, click } from './helpers/dom.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import { runPlay, STEP_TYPES } from '../lib/play.mjs';
import { isDash0AppUrl } from '../lib/dash0-task/client.mjs';
import COPY from '../content/core/ui/dash0-task.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
const A = 'a'.repeat(16);
const B = 'b'.repeat(16);
const LINK = 'https://app.dash0.com/goto/traces/explorer?from=now-30m&to=now';
const started = (attemptId, extra = {}) => ({ ok: true, attemptId, link: LINK, tag: 'k3j9x2m4q1', readyAfterS: 30, expiresAt: 1767229200000, name: 'oncall-k3j9x2m4q1-connect-test-span-aaaaaa', dataset: 'game-ds', ...extra });
const TOKEN = 'auth_Tk9secretValue42xyz';
const TOKEN2 = 'auth_Other7secretQ99abc';
const ENDPOINT = 'https://ingress.eu-west-1.aws.dash0.com';
const PASS = { outcome: 'pass', charge: false };
const stale = { outcome: 'inconclusive', charge: false, reason: 'expired', restart: true };

const choiceStep = (id) => ({
  intro: 'Which signal tells you where a request spent its time?',
  question: 'Pick one.',
  choice: { id, choices: [{ key: 'a', label: 'A metric', why: 'It aggregates.' }, { key: 'b', label: 'A trace', right: true, why: 'Spans carry timing.' }] },
});
const sendPlay = () => ({ prefix: 'sf', finish: 'You did it, and the level is done.', steps: [choiceStep('c1'), { intro: 'Send a span.', dash0: { id: 'd1', task: 'connect-test-span', grader: 'readback' } }] });
const bossPlay = () => ({ prefix: 'sf', finish: 'You did it, and the level is done.', steps: [choiceStep('c1'), { intro: 'Find it.', dash0: { id: 'd1', task: 'its-us-find', grader: 'seeded', answers: ['operation'], fields: [{ key: 'operation', label: 'The operation' }] } }] });

function fakeApi({ starts = [started(A)], checks = [PASS] } = {}) {
  const calls = [];
  const next = (list, n) => list[Math.min(n, list.length - 1)];
  const api = {
    calls, skipped: [], passes: [],
    available: () => true, reason: () => null, isDash0AppUrl,
    start: async (task) => { const n = calls.filter((c) => c[0] === 'start').length; calls.push(['start', task]); return next(starts, n); },
    check: async (task, attemptId, answer) => { const n = calls.filter((c) => c[0] === 'check').length; calls.push(['check', task, attemptId, ...(answer === undefined ? [] : [answer])]); return next(checks, n); },
    skip: (ids, cause) => { api.skipped.push([ids, cause]); },
    passed: (task) => api.passes.push(task),
    downCause: () => null,
  };
  return api;
}

/** A fake session: `verdicts` answer connect, `outcomes` answer sendTest; `connects` keeps connect's argument and the field it was read from. */
function fakeTele({ verdicts = [{ ok: true }], outcomes = [{ kind: 'accepted' }], connectsOnAccept = true } = {}) {
  let state = 'off';
  const log = [];
  const next = (list, n) => list[Math.min(n, list.length - 1)];
  return {
    log,
    sessionId: 's',
    status: () => ({ state, host: 'h' }),
    connect(arg) {
      const verdict = next(verdicts, log.filter((l) => l.fn === 'connect').length);
      log.push({ fn: 'connect', arg: { ...arg }, fieldAtCall: q('#d1-token')?.value });
      if (verdict.ok) state = 'configured';
      return verdict;
    },
    async sendTest(arg) {
      const pending = next(outcomes, log.filter((l) => l.fn === 'sendTest').length);
      log.push({ fn: 'sendTest', arg: { attemptId: arg.attemptId } });
      const outcome = await pending; // a promise holds the send
      if (outcome.kind === 'accepted' && connectsOnAccept) state = 'connected';
      return outcome;
    },
  };
}

function open(play, { api, telemetry }) {
  const dom = makeDom();
  const reported = [];
  const ctx = createLevelContext({
    level: { id: 'sf', scored: true, scoring: { parMs: null } }, ovBody: dom.body, ovActions: dom.actions, now: () => 0, shuffle: (a) => a, reduceMotion: true,
    onFinish: () => {}, signal: new AbortController().signal, reportError: (e) => reported.push(e), telemetry,
  });
  ctx.dash0Task = api;
  let mistakes = 0;
  const realMistake = ctx.mistake;
  ctx.mistake = () => { mistakes += 1; realMistake(); };
  runPlay({ id: 'sf', cards: [], scored: true, scoring: { parMs: null }, play }, ctx, STEP_TYPES);
  return { ctx, mistakes: () => mistakes, reported };
}
const toTask = () => { click('[data-pick="b"]'); click('#sf-next'); };
const start = async () => { click('#d1-start'); await settle(); };
const type = (token = TOKEN, endpoint = ENDPOINT) => { click({ type: '#d1-endpoint', text: endpoint }); click({ type: '#d1-token', text: token }); };
const send = async (token, endpoint) => { type(token, endpoint); click('#d1-send-go'); await settle(); };
const feedback = () => q('#d1-feedback').textContent;
const rig = (over = {}) => {
  const api = fakeApi(over.api);
  const telemetry = fakeTele(over.tele);
  return { api, telemetry, ...open(over.play ?? sendPlay(), { api, telemetry }) };
};

test('the send form appears only after Start, and Check stays off until a send is accepted AND the session is connected', async () => {
  const r = rig();
  toTask();
  assert.equal(q('#d1-send').hasAttribute('hidden'), true, 'no form before Start');
  assert.equal(q('#d1-check').disabled, true);
  await start();
  assert.equal(q('#d1-send').hasAttribute('hidden'), false);
  assert.equal(q('#d1-check').disabled, true, 'started is not sent');
  assert.equal(q('#d1-token').getAttribute('type'), 'password', 'the kit secret field');
  assert.match(q('#d1-send-first').textContent, new RegExp(COPY.sendFirst));
  await send();
  assert.equal(q('#d1-check').disabled, false);
  assert.equal(feedback(), COPY.send.accepted);
  assert.ok(r.telemetry.log.length > 0);
  // accepted, but the session did not become connected: Check stays off
  const r2 = rig({ tele: { connectsOnAccept: false } });
  toTask();
  await start();
  await send();
  assert.equal(q('#d1-check').disabled, true, 'an accepted outcome alone does not unlock Check');
  assert.equal(feedback(), COPY.send.unreachable['not-connected']);
  assert.equal(r2.mistakes(), 0);
});

test('Send empties the token field before any await, the token goes only to telemetry.connect, and the span carries this attempt id (a 410 then a new attempt)', async () => {
  const r = rig({ api: { starts: [started(A), started(B)], checks: [stale, PASS] } });
  toTask();
  await start();
  type();
  click('#d1-send-go');
  assert.equal(q('#d1-token').value, '', 'emptied in the same click, before the first await');
  assert.equal(r.telemetry.log[0].fn, 'connect', 'connect ran synchronously in the click');
  assert.equal(r.telemetry.log[0].fieldAtCall, '', 'the field was already empty when connect ran');
  assert.deepEqual(r.telemetry.log[0].arg, { endpoint: ENDPOINT, token: TOKEN, dataset: 'game-ds' });
  await settle();
  assert.deepEqual(r.telemetry.log.find((l) => l.fn === 'sendTest').arg, { attemptId: A });
  click('#d1-check');
  await settle();
  click('#d1-retry'); // Start again after the 410
  await settle();
  await send(); // empty field: the held token is reused
  const sends = r.telemetry.log.filter((l) => l.fn === 'sendTest');
  assert.deepEqual(sends.map((s) => s.arg.attemptId), [A, B], 'each send names its own attempt');
  assert.equal(JSON.stringify(r.api.calls).includes(TOKEN), false, 'the token never reaches the task API');
});

test('Start again resets the sent state, and a re-send reuses the held token', async () => {
  const r = rig({ api: { starts: [started(A), started(B)], checks: [stale, PASS] } });
  toTask();
  await start();
  await send();
  assert.equal(q('#d1-check').disabled, false);
  click('#d1-check');
  await settle();
  click('#d1-retry');
  await settle();
  assert.equal(q('#d1-check').disabled, true, 'a new attempt has sent nothing');
  assert.equal(q('#d1-send-first').hasAttribute('hidden'), false);
  assert.match(q('#d1-held').textContent, /still held/);
  await send(); // nothing typed
  const connects = r.telemetry.log.filter((l) => l.fn === 'connect');
  assert.equal(connects.length, 2);
  assert.equal(connects[1].arg.token, TOKEN, 'the held token is reused');
  assert.equal(q('#d1-check').disabled, false);
  // a newly typed token replaces the held one
  const r2 = rig({ api: { starts: [started(A), started(B)], checks: [stale, PASS] } });
  toTask();
  await start();
  await send(TOKEN);
  click('#d1-check');
  await settle();
  click('#d1-retry');
  await settle();
  await send(TOKEN2);
  assert.equal(r2.telemetry.log.filter((l) => l.fn === 'connect')[1].arg.token, TOKEN2);
});

test('the dataset is the start response, and there is no dataset field', async () => {
  const r = rig();
  toTask();
  await start();
  assert.equal(q('#d1-dataset') === null, true);
  assert.equal(document.querySelectorAll('#d1-send input').length, 2, 'endpoint and token only');
  await send();
  assert.equal(r.telemetry.log[0].arg.dataset, 'game-ds');
});

test('a form error, a refused token (401 or 403) and an unreachable Dash0 cost no mistake, and a refused token never shows its status', async () => {
  const cases = [
    ['form error', { verdicts: [{ ok: false, field: 'endpoint', reason: 'grpc-port' }] }],
    ['empty token', { verdicts: [{ ok: false, field: 'token', reason: 'empty' }] }],
    ['401', { outcomes: [{ kind: 'rejected', status: 401, auth: true }] }],
    ['403', { outcomes: [{ kind: 'rejected', status: 403, auth: true }] }],
    ['network', { outcomes: [{ kind: 'unreachable', cause: 'network' }] }],
    ['timeout', { outcomes: [{ kind: 'unreachable', cause: 'timeout' }] }],
  ];
  for (const [name, tele] of cases) {
    const r = rig({ tele });
    toTask();
    await start();
    await send();
    assert.equal(r.mistakes(), 0, name);
    assert.equal(q('#d1-check').disabled, true, name);
    assert.doesNotMatch(feedback(), /40[13]/, `${name}: no status code`);
    assert.doesNotMatch(feedback(), new RegExp(TOKEN), name);
    assert.ok(feedback().length > 0, name);
  }
  const refused = rig({ tele: { outcomes: [{ kind: 'rejected', status: 401, auth: true }] } });
  toTask();
  await start();
  await send();
  assert.match(feedback(), /refused this token/);
});

test('when the player\'s own Dash0 is unavailable in this browser, "Finish without the In Dash0 task" is offered with cause off', async () => {
  const r = rig({ tele: { verdicts: [{ ok: false, field: 'session', reason: 'unavailable' }] } });
  toTask();
  await start();
  assert.equal(q('#d1-skip') === null, true);
  await send();
  assert.ok(q('#d1-skip'), 'the skip is on offer');
  assert.equal(q('#d1-skip').textContent, COPY.skip);
  click('#d1-skip');
  assert.deepEqual(r.api.skipped, [[['connect-test-span'], 'off']]);
  assert.equal(r.mistakes(), 0);
});

test('the token is in no frame, no reportError and no task API argument', async () => {
  const r = rig({ tele: { outcomes: [{ kind: 'rejected', status: 400, auth: false, message: 'bad request' }, { kind: 'unreachable', cause: 'network' }, { kind: 'accepted' }] } });
  const frames = [];
  toTask();
  await start();
  for (let i = 0; i < 3; i += 1) {
    type(i === 0 ? TOKEN : '');
    click('#d1-send-go');
    frames.push(globalThis.document.body.innerHTML); // the frame while the span is in flight
    await settle();
    frames.push(globalThis.document.body.innerHTML, globalThis.document.body.textContent);
  }
  click('#d1-check');
  await settle();
  frames.push(globalThis.document.body.innerHTML);
  for (const f of frames) assert.equal(f.includes(TOKEN), false, 'no frame holds the token');
  assert.deepEqual(r.reported, []);
  assert.equal(JSON.stringify(r.api.calls).includes(TOKEN), false);
  assert.equal(JSON.stringify(r.api.calls).includes('token'), false);
});

test('the source of the send widget touches no storage, location, console or cookie', () => {
  const src = readFileSync(new URL('../lib/widgets/dash0-send.mjs', import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const bad of [/localStorage/, /sessionStorage/, /indexedDB/, /\bwindow\b/, /\blocation\b/, /\bconsole\b/, /\bcookie\b/, /history\./, /navigator\./, /\bfetch\b/]) assert.doesNotMatch(src, bad, String(bad));
});

test('a seeded task with a filter hint tells the player which id to filter on; one without draws none', async () => {
  rig({ play: bossPlay(), api: { starts: [started(A, { name: undefined, dataset: undefined })] } });
  toTask();
  await start();
  const info = q('#d1-info').textContent;
  assert.ok(info.includes(`In the Trace Explorer, look for the attribute game.attempt.id with the value ${A}.`), info);
  assert.equal(q('#d1-send') === null, true, 'a seeded task has no send form');
  rig();
  toTask();
  await start();
  assert.equal(q('#d1-info').textContent.includes('Trace Explorer'), false);
});

/** A promise whose resolution the test controls. */
const hold = () => {
  let done;
  const promise = new Promise((resolve) => { done = resolve; });
  return { promise, done };
};
const count = (r, fn) => r.telemetry.log.filter((l) => l.fn === fn).length;

test('single-flight: two quick Sends give one connect and one sendTest', async () => {
  const gate = hold();
  const r = rig({ tele: { outcomes: [gate.promise] } });
  toTask();
  await start();
  type();
  click('#d1-send-go');
  q('#d1-send-go').onclick(); // a second press before the first answer
  await settle();
  assert.equal(count(r, 'connect'), 1);
  assert.equal(count(r, 'sendTest'), 1);
  assert.equal(q('#d1-send-go').disabled, true);
  gate.done({ kind: 'accepted' });
  await settle();
  assert.equal(q('#d1-send-go').disabled, false);
});

test('a Start again during a send does not free Send, and a second Send is dropped until the old one answers', async () => {
  const gate = hold();
  const r = rig({ api: { starts: [started(A), started(B)] }, tele: { outcomes: [gate.promise] } });
  toTask();
  await start();
  type();
  click('#d1-send-go');
  await settle();
  q('#d1-start').onclick(); // a new attempt begins while the old send is in flight
  await settle();
  assert.equal(q('#d1-send-go').disabled, true, 'reset does not clear an in-flight send');
  type(TOKEN2);
  q('#d1-send-go').onclick();
  await settle();
  assert.equal(count(r, 'connect'), 1);
  assert.equal(q('#d1-send-go').disabled, true);
  assert.equal(q('#d1-token').value, '', 'the early return still scrubs the token field');
  assert.match(q('#d1-held').textContent, /still held/, 'and the held note shows');
  gate.done({ kind: 'accepted' });
  await settle();
  assert.equal(q('#d1-send-go').disabled, false, 'the old send answered: Send is free again');
  assert.equal(count(r, 'connect'), 1);
});

test('a send answered while no attempt is open leaves Send off, and Start again frees it', async () => {
  const stale409 = hold();
  const gate = hold();
  const r = rig({ api: { starts: [started(A), started(B)], checks: [stale409.promise] }, tele: { outcomes: [{ kind: 'accepted' }, gate.promise] } });
  toTask();
  await start();
  await send();
  click('#d1-check'); // the 409 is held
  type();
  click('#d1-send-go');
  await settle();
  stale409.done(stale);
  await settle();
  gate.done({ kind: 'accepted' });
  await settle();
  assert.equal(count(r, 'sendTest'), 2);
  assert.equal(q('#d1-send-go').disabled, true, 'no attempt is open: Send stays off');
  click('#d1-retry');
  await settle();
  assert.equal(q('#d1-send-go').disabled, false);
});

test('while a second Send is in flight Check is off, because the replaced session is not connected', async () => {
  const gate = hold();
  const r = rig({ tele: { outcomes: [{ kind: 'accepted' }, gate.promise] } });
  toTask();
  await start();
  await send();
  assert.equal(q('#d1-check').disabled, false);
  type();
  click('#d1-send-go');
  assert.equal(q('#d1-check').disabled, true, 'off the moment connect replaced the session');
  gate.done({ kind: 'accepted' });
  await settle();
  assert.equal(q('#d1-check').disabled, false);
  assert.equal(count(r, 'sendTest'), 2);
});

test('a late accepted send for an old attempt unlocks nothing for the new one', async () => {
  const gate = hold();
  const r = rig({ api: { starts: [started(A), started(B)] }, tele: { outcomes: [gate.promise] } });
  toTask();
  await start();
  type();
  click('#d1-send-go');
  await settle();
  q('#d1-start').onclick();
  await settle();
  gate.done({ kind: 'accepted' });
  await settle();
  assert.equal(q('#d1-check').disabled, true, 'the new attempt has sent nothing');
  assert.equal(q('#d1-send-first').hasAttribute('hidden'), false, 'the send-first note stays');
  assert.notEqual(feedback(), COPY.send.accepted);
  assert.equal(r.mistakes(), 0);
});

test('a token Dash0 refused is forgotten: a 401 from the send, and connect refusing the token', async () => {
  const paths = [
    ['401', { outcomes: [{ kind: 'rejected', status: 401, auth: true }, { kind: 'accepted' }] }],
    ['connect refuses the token', { verdicts: [{ ok: false, field: 'token', reason: 'empty' }, { ok: true }] }],
  ];
  for (const [name, tele] of paths) {
    const r = rig({ tele });
    toTask();
    await start();
    await send(TOKEN);
    assert.equal(q('#d1-held').textContent, '', `${name}: nothing held`);
    await send(''); // an empty field
    const connects = r.telemetry.log.filter((l) => l.fn === 'connect');
    assert.equal(connects[0].arg.token, TOKEN, name);
    assert.equal(connects[1].arg.token, '', `${name}: the refused token is not tried again`);
  }
});

test('Send reads and empties the token field even when it returns early, and the form is off while there is no attempt', async () => {
  const r = rig({ api: { starts: [started(A), started(B)], checks: [stale, PASS] } });
  toTask();
  await start();
  await send();
  click('#d1-check');
  await settle();
  assert.equal(q('#d1-token').disabled, true, 'no attempt: the token field is off');
  assert.equal(q('#d1-endpoint').disabled, true);
  assert.equal(q('#d1-send-go').disabled, true);
  q('#d1-token').value = TOKEN2;
  q('#d1-send-go').onclick(); // dispatched anyway
  await settle();
  assert.equal(q('#d1-token').value, '', 'emptied on the early return');
  assert.equal(count(r, 'connect'), 1, 'nothing sent without an attempt');
  click('#d1-retry');
  await settle();
  assert.equal(q('#d1-token').disabled, false, 'Start again turns the form back on');
  assert.equal(q('#d1-send-go').disabled, false);
});

// linkedom has no focus model: track focus() calls and serve them as document.activeElement (as test/dash0-task-step.test.mjs does).
function trackFocus() {
  let active = globalThis.document.body;
  Object.defineProperty(globalThis.document, 'activeElement', { get: () => active, configurable: true });
  globalThis.window.HTMLElement.prototype.focus = function focus() { active = this; };
}
// the id (or tag) of the focused element: comparing DOM nodes makes a failing assert diff the whole page
const focused = () => globalThis.document.activeElement?.id || globalThis.document.activeElement?.localName;

test('after an accepted send focus lands on Check, not the page', async () => {
  rig();
  toTask();
  await start();
  trackFocus();
  type();
  q('#d1-send-go').focus();
  assert.equal(focused(), 'd1-send-go', 'the rig holds focus on Send');
  click('#d1-send-go');
  await settle();
  assert.equal(q('#d1-send-first').hasAttribute('hidden'), true);
  assert.equal(focused(), 'd1-check');
});

test('a token typed during a send survives the earlier token being refused, and the next Send uses it', async () => {
  const gate = hold();
  const r = rig({ tele: { outcomes: [gate.promise, { kind: 'accepted' }] } });
  toTask();
  await start();
  type();
  click('#d1-send-go');
  await settle();
  click({ type: '#d1-token', text: TOKEN2 });
  q('#d1-send-go').onclick(); // dropped while in flight, but the token is kept
  await settle();
  gate.done({ kind: 'rejected', status: 401, auth: true });
  await settle();
  assert.match(q('#d1-held').textContent, /still held/, 'the newer token is still held');
  click('#d1-send-go');
  await settle();
  const connects = r.telemetry.log.filter((l) => l.fn === 'connect');
  assert.equal(connects[connects.length - 1].arg.token, TOKEN2);
});

test('Send keeps focus while a send is in flight (aria-disabled, not disabled), and is plain again afterwards', async () => {
  const gate = hold();
  rig({ tele: { outcomes: [gate.promise] } });
  toTask();
  await start();
  trackFocus();
  type();
  q('#d1-send-go').focus();
  click('#d1-send-go');
  assert.equal(focused(), 'd1-send-go', 'focus stays on Send');
  assert.equal(q('#d1-send-go').getAttribute('aria-disabled'), 'true');
  assert.equal(q('#d1-send-go').disabled, false, 'not disabled, or focus would be lost');
  gate.done({ kind: 'accepted' });
  await settle();
  assert.equal(q('#d1-send-go').hasAttribute('aria-disabled'), false);
  assert.equal(q('#d1-send-go').disabled, false);
});

test('a send that is not focused is hard-disabled in flight as before', async () => {
  const gate = hold();
  rig({ tele: { outcomes: [gate.promise] } });
  toTask();
  await start();
  trackFocus();
  type();
  click('#d1-send-go');
  assert.equal(q('#d1-send-go').disabled, true);
  gate.done({ kind: 'accepted' });
  await settle();
});

test('when the attempt ends (410) with focus in the send form, focus moves to Start again', async () => {
  rig({ api: { starts: [started(A), started(B)], checks: [stale] }, tele: { outcomes: [{ kind: 'rejected', status: 500 }] } });
  toTask();
  await start();
  trackFocus();
  await send(); // not accepted: Check stays off
  q('#d1-send-go').focus();
  // the attempt ends (410) while Send holds focus: Check is forced on only to reach that path
  q('#d1-check').disabled = false;
  q('#d1-check').onclick();
  await settle();
  assert.equal(focused(), 'd1-retry');
});
