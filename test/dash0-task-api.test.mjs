// api/dash0-task.mjs (#509 P5; docs/FOUNDATION.md §2.15): the In Dash0 task server over fake Redis and a fake Dash0.
// The invariants of #509 P5 (secrets, identity, the key, settling, one charge, off, deletion, no network) are each tested below. No network: the global fetch throws (helpers/no-network.mjs).
import './helpers/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDash0Task } from '../api/dash0-task.mjs';
import { keys } from '../lib/account/store.mjs';
import { containsToken } from '../lib/otlp/send.mjs';
import { createServerTelemetry } from '../lib/otel/server.mjs';
import { ORIGIN, get, post } from './helpers/auth-api.mjs';
import {
  API_TOKEN, EMAIL, INGEST_HOST, INGEST_TOKEN, NICK, PLAYER_SECRET, SETTLE_MS, TASK_ENV, URL_, taskRig,
} from './helpers/dash0-task.mjs';

// Pinned here on purpose: a test that imported these would move with a mutation of them.
const START_MAX = 12;
const START_KEYS = ['attemptId', 'expiresAt', 'link', 'ok', 'readyAfterS', 'tag', 'v'];
const WRONG_ANSWERS = ['storage.write', 'cards.award', 'globe.ignite'];

const noDash0 = (env) => Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('DASH0_GAME_')));
const texts = async (responses) => Promise.all(responses.map((res) => res.clone().text()));

test('off: no Dash0 variables is off, with zero Redis commands and zero fetches', async () => {
  const t = await taskRig({ env: noDash0(TASK_ENV) });
  const before = t.fake.calls.length; // the fixture's own sign-in
  const get_ = await t.get();
  assert.deepEqual(await get_.json(), { v: 1, on: false });
  const res = await t.op({ v: 1, op: 'start', taskId: 'its-us-find' });
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'not-configured' });
  assert.equal((await t.op({ v: 1, op: 'check', taskId: 'its-us-find', attemptId: 'a'.repeat(16), answer: { question: 'operation', value: 'x' } })).status, 503);
  assert.equal(t.fake.calls.length, before, 'no Redis command');
  assert.equal(t.sent.length, 0, 'no fetch');
  assert.ok(!t.logs.some((l) => 'reason' in l), 'off never logs a configuration line');
});

test('off: valid Dash0 variables with sign-in unconfigured are off too', async () => {
  const env = Object.fromEntries(Object.entries(TASK_ENV).filter(([k]) => k !== 'SESSION_SECRET'));
  const t = await taskRig({ env });
  const before = t.fake.calls.length;
  assert.deepEqual(await (await t.get()).json(), { v: 1, on: false });
  assert.equal((await t.op({ v: 1, op: 'start', taskId: 'its-us-find' })).status, 503);
  assert.equal(t.fake.calls.length, before);
  assert.equal(t.sent.length, 0);
});

test('on: GET says so without a session or a Redis command', async () => {
  const t = await taskRig({ signedIn: false });
  const before = t.fake.calls.length;
  assert.deepEqual(await (await t.get()).json(), { v: 1, on: true });
  assert.equal(t.fake.calls.length, before);
  assert.equal((await t.api.POST(get(URL_))).status, 405);
  assert.equal((await t.api.GET(post(URL_, {}))).status, 405);
});

test('a partial environment is invalid: 503, one log line naming the field and reason, never a value', async () => {
  const { DASH0_GAME_API_TOKEN, ...partial } = TASK_ENV;
  const t = await taskRig({ env: partial });
  const before = t.fake.calls.length;
  assert.deepEqual(await (await t.get()).json(), { v: 1, on: false });
  assert.equal((await t.op({ v: 1, op: 'start', taskId: 'its-us-find' })).status, 503);
  assert.equal(t.fake.calls.length, before);
  assert.equal(t.sent.length, 0);
  const lines = t.logs.filter((l) => 'reason' in l);
  assert.deepEqual(lines, [{ msg: 'dash0-task', outcome: 'not-configured', reason: 'DASH0_GAME_API_TOKEN:empty' }], 'once, at the first request');
  const all = JSON.stringify(t.logs);
  for (const value of Object.values(TASK_ENV)) assert.ok(!all.includes(value), 'no configured value in a log line');
});

test('signed out: 401, and nothing is written or sent', async () => {
  const t = await taskRig({ signedIn: false });
  const before = t.fake.calls.length;
  const res = await t.op({ v: 1, op: 'start', taskId: 'its-us-find' });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'unauthenticated' });
  assert.equal(t.fake.calls.length, before);
  assert.equal(t.sent.length, 0);
  const stale = await t.op({ v: 1, op: 'start', taskId: 'its-us-find' }, { cookie: await t.r.cookieFor(t.pid, { gen: '9' }) });
  assert.equal(stale.status, 401);
  assert.ok(stale.headers.getSetCookie().some((c) => c.includes('Max-Age=0')), 'a stale session clears the cookie');
});

test('the check order: 405, 503, 403, 415, 413, 401, 400, 404, then 429', async () => {
  const t = await taskRig();
  const valid = { v: 1, op: 'start', taskId: 'its-us-find' };
  assert.equal((await t.api.POST(get(URL_))).status, 405);
  assert.equal((await t.op(valid, { origin: 'https://evil.example' })).status, 403);
  const noOrigin = new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', cookie: t.cookie }, body: JSON.stringify(valid) });
  assert.equal((await t.api.POST(noOrigin)).status, 403);
  assert.equal((await t.op(valid, { 'content-type': 'text/plain' })).status, 415);
  const big = { ...valid, pad: 'x'.repeat(4096) };
  assert.equal((await t.op(big)).status, 413);
  assert.equal((await t.op(big, { 'content-length': '5000' })).status, 413, 'a declared length over the limit is refused before the body is read');
  assert.equal((await t.api.POST(post(URL_, valid))).status, 401, 'signed-in comes after the size checks');
  assert.equal((await t.op('not json')).status, 400);
  assert.equal((await t.op({ ...valid, taskId: 'no-such-task' })).status, 404, 'a well-formed unknown task is 404');
  assert.equal((await t.op({ ...valid, taskId: 'No Such' })).status, 400, 'a malformed task id is 400');
  for (let i = 0; i < START_MAX; i++) assert.equal((await t.op(valid)).status, 200);
  assert.equal((await t.op(valid)).status, 429);
});

test('400: every malformed body names its field', async () => {
  const t = await taskRig();
  const field = async (body) => (await t.json(await t.op(body))).field;
  const ok = { v: 1, op: 'check', taskId: 'its-us-find', attemptId: 'a'.repeat(16), answer: { question: 'operation', value: 'x' } };
  assert.equal(await field('[]'), 'body');
  assert.equal(await field({ ...ok, v: 2 }), 'v');
  assert.equal(await field({ ...ok, extra: 1 }), 'body');
  assert.equal(await field({ ...ok, op: 'stop' }), 'op');
  assert.equal(await field({ ...ok, taskId: 7 }), 'taskId');
  assert.equal(await field({ ...ok, attemptId: 'short' }), 'attemptId');
  assert.equal(await field({ ...ok, attemptId: undefined }), 'attemptId');
  assert.equal(await field({ ...ok, answer: { question: 'operation', value: 'x'.repeat(201) } }), 'answer');
  assert.equal(await field({ ...ok, answer: { question: 'operation', value: null } }), 'answer');
  assert.equal(await field({ ...ok, answer: undefined }), 'answer', 'a seeded task needs an answer');
  assert.equal(await field({ v: 1, op: 'check', taskId: 'connect-test-span', attemptId: 'a'.repeat(16), answer: { question: 'operation', value: 'x' } }), 'answer', 'a readback task takes none');
  assert.equal(await field({ v: 1, op: 'start', taskId: 'its-us-find', attemptId: 'a'.repeat(16) }), 'attemptId');
  assert.equal(await field({ v: 1, op: 'start', taskId: 'its-us-find', answer: ok.answer }), 'answer');
});

test('start answers with exactly the listed keys, and no seed, answer or fault code', async () => {
  const t = await taskRig();
  const { res, body } = await t.start('its-us-find');
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(body).sort(), START_KEYS);
  assert.equal(body.v, 1);
  assert.equal(body.ok, true);
  assert.match(body.attemptId, /^[a-f0-9]{16}$/);
  assert.equal(body.tag, t.tag);
  assert.equal(body.readyAfterS, 30);
  const stored = t.attempt('its-us-find');
  assert.equal(body.expiresAt, stored.expiresAt);
  const text = JSON.stringify(body);
  const key = t.answersOf('its-us-find');
  for (const secret of [key.faultCode, key.traceId, key.operation, String(stored.seed), String(stored.t0)]) {
    assert.ok(!text.includes(secret), `the response does not hold ${secret.length > 8 ? 'the trace id' : secret}`);
  }
  assert.ok(!('seed' in body || 'answers' in body || 't0' in body));
});

test('start for a readback task adds the asset name and sends nothing', async () => {
  const t = await taskRig();
  const { body } = await t.start('connect-test-span');
  assert.deepEqual(Object.keys(body).sort(), [...START_KEYS, 'name'].sort());
  assert.equal(body.name, `oncall-${t.tag}-connect-test-span-${body.attemptId.slice(0, 6)}`);
  assert.equal(t.sent.length, 0, 'the player sends this task\'s span, the server sends none');
  assert.equal(t.attempt('connect-test-span').seed, undefined);
});

test('the ingest body, name and link carry the tag and never a pid, nickname or email', async () => {
  const t = await taskRig();
  assert.notEqual(t.tag, t.pid);
  const { body } = await t.start('its-us-find');
  const connect = (await t.start('connect-test-span')).body;
  assert.equal(t.sent.length, 1);
  const [request] = t.sent;
  assert.equal(request.url, `https://${INGEST_HOST}/v1/traces`);
  for (const text of [request.body, body.link, connect.link, connect.name, JSON.stringify(body), JSON.stringify(connect)]) {
    for (const forbidden of [t.pid, NICK, EMAIL, 'ada.lovelace']) assert.ok(!text.includes(forbidden), `no ${forbidden === t.pid ? 'pid' : forbidden} in ${text.slice(0, 40)}`);
  }
  assert.ok(connect.name.includes(t.tag) && connect.link.includes(connect.attemptId), 'the tag names the asset and the attempt filters the link');
  assert.ok(request.body.includes(t.tag), 'the span is stamped with the tag');
  assert.ok(request.body.includes(body.attemptId), 'and the attempt id');
  assert.ok(request.body.includes('its-us-find'), 'and the task id');
  const stamped = t.dash0.records.every((r) => r.tag === t.tag && r.attemptId === body.attemptId && r.taskId === 'its-us-find');
  assert.ok(stamped && t.dash0.records.length > 0, 'every record the fake received is stamped');
  assert.equal(request.headers.Authorization, `Bearer ${INGEST_TOKEN}`);
  assert.equal(request.headers['Dash0-Dataset'], 'oncall-game');
});

test('the link names the app, the attempt filter and the dataset', async () => {
  const t = await taskRig();
  const { body } = await t.start('its-us-find');
  const url = new URL(body.link);
  assert.equal(url.origin, 'https://app.dash0.com');
  assert.equal(url.pathname, '/goto/traces/explorer');
  assert.equal(url.searchParams.get('dataset'), 'oncall-game');
  assert.deepEqual(JSON.parse(url.searchParams.get('filter')), [{ key: 'game.attempt.id', operator: 'is', value: body.attemptId }]);
  const t0 = t.attempt('its-us-find').t0;
  assert.ok(Date.parse(url.searchParams.get('from')) < t0 && Date.parse(url.searchParams.get('to')) > t0, 'the window holds the attempt');
});

test('the attempt is written to Redis BEFORE the send, with a 30 day expiry', async () => {
  const t = await taskRig();
  let atSend = null;
  t.dash0.fetch = async () => {
    atSend = t.r.fake.db.get(keys.task(t.pid))?.get('its-us-find') ?? null;
    return new Response('{}', { status: 200 });
  };
  const api = createDash0Task({ ...t.deps, fetch: (url, init) => t.dash0.fetch(url, init) });
  const res = await api.POST(post(URL_, { v: 1, op: 'start', taskId: 'its-us-find' }, { cookie: t.cookie }));
  assert.equal(res.status, 200);
  assert.ok(atSend !== null, 'the record was in Redis when the batch went out');
  assert.equal(JSON.parse(atSend).attemptId, (await res.json()).attemptId);
  assert.equal(t.r.fake.ttl.get(keys.task(t.pid)), 30 * 24 * 60 * 60);
  assert.deepEqual(Object.keys(JSON.parse(atSend)).sort(), ['attemptId', 'expiresAt', 'grader', 'seed', 't0']);
});

test('ingest failure is inconclusive "ingest" with a retry time, and a retry resends the identical payload', async () => {
  const t = await taskRig();
  t.dash0.fail(500, 'ingest');
  const first = await t.start('its-us-find');
  assert.equal(first.res.status, 502);
  assert.deepEqual(first.body, { ok: false, outcome: 'inconclusive', reason: 'ingest', retryAfterS: 10 });
  const stored = t.attempt('its-us-find');
  t.dash0.fail(null);
  const second = await t.start('its-us-find');
  assert.equal(second.res.status, 200);
  assert.equal(second.body.attemptId, stored.attemptId, 'the unsent attempt is the one resent');
  assert.equal(t.sent.length, 2);
  assert.equal(t.sent[1].body, t.sent[0].body, 'byte for byte the same payload');
  assert.equal(t.r.fake.db.get(keys.task(t.pid)).size, 2, 'one record and its sent marker');
  const third = await t.start('its-us-find');
  assert.notEqual(third.body.attemptId, stored.attemptId, 'a sent attempt starts a fresh one');
});

test('every ingest failure mode is the same refusal and never marks the attempt sent', async () => {
  for (const mode of [401, 403, 429, 500, 'timeout', 'malformed']) {
    const t = await taskRig();
    t.dash0.fail(mode, 'ingest');
    const { res, body } = await t.start('its-us-find');
    assert.equal(res.status, 502, String(mode));
    assert.equal(body.reason, 'ingest');
    assert.equal((await t.check('its-us-find', t.attempt('its-us-find').attemptId, { question: 'operation', value: 'x' })).body.reason, 'not-sent', 'an unsent attempt cannot be graded');
  }
});

test('no token or secret appears in a response, a log line, Redis or an OTLP body (and the check can fire)', async () => {
  const t = await taskRig();
  const seen = [];
  const keep = async (res) => {
    seen.push(...(await texts([res])));
    return res;
  };
  t.noCooldown();
  const { body } = await t.start('its-us-find');
  await t.start('connect-test-span');
  const id = body.attemptId;
  t.clock.t += SETTLE_MS;
  await keep(await t.op({ v: 1, op: 'check', taskId: 'its-us-find', attemptId: id, answer: { question: 'operation', value: t.wrongOperation() } }));
  await keep(await t.op({ v: 1, op: 'check', taskId: 'its-us-find', attemptId: id, answer: { question: 'operation', value: t.answersOf('its-us-find').operation } }));
  t.dash0.fail(401, 'api');
  await keep(await t.op({ v: 1, op: 'check', taskId: 'its-us-find', attemptId: id, answer: { question: 'faultCode', value: 'ZZZZZZ' } }));
  t.dash0.fail(null);
  await keep(await t.op({ v: 1, op: 'start', taskId: 'no-such-task' }));
  const everything = [...seen, JSON.stringify(t.logs), t.r.fake.dump(), JSON.stringify(t.r.fake.calls), ...t.sent.map((s) => s.body), JSON.stringify(t.dash0.records), JSON.stringify(t.dash0.calls), JSON.stringify(body)];
  for (const [what, secret] of [['ingest token', INGEST_TOKEN], ['API token', API_TOKEN], ['player secret', PLAYER_SECRET]]) {
    for (const text of everything) assert.ok(!containsToken(text, secret), `the ${what} is in a captured text`);
  }
  assert.ok(containsToken(t.sent[0].headers.Authorization, INGEST_TOKEN), 'the check does fire on the one place the ingest token belongs');
});

test('no token, secret or pid reaches a span either', async () => {
  const t = await taskRig();
  const exported = [];
  const tel = createServerTelemetry({
    name: 'dash0-task',
    env: { DASH0_OTLP_ENDPOINT: 'http://localhost:4318', DASH0_AUTH_TOKEN: 'auth_monitor_token_000' },
    random: t.deps.random,
    exporter: async (body) => {
      exported.push(JSON.stringify(body));
      return { kind: 'accepted' };
    },
  });
  const wrapped = tel.instrument(createDash0Task({ ...t.deps, log: tel.log, fetch: tel.trace(t.deps.fetch) }));
  const res = await wrapped.POST(post(URL_, { v: 1, op: 'start', taskId: 'its-us-find' }, { cookie: t.cookie }));
  assert.equal(res.status, 200);
  assert.ok(exported.length > 0 && exported.every((x) => x.includes('dash0-task')), 'spans were exported');
  for (const text of exported) {
    for (const secret of [INGEST_TOKEN, API_TOKEN, PLAYER_SECRET, t.pid, NICK]) assert.ok(!containsToken(text, secret) && !text.includes(t.pid), 'no secret in a span');
  }
});

test('a check response carries no answer, seed or t0', async () => {
  const t = await taskRig();
  const { body } = await t.start('its-us-find');
  t.noCooldown();
  t.clock.t += SETTLE_MS;
  const key = t.answersOf('its-us-find');
  const stored = t.attempt('its-us-find');
  const out = [];
  for (const [question, value] of [['operation', t.wrongOperation()], ['faultCode', 'ZZZZZZ'], ['retryCount', 9], ['traceId', 'f'.repeat(32)], ['operation', key.operation]]) {
    out.push(...(await texts([await t.op({ v: 1, op: 'check', taskId: 'its-us-find', attemptId: body.attemptId, answer: { question, value } })])));
  }
  for (const text of out) {
    for (const secret of [key.faultCode, key.traceId, String(stored.seed), String(stored.t0), String(key.retryCount) + '"']) assert.ok(!text.includes(secret), 'no key material');
    assert.ok(!text.includes('answers'));
  }
});

test('a right answer passes with charge false once the data has settled and is confirmed visible, with one probe however many checks follow', async () => {
  const t = await taskRig();
  const { body } = await t.start('its-us-find');
  t.noCooldown();
  t.clock.t += SETTLE_MS;
  const key = t.answersOf('its-us-find');
  const { res, body: out } = await t.check('its-us-find', body.attemptId, { question: 'operation', value: `  ${key.operation.toUpperCase()} ` });
  assert.equal(res.status, 200);
  assert.deepEqual(out, { v: 1, outcome: 'pass', charge: false });
  assert.equal(t.dash0.calls.length, 1, 'the data was confirmed visible before the answer was graded');
  for (const [question, value] of [['faultCode', key.faultCode], ['retryCount', key.retryCount], ['traceId', key.traceId]]) {
    assert.equal((await t.check('its-us-find', body.attemptId, { question, value })).body.outcome, 'pass', question);
  }
  assert.equal(t.dash0.calls.length, 1, 'the confirmation is cached per attempt: later checks do not probe');
  const stored = JSON.parse(t.r.fake.db.get(keys.task(t.pid)).get('its-us-find.seen'));
  assert.deepEqual(Object.keys(stored).sort(), ['at', 'attemptId']);
  assert.equal(stored.attemptId, body.attemptId);
});

test('a confirmation of another attempt is ignored: the new attempt is probed before anything is graded', async () => {
  const t = await taskRig();
  const a = (await t.start('its-us-find')).body;
  t.noCooldown();
  t.clock.t += SETTLE_MS;
  assert.equal((await t.check('its-us-find', a.attemptId, { question: 'operation', value: t.answersOf('its-us-find').operation })).body.outcome, 'pass');
  assert.equal(t.dash0.calls.length, 1);
  const b = (await t.start('its-us-find')).body; // a sent attempt starts a fresh one; A's .seen stays in the hash
  assert.notEqual(b.attemptId, a.attemptId);
  assert.ok(t.r.fake.db.get(keys.task(t.pid)).has('its-us-find.seen'), 'A\'s confirmation is still in the hash');
  t.dash0.fail(500, 'api');
  t.clock.t += SETTLE_MS;
  const out = (await t.check('its-us-find', b.attemptId, { question: 'operation', value: t.answersOf('its-us-find').operation })).body;
  assert.deepEqual(out, { v: 1, outcome: 'inconclusive', charge: false, reason: 'upstream', retryAfterS: 15 }, 'not graded on A\'s sighting');
});

test('no free guesses: while settling EVERY answer, right or wrong, is inconclusive "settling" with a retry time and no charge', async () => {
  const t = await taskRig();
  const { body } = await t.start('its-us-find');
  t.noCooldown();
  const key = t.answersOf('its-us-find');
  const sentAt = t.clock.t;
  const attempts = [
    { question: 'operation', value: key.operation },
    { question: 'faultCode', value: key.faultCode },
    { question: 'operation', value: t.wrongOperation() },
  ];
  for (const at of [0, 10_000, SETTLE_MS - 1]) {
    t.clock.t = sentAt + at;
    const retryAfterS = Math.ceil((SETTLE_MS - at) / 1000);
    for (const answer of attempts) {
      assert.deepEqual((await t.check('its-us-find', body.attemptId, answer)).body, { v: 1, outcome: 'inconclusive', charge: false, reason: 'settling', retryAfterS });
    }
  }
  assert.deepEqual(t.dash0.calls, []);
  assert.equal(t.charged(body.attemptId).length, 0);
  t.clock.t = sentAt + SETTLE_MS;
  assert.equal((await t.check('its-us-find', body.attemptId, attempts[0])).body.outcome, 'pass', 'at the boundary the right answer grades');
});

test('a right answer is graded only once the data is confirmed visible: lag, an API failure and the P8 stub make it inconclusive, never a pass, never charged', async () => {
  for (const mode of ['lag', 'api-500', 'p8-stub']) {
    const t = await taskRig(mode === 'lag' ? { lagMs: 10 * 60_000 } : {});
    const api = mode === 'p8-stub' ? createDash0Task({ ...t.deps, dash0: null }) : null;
    const call = async (body) => (await (api ?? t.api).POST(post(URL_, body, { cookie: t.cookie }))).json();
    const { attemptId } = await call({ v: 1, op: 'start', taskId: 'its-us-find' });
    if (mode === 'api-500') t.dash0.fail(500, 'api');
    t.noCooldown();
    t.clock.t += SETTLE_MS * 10;
    const right = { question: 'operation', value: t.answersOf('its-us-find').operation };
    const reason = mode === 'lag' ? 'not-visible' : 'upstream';
    const retryAfterS = mode === 'lag' ? 10 : 15;
    for (const answer of [right, { question: 'operation', value: t.wrongOperation() }]) {
      const out = await call({ v: 1, op: 'check', taskId: 'its-us-find', attemptId, answer });
      assert.deepEqual(out, { v: 1, outcome: 'inconclusive', charge: false, reason, retryAfterS }, `${mode} ${answer.value}`);
    }
    assert.equal(t.charged(attemptId).length, 0, mode);
    assert.equal(t.r.fake.db.get(keys.task(t.pid)).has('its-us-find.seen'), false, `${mode}: nothing is confirmed`);
  }
});

test('a wrong answer with the data visible is a fail with a charge, once per distinct value', async () => {
  const t = await taskRig();
  const { body } = await t.start('its-us-find');
  t.noCooldown();
  t.clock.t += SETTLE_MS;
  const wrong = t.wrongOperation();
  const other = WRONG_ANSWERS.find((w) => w !== wrong && w !== t.answersOf('its-us-find').operation);
  const one = async (value, question = 'operation') => (await t.check('its-us-find', body.attemptId, { question, value })).body;
  assert.deepEqual(await one(wrong), { v: 1, outcome: 'fail', charge: true });
  assert.deepEqual(await one(wrong.toUpperCase()), { v: 1, outcome: 'fail', charge: false }, 'another case is the same value');
  assert.deepEqual(await one(`  ${wrong}  `), { v: 1, outcome: 'fail', charge: false }, 'so is padding');
  assert.deepEqual(await one(other), { v: 1, outcome: 'fail', charge: true }, 'a new value is charged');
  const wrongRetry = t.answersOf('its-us-find').retryCount === 3 ? 4 : 3;
  assert.equal((await one(wrongRetry, 'retryCount')).charge, true);
  assert.equal((await one(`0${wrongRetry}`, 'retryCount')).charge, false, '"03" is the number 3 again');
  assert.equal((await one(String(wrongRetry), 'retryCount')).charge, false);
  assert.equal(t.dash0.calls.every((c) => c.op === 'countAttempt'), true);
  assert.equal(t.r.fake.ttl.get(keys.taskCharged(t.pid)), 30 * 24 * 60 * 60, 'the player\'s charge set expires after 30 days, refreshed on every write');
  assert.ok([...t.r.fake.db.get(keys.taskCharged(t.pid)).set].every((m) => m.startsWith(`${body.attemptId}|`)), 'members are <attemptId>|<value>');
});

test('charging is per attempt: the same wrong value fails with a charge again on a new attempt', async () => {
  const t = await taskRig();
  t.noCooldown();
  const wrongOn = async (attemptId) => (await t.check('its-us-find', attemptId, { question: 'faultCode', value: 'ZZZZZZ' })).body;
  const a = (await t.start('its-us-find')).body;
  t.clock.t += SETTLE_MS;
  assert.deepEqual(await wrongOn(a.attemptId), { v: 1, outcome: 'fail', charge: true });
  assert.equal((await wrongOn(a.attemptId)).charge, false, 'the same value on the same attempt is free');
  const b = (await t.start('its-us-find')).body;
  assert.notEqual(b.attemptId, a.attemptId);
  t.clock.t += SETTLE_MS;
  assert.deepEqual(await wrongOn(b.attemptId), { v: 1, outcome: 'fail', charge: true }, 'a new attempt charges the same value again');
});

test('two identical wrong checks at once give exactly one charge', async () => {
  const t = await taskRig();
  const { body } = await t.start('its-us-find');
  t.noCooldown();
  t.clock.t += SETTLE_MS;
  // Hold both checks inside the probe until both have arrived, so they reach the charge step together.
  let arrived = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const gated = {
    ...t.dash0,
    countAttempt: async (...args) => {
      if (++arrived === 2) release();
      await gate;
      return t.dash0.countAttempt(...args);
    },
  };
  const api = createDash0Task({ ...t.deps, dash0: gated, timeoutMs: 5000 });
  const wrong = { v: 1, op: 'check', taskId: 'its-us-find', attemptId: body.attemptId, answer: { question: 'operation', value: t.wrongOperation() } };
  const both = await Promise.all([1, 2].map(async () => (await api.POST(post(URL_, wrong, { cookie: t.cookie }))).json()));
  assert.equal(arrived, 2, 'both checks reached the probe');
  assert.deepEqual(both.map((x) => x.outcome), ['fail', 'fail']);
  assert.equal(both.filter((x) => x.charge).length, 1, 'exactly one charge');
  assert.equal(t.charged(body.attemptId).length, 1);
});

test('settling: a wrong answer one millisecond early is inconclusive and makes no call; at the boundary the probe runs', async () => {
  const t = await taskRig();
  const { body } = await t.start('its-us-find');
  t.noCooldown();
  const sentAt = t.clock.t;
  const wrong = { question: 'operation', value: t.wrongOperation() };
  t.clock.t = sentAt + SETTLE_MS - 1;
  const early = (await t.check('its-us-find', body.attemptId, wrong)).body;
  assert.deepEqual(early, { v: 1, outcome: 'inconclusive', charge: false, reason: 'settling', retryAfterS: 1 });
  assert.deepEqual(t.dash0.calls, [], 'no Dash0 call while settling');
  assert.equal(t.charged(body.attemptId).length, 0);
  t.clock.t = sentAt + SETTLE_MS;
  const ready = (await t.check('its-us-find', body.attemptId, wrong)).body;
  assert.deepEqual(ready, { v: 1, outcome: 'fail', charge: true });
  assert.equal(t.dash0.calls.length, 1);
  assert.equal(t.dash0.calls[0].attemptId, body.attemptId);
  assert.equal(typeof t.dash0.calls[0].from, 'number');
  assert.ok(t.dash0.calls[0].to > t.dash0.calls[0].from);
});

test('data that lags behind ingest is not-visible, never a fail, and not charged', async () => {
  const t = await taskRig({ lagMs: 60_000 });
  const { body } = await t.start('its-us-find');
  t.noCooldown();
  const sentAt = t.clock.t;
  const wrong = { question: 'operation', value: t.wrongOperation() };
  t.clock.t = sentAt + SETTLE_MS + 1000;
  assert.deepEqual((await t.check('its-us-find', body.attemptId, wrong)).body, { v: 1, outcome: 'inconclusive', charge: false, reason: 'not-visible', retryAfterS: 10 });
  assert.equal(t.charged(body.attemptId).length, 0);
  t.clock.t = sentAt + 60_000;
  assert.deepEqual((await t.check('its-us-find', body.attemptId, wrong)).body, { v: 1, outcome: 'fail', charge: true }, 'once visible, the same answer fails');
});

test('an API failure of any kind is inconclusive "upstream", never a fail, and not charged', async () => {
  for (const mode of [401, 403, 429, 500, 'timeout', 'malformed']) {
    const t = await taskRig();
    const { body } = await t.start('its-us-find');
    t.noCooldown();
    t.clock.t += SETTLE_MS;
    t.dash0.fail(mode, 'api');
    const out = (await t.check('its-us-find', body.attemptId, { question: 'operation', value: t.wrongOperation() })).body;
    assert.deepEqual(out, { v: 1, outcome: 'inconclusive', charge: false, reason: 'upstream', retryAfterS: 15 }, String(mode));
    assert.equal(t.charged(body.attemptId).length, 0, String(mode));
  }
});

test('the real-mode adapter stub says "not implemented: P8" and the check stays inconclusive', async () => {
  const t = await taskRig();
  const api = createDash0Task({ ...t.deps, dash0: null }); // no injected Dash0: the P8 stub
  const { body } = await (async () => {
    const res = await api.POST(post(URL_, { v: 1, op: 'start', taskId: 'its-us-find' }, { cookie: t.cookie }));
    return { body: await res.json() };
  })();
  t.clock.t += SETTLE_MS;
  const res = await api.POST(post(URL_, { v: 1, op: 'check', taskId: 'its-us-find', attemptId: body.attemptId, answer: { question: 'operation', value: t.wrongOperation() } }, { cookie: t.cookie }));
  assert.equal((await res.json()).reason, 'upstream');
  const { createDash0Api } = await import('../lib/dash0-task/api.mjs');
  await assert.rejects(createDash0Api().countAttempt(), /not implemented: P8/);
  await assert.rejects(createDash0Api().findAssets(), /not implemented: P8/);
});

test('the per-attempt cooldown is taken before grading: a held cooldown is "cooldown" whatever the answer, with no Dash0 call', async () => {
  const t = await taskRig();
  const { body } = await t.start('its-us-find');
  t.clock.t += SETTLE_MS;
  const wrong = { question: 'operation', value: t.wrongOperation() };
  const right = { question: 'operation', value: t.answersOf('its-us-find').operation };
  assert.equal((await t.check('its-us-find', body.attemptId, wrong)).body.outcome, 'fail');
  const held = { v: 1, outcome: 'inconclusive', charge: false, reason: 'cooldown', retryAfterS: 5 };
  assert.deepEqual((await t.check('its-us-find', body.attemptId, { question: 'faultCode', value: 'ZZZZZZ' })).body, held);
  assert.deepEqual((await t.check('its-us-find', body.attemptId, right)).body, held, 'a right answer is not graded while the cooldown is held either');
  assert.equal(t.dash0.calls.length, 1, 'the held checks made no Dash0 call');
  assert.equal(t.charged(body.attemptId).length, 1, 'and no charge');
  const cool = t.r.fake.calls.find((c) => c[0] === 'SET' && String(c[1]).includes(':task-cool:'));
  assert.deepEqual(cool.slice(2), ['1', 'NX', 'EX', 5]);
  t.r.fake.db.delete(cool[1]); // the 5 s are up
  assert.equal((await t.check('its-us-find', body.attemptId, right)).body.outcome, 'pass');
});

test('a stale attempt id is 409; expired is 410 one millisecond past expiresAt and fine at expiresAt', async () => {
  const t = await taskRig();
  const { body } = await t.start('its-us-find');
  t.noCooldown();
  const answer = { question: 'operation', value: t.answersOf('its-us-find').operation };
  const other = (await t.check('its-us-find', 'b'.repeat(16), answer));
  assert.equal(other.res.status, 409);
  assert.deepEqual(other.body, { error: 'stale-attempt' });
  assert.equal((await t.check('connect-test-span', body.attemptId)).res.status, 409, 'no attempt of that task');
  t.clock.t = body.expiresAt;
  assert.equal((await t.check('its-us-find', body.attemptId, answer)).res.status, 200);
  t.clock.t = body.expiresAt + 1;
  const late = await t.check('its-us-find', body.attemptId, answer);
  assert.equal(late.res.status, 410);
  assert.deepEqual(late.body, { error: 'expired' });
  const again = (await t.start('its-us-find')).body;
  assert.notEqual(again.attemptId, body.attemptId, 'an expired attempt starts afresh');
  assert.equal((await t.check('its-us-find', body.attemptId, answer)).res.status, 409, 'and the old id is stale from then on');
});

test('the 13th start in a window is 429 with a retry time; checks have their own budget of 40', async () => {
  const t = await taskRig();
  for (let i = 0; i < START_MAX; i++) assert.equal((await t.start('connect-test-span')).res.status, 200, `start ${i + 1}`);
  const limited = await t.op({ v: 1, op: 'start', taskId: 'connect-test-span' });
  assert.equal(limited.status, 429);
  const out = await limited.json();
  assert.equal(out.error, 'rate-limited');
  assert.ok(out.retryAfterS >= 1 && out.retryAfterS <= 600);
  assert.equal(limited.headers.get('retry-after'), String(out.retryAfterS));
  const { body } = await (async () => { t.clock.t += 600_000; return t.start('connect-test-span'); })();
  t.noCooldown();
  t.clock.t += 600_000;
  for (let i = 0; i < 40; i++) assert.equal((await t.check('connect-test-span', body.attemptId)).res.status, 200, `check ${i + 1}`);
  assert.equal((await t.check('connect-test-span', body.attemptId)).res.status, 429);
});

test('readback: the connect task passes once the attempt\'s span is visible, and is inconclusive before, never a fail', async () => {
  const t = await taskRig({ lagMs: 5000 });
  const { body } = await t.start('connect-test-span');
  t.noCooldown();
  t.clock.t += 100_000; // however long the player takes, absence stays inconclusive
  const before = await t.check('connect-test-span', body.attemptId);
  assert.deepEqual(before.body, { v: 1, outcome: 'inconclusive', charge: false, reason: 'not-visible', retryAfterS: 10 });
  // The player's connected game sends a span stamped with the attempt id (what P7's browser does).
  const span = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), name: 'connect.test', kind: 1, startTimeUnixNano: '1', endTimeUnixNano: '2' };
  const stampedSpan = { ...span, attributes: [{ key: 'game.attempt.id', value: { stringValue: body.attemptId } }] };
  const ingest = await t.dash0.fetch(`https://${INGEST_HOST}/v1/traces`, { method: 'POST', headers: { Authorization: `Bearer ${INGEST_TOKEN}` }, body: JSON.stringify({ resourceSpans: [{ scopeSpans: [{ spans: [stampedSpan] }] }] }) });
  assert.equal(ingest.status, 200);
  assert.equal((await t.check('connect-test-span', body.attemptId)).body.reason, 'not-visible', 'received but not yet visible');
  t.clock.t += 5000;
  assert.deepEqual((await t.check('connect-test-span', body.attemptId)).body, { v: 1, outcome: 'pass', charge: false });
  t.dash0.fail(500, 'api');
  assert.equal((await t.check('connect-test-span', body.attemptId)).body.reason, 'upstream');
  assert.equal(t.charged(body.attemptId).length, 0);
});

test('readback: a held cooldown is "cooldown" with no Dash0 call', async () => {
  const t = await taskRig();
  const { body } = await t.start('connect-test-span');
  t.clock.t += SETTLE_MS;
  const first = await t.check('connect-test-span', body.attemptId);
  assert.equal(first.body.reason, 'not-visible', 'the first check takes the cooldown and probes');
  assert.equal(t.dash0.calls.length, 1);
  const held = await t.check('connect-test-span', body.attemptId);
  assert.deepEqual(held.body, { v: 1, outcome: 'inconclusive', charge: false, reason: 'cooldown', retryAfterS: 5 });
  assert.equal(t.dash0.calls.length, 1, 'the held check made no Dash0 call');
});

test('delete-account removes the task attempts and the charge set, through the API too', async () => {
  const t = await taskRig();
  await t.start('its-us-find');
  await t.start('connect-test-span');
  t.noCooldown();
  t.clock.t += SETTLE_MS;
  assert.equal((await t.check('its-us-find', t.attempt('its-us-find').attemptId, { question: 'operation', value: t.wrongOperation() })).body.charge, true);
  assert.ok(t.r.fake.db.has(keys.task(t.pid)));
  assert.ok(t.r.fake.db.has(keys.taskCharged(t.pid)));
  const { createAccount } = await import('../api/account.mjs');
  const res = await createAccount(t.deps).POST(post(`${ORIGIN}/api/account`, { v: 1, action: 'delete', confirm: 'delete' }, { cookie: t.cookie }));
  assert.equal(res.status, 200);
  assert.equal(t.r.fake.db.has(keys.task(t.pid)), false);
  assert.equal(t.r.fake.db.has(keys.taskCharged(t.pid)), false);
  assert.ok(!t.r.fake.keys().some((k) => k.includes(t.pid) && k.includes('task-charged')));
  assert.ok(!t.r.fake.keys().some((k) => k.includes(t.pid) && k.includes(':task:')));
});

test('two starts at once: the second save wins and the survivor is sent and checkable, never stranded by the first start\'s late marker', { timeout: 15_000 }, async () => {
  // The gates follow SAVE order, not call order: both starts are held at their save until both have read "no attempt";
  // the send of whichever start saved first is held until the other start's save has landed. Run with and without a delay
  // on the first load, which flips which start reaches its save first.
  for (const loadDelayMs of [0, 5]) {
    const t = await taskRig();
    let saves = 0;
    let loads = 0;
    let bothSaving;
    const saving = new Promise((resolve) => { bothSaving = resolve; });
    let secondLanded;
    const landed = new Promise((resolve) => { secondLanded = resolve; });
    let firstSaved = null;
    const redis = {
      ...t.deps.redis,
      pipeline: async (commands) => {
        const [verb, key, field, value] = commands[0];
        if (verb === 'HGET' && key === keys.task(t.pid) && field === 'its-us-find' && loads++ === 0 && loadDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, loadDelayMs));
        }
        const save = verb === 'HSET' && key === keys.task(t.pid) && field === 'its-us-find';
        if (save) {
          if (++saves === 2) bothSaving();
          await saving;
        }
        const out = await t.deps.redis.pipeline(commands);
        if (save) {
          const id = JSON.parse(value).attemptId;
          if (firstSaved === null) firstSaved = id;
          else secondLanded();
        }
        return out;
      },
    };
    const fetch = async (url, init) => {
      if (firstSaved !== null && String(init.body).includes(firstSaved)) await landed; // the first-saved attempt's send waits for the other save
      return t.deps.fetch(url, init);
    };
    const api = createDash0Task({ ...t.deps, redis, fetch });
    const start = async () => (await api.POST(post(URL_, { v: 1, op: 'start', taskId: 'its-us-find' }, { cookie: t.cookie }))).json();
    const both = await Promise.all([start(), start()]);
    assert.equal(saves, 2, 'both starts reached the save');
    const survivor = t.attempt('its-us-find').attemptId;
    assert.notEqual(survivor, firstSaved, 'the second save won');
    const winner = both.find((x) => x.ok === true);
    const loser = both.find((x) => x.error !== undefined);
    assert.equal(winner?.attemptId, survivor);
    assert.equal(loser?.error, 'stale-attempt', 'the start whose save lost learns it lost');
    const right = () => ({ question: 'operation', value: t.answersOf('its-us-find').operation });
    const early = await t.check('its-us-find', survivor, right());
    assert.equal(early.res.status, 200);
    assert.equal(early.body.reason, 'settling', 'the survivor is sent and checkable (not "not-sent")');
    t.noCooldown();
    t.clock.t += SETTLE_MS;
    assert.equal((await t.check('its-us-find', survivor, right())).body.outcome, 'pass');
  }
});

test('an unsent attempt past its expiry is not resent: the next start is a new attempt from now, and a later check is not 410', async () => {
  const t = await taskRig();
  t.dash0.fail(500, 'ingest');
  const failed = await t.start('its-us-find');
  assert.equal(failed.res.status, 502);
  const dead = t.attempt('its-us-find');
  t.dash0.fail(null);
  t.clock.t = dead.expiresAt + 1;
  const { res, body } = await t.start('its-us-find');
  assert.equal(res.status, 200);
  assert.notEqual(body.attemptId, dead.attemptId, 'a new attempt');
  const fresh = t.attempt('its-us-find');
  assert.equal(fresh.t0, t.clock.t, 't0 is now');
  assert.equal(fresh.expiresAt, t.clock.t + 24 * 60 * 60 * 1000);
  t.clock.t += SETTLE_MS;
  t.noCooldown();
  const check = await t.check('its-us-find', body.attemptId, { question: 'operation', value: t.answersOf('its-us-find').operation });
  assert.equal(check.res.status, 200, 'not 410');
  assert.equal(check.body.outcome, 'pass');
});

test('an old attempt\'s sent marker is ignored: a new attempt whose ingest failed is not-sent, and its retry resends it byte for byte', async () => {
  const t = await taskRig();
  const a = (await t.start('its-us-find')).body; // A is sent
  assert.equal(t.sent.length, 1);
  t.dash0.fail(500, 'ingest');
  const failed = await t.start('its-us-find'); // B: a sent attempt starts a fresh one, and its ingest fails
  assert.equal(failed.res.status, 502);
  const b = t.attempt('its-us-find');
  assert.notEqual(b.attemptId, a.attemptId);
  assert.ok(t.r.fake.db.get(keys.task(t.pid)).has('its-us-find.sent'), 'A\'s marker is still in the hash');
  t.clock.t += SETTLE_MS;
  t.noCooldown();
  assert.equal((await t.check('its-us-find', b.attemptId, { question: 'operation', value: 'x' })).body.reason, 'not-sent');
  t.dash0.fail(null);
  const retry = await t.start('its-us-find');
  assert.equal(retry.body.attemptId, b.attemptId, 'B is resent, not replaced');
  assert.equal(t.sent.length, 3);
  assert.equal(t.sent[2].body, t.sent[1].body, 'byte for byte');
});

test('a Redis failure is 502 with nothing sent', async () => {
  const t = await taskRig();
  t.r.fake.fail = 'http500';
  const down = await t.op({ v: 1, op: 'start', taskId: 'its-us-find' });
  assert.equal(down.status, 502);
  assert.equal(t.sent.length, 0);
  t.r.fake.fail = null;
  assert.ok(t.logs.some((l) => l.outcome === 'store' && l.status === 502));
});

test('the suite never reaches the real Dash0: an unconfigured host is refused by the fake, and the global fetch throws', async () => {
  const t = await taskRig();
  await assert.rejects(async () => globalThis.fetch('https://api.eu-west-1.aws.dash0.com/'), /the test reached for the real fetch/);
  await assert.rejects(t.dash0.fetch('https://ingress.us-east-1.aws.dash0.com/v1/traces', { method: 'POST', body: '{}' }), TypeError);
  await assert.rejects(t.dash0.fetch('https://evil.example/v1/traces', { method: 'POST', body: '{}' }), TypeError);
  // A configured host the fake was not built for: the handler's send fails safe instead of reaching anywhere.
  const env = { ...TASK_ENV, DASH0_GAME_INGEST_URL: 'https://ingress.us-east-1.aws.dash0.com' };
  const other = await taskRig({ env });
  const { res, body } = await other.start('its-us-find');
  assert.equal(res.status, 502);
  assert.equal(body.reason, 'ingest');
});
