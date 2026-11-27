// The three attributes every record the task server sends carries (#509 P5), and the id shapes they hold.
// One expression site: the encoder stamps them, the fake and the real adapter read them, the deep link filters on one.
import { TAG_PATTERN } from './tag.mjs';

export const ATTR = Object.freeze({ attempt: 'game.attempt.id', player: 'game.player.tag', task: 'game.task.id' });
export const ATTEMPT_ID = /^[a-f0-9]{16}$/;
export const TASK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_TASK_ID_LENGTH = 40;

export const isTaskId = (v) => typeof v === 'string' && v.length <= MAX_TASK_ID_LENGTH && TASK_ID.test(v);

/** `{game.attempt.id, game.player.tag, game.task.id}`; throws on a value of the wrong shape (a pid can never fit). */
export function stampFor({ tag, taskId, attemptId }) {
  if (typeof tag !== 'string' || !TAG_PATTERN.test(tag)) throw new TypeError('bad player tag');
  if (!isTaskId(taskId)) throw new TypeError('bad task id');
  if (typeof attemptId !== 'string' || !ATTEMPT_ID.test(attemptId)) throw new TypeError('bad attempt id');
  return { [ATTR.attempt]: attemptId, [ATTR.player]: tag, [ATTR.task]: taskId };
}
