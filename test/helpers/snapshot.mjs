// Opt-in screen snapshots for test/levels-play.test.mjs (#391). With LEVEL_SNAPSHOT=<dir> set,
// each play-through writes <id>.<happy|sloppy>.json holding the live overlay (body and actions
// innerHTML) at every step change and at the end, plus the finish text. A content move must leave
// `diff -r` between a before and an after directory empty. Unset, nothing is written.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The snapshot directory from the environment, or null when the hook is off. */
export function snapshotDir(env = process.env) {
  const dir = env.LEVEL_SNAPSHOT;
  return typeof dir === 'string' && dir !== '' ? dir : null;
}

/** Writes <id>.<label>.json under `dir`: { frames, finish }. */
export function writeFrames(dir, id, label, frames, finish) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.${label}.json`), `${JSON.stringify({ frames, finish }, null, 2)}\n`);
}

/** writeFrames when the hook is on; returns whether it wrote. */
export function recordFrames(env, id, label, frames, finish) {
  const dir = snapshotDir(env);
  if (!dir) return false;
  writeFrames(dir, id, label, frames, finish);
  return true;
}

/** The live overlay as one frame: what the player sees right now. */
export function frameOf(at, body, actions) {
  return { at, body: body.innerHTML, actions: actions.innerHTML };
}
