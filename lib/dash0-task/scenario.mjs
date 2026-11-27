// What the task server sends and what is right (#509 P5). SERVER ONLY: this module holds the answer key, so no level,
// widget or browser module may import it (test/dash0-task-server-only.test.mjs). The seed that makes the key lives in Redis and
// never leaves the server.
//
// Two tasks. 'its-us-find' is seeded: the incident of lib/incident-lab.mjs, built from a random seed and sent as
// spans; the answers are read from those same spans (answersFrom). 'connect-test-span' is a readback: the server sends
// nothing, the player's own span (stamped with the attempt id) is what the check looks for.
// Every record is stamped game.attempt.id, game.player.tag and game.task.id, and nothing else identifies a player.
import { answersFrom, buildIncident } from '../incident-lab.mjs';
import { encodeResourceSpans, RESOURCE_ATTRIBUTES, SERVICE_NAME, SERVICE_VERSION } from '../otlp/encode.mjs';
import { stampFor } from './stamp.mjs';

export const GRADER = Object.freeze({ seeded: 'seeded', readback: 'readback' });
export const TASKS = Object.freeze({
  'its-us-find': Object.freeze({ grader: GRADER.seeded }),
  'connect-test-span': Object.freeze({ grader: GRADER.readback }),
});
export const SEED_LIMIT = 2 ** 32;
// The deep link opens a window around the attempt: a little before its start, and long enough after it for slow ingest.
export const LINK_LEAD_MS = 5 * 60 * 1000;
export const LINK_WINDOW_MS = 60 * 60 * 1000;

/** The task's definition, or null for an unknown task. */
export const taskOf = (taskId) => (typeof taskId === 'string' && Object.hasOwn(TASKS, taskId) ? TASKS[taskId] : null);

/**
 * `{batches, answers, linkParams, spans}` for one attempt. `batches` are `{signal, body}` ready for sendOtlp (none for a
 * readback task); `answers` is the key ({operation, faultCode, retryCount, traceId}) or null for a readback; `spans` is
 * what the seeded grader reads. Pure: the same inputs give the same output. Throws on an unknown task or a bad input.
 */
export function buildScenario(taskId, { seed, t0, tag, attemptId } = {}) {
  const task = taskOf(taskId);
  if (task === null) throw new RangeError('unknown task');
  if (typeof t0 !== 'number' || !Number.isFinite(t0)) throw new TypeError('t0 must be a number');
  const stamp = stampFor({ tag, taskId, attemptId });
  const linkParams = { target: 'traces', attemptId, fromMs: t0 - LINK_LEAD_MS, toMs: t0 + LINK_WINDOW_MS };
  if (task.grader === GRADER.readback) return { batches: [], answers: null, linkParams, spans: null };
  const { spans } = buildIncident(seed, { now: () => t0 }); // throws on a bad seed
  const body = encodeResourceSpans(spans, {
    resource: RESOURCE_ATTRIBUTES,
    scope: { name: SERVICE_NAME, version: SERVICE_VERSION },
    stamp,
  });
  return { batches: [{ signal: 'traces', body }], answers: answersFrom(spans), linkParams, spans };
}
