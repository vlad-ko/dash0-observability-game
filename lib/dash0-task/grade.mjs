// Grading an In Dash0 check (#509 P5). SERVER ONLY (see scenario.mjs). Wraps lib/incident-lab.mjs's gradeAnswer and
// normaliseAnswer and decides, in one place, what a check may say:
//   - a seeded check grades nothing before the data can be there: while now < sentAt + SETTLE_S EVERY answer, right or
//     wrong, is inconclusive 'settling' (a right one could only be a guess, the player cannot have seen the data yet);
//   - after that the per-attempt cooldown is taken BEFORE grading, so a held cooldown is 'cooldown' whatever the answer
//     (no free guesses, one grading per window);
//   - then, BEFORE any answer is graded, the attempt's data must be confirmed VISIBLE in Dash0 (one probe, then cached
//     per attempt by the caller): if the probe finds nothing, or cannot ask, EVERY answer, right or wrong, is inconclusive
//     'not-visible' or 'upstream' with no charge. A right answer that passed without the check would let a player probe
//     for it freely whenever the data lags or the API is down; absence is never a verdict;
//   - a readback task passes when the probe finds the attempt's record, and is otherwise inconclusive, never fail.
// `charge` is not decided here: it needs Redis (SADD), so a `fail` carries `wrong` (the key to charge once per attempt) and the caller charges.
import { GRADE, gradeAnswer, normaliseAnswer } from '../incident-lab.mjs';
import { GRADER } from './scenario.mjs';

// How long after the last batch was accepted the server waits before it believes "not found". The ingest-to-query
// delay is unmeasured (#509 P1: "still to verify"); 30 s is the planned value, to be measured on the live run (P8).
export const SETTLE_S = 30;
export const RETRY_S = Object.freeze({ cooldown: 5, 'not-visible': 10, upstream: 15 });
export const MAX_VALUE_LENGTH = 200;

export const REASON = Object.freeze({
  settling: 'settling',
  cooldown: 'cooldown',
  notVisible: 'not-visible',
  upstream: 'upstream',
  notSent: 'not-sent',
  answer: 'answer',
});

const inconclusive = (reason, retryAfterS) => (retryAfterS === undefined ? { outcome: GRADE.inconclusive, reason } : { outcome: GRADE.inconclusive, reason, retryAfterS });

/** The charge key of a wrong answer: the same value in another case, or padded, is the same key. */
export const wrongKey = (question, value) => `${question}:${normaliseAnswer(question, value)}`;

/** An answer `{question, value}` of the right shape (a string question, a short string or a finite number). */
export function validAnswer(answer) {
  if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) return false;
  if (typeof answer.question !== 'string' || !/^[A-Za-z]{1,40}$/.test(answer.question)) return false;
  const { value } = answer;
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.length <= MAX_VALUE_LENGTH;
}

/**
 * -> {outcome:'pass'} | {outcome:'fail', wrong} | {outcome:'inconclusive', reason, retryAfterS?}.
 * `grader` is a GRADER value; `scenario` the attempt's buildScenario result; `answer` the player's `{question, value}`
 * (seeded only); `sentAt` when the batches were accepted (null if never); `now` epoch ms;
 * `cooldown()` -> Promise<boolean> (false: asked again too soon, nothing is graded);
 * `probe()` -> Promise<{count} | {error}> (the number of records Dash0 shows for the attempt, or why it could not say);
 * `seen` true when an earlier check already confirmed this attempt's data visible (a seeded task then asks no probe);
 * `confirm()` -> Promise<void> records that confirmation (called once, when a seeded probe first finds the data).
 */
export async function gradeCheck({ grader, scenario, answer, sentAt, now, cooldown, probe, seen = false, confirm = async () => {} }) {
  async function visible(cache) {
    if (cache && seen) return { visible: true };
    const found = await probe();
    if (found.error) return inconclusive(REASON.upstream, RETRY_S.upstream);
    if (!(found.count > 0)) return inconclusive(REASON.notVisible, RETRY_S['not-visible']);
    if (cache) await confirm();
    return { visible: true };
  }

  if (sentAt === null) return inconclusive(REASON.notSent, RETRY_S['not-visible']);

  if (grader === GRADER.readback) {
    if (!(await cooldown())) return inconclusive(REASON.cooldown, RETRY_S.cooldown);
    const found = await visible(false); // a readback pass IS the sighting: nothing is cached
    return found.visible ? { outcome: GRADE.pass } : found;
  }

  if (grader !== GRADER.seeded || !validAnswer(answer)) return inconclusive(REASON.answer);
  const readyAt = sentAt + SETTLE_S * 1000;
  if (now < readyAt) return inconclusive(REASON.settling, Math.ceil((readyAt - now) / 1000));
  if (!(await cooldown())) return inconclusive(REASON.cooldown, RETRY_S.cooldown);
  const found = await visible(true);
  if (!found.visible) return found;
  const verdict = gradeAnswer(scenario.spans, answer.question, answer.value);
  if (verdict === GRADE.pass) return { outcome: GRADE.pass };
  if (verdict !== GRADE.fail) return inconclusive(REASON.answer); // unreadable key or an answer of the wrong form
  return { outcome: GRADE.fail, wrong: wrongKey(answer.question, answer.value) };
}
