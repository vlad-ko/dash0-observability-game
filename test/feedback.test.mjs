// Level feedback (#370, docs/FOUNDATION.md §2.11): the pure contract in lib/feedback.mjs and the function in
// api/feedback.mjs, driven with a fake GitHub fetch, a fixed clock, fake timers and a log spy. No network.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFeedback } from '../api/feedback.mjs';
import { liveRegistry } from '../app.mjs';
import { createAuthContext } from '../lib/auth/config.mjs';
import { feedbackConfig, issueBody, issueTitle, KINDS, MAX_BODY_BYTES, MAX_TEXT, parseFeedback } from '../lib/feedback.mjs';
import { ENV as AUTH_ENV, registry as authRegistry, rig } from './helpers/auth-api.mjs';
import { timers } from './helpers/otel.mjs';

const NOW = 1_800_000_000_000;
const URL_ = 'https://game.test/api/feedback';
const ENV_ON = Object.freeze({ FEEDBACK_GITHUB_TOKEN: 'ghp_TOKENCANARY', FEEDBACK_REPO: 'o/r', VERCEL_GIT_COMMIT_SHA: 'abc1234def' });
const registry = {
  levels: {
    'spans-and-traces': { id: 'spans-and-traces', name: 'Spans and traces' },
    'lvl-b': { id: 'lvl-b', name: 'Level B' },
  },
};
const good = { v: 1, levelId: 'spans-and-traces', screen: 2, kind: 'unclear', text: 'The second option reads oddly.' };
const body = (over = {}) => JSON.stringify({ ...good, ...over });
const SECRETS = { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'UA-SECRET', cookie: 'c=COOKIE-SECRET' };

function github({ status = 201, json = { number: 42 }, mode } = {}) {
  const calls = [];
  const fetch = (url, init) => {
    calls.push({ url, init, body: init?.body === undefined ? undefined : JSON.parse(init.body) });
    if (mode === 'stall') return new Promise(() => {});
    if (mode === 'throw') return Promise.reject(new Error('tok'));
    return Promise.resolve(new Response(JSON.stringify(json), { status }));
  };
  return { fetch, calls };
}

function setup({ env = ENV_ON, gh = github(), limiter, extra = {} } = {}) {
  const logs = [];
  const tm = timers();
  const fb = createFeedback({
    env, fetch: gh.fetch, registry, now: () => NOW, log: (l) => logs.push(l), setTimeout: tm.setTimeout, clearTimeout: tm.clearTimeout,
    ...(limiter ? { limiter } : {}), // the function's own default limits are the ones under test
    auth: { session: async () => ({ state: 'none' }) },
    ...extra,
  });
  return { fb, logs, gh, tm };
}
const post = (payload = body(), { headers = {}, method = 'POST' } = {}) =>
  new Request(URL_, { method, headers: { 'content-type': 'application/json', origin: 'https://game.test', ...headers }, body: method === 'GET' ? undefined : payload });
const spied = (req) => {
  const reads = { n: 0 };
  const text = req.text.bind(req);
  const clone = req.clone.bind(req);
  req.text = async () => { reads.n += 1; return text(); };
  req.clone = () => { reads.n += 1; return clone(); };
  return { req, reads };
};

test('1 feedbackConfig: on only with a token and a well-formed repo', () => {
  assert.equal(feedbackConfig({ FEEDBACK_GITHUB_TOKEN: 't', FEEDBACK_REPO: 'a/b' }).on, true);
  assert.equal(feedbackConfig({ FEEDBACK_GITHUB_TOKEN: 't', FEEDBACK_REPO: 'vlad-ko/dash0-observability-game' }).on, true);
  for (const env of [
    { FEEDBACK_REPO: 'a/b' },
    { FEEDBACK_GITHUB_TOKEN: '', FEEDBACK_REPO: 'a/b' },
    { FEEDBACK_GITHUB_TOKEN: 't', FEEDBACK_REPO: 'a/b/c' },
    { FEEDBACK_GITHUB_TOKEN: 't', FEEDBACK_REPO: '../x' },
    { FEEDBACK_GITHUB_TOKEN: 't', FEEDBACK_REPO: 'a/..' },
    { FEEDBACK_GITHUB_TOKEN: 't' },
    {},
  ]) assert.equal(feedbackConfig(env).on, false, JSON.stringify(env));
});

test('2 GET says whether feedback is on, never cached; other methods are 405', async () => {
  const off = await setup({ env: {} }).fb.GET(new Request(URL_));
  assert.deepEqual(await off.json(), { v: 1, on: false });
  const on = await setup().fb.GET(new Request(URL_));
  assert.equal(on.status, 200);
  assert.deepEqual(await on.json(), { v: 1, on: true });
  assert.equal(on.headers.get('cache-control'), 'no-store');
  assert.equal((await setup().fb.GET(new Request(URL_, { method: 'PUT', body: 'x' }))).status, 405);
});

test('3 off: POST is 503, reads no body and calls no GitHub', async () => {
  const { fb, gh } = setup({ env: {} });
  const { req, reads } = spied(post());
  const res = await fb.POST(req);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'off' });
  assert.equal(reads.n, 0);
  assert.equal(gh.calls.length, 0);
});

test('4 Origin: missing, null and foreign are 403; the same host reaches the parse', async () => {
  for (const origin of [undefined, 'null', 'https://evil.example']) {
    const { fb, gh } = setup();
    const headers = origin === undefined ? { origin: '' } : { origin };
    const req = post(body(), { headers });
    if (origin === undefined) req.headers.delete('origin');
    assert.equal((await fb.POST(req)).status, 403, String(origin));
    assert.equal(gh.calls.length, 0);
  }
  const { fb } = setup();
  assert.equal((await fb.POST(post('not json'))).status, 400, 'same host passes the origin check and fails the parse');
});

test('5 media type and size: text/plain 415; a declared or actual body over the cap is 413', async () => {
  const { fb, gh } = setup();
  assert.equal((await fb.POST(post(body(), { headers: { 'content-type': 'text/plain' } }))).status, 415);
  const { req, reads } = spied(post(body(), { headers: { 'content-length': '9000' } }));
  assert.equal((await fb.POST(req)).status, 413);
  assert.equal(reads.n, 0, 'a declared over-limit body is not read');
  const big = body({ text: 'x'.repeat(MAX_BODY_BYTES) });
  assert.ok(new TextEncoder().encode(big).length > MAX_BODY_BYTES);
  assert.equal((await fb.POST(post(big, { headers: { 'content-length': '10' } }))).status, 413, 'a lying length does not help');
  assert.equal(gh.calls.length, 0);
});

test('6 parseFeedback is closed and strict', () => {
  const p = (over, drop) => {
    const o = { ...good, ...over };
    if (drop) delete o[drop];
    return parseFeedback(JSON.stringify(o), registry);
  };
  assert.deepEqual(p({}), { ok: true, levelId: 'spans-and-traces', screen: 2, kind: 'unclear', text: good.text, chars: good.text.length });
  assert.deepEqual(p({ email: 'a@b.c' }), { ok: false, field: 'body' });
  assert.deepEqual(parseFeedback('[]', registry), { ok: false, field: 'body' });
  assert.deepEqual(parseFeedback('{"v":1', registry), { ok: false, field: 'body' });
  assert.deepEqual(p({ v: 2 }), { ok: false, field: 'v' });
  for (const levelId of ['toString', '__proto__', 'constructor', 'nope', 7]) assert.deepEqual(p({ levelId }), { ok: false, field: 'levelId' }, String(levelId));
  assert.deepEqual(p({ kind: 'praise' }), { ok: false, field: 'kind' });
  for (const kind of KINDS) assert.equal(p({ kind }).ok, true, kind);
  for (const screen of [0, 1.5, '2', 1000, -1, null]) assert.deepEqual(p({ screen }), { ok: false, field: 'screen' }, String(screen));
  assert.equal(p({ screen: 1 }).ok, true);
  assert.equal(p({ screen: 999 }).ok, true);
  assert.deepEqual(p({ text: '   ' }), { ok: false, field: 'text' });
  assert.deepEqual(p({ text: 5 }), { ok: false, field: 'text' });
  assert.deepEqual(p({}, 'text'), { ok: false, field: 'text' });
  assert.equal(p({ text: '😀'.repeat(MAX_TEXT) }).ok, true, 'a code point is one character');
  assert.deepEqual(p({ text: '😀'.repeat(MAX_TEXT + 1) }), { ok: false, field: 'text' });
  assert.equal(p({ text: `  hi  ` }).text, 'hi', 'trimmed');
});

test('7 issueBody neutralises mentions, hidden direction marks and fence escapes', () => {
  const text = '@octocat ![x](https://evil/p.png) [go](https://evil) ``` ‮';
  const out = issueBody({ kind: 'bug', screen: 1, level: registry.levels['lvl-b'], commit: 'abc1234', who: 'signed out', text });
  const lines = out.split('\n');
  const open = lines.findIndex((l) => l.startsWith('`'));
  assert.equal(lines[open], '````text', 'the fence is longer than the longest backtick run in the text');
  const closers = lines.filter((l, i) => i > open && /^`+$/.test(l));
  assert.deepEqual(closers, ['````']);
  assert.equal(lines.at(-1), '````', 'only the last line closes it');
  assert.ok(out.includes('@​octocat'));
  assert.ok(!/@(?!​)/.test(out), 'every @ is followed by a zero-width space');
  assert.ok(!out.includes('‮'));
  const before = out.slice(0, out.indexOf('````text'));
  assert.ok(!before.includes('evil'), 'the player text sits only inside the fence');
  const plain = issueBody({ kind: 'bug', screen: 1, level: registry.levels['lvl-b'], commit: 'abc1234', who: 'signed out', text: 'a\u0000b\u007Fc\td\ne⁦f' });
  assert.ok(plain.includes('abc\td\nef'), 'controls and bidi marks go, tab and newline stay');
  assert.ok(plain.includes('```text\n'), 'three backticks when the text has none');
});

test('8 the header lines and the title come from controlled data', () => {
  const level = liveRegistry().levels['spans-and-traces'];
  assert.equal(issueTitle(level), 'Feedback: Spans and traces (spans-and-traces)');
  const out = issueBody({ kind: 'wrong-fact', screen: 3, level, commit: 'abc1234', who: '`nick-1`', text: 'hi' });
  for (const line of ['Kind: wrong-fact', 'Level: Spans and traces (spans-and-traces)', 'Screen: 3', 'Game commit: abc1234', 'From: `nick-1`']) {
    assert.ok(out.split('\n').includes(line), line);
  }
  assert.ok(issueBody({ kind: 'bug', screen: 1, level, commit: 'not-a-sha', who: 'x', text: 'hi' }).includes('Game commit: unknown'));
  assert.ok(issueBody({ kind: 'bug', screen: 1, level, commit: undefined, who: 'x', text: 'hi' }).includes('Game commit: unknown'));
  assert.ok(!issueTitle(level).includes('wrong-fact'));
});

test('9 a good POST opens one issue, and nothing private reaches GitHub or a log', async () => {
  const { fb, gh, logs } = setup();
  const res = await fb.POST(post(body(), { headers: SECRETS }));
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { v: 1, ok: true, issue: 42 });
  assert.equal(gh.calls.length, 1);
  const [call] = gh.calls;
  assert.equal(call.url, 'https://api.github.com/repos/o/r/issues');
  assert.equal(call.init.method, 'POST');
  assert.deepEqual(
    { ...call.init.headers },
    { authorization: 'Bearer ghp_TOKENCANARY', accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'oncall-game-feedback', 'content-type': 'application/json' },
  );
  assert.deepEqual(Object.keys(call.body).sort(), ['body', 'labels', 'title']);
  assert.deepEqual(call.body.labels, ['feedback']);
  assert.equal(call.body.title, 'Feedback: Spans and traces (spans-and-traces)');
  assert.ok(call.body.body.includes('Game commit: abc1234def'));
  const outbound = JSON.stringify(call.body);
  const logged = JSON.stringify(logs);
  for (const secret of ['203.0.113.9', 'UA-SECRET', 'COOKIE-SECRET']) {
    assert.ok(!outbound.includes(secret), `outbound leaks ${secret}`);
    assert.ok(!logged.includes(secret), `log leaks ${secret}`);
  }
  assert.ok(!logged.includes('second option') && !logged.includes('ghp_'), 'no text and no token in a log');
  assert.deepEqual(logs, [{ msg: 'feedback', outcome: 'sent', status: 201, levelId: 'spans-and-traces', kind: 'unclear', chars: good.text.length, issue: 42, ms: 0 }]);
});

test('10 the issue names a listed player by nickname, nobody else', async () => {
  const r = rig();
  const auth = createAuthContext({ env: AUTH_ENV, redis: r.deps.redis, now: r.deps.now, random: r.deps.random, registry: authRegistry });
  const { profile } = await r.store.signIn('g-1', 'ada@dash0.com');
  const cookie = await r.cookieFor(profile.pid);
  const from = async (extra, headers) => {
    const { fb, gh } = setup({ extra });
    assert.equal((await fb.POST(post(body(), { headers }))).status, 201);
    return gh.calls[0].body.body.split('\n').find((l) => l.startsWith('From:'));
  };
  const withAuth = { auth };
  assert.equal(await from(withAuth, { cookie }), `From: \`${profile.nick}\``);
  await r.store.setListing(profile.pid, false);
  assert.equal(await from(withAuth, { cookie }), 'From: signed in, not listed');
  const before = r.storeCalls();
  assert.equal(await from(withAuth, {}), 'From: signed out');
  assert.equal(r.storeCalls(), before, 'no cookie, no store call');
  assert.equal(await from({ auth: { session: async () => ({ state: 'store' }) } }, { cookie }), 'From: signed out');
  assert.equal(await from({ auth: { session: async () => { throw new Error('boom'); } } }, { cookie }), 'From: signed out');
});

test('11 the limiter counts accepted posts only, per client and per instance', async () => {
  {
    const { fb, gh } = setup();
    const headers = { 'x-forwarded-for': '198.51.100.1' };
    for (let i = 0; i < 5; i += 1) assert.equal((await fb.POST(post(body(), { headers }))).status, 201);
    const sixth = await fb.POST(post(body(), { headers }));
    assert.equal(sixth.status, 429);
    assert.ok(Number(sixth.headers.get('retry-after')) >= 1);
    assert.equal((await sixth.json()).retryAfterS, Number(sixth.headers.get('retry-after')));
    assert.equal(gh.calls.length, 5);
  }
  {
    const { fb } = setup();
    const headers = { 'x-forwarded-for': '198.51.100.2' };
    for (let i = 0; i < 6; i += 1) assert.equal((await fb.POST(post(body({ kind: 'praise' }), { headers }))).status, 400);
    assert.equal((await fb.POST(post(body(), { headers }))).status, 201, 'rejected bodies never used the budget');
  }
  {
    const { fb } = setup();
    for (let i = 1; i <= 30; i += 1) assert.equal((await fb.POST(post(body(), { headers: { 'x-forwarded-for': `203.0.113.${i}` } }))).status, 201);
    assert.equal((await fb.POST(post(body(), { headers: { 'x-forwarded-for': '203.0.113.31' } }))).status, 429);
  }
});

test('12 an upstream that fails, lies or stalls is a 502 and leaks nothing', async () => {
  for (const gh of [github({ status: 422, json: { message: 'bad' } }), github({ json: {} }), github({ json: { number: 0 } }), github({ json: { number: '7' } })]) {
    const { fb } = setup({ gh });
    const res = await fb.POST(post());
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: 'upstream' });
  }
  {
    const gh = github({ mode: 'stall' });
    const { fb, tm, logs } = setup({ gh });
    const pending = fb.POST(post());
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(tm.pending(), [{ ms: 6000 }]);
    assert.equal(gh.calls[0].init.signal.aborted, false);
    assert.equal(tm.fire(6000), true);
    const res = await pending;
    assert.equal(res.status, 502);
    assert.equal(gh.calls[0].init.signal.aborted, true, 'the call is aborted, not abandoned');
    assert.equal(logs.at(-1).outcome, 'timeout');
    assert.equal(tm.active(), 0);
  }
  {
    const { fb, logs } = setup({ gh: github({ mode: 'throw' }) });
    assert.equal((await fb.POST(post())).status, 502);
    assert.ok(!JSON.stringify(logs).includes('tok'), 'the error text is never logged');
  }
});

test('an internal failure is a 500 with no error text', async () => {
  const { fb, logs } = setup({ extra: { auth: { session: async () => ({ state: 'ok', profile: null }) } } });
  const res = await fb.POST(post());
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'internal' });
  assert.equal(logs.at(-1).outcome, 'error');
});
