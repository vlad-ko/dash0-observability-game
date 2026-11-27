// The In Dash0 task server (#509 P5; docs/FOUNDATION.md §2.15). A task asks the player to find something in the real Dash0
// organisation. POST `{v:1, op:'start', taskId}` makes an attempt: the server draws a seed, sends that attempt's telemetry
// to Dash0 and answers with a deep link. POST `{v:1, op:'check', taskId, attemptId, answer?}` grades the answer; the verdict
// is only ever 'fail' when the attempt's data is visible in Dash0 (lib/dash0-task/grade.mjs). GET says whether the tasks are on.
// Off unless all seven DASH0_GAME_* variables validate AND sign-in and the store are configured; off makes no Redis command
// and no outbound request. Signed-in only, same-origin, 4 KiB. Never in a response, log line, span or Redis: the tokens, the
// player secret, the seed, the answers, a pid, a nickname or an email. Logs carry the outcome only.
import { RedisError } from '../lib/account/redis.mjs';
import { keys } from '../lib/account/store.mjs';
import { clearSessionCookie } from '../lib/auth/session.mjs';
import { createAuthContext } from '../lib/auth/config.mjs';
import { createDash0Api } from '../lib/dash0-task/api.mjs';
import { dash0TaskConfig } from '../lib/dash0-task/config.mjs';
import { gradeCheck, SETTLE_S, validAnswer } from '../lib/dash0-task/grade.mjs';
import { deepLink } from '../lib/dash0-task/links.mjs';
import { assetName } from '../lib/dash0-task/names.mjs';
import { buildScenario, GRADER, taskOf } from '../lib/dash0-task/scenario.mjs';
import { ATTEMPT_ID, isTaskId } from '../lib/dash0-task/stamp.mjs';
import { playerTag } from '../lib/dash0-task/tag.mjs';
import { isJson, originMatches, reply } from '../lib/http.mjs';
import { signalUrl } from '../lib/dash0/ingress.mjs';
import { GRADE } from '../lib/incident-lab.mjs';
import { createServerTelemetry } from '../lib/otel/server.mjs';
import { sendOtlp } from '../lib/otlp/send.mjs';

export const MAX_BODY_BYTES = 4 * 1024;
export const START_LIMIT = { max: 12, windowS: 600 };
export const CHECK_LIMIT = { max: 40, windowS: 600 };
export const COOLDOWN_S = 5;
export const TASK_TTL_S = 30 * 24 * 60 * 60; // the player's attempts hash and charge set, refreshed on every write
export const ATTEMPT_LIFE_MS = 24 * 60 * 60 * 1000; // one attempt
export const INGEST_RETRY_S = 10;
export const INGEST_TIMEOUT_MS = 8000;
export const PROBE_TIMEOUT_MS = 5000;
const BODY_KEYS = ['v', 'op', 'taskId', 'attemptId', 'answer'];
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sentField = (taskId) => `${taskId}.sent`;

/** The handlers over injected `env`, `redis`, `fetch`, `now`, `random`, `registry`, `log` and `dash0` (the API interface of lib/dash0-task/api.mjs). */
export function createDash0Task({
  env = process.env,
  redis = null,
  fetch = globalThis.fetch,
  now = Date.now,
  random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)),
  registry = null,
  log = (line) => console.log(JSON.stringify(line)),
  dash0 = null,
  timeoutMs = null, // test-only: one timeout for the ingest call and the probe
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
} = {}) {
  const auth = createAuthContext({ env, redis, now, random, registry });
  const cfg = dash0TaskConfig(env);
  /** The one expression of "the tasks are on": the Dash0 variables validate and sign-in with its store is configured. */
  const enabled = cfg.state === 'on' && auth.config !== null;
  const api = dash0 ?? (cfg.state === 'on' ? createDash0Api() : null);

  let told = false;
  const tellOnce = () => {
    if (told || enabled || cfg.state === 'off') return;
    told = true;
    const reason = cfg.state === 'invalid' ? `${cfg.field}:${cfg.reason}` : 'auth:not-configured';
    try {
      log({ msg: 'dash0-task', outcome: 'not-configured', reason }); // the field and the reason, never a value
    } catch {
      // a failing log must not fail the request
    }
  };

  const wrap = (handler) => async (request) => {
    const started = now();
    const done = (status, body, outcome, headers) => {
      log({ msg: 'dash0-task', outcome, status, ms: now() - started });
      return reply(status, body, headers);
    };
    tellOnce();
    try {
      return await handler(request, done);
    } catch (err) {
      return err instanceof RedisError ? done(502, { error: 'store-unavailable' }, 'store') : done(500, { error: 'internal' }, 'error');
    }
  };

  /** The signed-in profile, or a ready response (502 or 401). */
  async function signedIn(request, done) {
    const who = await auth.session(request);
    if (who.state === 'store') return { res: done(502, { error: 'store-unavailable' }, 'store') };
    if (who.state !== 'ok') return { res: done(401, { error: 'unauthenticated' }, 'unauthenticated', who.state === 'bad' ? { 'set-cookie': [clearSessionCookie()] } : {}) };
    return { profile: who.profile };
  }

  const refusal = (result, done) => {
    if (result.reason === 'limited') {
      return done(429, { error: 'rate-limited', retryAfterS: result.retryAfterS }, 'rate-limited', { 'retry-after': String(result.retryAfterS) });
    }
    return done(502, { error: 'store-unavailable' }, 'store');
  };

  const hex = (n) => Buffer.from(random(n)).toString('hex');

  // The attempts: one hash per player, a field per task holding the immutable record (attemptId, seed, t0, expiresAt,
  // grader), and a second field `<task>.sent` holding {attemptId, sentAt}. Marking sent is one script that writes the
  // marker only while the record is still this attempt (a start that lost a race cannot mark over the winner), and a
  // marker whose attemptId is not the record's is ignored on read.
  async function loadAttempt(pid, taskId) {
    const [raw, sent] = await redis.pipeline([['HGET', keys.task(pid), taskId], ['HGET', keys.task(pid), sentField(taskId)]]);
    if (raw === null) return null;
    let record;
    let mark = null;
    try {
      record = JSON.parse(raw);
      if (sent !== null) mark = JSON.parse(sent);
    } catch {
      throw new RedisError('unreadable task record');
    }
    if (!isObject(record) || typeof record.attemptId !== 'string' || !Number.isFinite(record.t0) || !Number.isFinite(record.expiresAt)) {
      throw new RedisError('unreadable task record');
    }
    const sentAt = isObject(mark) && mark.attemptId === record.attemptId && Number.isFinite(mark.sentAt) ? mark.sentAt : null;
    return { ...record, sentAt };
  }

  const saveAttempt = (pid, taskId, record) =>
    redis.pipeline([['HSET', keys.task(pid), taskId, JSON.stringify(record)], ['EXPIRE', keys.task(pid), TASK_TTL_S]]);

  /** True when marked; false when the record is no longer this attempt (a newer start won). */
  const markSent = async (pid, taskId, attemptId, sentAt) =>
    (await redis.script('mark-sent', [keys.task(pid)], [taskId, sentField(taskId), attemptId, JSON.stringify({ attemptId, sentAt })])) === 1;

  const scenarioOf = (taskId, attempt, tag) => buildScenario(taskId, { seed: attempt.seed, t0: attempt.t0, tag, attemptId: attempt.attemptId });

  /** True when every batch was accepted. The token goes only into the outgoing header. */
  async function sendBatches(batches) {
    for (const { signal, body } of batches) {
      const out = await sendOtlp({
        signal,
        fetch,
        url: signalUrl(cfg.ingestBase, signal),
        token: cfg.ingestToken,
        dataset: cfg.dataset,
        body,
        setTimeout,
        clearTimeout,
        ...(timeoutMs === null ? { timeoutMs: INGEST_TIMEOUT_MS } : { timeoutMs }),
      });
      if (out.kind !== 'accepted') return false;
    }
    return true;
  }

  /** `{count}` or `{error:true}`: a failure, a timeout or an answer that is not a count is "could not say", never zero. */
  async function probe(attempt) {
    const ctl = new AbortController();
    const limit = new Promise((_, reject) => {
      ctl.signal.addEventListener('abort', () => reject(new Error('probe timeout')), { once: true });
    });
    const timer = setTimeout(() => ctl.abort(), timeoutMs ?? PROBE_TIMEOUT_MS);
    try {
      const got = await Promise.race([
        api.countAttempt(attempt.attemptId, { signal: ctl.signal, from: attempt.t0 - 60_000, to: now() + 60_000 }),
        limit,
      ]);
      return Number.isInteger(got?.count) && got.count >= 0 ? { count: got.count } : { error: true };
    } catch {
      return { error: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async function start(pid, tag, taskId, task, done) {
    const found = await loadAttempt(pid, taskId);
    const resend = found !== null && found.sentAt === null && now() <= found.expiresAt;
    let attempt = found;
    if (!resend) {
      const t0 = now();
      attempt = {
        attemptId: hex(8),
        ...(task.grader === GRADER.seeded ? { seed: Buffer.from(random(4)).readUInt32BE(0) } : {}),
        t0,
        expiresAt: t0 + ATTEMPT_LIFE_MS,
        grader: task.grader,
      };
      await saveAttempt(pid, taskId, attempt); // before anything is sent: a crash then leaves an unsent attempt to resend
    }
    // An unsent attempt found above is resent as it is: the same seed and t0 give the identical payload.
    const scenario = scenarioOf(taskId, attempt, tag);
    if (!(await sendBatches(scenario.batches))) {
      return done(502, { ok: false, outcome: GRADE.inconclusive, reason: 'ingest', retryAfterS: INGEST_RETRY_S }, 'ingest');
    }
    if (!(await markSent(pid, taskId, attempt.attemptId, now()))) return done(409, { error: 'stale-attempt' }, 'stale'); // a newer start took over
    const link = deepLink({ appOrigin: cfg.appOrigin, dataset: cfg.dataset, ...scenario.linkParams });
    return done(200, {
      v: 1,
      ok: true,
      attemptId: attempt.attemptId,
      link,
      tag,
      readyAfterS: SETTLE_S,
      expiresAt: attempt.expiresAt,
      ...(task.grader === GRADER.readback ? { name: assetName(tag, taskId, attempt.attemptId) } : {}),
    }, 'started');
  }

  async function check(pid, tag, body, taskId, task, done) {
    const attempt = await loadAttempt(pid, taskId);
    if (attempt === null || attempt.attemptId !== body.attemptId) return done(409, { error: 'stale-attempt' }, 'stale');
    if (now() > attempt.expiresAt) return done(410, { error: 'expired' }, 'expired');

    const result = await gradeCheck({
      grader: task.grader,
      scenario: scenarioOf(taskId, attempt, tag),
      answer: body.answer,
      sentAt: attempt.sentAt,
      now: now(),
      cooldown: async () => (await redis.command(['SET', keys.taskCooldown(pid, attempt.attemptId), '1', 'NX', 'EX', COOLDOWN_S])) !== null,
      probe: () => probe(attempt),
    });
    if (result.outcome === GRADE.pass) return done(200, { v: 1, outcome: GRADE.pass, charge: false }, 'pass');
    if (result.outcome === GRADE.fail) {
      // One charge per distinct wrong value per attempt: SADD says in one step whether this member was new. The set is the
      // player's (so deleting the account removes it) and its expiry is refreshed on every write.
      const [added] = await redis.pipeline([['SADD', keys.taskCharged(pid), `${attempt.attemptId}|${result.wrong}`], ['EXPIRE', keys.taskCharged(pid), TASK_TTL_S]]);
      return done(200, { v: 1, outcome: GRADE.fail, charge: added === 1 }, 'fail');
    }
    const { reason, retryAfterS } = result;
    return done(200, { v: 1, outcome: GRADE.inconclusive, charge: false, reason, ...(retryAfterS === undefined ? {} : { retryAfterS }) }, reason);
  }

  const GET = wrap(async (request, done) => {
    if (request.method !== 'GET') return done(405, { error: 'method-not-allowed' }, 'method', { allow: 'GET' });
    return done(200, { v: 1, on: enabled }, enabled ? 'on' : 'off');
  });

  const POST = wrap(async (request, done) => {
    if (request.method !== 'POST') return done(405, { error: 'method-not-allowed' }, 'method', { allow: 'POST' });
    if (!enabled) return done(503, { error: 'not-configured' }, 'not-configured');
    if (!originMatches(request, auth.config.origin)) return done(403, { error: 'forbidden' }, 'forbidden');
    if (!isJson(request)) return done(415, { error: 'unsupported-media-type' }, 'media-type');
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return done(413, { error: 'too-large' }, 'too-large');
    const { res, profile } = await signedIn(request, done);
    if (res) return res;
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return done(413, { error: 'too-large' }, 'too-large');
    const body = parse(text);
    if (body.field) return done(400, { ok: false, error: 'bad-request', field: body.field }, 'bad-request');
    const task = taskOf(body.taskId);
    if (task === null) return done(404, { error: 'unknown-task' }, 'unknown-task');
    const seeded = task.grader === GRADER.seeded;
    if (body.op === 'check' && seeded !== ('answer' in body)) return done(400, { ok: false, error: 'bad-request', field: 'answer' }, 'bad-request');

    const store = await auth.store();
    const limited = await store.rateLimit(profile.pid, body.op === 'start' ? 'dash0-start' : 'dash0-check', body.op === 'start' ? START_LIMIT : CHECK_LIMIT);
    if (!limited.ok) return refusal(limited, done);

    const tag = playerTag(profile.pid, cfg.playerSecret);
    return body.op === 'start' ? start(profile.pid, tag, body.taskId, task, done) : check(profile.pid, tag, body, body.taskId, task, done);
  });

  return { GET, POST };
}

/** The body, or `{field}` naming what is wrong. `start` takes only `taskId`; `check` needs `attemptId` and, for a seeded task, an `answer`. */
function parse(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { field: 'body' };
  }
  if (!isObject(body)) return { field: 'body' };
  if (body.v !== 1) return { field: 'v' };
  if (Object.keys(body).some((k) => !BODY_KEYS.includes(k))) return { field: 'body' };
  if (body.op !== 'start' && body.op !== 'check') return { field: 'op' };
  if (!isTaskId(body.taskId)) return { field: 'taskId' };
  if (body.op === 'start') {
    const extra = ['attemptId', 'answer'].find((k) => k in body);
    return extra ? { field: extra } : body;
  }
  if (typeof body.attemptId !== 'string' || !ATTEMPT_ID.test(body.attemptId)) return { field: 'attemptId' };
  if ('answer' in body && !validAnswer(body.answer)) return { field: 'answer' };
  return body;
}

const telemetry = createServerTelemetry({ name: 'dash0-task', env: process.env });
const dash0Task = createDash0Task({ log: telemetry.log, fetch: telemetry.trace(globalThis.fetch) });
export const { GET, POST } = telemetry.instrument(dash0Task);
