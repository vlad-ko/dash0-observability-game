// Opt-in screen snapshots for test/levels-play.test.mjs (#391). With LEVEL_SNAPSHOT=<dir> set,
// each play-through writes <id>.<happy|sloppy>.json holding the live overlay (body and actions
// innerHTML) at every step change and at the end, the screen before every driver click (`clicks`), plus the finish text. A content move must leave
// `diff -r` between a before and an after directory empty. Unset, nothing is written.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The snapshot directory from the environment, or null when the hook is off. */
export function snapshotDir(env = process.env) {
  const dir = env.LEVEL_SNAPSHOT;
  return typeof dir === 'string' && dir !== '' ? dir : null;
}

/** Writes <id>.<label>.json under `dir`: { frames, clicks, finish }. */
export function writeFrames(dir, id, label, frames, finish, clicks = []) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.${label}.json`), `${JSON.stringify({ frames, clicks, finish }, null, 2)}\n`);
}

/** writeFrames when the hook is on; returns whether it wrote. */
export function recordFrames(env, id, label, frames, finish, clicks = []) {
  const dir = snapshotDir(env);
  if (!dir) return false;
  writeFrames(dir, id, label, frames, finish, clicks);
  return true;
}

/**
 * The screen just BEFORE a driver click, `{sel, body, actions}`: with the frames (which show each screen as a step
 * is entered and left) it ties every screen to the click that was made on it, so a level whose words moved is
 * compared click by click, not only at step changes.
 */
export function clickFrameOf(sel, body, actions) {
  return { sel, body: body.innerHTML, actions: actions.innerHTML };
}

/** The live overlay as one frame: what the player sees right now. */
export function frameOf(at, body, actions) {
  return { at, body: body.innerHTML, actions: actions.innerHTML };
}
