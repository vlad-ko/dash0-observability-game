// Act 0 boss: The pager, in two parts. Part 1 (blind): an alert fires with no context;
// every look the player takes finds no data and burns a quarter of the error budget,
// until they escalate or the budget hits 0. Part 2: the same four questions, each answered
// from a small instrumented view. It cannot be won and is not scored: it is the reason to instrument.
// The budget is a percent of the error budget, not minutes, in fixed 25% steps. The screen shows a kit meter of 4 cells, its text line (percent spent) as the one statement of the budget, and a Spent on chip per look. It is not the incident engine (§4.3). Spec: docs/M1-DESIGN.md §6 Boss the-pager.
// Spec: https://opentelemetry.io/docs/concepts/observability-primer/#what-is-observability
//
// A run(ctx) level: its words are in content/core/levels/the-pager.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the budget and the screens. The content calls a part 2 answer a `reply` ("answer" is a
// logic-only key under run); contentOf maps it back to `answer`.
import CORE from '../content/core/levels/the-pager.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { fillSlots } from '../lib/content/placeholders.mjs';
import {
  actions,
  button,
  chip,
  finishButton,
  feedback as feedbackRegion,
  meter,
  note,
  option,
  options,
  question,
  reason,
  setFeedback,
  step,
} from '../lib/ui/index.mjs';

const BUDGET = { startPct: 100, stepPct: 25 };

// The Spent on chips quote the step of the budget (a figure); the label of a look is known only to the code (a slot).
const VARS = { 'step-pct': BUDGET.stepPct };
const SLOTS = ['label'];

const SKELETON = {
  id: 'the-pager',
  no: null,
  icon: '\u{1F4DF}',
  mechanics: ['incident'],
  // No help card: its intro explains the board (it is not scored).
  widgets: [],
  cards: [],
  lights: [],
  scored: false,
  scoring: { parMs: null },
  // Nothing in it carries an answer flag or a figure: all its words are in the content.
  run: {},
};

// Part 2's answers. All figures, names and the trace ID are MADE UP for illustration.
// Each answer leans on one OpenTelemetry idea:
// service: the service.name resource attribute names the service producing telemetry.
//   Spec: https://opentelemetry.io/docs/concepts/resources/
// since: a metric (a latency percentile over time) shows when it changed; service.version
//   is a resource attribute. Spec: https://opentelemetry.io/docs/concepts/signals/metrics/
// customers: span attributes (here payment.provider) let you slice requests.
//   Spec: https://opentelemetry.io/docs/concepts/signals/traces/#attributes
// trace: a trace is the spans of one request; a span records its operation and duration.
//   Spec: https://opentelemetry.io/docs/concepts/signals/traces/

/**
 * The boss's copy (pinned by test/the-pager.test.mjs), from the bound words `say`. The four looks are in play order,
 * and `reason` is what a look reveals. A part 2 answer is the content's `reply`.
 */
const contentOf = (say) => ({
  alert: say.alert,
  looks: say.looks,
  budget: BUDGET,
  reward: say.reward,
  intro: say.intro,
  telemetry: { intro: say.litIntro, asks: say.asks.map(({ reply, ...ask }) => ({ ...ask, answer: reply })) },
});
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, { vars: VARS, slots: SLOTS }).run);

const CELLS = BUDGET.startPct / BUDGET.stepPct;

/** The kit meter, the one place the budget is stated: spent cells fill as looks are taken, and its text line says "75 of 100 percent spent". */
const meterHtml = (say, left) =>
  meter({
    id: 'pager-meter',
    label: say.meterLabel,
    value: BUDGET.startPct - left,
    max: BUDGET.startPct,
    cells: CELLS,
    unit: say.meterUnit,
  });

/** One Spent on chip per look taken, in the order taken. */
const spentHtml = (say, taken) =>
  taken.length
    ? `${say.spentLabel} ${taken.map((l) => chip({ text: fillSlots(say.spentChip, { label: l.label }) })).join(' ')}`
    : '';

function screens(ctx, say) {
  const { looks: LOOKS, telemetry: { asks: ASKS } } = contentOf(say); // the same tables CONTENT holds
  const e = ctx.escapeHtml;
  // The rows so far: full-width kit cards (copies of the feedback region), not live. Only the newest row is announced, in the feedback region.
  const rowsList = (id) => `<div class="pager-rows" id="${id}"></div>`;
  const alert = question({ id: 'pager-alert', html: e(say.alert) });
  const choices = (list, attr) =>
    options({
      labelledBy: 'pager-alert',
      itemsHtml: list.map((x) => option({ attr, value: x.key, labelHtml: e(x.label) })).join(''),
    });
  /** The newest row is announced in the kit feedback region (neutral: information only); the row it replaces moves into the plain (not live) list, so each row is on screen once. */
  const addRow = (list, region, key, attr, label, body) => {
    if (region.newestHtml) {
      // The row it replaces becomes a card of its own, a copy of the kit region (not live, no id), so every row has one style (#332).
      const old = region.cloneNode(true);
      for (const attr of ['id', 'role', 'aria-live', 'tabindex']) old.removeAttribute(attr);
      list.appendChild(old);
    }
    // A label that is a question reads on as it is; any other label gets a colon.
    const mark = label.endsWith('?') ? '' : ':';
    region.newestHtml = `<p data-${attr}="${key}"><strong>${label}${mark}</strong> ${body}</p>`;
    setFeedback(region, 'neutral', region.newestHtml, { scroll: true }); // each row answers a click: in view, above the footer (#346)
  };
  const askAnswers = (escalatedByBudget = false) => {
    // The note is said at the top of part 2 when the fourth look spent the last of the budget: the player never presses Escalate, and the meter and the look's row are gone with part 1.
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.litIntro)}${escalatedByBudget ? note(say.budgetSpent) : ''}${alert}${choices(ASKS, 'ask')}${rowsList('pager-answer-rows')}${feedbackRegion({ id: 'pager-answers' })}`,
      }),
      actions({ wide: false, buttonsHtml: finishButton('pager-finish', say.askReason) }),
    );
    const finish = ctx.ovActions.querySelector('#pager-finish');
    const answers = ctx.ovBody.querySelector('#pager-answers');
    const answerRows = ctx.ovBody.querySelector('#pager-answer-rows');
    const buttons = [...ctx.ovBody.querySelectorAll('[data-ask]')];
    buttons.forEach((b, i) => {
      const ask = ASKS[i];
      b.onclick = () => {
        if (b.disabled) return;
        b.disabled = true;
        addRow(answerRows, answers, ask.key, 'answer', ask.label, ask.answer);
        finish.disabled = buttons.some((x) => !x.disabled);
        const rest = [...buttons.slice(i + 1), ...buttons.slice(0, i)];
        (rest.find((x) => !x.disabled) ?? finish).focus();
      };
    });
    finish.onclick = () => ctx.finish({ text: say.reward, cards: [] });
    buttons[0].focus({ preventScroll: true }); // a new step opens at its top (#331)
  };

  ctx.renderStep(
    step({
      wide: false,
      bodyHtml: `${ctx.speech(say.intro)}${alert}
        <div id="pager-budget" role="status" aria-live="polite">${meterHtml(say, BUDGET.startPct)}</div>
        <p id="pager-spent"></p>
        ${choices(LOOKS, 'look')}${rowsList('pager-said-rows')}${feedbackRegion({ id: 'pager-feedback' })}`,
    }),
    actions({
      wide: false,
      buttonsHtml: button({ id: 'pager-escalate', label: say.startEscalateButton, variant: 'primary', disabled: true }) +
        reason({ id: 'pager-escalate-why', text: say.startEscalateReason }),
    }),
  );
  const body = ctx.ovBody;
  const escalate = ctx.ovActions.querySelector('#pager-escalate');
  const budgetEl = body.querySelector('#pager-budget');
  const spentEl = body.querySelector('#pager-spent');
  const feedback = body.querySelector('#pager-feedback');
  const saidRows = body.querySelector('#pager-said-rows');
  const taken = [];
  const buttons = [...body.querySelectorAll('[data-look]')];
  let left = BUDGET.startPct;

  buttons.forEach((b, i) => {
    const look = LOOKS[i];
    b.onclick = () => {
      if (b.disabled) return;
      b.disabled = true;
      left = Math.max(0, left - BUDGET.stepPct);
      taken.push(look);
      budgetEl.innerHTML = meterHtml(say, left);
      spentEl.innerHTML = spentHtml(say, taken);
      addRow(saidRows, feedback, look.key, 'said', look.label, look.reason);
      escalate.disabled = false;
      if (left === 0) return askAnswers(true);
      const rest = [...buttons.slice(i + 1), ...buttons.slice(0, i)];
      (rest.find((x) => !x.disabled) ?? escalate).focus();
    };
  });
  escalate.onclick = () => askAnswers();
  // The app moves focus to Back after run() (docs/DESIGN-SYSTEM.md, Focus); this keeps the step's own focus order.
  buttons[0].focus({ preventScroll: true }); // a new step opens at its top (#331)
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { vars: VARS, slots: SLOTS, screens });
}

export default withText(CORE);
