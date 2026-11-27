// Grading an In Dash0 check (#509 P5). SERVER ONLY (see scenario.mjs). Wraps lib/incident-lab.mjs's gradeAnswer and
// normaliseAnswer and decides, in one place, what a check may say:
//   - a right answer passes at once, with no Dash0 call (the player saw the data, so the data is there);
//   - a wrong answer is only ever a `fail` once the attempt's data is VISIBLE in Dash0: before sentAt + SETTLE_S it is
//     inconclusive 'settling', and if the probe finds nothing (or cannot ask) it is inconclusive 'not-visible' or
//     'upstream'. Absence is never a fail: a player must not be charged for a question the data could not answer yet;
//   - a readback task passes when the probe finds the attempt's record, and is otherwise inconclusive, never fail.
// `charge` is not decided here: it needs Redis (SADD), so a `fail` carries `wrong` (the key to charge once) and the caller charges.
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
 * `cooldown()` -> Promise<boolean> (false: asked again too soon, a Dash0 call is refused);
 * `probe()` -> Promise<{count} | {error}> (the number of records Dash0 shows for the attempt, or why it could not say).
 */
export async function gradeCheck({ grader, scenario, answer, sentAt, now, cooldown, probe }) {
  async function visible() {
    if (!(await cooldown())) return inconclusive(REASON.cooldown, RETRY_S.cooldown);
    const seen = await probe();
    if (seen.error) return inconclusive(REASON.upstream, RETRY_S.upstream);
    return seen.count > 0 ? { visible: true } : inconclusive(REASON.notVisible, RETRY_S['not-visible']);
  }

  if (sentAt === null) return inconclusive(REASON.notSent, RETRY_S['not-visible']);

  if (grader === GRADER.readback) {
    const seen = await visible();
    return seen.visible ? { outcome: GRADE.pass } : seen;
  }

  if (grader !== GRADER.seeded || !validAnswer(answer)) return inconclusive(REASON.answer);
  const verdict = gradeAnswer(scenario.spans, answer.question, answer.value);
  if (verdict === GRADE.pass) return { outcome: GRADE.pass };
  if (verdict !== GRADE.fail) return inconclusive(REASON.answer); // unreadable key or an answer of the wrong form
  const readyAt = sentAt + SETTLE_S * 1000;
  if (now < readyAt) return inconclusive(REASON.settling, Math.ceil((readyAt - now) / 1000));
  const seen = await visible();
  return seen.visible ? { outcome: GRADE.fail, wrong: wrongKey(answer.question, answer.value) } : seen;
}
