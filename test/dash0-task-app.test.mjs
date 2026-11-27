// #509 P6 (D7): the app's side of the In Dash0 step: createGame builds ctx.dash0Task from the page's fetch and the account's
// signed-in state; a level that runs without its task says so on the reward and in the hub, and remembers the task; debug never
// asks. A fake fetch routed by URL, one fake storage, the real index.html shell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDom, q, click } from './helpers/dom.mjs';
import { fakeStorage } from './helpers/fake-storage.mjs';
import { buildRegistry } from '../lib/registry.mjs';
import { runPlay, validatePlay } from '../lib/play.mjs';
import { createGame } from '../app.mjs';
import { readSkipped, SKIPPED_KEY } from '../lib/dash0-task/prefs.mjs';
import { RESET_KEYS } from '../lib/reset-mode.mjs';
import COPY from '../content/core/ui/dash0-task.mjs';

const HTML = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
const NOW = 1767225600000;
const settle = () => new Promise((resolve) => setImmediate(resolve));
const LINK = 'https://app.dash0.com/goto/traces/explorer';

// The registry wants a mechanic step, so the game steps are Spot it steps: pick the user line, press Check.
const gameStep = (id) => ({
  intro: 'One attribute on this span will blow up your bill.',
  question: 'Spot the attribute that has unbounded values.',
  spot: {
    id,
    target: 'span',
    lines: [{ id: 'route', text: 'http.route=/pay' }, { id: 'user', text: 'user.id=8841' }, { id: 'status', text: 'http.status_code=200' }],
    faults: ['user'],
    whyNot: { route: 'A route comes from a small fixed set.' },
    explain: 'A user id has a new value for every user.',
  },
});
const playGame = (id) => { click('[data-line="user"]'); click(`#${id}-check`); };
const PLAY = {
  prefix: 'dt',
  finish: 'You did it, and the level is done.',
  steps: [
    gameStep('s1'),
    { intro: 'Now find the slowest route in Dash0.', dash0: { id: 'd1', task: 'p95-task', grader: 'seeded', answers: ['p95'], fields: [{ key: 'p95', label: 'The p95 in ms' }] } },
  ],
};
const REG = buildRegistry(
  [{
    id: 'a0', no: 0, name: 'First act',
    levels: [
      { id: 'with-task', no: '0.1', name: 'With a task', icon: '*', rewardTitle: 'Title', play: PLAY },
      { id: 'game-only', no: '0.2', name: 'Game only', icon: '*', rewardTitle: 'Other title', play: { ...PLAY, steps: [gameStep('s1'), gameStep('s2')] } },
    ],
    boss: null,
  }],
  { deck: [], nodeIds: [], play: { validatePlay, runPlay } },
);

const json = (status, body) => ({ status, json: async () => body });
/** A page: `server` is GET/POST /api/dash0-task's answers, `account` GET /api/account's. Every request is recorded. */
function rig({ on = true, signedIn = true, debug = false, store = fakeStorage(), start = { v: 1, ok: true, attemptId: 'a1', link: LINK, tag: 'k3j9x2m4q1', readyAfterS: 30, expiresAt: 1 }, check = { v: 1, outcome: 'pass', charge: false }, noFetch = false } = {}) {
  const dom = makeDom(HTML);
  const requests = [];
  const errors = [];
  const fetch = async (url, init = {}) => {
    requests.push({ url, method: init.method ?? 'GET', body: init.body === undefined ? undefined : JSON.parse(init.body) });
    if (url === '/api/dash0-task') return init.method === 'POST' ? json(200, JSON.parse(init.body).op === 'start' ? start : check) : json(200, { v: 1, on });
    if (url === '/api/account') return json(200, signedIn ? { v: 1, configured: true, signedIn: true, nick: 'ada', listed: false } : { v: 1, configured: true, signedIn: false });
    return json(404, {});
  };
  const game = createGame({
    registry: REG, deck: [], storage: () => store, document: dom.document, window: { addEventListener() {} }, now: () => NOW, rand: () => 0,
    reportError: (e) => errors.push(e), setTimeout: () => {}, clearTimeout: () => {}, debug, ...(noFetch ? {} : { fetch }),
  });
  game.init();
  return { game, store, requests, errors, dom };
}
const dash0Requests = (r) => r.requests.filter((x) => x.url === '/api/dash0-task');
const finishGameOnly = async (r, id) => {
  r.game.openLevel(id);
  playGame('s1');
  click('#dt-finish');
  await settle();
};

test('available: the server on and a signed-in player run the In Dash0 step; the page asks the status once, at init', async () => {
  const r = rig();
  await settle();
  assert.deepEqual(dash0Requests(r).map((x) => x.method), ['GET']);
  r.game.openLevel('with-task');
  assert.ok(r.game.howTo.topics.some((t) => t.key === 'dash0'), 'the In Dash0 guide is offered');
  playGame('s1');
  click('#dt-next');
  assert.ok(q('#d1-start'), 'the In Dash0 step is shown');
  click('#d1-start');
  await settle();
  click({ type: '#d1-f-p95', text: '412' });
  click('#d1-check-p95');
  await settle();
  assert.deepEqual(dash0Requests(r).map((x) => x.body ?? null), [null, { v: 1, op: 'start', taskId: 'p95-task' }, { v: 1, op: 'check', taskId: 'p95-task', attemptId: 'a1', answer: { question: 'p95', value: '412' } }]);
  click('#dt-finish');
  assert.equal(r.game.rewardNotice, '', 'nothing was left out');
  assert.equal(r.game.taskWaiting('with-task'), false);
  assert.equal(r.store.data.has(SKIPPED_KEY), false);
});

for (const [name, opts, notice] of [
  ['the server is off', { on: false }, COPY.notices.off],
  ['the player is signed out', { signedIn: false }, COPY.notices['signed-out']],
]) {
  test(`${name}: no task request, the step is left out, the reward says so, the task is remembered and the hub marks the level`, async () => {
    const r = rig(opts);
    await settle();
    r.game.openLevel('with-task');
    assert.equal(q('#d1-start') === null, true, 'no In Dash0 step');
    assert.deepEqual(dash0Requests(r).filter((x) => x.method === 'POST'), [], 'no POST');
    assert.equal(r.game.howTo.topics.some((t) => t.key === 'dash0'), false, 'no In Dash0 guide for a step that does not run');
    playGame('s1');
    click('#dt-finish');
    await settle();
    assert.equal(r.game.rewardNotice, notice);
    assert.deepEqual(JSON.parse(r.store.data.get(SKIPPED_KEY)), { v: 1, levels: { 'with-task': ['p95-task'] } }, 'the skipped task id is saved');
    assert.equal(r.game.taskWaiting('with-task'), true);
    assert.equal(r.game.taskWaiting('game-only'), false);
    assert.match(r.game.levelLabel('with-task'), new RegExp(COPY.waitingLabel));
    assert.doesNotMatch(r.game.levelLabel('game-only'), new RegExp(COPY.waitingLabel));
    assert.ok(q('#reward-dash0'), 'the reward card has its notice line');
  });
}

test('the two notices are different and say what to do', () => {
  assert.match(COPY.notices.off, /Come back once the admin restores the connection to Dash0/);
  assert.match(COPY.notices['signed-out'], /Sign in with your dash0\.com account/);
  assert.notEqual(COPY.notices.off, COPY.notices['signed-out']);
});

test('a level with no In Dash0 step says nothing and remembers nothing, whatever the server says', async () => {
  const r = rig({ on: false });
  await settle();
  r.game.openLevel('game-only');
  playGame('s1');
  click('#dt-next');
  playGame('s2');
  click('#dt-finish');
  assert.equal(r.game.rewardNotice, '');
  assert.equal(r.store.data.has(SKIPPED_KEY), false);
});

test('once the server is back the level offers the task again, and doing it takes the marker away', async () => {
  const store = fakeStorage();
  const first = rig({ on: false, store });
  await settle();
  await finishGameOnly(first, 'with-task');
  assert.equal(first.game.taskWaiting('with-task'), true);
  const again = rig({ on: true, store });
  await settle();
  assert.equal(again.game.taskWaiting('with-task'), true, 'remembered across visits');
  again.game.closeReward?.();
  again.game.openLevel('with-task');
  playGame('s1');
  click('#dt-next');
  click('#d1-start');
  await settle();
  click('#d1-check-p95');
  await settle();
  assert.equal(again.game.taskWaiting('with-task'), false, 'the pass took it out');
  assert.equal(readSkipped(() => store).levels.size, 0, 'and out of the saved state');
});

test('the server going down mid-step: "Finish without the Dash0 task" records the skip, the reward carries the notice, the hub marks the level', async () => {
  const r = rig({ check: { v: 1, outcome: 'inconclusive', reason: 'x' } });
  await settle();
  r.game.openLevel('with-task');
  playGame('s1');
  click('#dt-next');
  click('#d1-start');
  await settle();
  const failing = async () => { click('#d1-check-p95'); await settle(); };
  await failing();
  await failing();
  await failing();
  assert.ok(q('#d1-skip'), 'three that cannot be judged');
  click('#d1-skip');
  click('#dt-finish');
  await settle();
  assert.equal(r.game.rewardNotice, COPY.notices.off);
  assert.deepEqual(JSON.parse(r.store.data.get(SKIPPED_KEY)), { v: 1, levels: { 'with-task': ['p95-task'] } });
  assert.equal(r.game.taskWaiting('with-task'), true);
});

test('?mode=debug: the real status is never read, no ctx.dash0Task, the step is left out silently and nothing is saved', async () => {
  const r = rig({ debug: true });
  await settle();
  r.game.openLevel('with-task');
  assert.equal(q('#d1-start') === null, true);
  playGame('s1');
  click('#dt-finish');
  await settle();
  assert.deepEqual(dash0Requests(r), [], 'no request to the task server, not even the status');
  assert.equal(r.game.rewardNotice, '');
  assert.equal(r.store.data.has(SKIPPED_KEY), false);
  assert.equal(r.store.sets.length, 0, 'debug writes nothing');
  assert.equal(r.game.taskWaiting('with-task'), false);
});

test('without a fetch there is no task client: the level plays as a game-only level without a word about it', async () => {
  const r = rig({ noFetch: true });
  r.game.openLevel('with-task');
  assert.equal(q('#d1-start') === null, true);
  playGame('s1');
  click('#dt-finish');
  assert.equal(r.game.rewardNotice, '');
  assert.equal(r.store.data.has(SKIPPED_KEY), false);
});

test('a level opened before the status answered counts as off, and a stale run cannot write for the level that is open now', async () => {
  const r = rig();
  r.game.openLevel('with-task'); // GET /api/dash0-task has not answered yet
  assert.equal(q('#d1-start') === null, true);
  r.game.openLevel('game-only');
  assert.equal(r.game.rewardNotice, '', 'a new run starts with no notice');
});

test('?mode=reset clears the remembered tasks too', () => {
  assert.ok(RESET_KEYS.includes(SKIPPED_KEY));
});

test('the reward card and the level card in index.html show the notice and the marker without inline style', () => {
  assert.match(HTML, /id="reward-dash0"[^>]*x-text="rewardNotice"/);
  assert.match(HTML, /x-show="taskWaiting\(id\)"[^>]*x-text="taskWaitingText\(\)"/);
});
