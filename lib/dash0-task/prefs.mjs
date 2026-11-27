// The In Dash0 tasks a player has left out, per level (#509 D7; docs/FOUNDATION.md §2.6): its own localStorage key, never
// oncall.progress. Value:
//   {"v":1,"levels":{"the-level-id":["task-id"]}}
// A level run without its In Dash0 steps (the task server was off, or the player was signed out, or chose "Finish without the
// Dash0 task") remembers the task ids here, so the hub can say the task is waiting; a pass takes the id out again. It is a
// preference, not progress: a corrupt value is overwritten, a newer version is never written, an unreadable store means
// "memory only". Storage comes in as a getter (`() => window.localStorage`), always called inside try/catch.
import { isId } from '../registry.mjs';

export const SKIPPED_KEY = 'oncall.dash0tasks';
const VERSION = 1;
export const MAX_LEVELS = 200;
export const MAX_TASKS = 20;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ids = (list) => [...new Set((Array.isArray(list) ? list : []).filter(isId))].sort();

// -> {status: 'fresh'|'ok'|'corrupt'|'future', levels: Map<levelId, string[]>}, or null when storage throws.
function load(getStorage) {
  let text;
  try {
    text = getStorage().getItem(SKIPPED_KEY);
  } catch {
    return null;
  }
  if (text === null || text === undefined) return { status: 'fresh', levels: new Map() };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: 'corrupt', levels: new Map() };
  }
  if (!isObject(parsed) || !Number.isInteger(parsed.v) || !isObject(parsed.levels)) return { status: 'corrupt', levels: new Map() };
  const levels = new Map();
  for (const id of Object.keys(parsed.levels).sort()) {
    if (!isId(id) || levels.size >= MAX_LEVELS) continue;
    const tasks = ids(parsed.levels[id]).slice(0, MAX_TASKS);
    if (tasks.length > 0) levels.set(id, tasks);
  }
  return { status: parsed.v > VERSION ? 'future' : 'ok', levels };
}

/** The remembered tasks: `{status: 'fresh'|'ok'|'corrupt'|'future'|'unavailable', levels}`, levels a Map of level id to sorted task ids. Never writes. */
export function readSkipped(getStorage) {
  const r = load(getStorage);
  return r === null ? { status: 'unavailable', levels: new Map() } : r;
}

function write(getStorage, levels) {
  const out = {};
  for (const id of [...levels.keys()].sort()) out[id] = levels.get(id);
  try {
    getStorage().setItem(SKIPPED_KEY, JSON.stringify({ v: VERSION, levels: out }));
  } catch {
    return { saved: false, reason: 'unavailable' };
  }
  return { saved: true };
}

/**
 * Change one level's remembered tasks: read, merge and write in one synchronous task, one setItem. `add` joins the ids
 * already there, `remove` takes ids out (a level with none left is dropped). -> `{saved: true}` or `{saved: false, reason}`
 * with reason `future` (left untouched), `unavailable`, `invalid` (a bad id) or `full` (too many levels or tasks: nothing is written).
 */
export function changeSkipped(getStorage, levelId, { add = [], remove = [] } = {}) {
  if (!isId(levelId) || ![...add, ...remove].every(isId)) return { saved: false, reason: 'invalid' };
  const r = load(getStorage);
  if (r === null) return { saved: false, reason: 'unavailable' };
  if (r.status === 'future') return { saved: false, reason: 'future' };
  const next = new Map(r.levels);
  const tasks = ids([...(r.levels.get(levelId) ?? []), ...add]).filter((t) => !remove.includes(t));
  if (tasks.length > MAX_TASKS) return { saved: false, reason: 'full' };
  const before = r.levels.get(levelId) ?? [];
  if (tasks.length === before.length && tasks.every((t, i) => t === before[i])) return { saved: true }; // nothing changed: no write
  if (tasks.length === 0) next.delete(levelId);
  else next.set(levelId, tasks);
  if (next.size > MAX_LEVELS) return { saved: false, reason: 'full' };
  return write(getStorage, next);
}

/** Remember that `taskIds` of `levelId` were left out. */
export const recordSkipped = (getStorage, levelId, taskIds) => changeSkipped(getStorage, levelId, { add: taskIds });
/** Forget `taskId` of `levelId`: the player did it. */
export const clearSkipped = (getStorage, levelId, taskId) => changeSkipped(getStorage, levelId, { remove: [taskId] });
