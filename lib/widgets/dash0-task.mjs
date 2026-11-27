// The In Dash0 step (#509, docs/DECLARATIVE-LEVELS.md): the player does a task in the real Dash0 and the task server checks
// it. This file is the logic: the spec check, what costs a star and the counting rule for "the server is not answering".
// The markup and the mount are lib/widgets/dash0-task-view.mjs; the words are content/core/ui/dash0-task.mjs. The answers
// never reach the browser: the spec holds only the task id, the grader kind and, for a seeded task, the answer FIELD KEYS (and
// their labels). A readback task has no answer at all: the player makes an asset and the server reads it back.
// DOM-free at import.
import { isId } from '../registry.mjs';
import { taskOf } from '../dash0-task/tasks.mjs';

/** Who grades the task: `seeded` (the server made the data and knows the answer) or `readback` (the player made an asset and the server reads it back). */
export const GRADERS = Object.freeze(['seeded', 'readback']);

/** The longest answer the task server takes (api/dash0-task.mjs); a longer one is refused here, before anything is sent. */
export const ANSWER_MAX = 200;

/** After this many results in a row that say Dash0 or the server could not be reached (OUTAGE), the step offers to finish without the task. */
export const DOWN_AFTER = 3;

/**
 * The results that mean Dash0 or the task server could not be reached: the only ones that count towards DOWN_AFTER. Every other
 * inconclusive result (settling, cooldown, rate-limited, not-sent, answer, and not-visible for a readback task) is the player's own pace or work, never an outage.
 */
export const OUTAGE = Object.freeze(['network', 'unavailable', 'upstream', 'ingest']);

/** What costs a star on an In Dash0 step (the check route charges it), and what does not. */
export const PENALTY = Object.freeze({
  costs: 'a wrong answer (once for each attempt)',
  free: 'A check that could not be judged, starting again and finishing without the task cost nothing.',
});

const FIELD_KEYS = ['key', 'label', 'hint'];
const QUESTION = /^[A-Za-z]{1,40}$/; // the server's question ids (api/dash0-task.mjs): operation, faultCode, retryCount, traceId
const isQuestion = (v) => typeof v === 'string' && QUESTION.test(v);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Every problem with an In Dash0 spec, as strings; [] when valid. `{id, task, grader, answers?, fields?}`. A `seeded` task lists
 * the question ids the player answers in `answers` (one field and one Check each, sent as `{question, value}`) and `fields` is the
 * bound content, one `{key, label, hint?}` for each answer key and no others. A `readback` task has neither: the view draws one
 * Check with no field and sends no answer. Pure, never throws.
 */
export function validateDash0Spec(spec) {
  if (!isObject(spec)) return ['spec: not an object'];
  const problems = [];
  for (const k of Object.keys(spec)) if (!['id', 'task', 'grader', 'answers', 'fields'].includes(k)) problems.push(`spec: unknown key ${JSON.stringify(k)}`);
  if (!isId(spec.id)) problems.push(`spec id ${JSON.stringify(spec.id) ?? String(spec.id)} is not kebab-case`);
  if (!isId(spec.task)) problems.push(`spec task ${JSON.stringify(spec.task) ?? String(spec.task)} is not a kebab-case task id`);
  if (!GRADERS.includes(spec.grader)) problems.push(`spec grader must be one of ${GRADERS.join(', ')}`);
  // The task must be one the server knows, graded the way the server grades it (lib/dash0-task/tasks.mjs): a mismatch would be a 400 for ever.
  const known = isId(spec.task) ? taskOf(spec.task) : null;
  if (isId(spec.task) && known === null) problems.push(`spec task ${JSON.stringify(spec.task)} is not a task the server knows`);
  else if (known !== null && GRADERS.includes(spec.grader) && spec.grader !== known.grader) problems.push(`spec task ${JSON.stringify(spec.task)} is graded as ${known.grader}, not ${spec.grader}`);
  if (spec.grader === 'readback') {
    for (const k of ['answers', 'fields']) if (spec[k] !== undefined) problems.push(`a readback task has no ${k} (the player makes an asset and the server reads it back)`);
    return problems;
  }
  const answers = spec.answers;
  if (!Array.isArray(answers) || answers.length === 0 || !answers.every(isQuestion)) problems.push('answers must be a non-empty array of question ids (letters only, up to 40) (each is one check)');
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
      if (known?.answers) for (const a of answers) if (!known.answers.includes(a)) problems.push(`answer ${JSON.stringify(a)} is not a question of task ${JSON.stringify(spec.task)}`);
      for (const a of answers) if (!keys.includes(a)) problems.push(`answer ${JSON.stringify(a)} has no field (give it a label in the content)`);
      for (const k of keys) if (!answers.includes(k)) problems.push(`field ${JSON.stringify(k)} is not in answers`);
    }
  }
  return problems;
}

/** A seeded `not-visible` only counts towards the offer once this many times `readyAfterS` have passed since the attempt's Start: a slow Dash0 is not a missing one. */
export const NOT_VISIBLE_AFTER = 3;

/**
 * The count of results that found Dash0 or the server out of reach, after one more result: an inconclusive result whose reason
 * is in OUTAGE adds one, and so does `not-visible` for a `seeded` task once `elapsedMs` (since that attempt's Start) has reached
 * NOT_VISIBLE_AFTER times `readyAfterS` (the server sends it only after settling, and never again for an attempt whose data it has
 * confirmed, so a healthy server cannot give DOWN_AFTER in a row late: the data never showed). An earlier `not-visible` neither
 * counts nor resets. Any other inconclusive result (settling, cooldown, rate-limited, not-sent, answer, and not-visible for a
 * readback task) leaves the count alone, and a judged result (pass, fail) resets it. -> the new count. Pure.
 */
export function missesAfter(count, res, grader, { elapsedMs = NaN, readyAfterS = NaN } = {}) {
  if (res.outcome !== 'inconclusive') return 0;
  const late = grader === 'seeded' && res.reason === 'not-visible' && elapsedMs >= NOT_VISIBLE_AFTER * readyAfterS * 1000;
  return OUTAGE.includes(res.reason) || late ? count + 1 : count;
}

/** Whether the step should offer "Finish without the In Dash0 task": the server said it is down or signed out, or `misses` reached DOWN_AFTER. */
export const offersSkip = (res, misses) => res.down !== undefined || misses >= DOWN_AFTER;

/** Why the task cannot go on, as the cause the skipped-task notice is chosen by: 'signed-out' for a 401, else 'off'. */
export const causeOf = (res) => (res.down === 'signed-out' ? 'signed-out' : 'off');
