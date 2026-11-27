// The browser side of the In Dash0 task (#509, docs/FOUNDATION.md §2.6): GET /api/dash0-task says whether the task server is
// on, POST starts a task and checks an answer. `fetch` and `signedIn` are injected; nothing here touches window or storage.
// Every call resolves, never rejects, and a network error is inconclusive, never a fail (absence is never a fail). The server
// answers only signed-in @dash0.com players: a 401 means "sign in", a 503 "off". The page asks the status once.
import { isPlainObject } from '../progress.mjs';
import { checkDataset } from '../dash0/ingress.mjs';

export const DASH0_TASK_URL = '/api/dash0-task';
/** The one origin a deep link may point at. The server builds the link; the browser still checks it before drawing it. */
export const DASH0_APP_ORIGIN = 'https://app.dash0.com';

const JSON_HEADERS = { 'content-type': 'application/json' };
const DEFAULT_RETRY_S = 60;
const isStr = (v) => typeof v === 'string' && v !== '';
const isCount = (n) => Number.isInteger(n) && n >= 0;

/** Whether `url` is an https link to app.dash0.com (an origin allowlist; no other host, scheme or userinfo). Pure; never throws. */
export function isDash0AppUrl(url) {
  if (typeof url !== 'string' || /[\s\u0000-\u001f]/.test(url)) return false;
  try {
    const u = new URL(url);
    return u.origin === DASH0_APP_ORIGIN && u.username === '' && u.password === '';
  } catch {
    return false;
  }
}

/** {status, body} for a request; null on a network error. A body that is not JSON is null. */
async function call(fetch, init) {
  try {
    const res = await fetch(DASH0_TASK_URL, init);
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch {
    return null;
  }
}

const post = (body) => ({ method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ v: 1, ...body }) });

/** The seconds a 429 or an inconclusive says to wait: the body's, else the default. */
const retryOf = (body) => (isPlainObject(body) && isCount(body.retryAfterS) && body.retryAfterS > 0 ? body.retryAfterS : DEFAULT_RETRY_S);

/**
 * What a non-answer is: `inconclusive`, with a `reason` the widget has words for, `retryAfterS` when waiting helps, `down`
 * ('off' for a 503, 'signed-out' for a 401) when the server cannot take the task at all, `refused` for a 413 or a 400 naming the
 * `answer` field of a seeded check (the answer was refused: no outage, no wait; any other 400, or one on a readback check, is `unavailable`), and `restart` when the attempt
 * is gone (409 stale-attempt, 410 expired) and only a new start helps. Pure.
 */
export function failureOf(res, { answered = true } = {}) {
  if (res === null) return { outcome: 'inconclusive', reason: 'network', retryAfterS: DEFAULT_RETRY_S };
  const { status, body } = res;
  if (status === 401) return { outcome: 'inconclusive', reason: 'signed-out', down: 'signed-out' };
  if (status === 503) return { outcome: 'inconclusive', reason: 'off', down: 'off' };
  if (status === 429) return { outcome: 'inconclusive', reason: 'rate-limited', retryAfterS: retryOf(body) };
  // The server refused the answer itself (413 too big, or a 400 naming the `answer` field): the player's input, never an outage.
  // Any other 400 (a field of the contract: v, op, taskId, attemptId, body) is a mismatch between client and server, so it counts as one.
  // A readback check sends no answer (`answered: false`), so a 400 or 413 about one is a mismatch between client and server: an outage, never the player's input.
  if (answered && (status === 413 || (status === 400 && isPlainObject(body) && body.field === 'answer'))) return { outcome: 'inconclusive', reason: 'refused' };
  if (status === 409) return { outcome: 'inconclusive', reason: 'stale', restart: true };
  if (status === 410) return { outcome: 'inconclusive', reason: 'expired', restart: true };
  return { outcome: 'inconclusive', reason: 'unavailable', retryAfterS: DEFAULT_RETRY_S };
}

/** The POST start answer: `{ok: true, attemptId, link, tag, readyAfterS, expiresAt, name?}` or `{ok: false, ...failureOf}`. Pure. */
export function startOutcome(res) {
  // An inconclusive start (ingest failed: HTTP 502 `{ok: false, outcome: 'inconclusive', reason: 'ingest', retryAfterS}`, no `v`) is said by its body, whatever the status.
  if (res !== null && isPlainObject(res.body) && res.body.ok === false && res.body.outcome === 'inconclusive' && ![401, 429, 503].includes(res.status)) {
    return { ok: false, outcome: 'inconclusive', reason: isStr(res.body.reason) ? res.body.reason : 'unavailable', retryAfterS: retryOf(res.body) };
  }
  if (res === null || res.status !== 200 || !isPlainObject(res.body) || res.body.v !== 1) return { ok: false, ...failureOf(res) };
  const b = res.body;
  if (b.ok !== true || !isStr(b.attemptId) || !isStr(b.link) || !isStr(b.tag) || !isCount(b.readyAfterS)) {
    return { ok: false, outcome: 'inconclusive', reason: 'unavailable', retryAfterS: DEFAULT_RETRY_S };
  }
  return {
    ok: true,
    attemptId: b.attemptId,
    link: b.link,
    tag: b.tag,
    readyAfterS: b.readyAfterS,
    expiresAt: b.expiresAt ?? null,
    ...(isStr(b.name) ? { name: b.name } : {}),
    // A readback task's dataset (the identifier the player's own spans must go to), kept only when it is a well-formed one.
    ...(typeof b.dataset === 'string' && checkDataset(b.dataset).ok && b.dataset !== '' ? { dataset: b.dataset } : {}),
  };
}

/**
 * The POST check answer: HTTP 200 `{v: 1, outcome: 'pass'|'fail'|'inconclusive', charge, reason?, retryAfterS?}`, one question per call
 * (a readback task has one check and no question); the reasons are settling, cooldown, not-visible, upstream, not-sent and answer.
 * Pure. A charge is only ever on a fail; `retryAfterS` is only there when the body had it.
 */
export function checkOutcome(res, { answered = true } = {}) {
  if (res === null || res.status !== 200 || !isPlainObject(res.body) || res.body.v !== 1) return { charge: false, ...failureOf(res, { answered }) };
  const b = res.body;
  if (b.outcome === 'pass') return { outcome: 'pass', charge: false };
  if (b.outcome === 'fail') {
    return { outcome: 'fail', charge: b.charge === true, ...(isStr(b.field) ? { field: b.field } : {}), ...(isStr(b.reason) ? { reason: b.reason } : {}) };
  }
  if (b.outcome === 'inconclusive') {
    // The wait is the server's to name: without `retryAfterS` the player is told no time.
    return { outcome: 'inconclusive', charge: false, reason: isStr(b.reason) ? b.reason : 'unavailable', ...(isCount(b.retryAfterS) && b.retryAfterS > 0 ? { retryAfterS: b.retryAfterS } : {}) };
  }
  return { charge: false, ...failureOf(null), reason: 'unavailable' };
}

/**
 * The client. `fetch` is the page's; `signedIn()` says whether the account client has seen a signed-in player (read at each
 * decision, never cached); `signedOut()` (default: true) says whether it has seen a real signed-out player, as opposed to no answer. `load()` reads GET /api/dash0-task once and keeps the answer; until it has answered (or when it
 * failed) the server counts as off. `available()` is true only when the server is on and the player is signed in.
 */
export function createDash0TaskClient({ fetch, signedIn, signedOut = () => true }) {
  if (typeof fetch !== 'function') throw new TypeError('fetch must be a function');
  if (typeof signedIn !== 'function') throw new TypeError('signedIn must be a function');
  if (typeof signedOut !== 'function') throw new TypeError('signedOut must be a function');
  let on = false;
  let loading = null;
  const isSignedIn = () => {
    try {
      return signedIn() === true;
    } catch {
      return false;
    }
  };
  return {
    /** GET once per page; resolves to whether the server is on. */
    load() {
      loading ??= call(fetch, { method: 'GET' }).then((res) => {
        on = res !== null && res.status === 200 && isPlainObject(res.body) && res.body.v === 1 && res.body.on === true;
        return on;
      });
      return loading;
    },
    available: () => on && isSignedIn(),
    /**
     * Why the task cannot run now: 'off' (server off, not answered yet or failed, or the account could not be read), 'signed-out'
     * (only when `signedOut()` says the account answered and nobody is signed in), or null when it can.
     */
    reason: () => {
      if (!on) return 'off';
      if (isSignedIn()) return null;
      let out = false;
      try {
        out = signedOut() === true;
      } catch {
        out = false;
      }
      return out ? 'signed-out' : 'off';
    },
    start: async (taskId) => startOutcome(await call(fetch, post({ op: 'start', taskId }))),
    // A seeded check sends `answer: {question, value}`; a readback check has none and the body carries no `answer` key at all (the server refuses one).
    check: async (taskId, attemptId, answer) => checkOutcome(await call(fetch, post({ op: 'check', taskId, attemptId, ...(answer === undefined ? {} : { answer }) })), { answered: answer !== undefined }),
    isDash0AppUrl,
  };
}
