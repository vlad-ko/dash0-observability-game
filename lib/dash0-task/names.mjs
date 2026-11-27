// The only place the task server composes a name for something it creates in Dash0 (#509 P5): `oncall-<tag>-<task>-<attempt6>`.
// A name carries the player's tag, never a pid, nickname or email, and ends in the first six characters of the attempt id.
import { ATTEMPT_ID, isTaskId } from './stamp.mjs';
import { TAG_PATTERN } from './tag.mjs';

export const NAME_PREFIX = 'oncall';
export const ATTEMPT_SHORT_LENGTH = 6;

function checkTag(tag) {
  if (typeof tag !== 'string' || !TAG_PATTERN.test(tag)) throw new TypeError('bad player tag');
}

/** The prefix every asset of one player starts with, for listing and cleaning by origin prefix. */
export function originPrefix(tag) {
  checkTag(tag);
  return `${NAME_PREFIX}-${tag}-`;
}

/** The name of the asset one attempt of one task makes. */
export function assetName(tag, taskId, attemptId) {
  if (!isTaskId(taskId)) throw new TypeError('bad task id');
  if (typeof attemptId !== 'string' || !ATTEMPT_ID.test(attemptId)) throw new TypeError('bad attempt id');
  return `${originPrefix(tag)}${taskId}-${attemptId.slice(0, ATTEMPT_SHORT_LENGTH)}`;
}
