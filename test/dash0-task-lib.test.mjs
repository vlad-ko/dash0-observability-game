// lib/dash0-task/* and tools/fake-dash0.mjs (#509 P5): config, tag, names, links, scenario, grading and the fake.
import './helpers/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dash0TaskConfig, ENV_KEYS } from '../lib/dash0-task/config.mjs';
import { gradeCheck } from '../lib/dash0-task/grade.mjs';
import { deepLink } from '../lib/dash0-task/links.mjs';
import { assetName, originPrefix } from '../lib/dash0-task/names.mjs';
import { buildScenario } from '../lib/dash0-task/scenario.mjs';
import { playerTag } from '../lib/dash0-task/tag.mjs';
import { answersFrom } from '../lib/incident-lab.mjs';
import { createFakeDash0 } from '../tools/fake-dash0.mjs';
import { API_HOST, API_TOKEN, INGEST_HOST, INGEST_TOKEN, PLAYER_SECRET, TASK_ENV } from './helpers/dash0-task.mjs';

const without = (key) => Object.fromEntries(Object.entries(TASK_ENV).filter(([k]) => k !== key));
const withValue = (key, value) => ({ ...TASK_ENV, [key]: value });

test('config: no variable is off; all seven valid is on, carrying the values', () => {
  assert.deepEqual(dash0TaskConfig({}), { state: 'off' });
  assert.deepEqual(dash0TaskConfig({ DASH0_GAME_INGEST_URL: '' }), { state: 'off' });
  assert.deepEqual(dash0TaskConfig(undefined), { state: 'off' });
  assert.deepEqual(dash0TaskConfig(TASK_ENV), {
    state: 'on',
    ingestBase: `https://${INGEST_HOST}`,
    ingestToken: INGEST_TOKEN,
    dataset: 'oncall-game',
    apiBase: `https://${API_HOST}`,
    apiToken: API_TOKEN,
    appOrigin: 'https://app.dash0.com',
    playerSecret: PLAYER_SECRET,
  });
});

test('config: any one variable set means all must validate, and the result names the field and the reason, never a value', () => {
  for (const key of Object.values(ENV_KEYS)) {
    const got = dash0TaskConfig(without(key));
    assert.equal(got.state, 'invalid', key);
    assert.equal(got.field, key);
    assert.equal(got.reason, 'empty');
  }
  // Only one variable set: the rest are missing, the first missing one is named.
  assert.deepEqual(dash0TaskConfig({ DASH0_GAME_PLAYER_SECRET: PLAYER_SECRET }), { state: 'invalid', field: 'DASH0_GAME_INGEST_URL', reason: 'empty' });
});

test('config: each field has its own checks', () => {
  const reason = (key, value) => dash0TaskConfig(withValue(key, value));
  assert.equal(reason('DASH0_GAME_INGEST_URL', 'https://ingress.evil.example').reason, 'unknown-host');
  assert.equal(reason('DASH0_GAME_INGEST_TOKEN', 'nope').reason, 'prefix');
  assert.equal(reason('DASH0_GAME_DATASET', 'not a slug!').reason, 'format');
  assert.equal(reason('DASH0_GAME_API_URL', `https://${INGEST_HOST}`).reason, 'unknown-host', 'the ingress host is not an API host');
  assert.equal(reason('DASH0_GAME_API_URL', 'https://api.eu-west-1.aws.dash0.com.evil.example').reason, 'unknown-host');
  assert.equal(reason('DASH0_GAME_API_URL', 'http://api.eu-west-1.aws.dash0.com').reason, 'not-https');
  assert.equal(reason('DASH0_GAME_API_URL', 'https://u:p@api.eu-west-1.aws.dash0.com').reason, 'credentials');
  assert.equal(reason('DASH0_GAME_API_URL', 'https://api.eu-west-1.aws.dash0.com/api').reason, 'unexpected-path');
  assert.equal(reason('DASH0_GAME_API_URL', 'https://api.eu-west-1.aws.dash0.com:8443').reason, 'unexpected-port');
  assert.equal(reason('DASH0_GAME_API_URL', 'https://api.eu-west-1.aws.dash0.com/?x=1').reason, 'query');
  assert.equal(reason('DASH0_GAME_API_URL', 'api.eu-west-1.aws.dash0.com').reason, 'malformed');
  assert.equal(dash0TaskConfig(withValue('DASH0_GAME_API_URL', 'https://api.europe-west4.gcp.dash0.com/')).state, 'on');
  for (const host of ['api.eu-west-1.aws.dash0.com', 'api.us-west-2.aws.dash0.com', 'api.us-east-1.aws.dash0.com', 'api.europe-west4.gcp.dash0.com']) {
    assert.equal(dash0TaskConfig(withValue('DASH0_GAME_API_URL', `https://${host}`)).state, 'on', host);
  }
  assert.equal(reason('DASH0_GAME_API_TOKEN', 'Bearer auth_x1234567890').reason, 'bearer-prefix');
  assert.equal(reason('DASH0_GAME_APP_URL', 'https://app.dash0.com.evil.example').reason, 'unknown-host');
  assert.equal(reason('DASH0_GAME_APP_URL', 'https://app.dash0.com/goto').reason, 'unexpected-path');
  assert.equal(dash0TaskConfig(withValue('DASH0_GAME_APP_URL', 'https://app.dash0.com/')).appOrigin, 'https://app.dash0.com');
  assert.equal(reason('DASH0_GAME_PLAYER_SECRET', 'x'.repeat(31)).reason, 'short');
  assert.equal(dash0TaskConfig(withValue('DASH0_GAME_PLAYER_SECRET', 'x'.repeat(32))).state, 'on');
  const got = JSON.stringify(reason('DASH0_GAME_PLAYER_SECRET', 'x'.repeat(31)));
  assert.ok(!got.includes('xxxx'), 'a result never carries a value');
});

test('config: http://localhost is an ingest URL only off Vercel', () => {
  const local = withValue('DASH0_GAME_INGEST_URL', 'http://localhost:4318');
  assert.equal(dash0TaskConfig(local).state, 'on');
  assert.equal(dash0TaskConfig({ ...local, VERCEL: '1' }).reason, 'not-https');
});

test('tag: deterministic, 10 base32 characters, different per pid and per secret, and not the pid', () => {
  const secret = 'a'.repeat(32);
  const tag = playerTag('pid-1', secret);
  assert.match(tag, /^[a-z2-7]{10}$/);
  assert.equal(playerTag('pid-1', secret), tag);
  assert.notEqual(playerTag('pid-2', secret), tag);
  assert.notEqual(playerTag('pid-1', 'b'.repeat(32)), tag);
  assert.equal(tag, '6bz2w47pzb', 'HMAC-SHA256 over "player:pid-1", base32 lower case, ten characters: computed with Python hmac and base64');
  assert.throws(() => playerTag('', secret), TypeError);
  assert.throws(() => playerTag('pid-1', 'short'), (err) => err instanceof TypeError && !err.message.includes('short'));
});

test('names: assetName and originPrefix are the one composition', () => {
  const tag = 'abcdefghij';
  const attempt = '0123456789abcdef';
  assert.equal(assetName(tag, 'its-us-find', attempt), 'oncall-abcdefghij-its-us-find-012345');
  assert.equal(originPrefix(tag), 'oncall-abcdefghij-');
  assert.ok(assetName(tag, 'its-us-find', attempt).startsWith(originPrefix(tag)));
  assert.throws(() => assetName('a-pid-with-chars', 'x', attempt), TypeError);
  assert.throws(() => assetName(tag, 'Bad Task', attempt), TypeError);
  assert.throws(() => assetName(tag, 'x', 'nothex'), TypeError);
  assert.throws(() => originPrefix('ABCDEFGHIJ'), TypeError);
});

test('links: the deep link is the documented form, with JSON filter, absolute ISO times and the three targets', () => {
  const base = { appOrigin: 'https://app.dash0.com', dataset: 'oncall-game', attemptId: '0123456789abcdef', fromMs: Date.UTC(2027, 0, 2, 3, 4, 5), toMs: Date.UTC(2027, 0, 2, 4, 4, 5) };
  const filter = encodeURIComponent('[{"key":"game.attempt.id","operator":"is","value":"0123456789abcdef"}]');
  assert.equal(
    deepLink({ ...base, target: 'traces' }),
    `https://app.dash0.com/goto/traces/explorer?from=${encodeURIComponent('2027-01-02T03:04:05.000Z')}&to=${encodeURIComponent('2027-01-02T04:04:05.000Z')}&dataset=oncall-game&filter=${filter}`,
  );
  assert.ok(deepLink({ ...base, target: 'logs' }).startsWith('https://app.dash0.com/goto/logs?'));
  assert.ok(deepLink({ ...base, target: 'metrics' }).startsWith('https://app.dash0.com/goto/metrics/explorer?'));
  const url = new URL(deepLink({ ...base, target: 'traces' }));
  assert.equal(url.searchParams.get('from'), '2027-01-02T03:04:05.000Z');
  assert.throws(() => deepLink({ ...base, target: 'x' }), RangeError);
  assert.throws(() => deepLink({ ...base, target: 'traces', appOrigin: 'http://app.dash0.com' }), TypeError);
  assert.throws(() => deepLink({ ...base, target: 'traces', attemptId: 'a"b' }), TypeError);
  assert.throws(() => deepLink({ ...base, target: 'traces', dataset: '' }), TypeError);
  assert.throws(() => deepLink({ ...base, target: 'traces', fromMs: NaN }), RangeError);
});

const SCENARIO = { seed: 12345, t0: 1_800_000_000_000, tag: 'abcdefghij', attemptId: '0123456789abcdef' };

test('scenario: its-us-find is deterministic, stamped on every span, and its answers come from the same spans', () => {
  const a = buildScenario('its-us-find', SCENARIO);
  assert.deepEqual(buildScenario('its-us-find', SCENARIO), a);
  assert.notDeepEqual(buildScenario('its-us-find', { ...SCENARIO, seed: 54321 }).answers, a.answers);
  assert.deepEqual(a.answers, answersFrom(a.spans));
  assert.equal(a.batches.length, 1);
  assert.equal(a.batches[0].signal, 'traces');
  const spans = a.batches[0].body.resourceSpans[0].scopeSpans[0].spans;
  assert.equal(spans.length, a.spans.length);
  for (const span of spans) {
    const attrs = Object.fromEntries(span.attributes.map((x) => [x.key, x.value.stringValue]));
    assert.equal(attrs['game.attempt.id'], SCENARIO.attemptId);
    assert.equal(attrs['game.player.tag'], SCENARIO.tag);
    assert.equal(attrs['game.task.id'], 'its-us-find');
  }
  assert.equal('attemptId' in a.linkParams, false, 'the boss link has no attempt filter');
  assert.equal(buildScenario('connect-test-span', SCENARIO).linkParams.attemptId, SCENARIO.attemptId);
  assert.equal(a.linkParams.target, 'traces');
  assert.ok(a.linkParams.fromMs < SCENARIO.t0 && a.linkParams.toMs > SCENARIO.t0);
});

test('scenario: connect-test-span sends nothing and has no answer; bad input throws', () => {
  const c = buildScenario('connect-test-span', SCENARIO);
  assert.deepEqual(c.batches, []);
  assert.equal(c.answers, null);
  assert.throws(() => buildScenario('nope', SCENARIO), RangeError);
  assert.throws(() => buildScenario('its-us-find', { ...SCENARIO, tag: 'a-pid' }), TypeError);
  assert.throws(() => buildScenario('its-us-find', { ...SCENARIO, seed: -1 }), TypeError);
  assert.throws(() => buildScenario('its-us-find', { ...SCENARIO, t0: 'now' }), TypeError);
});

test('grade: the decision table, with the probe asked only when it must be', async () => {
  const scenario = buildScenario('its-us-find', SCENARIO);
  const wrong = { question: 'faultCode', value: 'ZZZZZZ' };
  const right = { question: 'faultCode', value: scenario.answers.faultCode.toLowerCase() };
  const sentAt = 1000;
  const run = async (over) => {
    const asked = { probe: 0, cooldown: 0 };
    const out = await gradeCheck({
      grader: 'seeded', scenario, answer: wrong, sentAt, now: sentAt + 30_000,
      cooldown: async () => { asked.cooldown++; return true; },
      probe: async () => { asked.probe++; return { count: 3 }; },
      ...over,
    });
    return { out, asked };
  };
  assert.deepEqual((await run({ answer: right })).out, { outcome: 'pass' });
  assert.deepEqual((await run({ answer: right })).asked, { probe: 1, cooldown: 1 }, 'a right answer takes the cooldown first, then the probe confirms the data before it is graded');
  assert.deepEqual((await run({ answer: right, seen: true })).asked, { probe: 0, cooldown: 1 }, 'a cached confirmation needs no probe');
  for (const [probe, reason] of [[async () => ({ count: 0 }), 'not-visible'], [async () => ({ error: true }), 'upstream']]) {
    const unconfirmed = await run({ answer: right, probe });
    assert.equal(unconfirmed.out.reason, reason, 'a right answer is not graded while the data is not confirmed');
    assert.equal(unconfirmed.out.outcome, 'inconclusive');
  }
  let confirmed = 0;
  await run({ answer: right, confirm: async () => { confirmed++; } });
  await run({ answer: right, seen: true, confirm: async () => { confirmed++; } });
  assert.equal(confirmed, 1, 'the confirmation is recorded when a probe finds the data, not when it was already cached');
  const early = await run({ answer: right, now: sentAt + 29_999 });
  assert.deepEqual([early.out.reason, early.out.retryAfterS, early.asked], ['settling', 1, { probe: 0, cooldown: 0 }], 'a right answer while settling is not graded: it could only be a guess');
  assert.equal((await run({ answer: right, cooldown: async () => false })).out.reason, 'cooldown', 'a held cooldown refuses a right answer too');
  assert.deepEqual((await run()).out, { outcome: 'fail', wrong: 'faultCode:zzzzzz' });
  assert.equal((await run({ now: sentAt + 29_999 })).out.reason, 'settling');
  assert.equal((await run({ now: sentAt + 29_999 })).asked.probe, 0);
  assert.equal((await run({ sentAt: null })).out.reason, 'not-sent');
  assert.equal((await run({ probe: async () => ({ count: 0 }) })).out.reason, 'not-visible');
  assert.equal((await run({ probe: async () => ({ error: true }) })).out.reason, 'upstream');
  assert.equal((await run({ cooldown: async () => false })).out.reason, 'cooldown');
  assert.equal((await run({ answer: { question: 'faultCode', value: '' } })).out.reason, 'answer');
  assert.equal((await run({ answer: { question: 'nope', value: 'x' } })).out.reason, 'answer');
  assert.equal((await run({ answer: { question: 'retryCount', value: 'many' } })).out.reason, 'answer');
  assert.equal((await run({ answer: undefined })).out.reason, 'answer');
  assert.equal((await run({ scenario: { spans: [] } })).out.reason, 'answer', 'an unreadable key is never a fail');
  const readback = await gradeCheck({ grader: 'readback', scenario: null, answer: undefined, sentAt, now: sentAt, cooldown: async () => true, probe: async () => ({ count: 1 }) });
  assert.deepEqual(readback, { outcome: 'pass' });
  assert.equal((await gradeCheck({ grader: 'readback', sentAt, now: sentAt, cooldown: async () => true, probe: async () => ({ count: 0 }) })).reason, 'not-visible');
  assert.equal((await gradeCheck({ grader: 'mystery', sentAt, now: sentAt, cooldown: async () => true, probe: async () => ({ count: 1 }) })).reason, 'answer');
});

test('fake dash0: it accepts ingest on the three signal paths and counts records only after the lag', async () => {
  let t = 1000;
  const fake = createFakeDash0({ now: () => t, lagMs: 500, hosts: [INGEST_HOST, API_HOST] });
  const stamp = [{ key: 'game.attempt.id', value: { stringValue: 'att' } }, { key: 'game.player.tag', value: { stringValue: 'tagtagtag2' } }];
  const send = (path, body) => fake.fetch(`https://${INGEST_HOST}${path}`, { method: 'POST', headers: {}, body: JSON.stringify(body) });
  assert.equal((await send('/v1/traces', { resourceSpans: [{ scopeSpans: [{ spans: [{ attributes: stamp }] }] }] })).status, 200);
  assert.equal((await send('/v1/logs', { resourceLogs: [{ scopeLogs: [{ logRecords: [{ attributes: stamp }] }] }] })).status, 200);
  assert.equal((await send('/v1/metrics', { resourceMetrics: [{ scopeMetrics: [{ metrics: [{ gauge: { dataPoints: [{ attributes: stamp }] } }] }] }] })).status, 200);
  assert.deepEqual(fake.records.map((r) => r.signal), ['traces', 'logs', 'metrics']);
  assert.equal((await send('/v1/other', {})).status, 404);
  assert.equal((await send('/v1/traces', { nope: 1 })).status, 400);
  assert.deepEqual(await fake.countAttempt('att', {}), { count: 0 }, 'not yet visible');
  t += 499;
  assert.equal((await fake.countAttempt('att', {})).count, 0);
  t += 1;
  assert.equal((await fake.countAttempt('att', { from: 1, to: 2 })).count, 3);
  assert.equal((await fake.countAttempt('other', {})).count, 0);
  fake.assets.push({ origin: 'oncall-tagtagtag2-x-1' }, { origin: 'oncall-other-x-1' });
  assert.deepEqual((await fake.findAssets({ originPrefix: 'oncall-tagtagtag2-' })).assets, [{ origin: 'oncall-tagtagtag2-x-1' }]);
});

test('fake dash0: every failure mode, for ingest and for the API', async () => {
  const fake = createFakeDash0({ now: () => 0, hosts: [INGEST_HOST] });
  const send = (signal) => fake.fetch(`https://${INGEST_HOST}/v1/traces`, { method: 'POST', body: '{}', signal });
  for (const status of [401, 403, 429, 500]) {
    fake.fail(status);
    assert.equal((await send()).status, status);
    await assert.rejects(fake.countAttempt('x'), (err) => err.status === status);
  }
  fake.fail('malformed');
  const bad = await send();
  assert.equal(bad.status, 200);
  await assert.rejects(bad.json());
  assert.deepEqual(await fake.countAttempt('x'), { count: 'many' });
  fake.fail('timeout');
  const ctl = new AbortController();
  const pending = send(ctl.signal);
  ctl.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  fake.fail(null);
  assert.equal((await send()).status, 400, 'healthy again: an empty body is a bad request, not a fault');
  fake.fail(500, 'api');
  assert.equal((await send()).status, 400, 'the API fault leaves ingest alone');
  await assert.rejects(fake.countAttempt('x'));
  assert.throws(() => fake.fail('boom'), RangeError);
  assert.throws(() => createFakeDash0({ now: () => 0 }), TypeError);
});

test('fake dash0: a host it was not built with throws a TypeError', async () => {
  const fake = createFakeDash0({ now: () => 0, hosts: [INGEST_HOST] });
  await assert.rejects(fake.fetch('https://ingress.us-east-1.aws.dash0.com/v1/traces', { method: 'POST', body: '{}' }), TypeError);
  await assert.rejects(fake.fetch(`https://${API_HOST}/api/spans`, { method: 'POST', body: '{}' }), TypeError);
  await assert.rejects(fake.fetch('https://example.com/'), TypeError);
});

test('links: without an attempt id the link has no filter at all, and a bad one still throws (#509 P7.1)', () => {
  const base = { appOrigin: 'https://app.dash0.com', dataset: 'oncall-game', fromMs: 1_000_000, toMs: 2_000_000, target: 'traces' };
  const url = new URL(deepLink(base));
  assert.equal(url.searchParams.has('filter'), false);
  assert.equal(url.searchParams.get('dataset'), 'oncall-game');
  assert.equal(url.searchParams.has('from') && url.searchParams.has('to'), true, 'the time range stays');
  assert.equal(deepLink(base).includes('filter'), false);
  assert.throws(() => deepLink({ ...base, attemptId: 'nothex' }), TypeError);
});
