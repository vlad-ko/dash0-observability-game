// Level feedback (#370; docs/FOUNDATION.md §2.11): a Vercel Node function (Web Request in, Response out). The page posts
// one short note about the level on screen; this function opens a GitHub issue for it with the owner's token, which never
// reaches the browser. Dormant: unless FEEDBACK_GITHUB_TOKEN and FEEDBACK_REPO are valid, GET says off and a POST is a
// 503 that reads nothing and calls nobody. Nothing about the player leaves this file except the text they wrote and,
// when they are signed in and listed, their public nickname: no address, user agent, cookie or token in a body or a log.
import { liveRegistry } from '../app.mjs';
import { createAuthContext } from '../lib/auth/config.mjs';
import { feedbackConfig, issueBody, issueTitle, MAX_BODY_BYTES, parseFeedback, VERSION } from '../lib/feedback.mjs';
import { createLimiter } from '../lib/guide/limit.mjs';
import { clientKey, isJson, reply } from '../lib/http.mjs';
import { createServerTelemetry } from '../lib/otel/server.mjs';

export const GITHUB_API = 'https://api.github.com';
export const GITHUB_TIMEOUT_MS = 6000;
export const LABEL = 'feedback';
const USER_AGENT = 'oncall-game-feedback';

/** The text after "From:" for what the session lookup said: a nickname only when the player chose to be listed. */
function whoText(who) {
  if (who.state !== 'ok') return 'signed out';
  return who.profile.listed ? `\`${who.profile.nick}\`` : 'signed in, not listed';
}

/**
 * The handlers over injected `env`, `fetch`, `now`, `log`, `limiter`, `auth` (`{session(request)}`), `registry` and
 * timers, so a test drives them with fakes. Defaults are the real ones; the registry and the auth context are built on first use.
 */
export function createFeedback({
  env = process.env,
  fetch = globalThis.fetch,
  now = Date.now,
  random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)),
  log = (line) => console.log(JSON.stringify(line)),
  limiter = createLimiter({ now, clientMax: 5, clientWindowMs: 10 * 60 * 1000, instanceMax: 30, instanceWindowMs: 60 * 1000 }),
  auth = null,
  registry = null,
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
} = {}) {
  let built = registry;
  let session = auth;

  async function GET(request) {
    if (request.method !== 'GET') return reply(405, { error: 'method-not-allowed' }, { allow: 'GET' });
    return reply(200, { v: VERSION, on: feedbackConfig(env).on });
  }

  async function POST(request) {
    const started = now();
    const seen = { levelId: null, kind: null, chars: null, issue: null };
    const done = (status, body, outcome, headers) => {
      log({ msg: 'feedback', outcome, status, ...seen, ms: now() - started });
      return reply(status, body, headers);
    };
    try {
      if (request.method !== 'POST') return done(405, { error: 'method-not-allowed' }, 'method', { allow: 'POST' });
      const config = feedbackConfig(env);
      if (!config.on) return done(503, { error: 'off' }, 'off');
      if (!originAllowed(request)) return done(403, { error: 'forbidden' }, 'forbidden');
      if (!isJson(request)) return done(415, { error: 'unsupported-media-type' }, 'media-type');
      if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return done(413, { error: 'too-large' }, 'too-large');
      const text = await request.text();
      if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return done(413, { error: 'too-large' }, 'too-large');

      built ??= liveRegistry();
      const parsed = parseFeedback(text, built);
      if (!parsed.ok) return done(400, { error: 'bad-request', field: parsed.field }, 'bad-request');
      Object.assign(seen, { levelId: parsed.levelId, kind: parsed.kind, chars: parsed.chars });
      const taken = limiter.take(clientKey(request));
      if (!taken.ok) {
        return done(429, { error: 'rate-limited', retryAfterS: taken.retryAfterS }, 'rate-limited', { 'retry-after': String(taken.retryAfterS) });
      }

      const level = built.levels[parsed.levelId];
      const who = whoText(await lookup(request));
      const issue = await openIssue(config, {
        title: issueTitle(level),
        body: issueBody({ kind: parsed.kind, screen: parsed.screen, level, commit: env.VERCEL_GIT_COMMIT_SHA, who, text: parsed.text }),
      });
      if (issue.kind !== 'opened') return done(502, { error: 'upstream' }, issue.kind);
      seen.issue = issue.number;
      return done(201, { v: VERSION, ok: true, issue: issue.number }, 'sent');
    } catch {
      return done(500, { error: 'internal' }, 'error'); // never the error: it could carry the token
    }
  }

  /** Same-origin only: an Origin is required, `null` is refused, and its host must be the host this request came to. */
  function originAllowed(request) {
    const origin = request.headers.get('origin');
    if (origin === null || origin === 'null') return false;
    try {
      const host = request.headers.get('host') ?? new URL(request.url).host;
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  /** The session, best effort: a failed or impossible lookup (no store, bad cookie) reads as signed out and never blocks the note. */
  async function lookup(request) {
    try {
      session ??= createAuthContext({ env, now, random, registry: built });
      return await session.session(request);
    } catch {
      return { state: 'none' };
    }
  }

  /** One call to GitHub within the budget -> `{kind:'opened', number}` or `{kind:'upstream'|'network'|'timeout'}`; never rejects. */
  async function openIssue(config, { title, body }) {
    const controller = new AbortController();
    let timer;
    const budget = new Promise((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve({ kind: 'timeout' });
      }, GITHUB_TIMEOUT_MS);
    });
    const call = (async () => {
      const res = await fetch(`${GITHUB_API}/repos/${config.repo}/issues`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          'user-agent': USER_AGENT,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title, body, labels: [LABEL] }),
        signal: controller.signal,
      });
      if (res.status !== 201) return { kind: 'upstream' };
      const number = (await res.json())?.number;
      return Number.isInteger(number) && number > 0 ? { kind: 'opened', number } : { kind: 'upstream' };
    })().catch(() => ({ kind: 'network' }));
    try {
      return await Promise.race([call, budget]);
    } finally {
      clearTimeout(timer);
    }
  }

  return { GET, POST };
}

const telemetry = createServerTelemetry({ name: 'feedback', env: process.env });
const feedback = createFeedback({ log: telemetry.log, fetch: telemetry.trace(globalThis.fetch) });
export const { GET, POST } = telemetry.instrument(feedback);
