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
import { createGame, DASH0_WAIT_MS } from '../app.mjs';
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
    { intro: 'Now find the slowest route in Dash0.', dash0: { id: 'd1', task: 'its-us-find', grader: 'seeded', answers: ['operation'], fields: [{ key: 'operation', label: 'The operation' }] } },
  ],
};
const seen = []; // every level's ctx, in the order the levels ran (a test reaches a run's own callbacks through it)
const REG = buildRegistry(
  [{
    id: 'a0', no: 0, name: 'First act',
    levels: [
      { id: 'with-task', no: '0.1', name: 'With a task', icon: '*', rewardTitle: 'Title', play: PLAY },
      { id: 'game-only', no: '0.2', name: 'Game only', icon: '*', rewardTitle: 'Other title', play: { ...PLAY, steps: [gameStep('s1'), gameStep('s2')] } },
    ],
    boss: null,
  }],
  { deck: [], nodeIds: [], play: { validatePlay, runPlay: (level, ctx, ...rest) => (seen.push(ctx), runPlay(level, ctx, ...rest)) } },
);

const json = (status, body) => ({ status, json: async () => body });
/** A page: `server` is GET/POST /api/dash0-task's answers, `account` GET /api/account's. Every request is recorded. */
function rig({ accountFails = false, timers = null, on = true, signedIn = true, debug = false, store = fakeStorage(), start = { v: 1, ok: true, attemptId: 'a1', link: LINK, tag: 'k3j9x2m4q1', readyAfterS: 30, expiresAt: 1 }, check = { v: 1, outcome: 'pass', charge: false }, noFetch = false, holdAccount = false } = {}) {
  const dom = makeDom(HTML);
  const requests = [];
  const errors = [];
  let release = () => {};
  const gate = new Promise((resolve) => { release = resolve; }); // with holdAccount, GET /api/account answers when a test says so
  const fetch = async (url, init = {}) => {
    requests.push({ url, method: init.method ?? 'GET', body: init.body === undefined ? undefined : JSON.parse(init.body) });
    if (url === '/api/dash0-task') return init.method === 'POST' ? json(200, JSON.parse(init.body).op === 'start' ? start : check) : json(200, { v: 1, on });
    if (url === '/api/account') {
      if (accountFails) throw new Error('offline');
      const answer = json(200, signedIn ? { v: 1, configured: true, signedIn: true, nick: 'ada', listed: false } : { v: 1, configured: true, signedIn: false });
      return holdAccount ? gate.then(() => answer) : answer;
    }
    return json(404, {});
  };
  const game = createGame({
    registry: REG, deck: [], storage: () => store, document: dom.document, window: { addEventListener() {} }, now: () => NOW, rand: () => 0,
    reportError: (e) => errors.push(e), setTimeout: timers ? timers.set : () => {}, clearTimeout: timers ? timers.clear : () => {}, debug, ...(noFetch ? {} : { fetch }),
  });
  game.init();
  return { game, store, requests, errors, dom, release };
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
  click({ type: '#d1-f-operation', text: '412' });
  click('#d1-check-operation');
  await settle();
  assert.deepEqual(dash0Requests(r).map((x) => x.body ?? null), [null, { v: 1, op: 'start', taskId: 'its-us-find' }, { v: 1, op: 'check', taskId: 'its-us-find', attemptId: 'a1', answer: { question: 'operation', value: '412' } }]);
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
    assert.deepEqual(JSON.parse(r.store.data.get(SKIPPED_KEY)), { v: 1, levels: { 'with-task': ['its-us-find'] } }, 'the skipped task id is saved');
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
  assert.match(COPY.notices['signed-out'], /then come back and replay this level to do its In Dash0 task/);
  assert.equal(COPY.waiting, 'Come back for the In Dash0 task');
  assert.equal(COPY.waitingLabel, 'has an In Dash0 task to come back for');
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
  click('#d1-check-operation');
  await settle();
  assert.equal(again.game.taskWaiting('with-task'), false, 'the pass took it out');
  assert.equal(readSkipped(() => store).levels.size, 0, 'and out of the saved state');
});

test('the server going down mid-step: "Finish without the In Dash0 task" records the skip, the reward carries the notice, the hub marks the level', async () => {
  const r = rig({ check: { v: 1, outcome: 'inconclusive', charge: false, reason: 'upstream' } });
  await settle();
  r.game.openLevel('with-task');
  playGame('s1');
  click('#dt-next');
  click('#d1-start');
  await settle();
  const failing = async () => { click('#d1-check-operation'); await settle(); };
  await failing();
  await failing();
  await failing();
  assert.ok(q('#d1-skip'), 'three that cannot be judged');
  click('#d1-skip');
  click('#dt-finish');
  await settle();
  assert.equal(r.game.rewardNotice, COPY.notices.off);
  assert.deepEqual(JSON.parse(r.store.data.get(SKIPPED_KEY)), { v: 1, levels: { 'with-task': ['its-us-find'] } });
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

test('a level opened before the status answered waits for it, then runs the task', async () => {
  const r = rig();
  r.game.openLevel('with-task'); // neither GET /api/dash0-task nor GET /api/account has answered yet
  assert.equal(q('[data-line="user"]') === null, true, 'nothing runs until both answered');
  assert.equal(r.game.overlayOpen, true, 'the overlay is drawn at once');
  await settle();
  assert.ok(q('[data-line="user"]'), 'the first step runs once they answered');
  assert.ok(r.game.howTo.topics.some((t) => t.key === 'dash0'), 'the guide is decided with the answer');
  playGame('s1');
  click('#dt-next');
  assert.ok(q('#d1-start'), 'the In Dash0 step was not dropped');
  assert.equal(r.store.data.has(SKIPPED_KEY), false, 'and no skip was saved');
  assert.equal(r.game.rewardNotice, '');
});

for (const [name, opts, cause] of [['off', { on: false }, 'off'], ['signed-out', { signedIn: false }, 'signed-out']]) {
  test(`a level opened before the answers came, with the task ${name}, leaves the step out with the right cause`, async () => {
    const r = rig(opts);
    r.game.openLevel('with-task');
    await settle();
    playGame('s1');
    assert.equal(q('#d1-start') === null, true);
    click('#dt-finish');
    await settle();
    assert.equal(r.game.rewardNotice, COPY.notices[cause]);
    assert.deepEqual(JSON.parse(r.store.data.get(SKIPPED_KEY)), { v: 1, levels: { 'with-task': ['its-us-find'] } });
  });
}

test('a level opened once the task status answered but the account has not still waits: a signed-in player is not taken for signed out', async () => {
  const r = rig({ holdAccount: true });
  await settle(); // the task status has answered, GET /api/account has not
  r.game.openLevel('with-task');
  assert.equal(q('[data-line="user"]') === null, true, 'waiting for the account state');
  r.release();
  await settle();
  assert.ok(q('[data-line="user"]'));
  playGame('s1');
  click('#dt-next');
  assert.ok(q('#d1-start'), 'the task runs for the signed-in player');
  assert.equal(r.store.data.has(SKIPPED_KEY), false);
});

test('a level closed while it waits never runs, and one opened after it is not touched by it', async () => {
  const r = rig();
  r.game.openLevel('with-task');
  r.game.closeOverlay();
  await settle();
  assert.equal(q('[data-line="user"]') === null, true, 'closed: it never runs');
  assert.equal(r.store.data.has(SKIPPED_KEY), false);
  const waiting = rig();
  waiting.game.openLevel('with-task');
  waiting.game.closeOverlay();
  waiting.game.openLevel('game-only'); // a level with no In Dash0 step runs at once
  const shown = q('[data-line="user"]');
  assert.ok(shown);
  await settle();
  assert.equal(shown.isConnected, true, 'the first run did not redraw the level that is open now');
  assert.equal(waiting.game.currentLevelId, 'game-only');
});

test('a stale run cannot skip or pass for the level that is open now', async () => {
  const r = rig();
  await settle();
  r.game.openLevel('with-task');
  const stale = seen.at(-1).dash0Task; // run A's own callbacks
  r.game.closeOverlay();
  r.game.openLevel('game-only'); // run B
  const before = [r.game.dash0Rev, r.store.data.get(SKIPPED_KEY) ?? null, r.store.sets.length, r.game.taskWaiting('with-task'), r.game.rewardNotice];
  stale.skip(['its-us-find'], 'off');
  stale.passed('its-us-find');
  assert.deepEqual([r.game.dash0Rev, r.store.data.get(SKIPPED_KEY) ?? null, r.store.sets.length, r.game.taskWaiting('with-task'), r.game.rewardNotice], before, 'run B\'s state is unchanged');
  assert.equal(r.game.taskWaiting('with-task'), false);
  // the live run's own callbacks do write
  r.game.closeOverlay();
  r.game.openLevel('with-task');
  seen.at(-1).dash0Task.skip(['its-us-find'], 'off');
  assert.equal(r.game.taskWaiting('with-task'), true, 'the guard is about the run, not the callback');
});

test('?mode=reset clears the remembered tasks too', () => {
  assert.ok(RESET_KEYS.includes(SKIPPED_KEY));
});

test('the reward card and the level card in index.html show the notice and the marker without inline style', () => {
  assert.match(HTML, /id="reward-dash0"[^>]*x-text="rewardNotice"/);
  assert.match(HTML, /x-show="taskWaiting\(id\)"[^>]*>\s*<span class="ui-chip"[^>]*x-text="taskWaitingText\(\)"/);
  const body = /<div class="level-body">([\s\S]*?)<div class="level-status"/.exec(HTML)[1];
  assert.match(body, /taskWaitingText/, 'the long chip sits in the body, where it can wrap');
  const status = /<div class="level-status"[\s\S]*?<\/div>/.exec(HTML)[0];
  assert.doesNotMatch(status, /taskWaitingText/, 'not in the no-wrap status column');
});

/** A timer rig: `set` records each call, `fire(ms)` runs the ones asked for that delay. */
const fakeTimers = () => {
  const list = [];
  return {
    list,
    set: (fn, ms) => { list.push({ fn, ms, cleared: false }); return list.length; },
    clear: (n) => { if (list[n - 1]) list[n - 1].cleared = true; },
    fire: (ms) => list.filter((t) => t.ms === ms && !t.cleared).forEach((t) => t.fn()),
  };
};

test('a level never waits for the task status or the account for ever: after DASH0_WAIT_MS it runs without the task, and says it is getting ready meanwhile', async () => {
  const timers = fakeTimers();
  const r = rig({ holdAccount: true, timers });
  await settle(); // GET /api/account never answers
  let focused = null; // linkedom has no focus model: record the focus() calls
  globalThis.window.HTMLElement.prototype.focus = function focus() { focused = this; };
  r.game.openLevel('with-task');
  assert.equal(q('[data-line="user"]') === null, true, 'still waiting');
  assert.equal(q('#ov-wait').getAttribute('role'), 'status', 'the wait is a live region, so it is announced');
  assert.equal(q('#ov-wait').textContent.trim(), '', 'the region goes in empty: text that arrives with a live region is not announced');
  timers.fire(0); // the next tick fills it
  assert.match(q('#ov-body').textContent, new RegExp(COPY.preparing));
  assert.equal(focused?.id, 'ov-back', 'focus is on Back, not left on the page');
  assert.ok(timers.list.some((t) => t.ms === DASH0_WAIT_MS), 'a timer bounds the wait');
  timers.fire(DASH0_WAIT_MS);
  assert.ok(q('[data-line="user"]'), 'the level runs with what is known');
  assert.doesNotMatch(q('#ov-body').textContent, new RegExp(COPY.preparing));
  playGame('s1');
  click('#dt-finish');
  await settle();
  assert.equal(r.game.rewardNotice, COPY.notices.off, 'an account that did not answer counts as unavailable: off, never signed out');
  assert.deepEqual(dash0Requests(r).filter((x) => x.method === 'POST'), []);
});

test('the status GET that never answers counts as off after the wait', async () => {
  const timers = fakeTimers();
  const dom = makeDom(HTML);
  const fetch = (url) => (url === '/api/dash0-task' ? new Promise(() => {}) : Promise.resolve(json(200, { v: 1, configured: true, signedIn: true, nick: 'ada', listed: false })));
  const game = createGame({ registry: REG, deck: [], storage: () => fakeStorage(), document: dom.document, window: { addEventListener() {} }, now: () => NOW, rand: () => 0, reportError: (e) => { throw e; }, setTimeout: timers.set, clearTimeout: timers.clear, fetch });
  game.init();
  await settle();
  game.openLevel('with-task');
  assert.equal(q('[data-line="user"]') === null, true);
  timers.fire(DASH0_WAIT_MS);
  assert.ok(q('[data-line="user"]'));
  playGame('s1');
  click('#dt-finish');
  await settle();
  assert.equal(game.rewardNotice, COPY.notices.off);
});

test('an answer that comes before the timer runs the level once and cancels the timer', async () => {
  const timers = fakeTimers();
  const r = rig({ holdAccount: true, timers });
  await settle();
  r.game.openLevel('with-task');
  r.release();
  await settle();
  assert.ok(q('[data-line="user"]'));
  assert.equal(timers.list.find((t) => t.ms === DASH0_WAIT_MS).cleared, true);
  const shown = q('[data-line="user"]');
  timers.list.find((t) => t.ms === DASH0_WAIT_MS).fn(); // a late fire does nothing
  assert.equal(q('[data-line="user"]') === shown, true, 'no second run');
});

test('an account GET that fails while the server is on skips with cause off, never signed-out', async () => {
  const r = rig({ accountFails: true });
  await settle();
  r.game.openLevel('with-task');
  assert.ok(q('[data-line="user"]'));
  assert.equal(seen.at(-1).dash0Task.reason(), 'off');
  playGame('s1');
  click('#dt-finish');
  await settle();
  assert.equal(r.game.rewardNotice, COPY.notices.off);
});
