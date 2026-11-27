// The In Dash0 tasks the game knows (#509, #515), shared by the browser and the task server: only each task's id, who grades it
// and, for a seeded task, the question ids it asks. Never a seed, an answer or a key: those are server-only
// (lib/dash0-task/scenario.mjs). A spec that names another task, or the wrong grader or question for one, is refused when the
// level is checked, so no level can ship a step the server would answer with a 400 for ever. test/dash0-task-tasks.test.mjs
// keeps this in step with the server's own definitions.
// DOM-free at import.

// `send` (a readback task only) says the player sends the span themselves, from their own browser: the step draws the send form
// for that kind of send ('test-span' is lib/telemetry.mjs sendTest). `filterHint` names the attribute the step tells the player to
// filter the Trace Explorer on (the task's link is unfiltered).
export const TASKS = Object.freeze({
  'its-us-find': Object.freeze({ grader: 'seeded', answers: Object.freeze(['operation', 'faultCode', 'retryCount', 'traceId']), filterHint: 'game.attempt.id' }),
  'connect-test-span': Object.freeze({ grader: 'readback', send: 'test-span' }),
});

/** The task's entry, or null for an unknown id. */
export const taskOf = (id) => (typeof id === 'string' && Object.hasOwn(TASKS, id) ? TASKS[id] : null);
