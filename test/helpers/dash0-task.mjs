// A rig for the In Dash0 task server tests (#509 P5): the auth rig (fake Redis, a signed-in cookie), the fake Dash0 with a
// request log, and the handler built over them. Values are pinned here (not imported from the code under test), so a
// mutation of the code cannot move the test with it.
import { createDash0Task } from '../../api/dash0-task.mjs';
import { createFakeDash0 } from '../../tools/fake-dash0.mjs';
import { keys } from '../../lib/account/store.mjs';
import { playerTag } from '../../lib/dash0-task/tag.mjs';
import { buildScenario } from '../../lib/dash0-task/scenario.mjs';
import { ENV, NOW, ORIGIN, get, post, rig } from './auth-api.mjs';

export const INGEST_HOST = 'ingress.eu-west-1.aws.dash0.com';
export const API_HOST = 'api.eu-west-1.aws.dash0.com';
export const INGEST_TOKEN = 'auth_INGEST_Zq81xk2m9PwTn4vR';
export const API_TOKEN = 'auth_API_Hb35cy7d2LsUe6jA';
export const PLAYER_SECRET = 'pS9-secret-for-the-player-tag-0123456789ab';
export const DATASET = 'oncall-game';
export const SETTLE_MS = 30_000;
export const URL_ = `${ORIGIN}/api/dash0-task`;
export const NICK = 'Zorblax';
export const EMAIL = 'ada.lovelace@dash0.com';

export const TASK_ENV = Object.freeze({
  ...ENV,
  DASH0_GAME_INGEST_URL: `https://${INGEST_HOST}`,
  DASH0_GAME_INGEST_TOKEN: INGEST_TOKEN,
  DASH0_GAME_DATASET: DATASET,
  DASH0_GAME_API_URL: `https://${API_HOST}`,
  DASH0_GAME_API_TOKEN: API_TOKEN,
  DASH0_GAME_APP_URL: 'https://app.dash0.com',
  DASH0_GAME_PLAYER_SECRET: PLAYER_SECRET,
});

/** Everything a test needs; `sent` is every request the handler made to the fake Dash0 (url, headers, body text). */
export async function taskRig({ env = TASK_ENV, lagMs = 0, signedIn = true, timeoutMs = 25 } = {}) {
  const r = rig();
  const dash0 = createFakeDash0({ now: () => r.clock.t, lagMs, hosts: [INGEST_HOST, API_HOST], ingestToken: INGEST_TOKEN });
  const sent = [];
  const fetch = async (url, init = {}) => {
    sent.push({ url: String(url), headers: init.headers, body: init.body });
    return dash0.fetch(url, init);
  };
  const { profile } = await r.store.signIn('g-1', EMAIL);
  await r.store.setNickname(profile.pid, NICK);
  const cookie = signedIn ? await r.cookieFor(profile.pid, { exp: NOW + 7 * 86_400_000 }) : undefined;
  let n = 0;
  const random = (len) => Uint8Array.from({ length: len }, (_, i) => (++n * 53 + i * 29) % 256);
  const deps = { ...r.deps, env, fetch, dash0, random, timeoutMs };
  const api = createDash0Task(deps);
  const headers = (extra = {}) => ({ ...(cookie ? { cookie } : {}), ...extra });
  const op = (body, extra) => api.POST(post(URL_, body, headers(extra)));
  const json = async (res) => res.json();
  const tag = playerTag(profile.pid, PLAYER_SECRET);

  /** The stored attempt record of a task, parsed. */
  const attempt = (taskId) => JSON.parse(r.fake.db.get(keys.task(profile.pid)).get(taskId));
  /** The answer key of the stored attempt, rebuilt as the server does. */
  const answersOf = (taskId) => {
    const a = attempt(taskId);
    return buildScenario(taskId, { seed: a.seed, t0: a.t0, tag, attemptId: a.attemptId }).answers;
  };
  /** The check cooldown never blocks: isolates the behaviour under test from the 5 s rule (the fake does not expire keys). */
  const noCooldown = () => {
    r.fake.beforeCommand = (args) => {
      if (args[0] === 'SET' && String(args[1]).includes(':task-cool:')) r.fake.db.delete(args[1]);
    };
  };
  const start = async (taskId = 'its-us-find') => {
    const res = await op({ v: 1, op: 'start', taskId });
    return { res, body: await res.json() };
  };
  const check = async (taskId, attemptId, answer) => {
    const res = await op({ v: 1, op: 'check', taskId, attemptId, ...(answer === undefined ? {} : { answer }) });
    return { res, body: await res.json() };
  };
  /** A wrong operation: any candidate other than the right one. */
  const wrongOperation = (taskId = 'its-us-find') => (answersOf(taskId).operation === 'storage.write' ? 'cards.award' : 'storage.write');
  const charged = (attemptId) => [...(r.fake.db.get(keys.taskCharged(profile.pid, attemptId))?.set ?? [])];

  return {
    r, dash0, sent, api, deps, pid: profile.pid, cookie, tag, headers, op, json, attempt, answersOf, noCooldown, start, check,
    wrongOperation, charged, get: (h) => api.GET(get(URL_, h)), clock: r.clock, fake: r.fake, logs: r.logs,
  };
}
