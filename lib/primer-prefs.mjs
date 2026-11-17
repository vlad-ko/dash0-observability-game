// What the player has done with each act primer (#389, docs/FOUNDATION.md §2.12): its own
// localStorage key, never oncall.progress. Value:
//   {"v":1,"acts":{"act-0":{"seen":true,"skipped":false,"read":["what-is-otel"]}}}
// It is a preference, not progress: a corrupt value is overwritten without a backup, a newer
// version is never written, and an unreadable store means "memory only" (the primer simply shows).
// Merging only moves up (seen OR, skipped OR, read union), so two tabs cannot undo each other.
// Storage comes in as a getter (`() => window.localStorage`), always called inside try/catch.
import { isId } from './registry.mjs';

export const PRIMER_KEY = 'oncall.primers';
const VERSION = 1;
export const MAX_ACTS = 50;
export const MAX_READ = 50;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sortedIds = (ids) => [...new Set(ids.filter(isId))].sort();

/** An empty entry: nothing seen, skipped or read. */
const blank = () => ({ seen: false, skipped: false, read: [] });

/** Clean one stored entry (unknown keys dropped, ids filtered, sorted, capped). */
function cleanEntry(raw) {
  return {
    seen: raw.seen === true,
    skipped: raw.skipped === true,
    read: sortedIds(Array.isArray(raw.read) ? raw.read : []).slice(0, MAX_READ),
  };
}

/**
 * The monotone merge of two entries: seen OR, skipped OR, sorted read union. Commutative,
 * associative and idempotent. Either side may be missing.
 */
export function mergePrimerEntry(a, b) {
  const x = a ? cleanEntry(a) : blank();
  const y = b ? cleanEntry(b) : blank();
  return {
    seen: x.seen || y.seen,
    skipped: x.skipped || y.skipped,
    read: sortedIds([...x.read, ...y.read]),
  };
}

// → {status: 'fresh'|'ok'|'corrupt'|'future', acts: Map}, or null when storage throws.
function load(getStorage) {
  let text;
  try {
    text = getStorage().getItem(PRIMER_KEY);
  } catch {
    return null;
  }
  if (text === null || text === undefined) return { status: 'fresh', acts: new Map() };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: 'corrupt', acts: new Map() };
  }
  if (!isObject(parsed) || !Number.isInteger(parsed.v) || !isObject(parsed.acts)) {
    return { status: 'corrupt', acts: new Map() };
  }
  const acts = new Map();
  for (const id of Object.keys(parsed.acts).sort()) {
    if (!isId(id) || !isObject(parsed.acts[id]) || acts.size >= MAX_ACTS) continue;
    acts.set(id, cleanEntry(parsed.acts[id]));
  }
  return { status: parsed.v > VERSION ? 'future' : 'ok', acts };
}

/**
 * The stored primer state: `{status: 'fresh'|'ok'|'corrupt'|'future'|'unavailable', acts}`, where
 * `acts` is a Map of act id to `{seen, skipped, read: string[]}`. Never writes.
 */
export function readPrimers(getStorage) {
  const r = load(getStorage);
  return r === null ? { status: 'unavailable', acts: new Map() } : r;
}

/**
 * Merge `{seen?, skipped?, read?}` into one act's stored entry: read, merge and write in one
 * synchronous task, exactly one setItem. → `{saved: true}` or `{saved: false, reason}` with reason
 * `future` (left untouched), `unavailable`, `invalid` (bad act id) or `full` (a 51st act, or more
 * than 50 read ids for the act: nothing is written). Unknown stored acts and chapter ids are kept.
 */
export function recordPrimer(getStorage, actId, change = {}) {
  if (!isId(actId)) return { saved: false, reason: 'invalid' };
  const r = load(getStorage);
  if (r === null) return { saved: false, reason: 'unavailable' };
  if (r.status === 'future') return { saved: false, reason: 'future' };
  const patch = {
    seen: change.seen === true,
    skipped: change.skipped === true,
    read: Array.isArray(change.read) ? change.read : [],
  };
  const merged = mergePrimerEntry(r.acts.get(actId), patch);
  const acts = new Map(r.acts).set(actId, merged);
  const readIds = sortedIds([...(r.acts.get(actId)?.read ?? []), ...patch.read]);
  if (acts.size > MAX_ACTS || readIds.length > MAX_READ) return { saved: false, reason: 'full' };
  const out = {};
  for (const id of [...acts.keys()].sort()) {
    const e = acts.get(id);
    out[id] = { seen: e.seen, skipped: e.skipped, read: e.read };
  }
  try {
    getStorage().setItem(PRIMER_KEY, JSON.stringify({ v: VERSION, acts: out }));
  } catch {
    return { saved: false, reason: 'unavailable' };
  }
  return { saved: true };
}
