// #509 P6: the browser client of the In Dash0 task (lib/dash0-task/client.mjs): the origin allowlist, the availability read
// once per page, the request bodies (the wire contract) and the HTTP-status-to-outcome mapping. A fake fetch; no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDash0TaskClient, DASH0_TASK_URL, isDash0AppUrl } from '../lib/dash0-task/client.mjs';

const json = (status, body) => ({ status, json: async () => body });
/** A fetch that answers by method and records every call. */
function rig({ get = json(200, { v: 1, on: true }), post = json(200, { v: 1, ok: true }), signedIn = true } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body === undefined ? undefined : JSON.parse(init.body), headers: init.headers });
    const answer = init.method === 'POST' ? post : get;
    if (answer instanceof Error) throw answer;
    return typeof answer === 'function' ? answer(init) : answer;
  };
  let me = signedIn;
  const client = createDash0TaskClient({ fetch, signedIn: () => me });
  return { client, calls, signOut: () => { me = false; } };
}

const START_OK = { v: 1, ok: true, attemptId: 'a1b2', link: 'https://app.dash0.com/goto/traces/explorer', tag: 'k3j9x2m4q1', readyAfterS: 30, expiresAt: 1767229200000, name: 'oncall-k3j9x2m4q1-p95-a1b2' };

test('isDash0AppUrl allows https://app.dash0.com only', () => {
  for (const ok of ['https://app.dash0.com/goto/traces/explorer?from=now-30m&to=now', 'https://app.dash0.com', 'https://app.dash0.com:443/x']) assert.equal(isDash0AppUrl(ok), true, ok);
  for (const bad of [
    'https://evil.example/x', 'https://app.dash0.com.evil.example/', 'https://app.dash0.com@evil.example/', 'https://evil.example/https://app.dash0.com',
    'http://app.dash0.com/', 'javascript:alert(1)', '//app.dash0.com/x', '/goto/traces', 'https://user:pw@app.dash0.com/', 'https://api.eu-west-1.aws.dash0.com/',
    'https://app.dash0.com/ x', ' https://app.dash0.com/', 'https://app.dash0.com:8443/', '', null, undefined, 42, {},
  ]) assert.equal(isDash0AppUrl(bad), false, String(bad));
});

test('available() is the server being on AND a signed-in player; the status is asked once', async () => {
  const r = rig();
  assert.equal(r.client.available(), false, 'before the status is read');
  assert.equal(r.client.reason(), 'off');
  assert.equal(await r.client.load(), true);
  await r.client.load();
  assert.deepEqual(r.calls.map((c) => [c.method, c.url]), [['GET', DASH0_TASK_URL]], 'one GET per page');
  assert.equal(r.client.available(), true);
  assert.equal(r.client.reason(), null);
  r.signOut();
  assert.equal(r.client.available(), false, 'the signed-in state is read at each decision');
  assert.equal(r.client.reason(), 'signed-out');
});

test('the server off, a failed or odd status read all mean off (never signed-out, which would ask the player to sign in for nothing)', async () => {
  for (const get of [json(200, { v: 1, on: false }), json(503, {}), json(200, { v: 2, on: true }), json(200, { on: 'yes' }), json(200, null), new Error('offline')]) {
    const r = rig({ get });
    assert.equal(await r.client.load(), false);
    assert.equal(r.client.available(), false);
    assert.equal(r.client.reason(), 'off');
  }
});

test('the request bodies carry exactly the contract keys, nothing else', async () => {
  const r = rig({ post: json(200, START_OK) });
  await r.client.start('p95-task');
  await r.client.check('p95-task', 'a1b2', { question: 'p95', value: '412' });
  const [start, check] = r.calls;
  assert.deepEqual([start.method, start.url, start.headers], ['POST', DASH0_TASK_URL, { 'content-type': 'application/json' }]);
  assert.deepEqual(start.body, { v: 1, op: 'start', taskId: 'p95-task' });
  assert.deepEqual(Object.keys(start.body).sort(), ['op', 'taskId', 'v']);
  assert.deepEqual(check.body, { v: 1, op: 'check', taskId: 'p95-task', attemptId: 'a1b2', answer: { question: 'p95', value: '412' } });
  assert.deepEqual(Object.keys(check.body).sort(), ['answer', 'attemptId', 'op', 'taskId', 'v']);
});

test('start: ok, with the asset name only when the server sends one', async () => {
  const got = await rig({ post: json(200, START_OK) }).client.start('t');
  assert.deepEqual(got, { ok: true, attemptId: 'a1b2', link: START_OK.link, tag: 'k3j9x2m4q1', readyAfterS: 30, expiresAt: 1767229200000, name: START_OK.name });
  const { name, ...bare } = START_OK;
  assert.equal(Object.hasOwn(await rig({ post: json(200, bare) }).client.start('t'), 'name'), false);
});

test('start: an inconclusive answer, an odd body and every HTTP status map to an outcome, never a throw', async () => {
  const cases = [
    [json(200, { v: 1, ok: false, outcome: 'inconclusive', reason: 'settling', retryAfterS: 12 }), { reason: 'settling', retryAfterS: 12 }],
    [json(200, { v: 1, ok: true }), { reason: 'unavailable' }],
    [json(200, { ok: true, attemptId: 'x' }), { reason: 'unavailable' }],
    [json(502, { ok: false, outcome: 'inconclusive', reason: 'ingest', retryAfterS: 10 }), { reason: 'ingest', retryAfterS: 10 }],
    [json(401, {}), { reason: 'signed-out', down: 'signed-out' }],
    [json(503, {}), { reason: 'off', down: 'off' }],
    [json(429, { v: 1, retryAfterS: 45 }), { reason: 'rate-limited', retryAfterS: 45 }],
    [json(429, {}), { reason: 'rate-limited', retryAfterS: 60 }],
    [json(500, {}), { reason: 'unavailable', retryAfterS: 60 }],
    [new Error('offline'), { reason: 'network', retryAfterS: 60 }],
    [{ status: 200, json: async () => { throw new SyntaxError('not json'); } }, { reason: 'unavailable' }],
  ];
  for (const [post, want] of cases) {
    const got = await rig({ post }).client.start('t');
    assert.equal(got.ok, false);
    assert.equal(got.outcome, 'inconclusive');
    for (const [k, v] of Object.entries(want)) assert.equal(got[k], v, `${k} of ${JSON.stringify(want)}`);
  }
});

test('check: pass, charged fail, uncharged fail and inconclusive; a charge is only ever on a fail', async () => {
  const check = (post) => rig({ post }).client.check('t', 'a', {});
  assert.deepEqual(await check(json(200, { v: 1, outcome: 'pass', charge: true })), { outcome: 'pass', charge: false });
  assert.deepEqual(await check(json(200, { v: 1, outcome: 'fail', charge: true, field: 'p95', reason: 'wrong' })), { outcome: 'fail', charge: true, field: 'p95', reason: 'wrong' });
  assert.deepEqual(await check(json(200, { v: 1, outcome: 'fail', charge: false })), { outcome: 'fail', charge: false });
  assert.deepEqual(await check(json(200, { v: 1, outcome: 'fail' })), { outcome: 'fail', charge: false }, 'no charge unless the server says so');
  assert.deepEqual(await check(json(200, { v: 1, outcome: 'inconclusive', charge: true, reason: 'settling', retryAfterS: 20 })), { outcome: 'inconclusive', charge: false, reason: 'settling', retryAfterS: 20 });
});

test('check: every reason the server names passes through on an inconclusive or a fail', async () => {
  for (const reason of ['settling', 'cooldown', 'not-visible', 'upstream', 'not-sent']) {
    const got = await rig({ post: json(200, { v: 1, outcome: 'inconclusive', charge: false, reason, retryAfterS: 5 }) }).client.check('t', 'a', { question: 'q', value: 'v' });
    assert.deepEqual(got, { outcome: 'inconclusive', charge: false, reason, retryAfterS: 5 });
  }
  assert.deepEqual(await rig({ post: json(200, { v: 1, outcome: 'fail', charge: true, reason: 'answer' }) }).client.check('t', 'a', {}), { outcome: 'fail', charge: true, reason: 'answer' });
});

test('check: a network error, a bad status or an odd body is inconclusive and never a fail', async () => {
  const check = (post) => rig({ post }).client.check('t', 'a', {});
  for (const post of [new Error('offline'), json(500, {}), json(200, null), json(200, { v: 1, outcome: 'maybe' }), json(200, { v: 2, outcome: 'pass' })]) {
    const got = await check(post);
    assert.equal(got.outcome, 'inconclusive', JSON.stringify(post));
    assert.equal(got.charge, false);
  }
  assert.deepEqual(await check(json(401, {})), { charge: false, outcome: 'inconclusive', reason: 'signed-out', down: 'signed-out' });
  assert.deepEqual(await check(json(503, {})), { charge: false, outcome: 'inconclusive', reason: 'off', down: 'off' });
  assert.deepEqual(await check(json(409, { error: 'stale-attempt' })), { charge: false, outcome: 'inconclusive', reason: 'stale', restart: true });
  assert.deepEqual(await check(json(410, { error: 'expired' })), { charge: false, outcome: 'inconclusive', reason: 'expired', restart: true });
  assert.deepEqual(await check(json(429, { error: 'rate-limited', retryAfterS: 5 })), { charge: false, outcome: 'inconclusive', reason: 'rate-limited', retryAfterS: 5 });
});

test('the client needs fetch and signedIn', () => {
  assert.throws(() => createDash0TaskClient({ signedIn: () => true }), /fetch/);
  assert.throws(() => createDash0TaskClient({ fetch: async () => {} }), /signedIn/);
  assert.equal(createDash0TaskClient({ fetch: async () => {}, signedIn: () => { throw new Error('boom'); } }).available(), false);
});
