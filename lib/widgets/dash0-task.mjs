// The In Dash0 step (#509, docs/DECLARATIVE-LEVELS.md): the player does a task in the real Dash0 and the task server checks
// it. This file is the logic: the spec check, what costs a star and the counting rule for "the server is not answering".
// The markup and the mount are lib/widgets/dash0-task-view.mjs; the words are content/core/ui/dash0-task.mjs. The answers
// never reach the browser: the spec holds only the task id, the grader kind and the answer FIELD KEYS (and their labels).
// DOM-free at import.
import { isId } from '../registry.mjs';

/** Who grades the task: `seeded` (the server made the data and knows the answer) or `readback` (the player made an asset and the server reads it back). */
export const GRADERS = Object.freeze(['seeded', 'readback']);

/** After this many checks in a row that could not be judged (not counting "still arriving"), the step offers to finish without the task. */
export const DOWN_AFTER = 3;

/** What costs a star on an In Dash0 step (the check route charges it), and what does not. */
export const PENALTY = Object.freeze({
  costs: 'a wrong answer (once per task attempt)',
  free: 'A check that could not be judged, starting again and finishing without the task cost nothing.',
});

const FIELD_KEYS = ['key', 'label', 'hint'];
const QUESTION = /^[A-Za-z][\w]*$/; // the server's question ids: operation, faultCode, retryCount, traceId
const isQuestion = (v) => typeof v === 'string' && QUESTION.test(v);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Every problem with an In Dash0 spec, as strings; [] when valid. `{id, task, grader, answers, fields?}`: `answers` lists the
 * question ids the player answers (one field and one Check each, sent as `{question, value}`), `fields` is the bound content, one `{key, label, hint?}`
 * for each answer key and no others. Pure, never throws.
 */
export function validateDash0Spec(spec) {
  if (!isObject(spec)) return ['spec: not an object'];
  const problems = [];
  for (const k of Object.keys(spec)) if (!['id', 'task', 'grader', 'answers', 'fields'].includes(k)) problems.push(`spec: unknown key ${JSON.stringify(k)}`);
  if (!isId(spec.id)) problems.push(`spec id ${JSON.stringify(spec.id) ?? String(spec.id)} is not kebab-case`);
  if (!isId(spec.task)) problems.push(`spec task ${JSON.stringify(spec.task) ?? String(spec.task)} is not a kebab-case task id`);
  if (!GRADERS.includes(spec.grader)) problems.push(`spec grader must be one of ${GRADERS.join(', ')}`);
  const answers = spec.answers;
  if (!Array.isArray(answers) || answers.length === 0 || !answers.every(isQuestion)) problems.push('answers must be a non-empty array of question ids (plain words, no hyphen) (each is one check)');
  else if (new Set(answers).size !== answers.length) problems.push('answers must be unique');
  const fields = spec.fields ?? [];
  if (!Array.isArray(fields)) problems.push('fields must be an array');
  else {
    fields.forEach((f, i) => {
      if (!isObject(f)) return void problems.push(`field ${i} is not an object`);
      for (const k of Object.keys(f)) if (!FIELD_KEYS.includes(k)) problems.push(`field ${i}: unknown key ${JSON.stringify(k)}`);
      if (!isQuestion(f.key)) problems.push(`field ${i}: key must be a question id`);
      if (typeof f.label !== 'string' || f.label.trim() === '') problems.push(`field ${JSON.stringify(f.key)} needs a label`);
      if (f.hint !== undefined && (typeof f.hint !== 'string' || f.hint.trim() === '')) problems.push(`field ${JSON.stringify(f.key)}: hint must be text`);
    });
    if (Array.isArray(answers) && answers.every(isQuestion)) {
      const keys = fields.filter(isObject).map((f) => f.key);
      for (const a of answers) if (!keys.includes(a)) problems.push(`answer ${JSON.stringify(a)} has no field (give it a label in the content)`);
      for (const k of keys) if (!answers.includes(k)) problems.push(`field ${JSON.stringify(k)} is not in answers`);
    }
  }
  return problems;
}

/**
 * The count of checks that could not be judged, after one more result: a result that says Dash0 is still receiving the
 * data (`settling`) or that was judged (pass, fail) resets or leaves it; any other inconclusive adds one.
 * -> the new count. Pure.
 */
export function missesAfter(count, res) {
  if (res.outcome === 'inconclusive' && res.reason !== 'settling') return count + 1;
  return res.outcome === 'inconclusive' ? count : 0;
}

/** Whether the step should offer "Finish without the Dash0 task": the server said it is down or signed out, or `misses` reached DOWN_AFTER. */
export const offersSkip = (res, misses) => res.down !== undefined || misses >= DOWN_AFTER;

/** Why the task cannot go on, as the cause the skipped-task notice is chosen by: 'signed-out' for a 401, else 'off'. */
export const causeOf = (res) => (res.down === 'signed-out' ? 'signed-out' : 'off');
