// lib/dash0-task/tasks.mjs is the browser-safe list of tasks (id, grader, question ids, never an answer); the server's own
// definitions are lib/dash0-task/scenario.mjs (#514). The two must agree, or a level could name a task the server refuses.
// scenario.mjs is server only (a level, play, widget or main may not import it), but a test may. It lands with #514: until it
// is on this branch the agreement test is skipped (it runs as soon as the file exists).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { TASKS, taskOf } from '../lib/dash0-task/tasks.mjs';

const SCENARIO = new URL('../lib/dash0-task/scenario.mjs', import.meta.url);

test('TASKS holds only ids, graders and question ids (no seed, no key, no answer value)', () => {
  assert.deepEqual(Object.keys(TASKS).sort(), ['connect-test-span', 'its-us-find']);
  for (const [id, t] of Object.entries(TASKS)) {
    assert.deepEqual(Object.keys(t).filter((k) => !['grader', 'answers'].includes(k)), [], id);
    assert.ok(['seeded', 'readback'].includes(t.grader), id);
    if (t.grader === 'readback') assert.equal(t.answers, undefined, `${id}: a readback task asks nothing`);
    else assert.ok(t.answers.every((a) => /^[A-Za-z]{1,40}$/.test(a)), id);
  }
  assert.equal(taskOf('constructor'), null);
  assert.equal(taskOf('nope'), null);
});

test('TASKS agrees with the server task definitions (runs once lib/dash0-task/scenario.mjs exists, with #514)', { skip: !existsSync(SCENARIO) && 'lib/dash0-task/scenario.mjs is not on this branch (#514 is not merged here)' }, async () => {
  const server = await import(SCENARIO.href);
  assert.deepEqual(Object.keys(TASKS).sort(), Object.keys(server.TASKS).sort(), 'the same task ids');
  for (const id of Object.keys(TASKS)) {
    assert.equal(TASKS[id].grader, server.TASKS[id].grader, `${id}: the same grader`);
    const built = server.buildScenario(id, { seed: 1, t0: 0, tag: 'abcdefgh23', attemptId: 'a1b2c3d4e5f60718' });
    if (TASKS[id].grader === 'readback') assert.equal(built.answers, null, `${id}: no answers`);
    else assert.deepEqual([...TASKS[id].answers].sort(), Object.keys(built.answers).sort(), `${id}: the same question ids`);
  }
});
