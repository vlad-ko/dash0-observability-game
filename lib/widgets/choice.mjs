// Choice widget: one multiple-choice question (docs/M1-DESIGN.md §4.0, extracted from
// level 1.2). The only home of "a wrong pick costs one mistake and passes focus to the
// next enabled choice". Choice = { key, label, why, right? }; `label` and `why` are
// trusted authored HTML, `key` and `id` plain tokens. Markup is the kit's (lib/ui): option
// cards marked by data-state, and one feedback region whose tone says how a pick went (D7:
// a wrong pick costs a star, so it is the error tone). DOM-free at import time.

import { canFocus, focusFirst } from './focus.mjs';
import { button, buttonRow, feedback, option, options, setFeedback } from '../ui/index.mjs';

const ID = /^[A-Za-z][\w-]*$/;

/** What costs a star on a multiple-choice question (mountChoice charges it), and what does not. */
export const PENALTY = Object.freeze({ costs: 'a wrong pick, a 50/50', free: '' });

/** A question offers the 50/50 joker from this many answers up (#371). */
export const FIFTY_MIN = 4;
/** The 50/50 needs at least this many enabled wrong answers: it removes two and one wrong one always stays. */
const FIFTY_WRONG_MIN = 3;
const FIFTY_LABEL = 'Use 50/50 (costs 1 penalty)';

/** Throw a TypeError naming question `id`. */
const fail = (id, msg) => {
  throw new TypeError(`choice "${String(id)}": ${msg}`);
};

/**
 * The shape rule both choiceHtml and validateChoiceSpec apply (the one expression of it):
 * an array of objects whose keys are non-empty strings. Never throws.
 */
function shapeOf(choices) {
  if (!Array.isArray(choices)) return { problems: ['choices must be an array'], objs: [] };
  const problems = [];
  const objs = [];
  // An index loop, not forEach: a hole is a problem, not something to skip.
  for (let i = 0; i < choices.length; i++) {
    const c = choices[i];
    if (c === null || typeof c !== 'object') problems.push(`choice ${i} is not an object`);
    else objs.push(c);
  }
  if (!objs.every((c) => typeof c.key === 'string' && c.key !== '')) problems.push('choice keys must be non-empty strings');
  return { problems, objs };
}

/**
 * Markup for question `id`: its choices (`#<id>-choices`, one `[data-pick]` card each) in
 * ctx.shuffle order, then its feedback region `#<id>-feedback` (hidden until a pick).
 * With `labelledBy` (null or undefined: not given; else the id of the question heading, a plain token like `id`; TypeError
 * otherwise) the choices form a labelled group. `choices` must be an array of objects with non-empty string keys, else a
 * TypeError naming `id` (the one mountChoice throws). label/why are trusted authored HTML; never pass player or data text;
 * escape with ctx.escapeHtml first.
 */
export function choiceHtml(ctx, choices, { id, labelledBy: given }) {
  const labelledBy = given ?? undefined; // null is "not given", like undefined
  if (labelledBy !== undefined && !(typeof labelledBy === 'string' && ID.test(labelledBy))) {
    fail(id, 'labelledBy must be a plain token');
  }
  const { problems } = shapeOf(choices);
  if (problems.length) fail(id, problems.join('; '));
  const itemsHtml = ctx
    .shuffle(choices)
    .map((c) => option({ attr: 'pick', value: c.key, labelHtml: c.label, kind: 'choice' }))
    .join('');
  const fiftyHtml = choices.length >= FIFTY_MIN
    ? buttonRow(button({ id: `${id}-fifty`, variant: 'hint', label: FIFTY_LABEL }))
    : '';
  return options({ id: `${id}-choices`, labelledBy, itemsHtml }) + fiftyHtml + feedback({ id: `${id}-feedback` });
}

/**
 * Every problem with a choice list, as strings; [] when valid. Pure, never throws.
 * Valid: an array of objects with unique non-empty string keys and a string `why`,
 * exactly one `right`.
 */
export function validateChoiceSpec(choices) {
  const { problems, objs } = shapeOf(choices);
  if (!Array.isArray(choices)) return problems;
  const keys = objs.map((c) => c.key);
  if (new Set(keys).size !== keys.length) problems.push('choice keys must be unique');
  for (const c of objs) if (typeof c.why !== 'string') problems.push(`choice "${String(c.key)}" needs a string why`);
  // keep: the 50/50 never removes this answer (a tempting near-miss); a boolean, and never on the right one.
  for (const c of objs) {
    if (c.keep !== undefined && typeof c.keep !== 'boolean') problems.push(`choice "${String(c.key)}" keep must be a boolean`);
    else if (c.keep && c.right) problems.push(`choice "${String(c.key)}" is the right answer and cannot have keep`);
  }
  const rights = objs.filter((c) => c.right).length;
  if (objs.length === choices.length && rights !== 1) problems.push(`needs exactly one right answer, has ${rights}`);
  return problems;
}

/**
 * Wire question `id` (rendered by choiceHtml into ctx.ovBody) and focus its first choice. Mount focus applies to a later step; on a level's first screen the app moves focus to Back (docs/DESIGN-SYSTEM.md, Focus).
 * A wrong pick: ctx.mistake(), data-state `wrong` and disabled, "Not quite. <why>" in the
 * error tone, focus to the next enabled choice (wrapping), else the feedback. The right
 * pick: data-state `correct`, every choice disabled, "Right. <why>" in the success tone,
 * then onRight() is called once and
 * must return the element to focus next, one that passes canFocus (lib/widgets/focus.mjs),
 * e.g. Next or Finish; anything else (nothing, false, a disabled, detached or plain
 * element) focuses the feedback instead. A disabled choice ignores clicks.
 * Throws TypeError (naming `id`) unless `id` is a plain-token string, `choices` is an
 * array of objects with unique non-empty string keys and a string `why`, exactly one is
 * right, and the rendered buttons match the choices' keys one for one.
 */
export function mountChoice(ctx, choices, { id, onRight }) {
  ctx.widget?.('choice'); // the How to play modal follows the step on screen (#316)
  if (typeof id !== 'string') fail(id, 'id must be a string');
  if (!ID.test(id)) fail(id, 'id must be a plain token');
  const problems = validateChoiceSpec(choices);
  if (problems.length) fail(id, problems.join('; '));
  const keys = choices.map((c) => c.key);
  const box = ctx.ovBody.querySelector(`#${id}-choices`);
  const fb = ctx.ovBody.querySelector(`#${id}-feedback`);
  if (!box || !fb) fail(id, 'not rendered (use choiceHtml with the same id)');
  const buttons = [...box.querySelectorAll('[data-pick]')];
  const rendered = buttons.map((b) => b.dataset.pick).sort();
  const wanted = [...keys].sort();
  if (rendered.length !== wanted.length || rendered.some((k, i) => k !== wanted[i])) {
    fail(id, 'the rendered buttons do not match the choices (render and mount the same list)');
  }
  // The enabled wrong answers in the spec's order (not the display order), so ctx.shuffle alone decides.
  const wrongOpen = () =>
    choices
      .filter((c) => !c.right)
      .map((c) => ({ c, x: buttons.find((x) => x.dataset.pick === c.key) }))
      .filter(({ x }) => !x.disabled);
  // The 50/50 removes two wrong answers, never a `keep` one, and one wrong answer always stays.
  const removable = () => wrongOpen().filter(({ c }) => !c.keep).map(({ x }) => x);
  const jokerBlocked = () => wrongOpen().length < FIFTY_WRONG_MIN || removable().length < 2;
  const joker = ctx.ovBody.querySelector(`#${id}-fifty`);
  let used = false;
  let solved = false;
  let lastWrong = ''; // the "Not quite. <why>" of the latest wrong pick, kept when a 50/50 follows it
  const settleJoker = () => {
    if (!joker || used) return;
    if (solved) {
      joker.disabled = true;
      joker.textContent = '50/50 (not needed)';
    } else if (jokerBlocked()) {
      joker.disabled = true;
      joker.textContent = '50/50 (too few answers left)';
    }
  };
  if (joker) {
    settleJoker();
    joker.onclick = () => {
      // A right pick disables every answer, so the floor below already stops a solved question.
      if (used || jokerBlocked()) return;
      used = true;
      // ctx.shuffle picks which two go (the injected randomness); the right answer is never a candidate.
      const gone = ctx.shuffle(removable()).slice(0, 2);
      for (const x of gone) {
        x.hidden = true;
        x.disabled = true;
      }
      ctx.hint();
      joker.textContent = '50/50 used';
      joker.disabled = true;
      const left = buttons.filter((x) => !x.hidden && !x.disabled);
      const line = `50/50: two wrong answers are gone. ${left.length} answers left.`;
      setFeedback(fb, 'neutral', lastWrong ? `<p>${lastWrong}</p><p>${line}</p>` : line);
      focusFirst(left[0], { fallback: fb });
    };
  }
  buttons.forEach((b, i) => {
    const c = choices.find((x) => x.key === b.dataset.pick);
    b.onclick = () => {
      if (b.disabled) return;
      if (c.right) {
        solved = true;
        settleJoker();
        b.setAttribute('data-state', 'correct');
        for (const x of buttons) x.disabled = true;
        setFeedback(fb, 'success', `Right. ${c.why}`);
        const target = onRight();
        (canFocus(target) ? target : fb).focus();
        return;
      }
      ctx.mistake();
      b.setAttribute('data-state', 'wrong');
      b.disabled = true;
      settleJoker();
      lastWrong = `Not quite. ${c.why}`;
      setFeedback(fb, 'error', lastWrong);
      const rest = [...buttons.slice(i + 1), ...buttons.slice(0, i)];
      (rest.find((x) => !x.disabled) ?? fb).focus();
    };
  });
  focusFirst(buttons[0], { fallback: fb }); // a new step opens at its top (#331)
}
