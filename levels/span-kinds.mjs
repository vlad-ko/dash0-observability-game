// Level 2.2: Span kinds, a symptom hunt (the pilot for the Build it redesign, #364). An alert fired
// for payments (2 requests a minute against the 22 it usually handles), finance says the card provider billed a charge for
// every checkout, and the service view draws no checkout to payments edge. The player opens
// the spans, reads their fields and flags the span that makes the view wrong (payments' POST /charge,
// recorded INTERNAL although it handles checkout's call), then picks the change that fixes the alert
// and the map, each option previewing payments' rate after the change (the map shows once a pick is made:
// in the redraw on the right pick, and in each wrong pick's text). The view rules are the
// game's simulation (lib/service-view.mjs); every figure on screen comes from serviceView.
// Spec: docs/M1-DESIGN.md §6 Act 2.
// Spec: https://opentelemetry.io/docs/specs/otel/trace/api/#spankind
// Spec: https://opentelemetry.io/docs/specs/otel/trace/api/#span-creation (SpanKind defaults to INTERNAL when not specified)
//
// A run(ctx) level: its words are in content/core/levels/span-kinds.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the answers, the span fixtures (names, kinds, routes, attribute keys) and the screens.
import CORE from '../content/core/levels/span-kinds.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { fillSlots } from '../lib/content/placeholders.mjs';
import {
  actions, button, chip, eyebrow, feedback, finishButton, nextButton, note, option, options, panel, question, sideColumn, split,
  stats, step, stepHead, table,
} from '../lib/ui/index.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { focusFirst } from '../lib/widgets/focus.mjs';
import { mountHintLadder, ruleText } from '../lib/widgets/help-ladder.mjs';
import { quiet, tell } from '../lib/widgets/tell.mjs';
import { waterfall } from '../lib/widgets/trace.mjs';
import { escapeHtml } from '../lib/lesson-kit.mjs';
import { flagSpan, newHunt, serviceView, withKind } from '../lib/service-view.mjs';
import { playSwirl } from '../lib/swirl-render.mjs';

const CHECKOUT_TRACE = 'c4e1b2a3d5f60718293a4b5c6d7e8f90';
const REFUND_TRACE = 'a7d5c3e1f9b8a6d4c2e0f8b6a4d2c0e9';
const VALIDATE = '4f8a2c6e0b3d7915';
const REFUND = '8e2b6f0a4c9d1357';
const STORE_SERVER = '9c8b7a6f5e4d3c2b';
const STORE_CLIENT = '1a2b3c4d5e6f7a8b';
const CHECKOUT = '3a7f5c9e1b2d4f60';
const TOTALS = 'e8b14d2c6a9f0357';
const PAY_CALL = '6c2d8e0f4a1b3957';
const CHARGE = 'b5f3a1c7e9d20486';
const PROVIDER = '0d9e7c5b3a1f8264';

// What one span stands for in the view: 20 checkouts a minute, each one charge the provider bills. A refund is
// one checkout in REFUND_ONE_IN, so its span counts that share of the rate. Every figure on screen is derived from these.
const PER_MIN = 20;
const REFUND_ONE_IN = 10;
const FINANCE_CHARGES = PER_MIN * 60;

const span = (spanId, service, name, kind, startMs, endMs, parentId, attributes, traceId = CHECKOUT_TRACE) => ({
  spanId, traceId, name, service, kind, startMs, endMs, status: 'UNSET', attributes, events: [], parentId, links: [],
});
const server = (route) => ({ 'http.request.method': 'POST', 'http.route': route });
const client = (address) => ({ 'http.request.method': 'POST', 'server.address': address });

const SPANS = [
  span(STORE_SERVER, 'storefront', 'POST /checkout', 'SERVER', 2, 140, null, server('/checkout')),
  span(STORE_CLIENT, 'storefront', 'POST checkout', 'CLIENT', 5, 135, STORE_SERVER, client('checkout')),
  span(CHECKOUT, 'checkout', 'POST /checkout', 'SERVER', 10, 130, STORE_CLIENT, server('/checkout')),
  span(TOTALS, 'checkout', 'compute totals', 'INTERNAL', 15, 25, CHECKOUT, {}),
  span(PAY_CALL, 'checkout', 'POST payments', 'CLIENT', 30, 110, CHECKOUT, client('payments')),
  span(CHARGE, 'payments', 'POST /charge', 'INTERNAL', 35, 105, PAY_CALL, server('/charge')),
  span(VALIDATE, 'payments', 'validate card', 'INTERNAL', 38, 50, CHARGE, { 'card.brand': 'visa' }),
  span(PROVIDER, 'payments', 'POST provider/charges', 'CLIENT', 55, 100, CHARGE, client('provider')),
  // A refund handled by payments, started by a webhook rather than by this checkout: its own trace, a root, and one
  // request in REFUND_ONE_IN. It starts first, so it is the first row of payments in the list (not the culprit).
  { ...span(REFUND, 'payments', 'POST /refund', 'SERVER', 0, 40, null, server('/refund'), REFUND_TRACE), oneIn: REFUND_ONE_IN },
];

const WATCH = 'payments';
// The rate the alert expects: what payments handles once its span is right (read through the view, never typed).
const EXPECTED = serviceView(withKind(SPANS, CHARGE, 'SERVER'), { perMin: PER_MIN, watch: WATCH }).watched;
/** The view of `spans`: the one expression of every figure on screen (rates, edges, the alert). */
const viewOf = (spans) => serviceView(spans, { perMin: PER_MIN, watch: WATCH, expected: EXPECTED });

/** "a → b, c → d" (or `none`, the content's words for no edge) for `edges` (service names escaped). */
const edgesList = (edges, e, none) => (edges.length ? edges.map((x) => `${e(x.from)} → ${e(x.to)}`).join(', ') : none);

// Step 2: each option changes one span; its label previews payments' rate after the change (a fill-in). The map shows
// only after the pick: in the redraw on the right pick, and in each wrong option's "Not quite." text (the slot {{edges}}).
// `why` follows "Right." or "Not quite.".
const FIX_CHANGES = {
  server: withKind(SPANS, CHARGE, 'SERVER'),
  provider: withKind(SPANS, PROVIDER, 'SERVER'),
  client: withKind(SPANS, CHARGE, 'CLIENT'),
  rename: SPANS.map((s) => (s.spanId === CHARGE ? { ...s, name: 'payments.charge' } : { ...s })),
};
// The figures the copy quotes, all from the one view (see viewOf): the content's fill-ins.
const VARS = {
  watch: WATCH,
  expected: EXPECTED,
  hourly: FINANCE_CHARGES.toLocaleString('en-US'),
  'per-min': PER_MIN,
  'refund-one-in': REFUND_ONE_IN,
  'rate-server': viewOf(FIX_CHANGES.server).watched,
  'rate-provider': viewOf(FIX_CHANGES.provider).watched,
  'rate-client': viewOf(FIX_CHANGES.client).watched,
  'rate-rename': viewOf(FIX_CHANGES.rename).watched,
};
// Values only the code knows: the watched service and the count of the view being drawn, a rate, the map edges, a span's
// times, parent, name and service.
const SLOTS = ['service', 'count', 'rate', 'edges', 'start', 'end', 'parent', 'name'];
// The run entries that are prose and may mark glossary terms (docs/CONTENT.md section 5.1). Drawn through ctx.speech.
export const TERMS = ['huntIntro'];
const BIND = { vars: VARS, slots: SLOTS, terms: TERMS };

const SKELETON = {
  id: 'span-kinds',
  no: '2.2',
  icon: '\u{1F500}',
  mechanics: ['spot'],
  widgets: ['choice'],
  cards: ['span-kind-edges'],
  lights: ['payments'],
  scoring: { parMs: null },
  run: {
    // Why each span that is not the culprit is not the cause: every span but CHARGE has one, joined by span id.
    flagWhy: SPANS.filter((s) => s.spanId !== CHARGE).map((s) => ({ id: s.spanId })),
    fix: [
      { key: 'server', right: true },
      { key: 'provider', keep: true }, // the tempting near-miss: the 50/50 never removes it (#371)
    ],
  },
};

/** The level's answer tables, in play order (pinned by test/act-2.test.mjs), from the bound words `say`. */
const contentOf = (say) => {
  // A wrong option's `why` ends with the map after the change (the slot {{edges}}); the right option's redraws the map instead.
  const fix = say.fix.map((c) => (c.right ? c : { ...c, why: fillSlots(c.why, { edges: edgesList(viewOf(FIX_CHANGES[c.key]).edges, escapeHtml, say.edgesNone) }) }));
  // The spans each option leaves behind, for the view the player sees once the right one is picked (and for the tests).
  for (const c of fix) Object.defineProperty(c, 'spans', { value: FIX_CHANGES[c.key] });
  return {
    steps: [
      { hunt: { id: 'kinds-hunt', spans: SPANS, culprit: CHARGE, perMin: PER_MIN, watch: WATCH, expected: EXPECTED } },
      { id: 'kinds-fix', question: say.fixQuestion, choices: fix },
    ],
  };
};
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, BIND).run);

function screens(ctx, say) {
  const bar = ctx.ovActions;
  const body = ctx.ovBody;
  const e = ctx.escapeHtml;
  const [{ hunt: { spans, culprit, watch } }, fixStep] = contentOf(say).steps; // the same tables CONTENT holds
  const byId = new Map(spans.map((s) => [s.spanId, s]));
  const services = [...new Set(spans.map((s) => s.service))];
  const label = (s) => `${s.name} (${s.service})`;
  const RULE = ruleText({ costs: say.huntRuleCosts, free: say.huntRuleFree });
  /** Why `id` is not the cause, from the content. */
  const whyNot = (id) => say.flagWhy.find((w) => w.id === id).why;

  const alertHtml = (view) => {
    const firing = view.firing === true;
    const noData = view.watched === null || view.watched === undefined;
    const text = firing
      ? `${fillSlots(say.alertFiringHead, { service: e(watch), count: view.watched })} ${say.alertFinance} ${say.alertFiringTail}`
      : `${fillSlots(say.alertResolvedHead, { service: e(watch) })} ${say.alertFinance} ${say.alertResolvedTail}`;
    const title = noData
      ? fillSlots(say.alertTitleNoData, { service: e(watch) })
      : fillSlots(say.alertTitle, { service: e(watch), count: view.watched });
    return panel({
      variant: firing ? 'alert' : undefined,
      headHtml: `${eyebrow(firing ? say.alertEyebrowFiring : say.alertEyebrowResolved)}<h3 id="kinds-alert-title" tabindex="-1">${title}</h3>`,
      sections: [`<p id="kinds-alert-text">${text}</p>`],
    });
  };

  const viewHtml = () => panel({
    id: 'kinds-view',
    headHtml: chip({ text: say.viewChip, tone: 'attention' }),
    sections: [
      `<div id="kinds-rates"></div>`,
      feedback({ id: 'kinds-edges' }),
      note(say.viewNote),
    ],
  });

  const drawView = (list, { scroll = false } = {}) => {
    const view = viewOf(list);
    body.querySelector('#kinds-alert').innerHTML = alertHtml(view);
    body.querySelector('#kinds-rates').innerHTML = stats(view.rates.map((r) => ({ label: r.service, value: fillSlots(say.ratesValue, { rate: r.perMin }) })));
    tell(ctx, body.querySelector('#kinds-edges'), 'neutral', fillSlots(say.edgesLine, { edges: edgesList(view.edges, e, say.edgesNone) }), { scroll });
  };
  // At 320px the step's first control and its question must be on screen when the How to play card closes, so the
  // view (and on the hunt screen the alert) sort after them (widgets.css; the markup order stays alert, board, view).
  const lastView = () => `<div class="kinds-last">${viewHtml()}</div>`;
  const shell = () => `<div id="kinds-alert"></div>${lastView()}`;

  const stepHunt = () => {
    const rows = waterfall(spans).rows.map((r) => {
      const s = byId.get(r.spanId);
      const parent = s.parentId === null ? null : byId.get(s.parentId);
      const meta = `${chip({ text: s.service, swatch: services.indexOf(s.service) })} ${chip({ text: fillSlots(say.huntSpanTimes, { start: s.startMs, end: s.endMs }) })}` +
        (parent ? ` ${chip({ text: fillSlots(say.huntSpanUnder, { parent: parent.name }) })}` : '');
      return option({ attr: 'open-span', value: s.spanId, kind: 'line', labelHtml: e(s.name), metaHtml: meta, pressed: false });
    }).join('');
    const board = panel({
      headHtml: stepHead({ step: 1, titleHtml: say.huntBoardTitle }),
      sections: [options({ id: 'kinds-hunt-spans', itemsHtml: rows })],
    });
    // The span sidebar sits beside the rows from 960px (a nested kit split), under them below.
    const detailHtml = `<div id="kinds-hunt-span" aria-live="polite">${note(say.huntDetailNote)}</div>` +
      feedback({ id: 'kinds-hunt-status', bar: true });
    const side = sideColumn({ id: 'kinds-hunt', titleHtml: say.huntSideTitle, counts: [{ key: 'wrong', label: '' }], hints: true, ruleHtml: RULE });
    ctx.renderStep(
      step({
        surface: 'game',
        wide: true,
        bodyHtml: `${ctx.speech(say.huntIntro)}<div data-kinds-hunt>${split({ mainHtml: `<div id="kinds-alert" class="kinds-late"></div>${split({ mainHtml: board, sideHtml: detailHtml })}${lastView()}`, sideHtml: side })}</div>`,
      }),
      actions({ wide: true, buttonsHtml: nextButton('kinds-next', say.huntReason) }),
    );
    const box = body.querySelector('[data-kinds-hunt]');
    const detail = body.querySelector('#kinds-hunt-span');
    const status = body.querySelector('#kinds-hunt-status');
    const next = bar.querySelector('#kinds-next');
    const rowBtns = [...box.querySelectorAll('[data-open-span]')];
    drawView(spans);

    let hunt = newHunt();
    let shown = null;
    const opened = new Set();
    const verdict = (tone, html) => tell(ctx, status, tone, html, { scroll: true });

    const ladder = mountHintLadder(ctx, box, 'kinds-hunt', {
      swirl: playSwirl,
      fallback: () => rowBtns[0],
      wrongNouns: [say.huntWrongOne, say.huntWrongMany],
      hint: (tier) => ({ html: `<p>${say.hints[tier - 1]}</p>` }),
    });

    const paintRows = () => {
      for (const b of rowBtns) {
        const id = b.dataset.openSpan;
        b.setAttribute('aria-pressed', String(id === shown));
        const state = hunt.solved && id === culprit ? 'correct' : hunt.flagged.includes(id) ? 'wrong' : opened.has(id) ? 'opened' : null;
        if (state) b.setAttribute('data-state', state);
        else b.removeAttribute('data-state');
      }
    };

    const sidebar = (s) => {
      const parent = s.parentId === null ? null : byId.get(s.parentId);
      const ruledOut = hunt.flagged.includes(s.spanId);
      const flag = button({
        id: 'kinds-flag',
        label: ruledOut ? say.sidebarRuledOut : hunt.solved ? (s.spanId === culprit ? say.sidebarFlagged : say.sidebarHuntOver) : say.sidebarFlag,
        variant: 'primary',
        disabled: ruledOut || hunt.solved,
      });
      return panel({
        variant: 'inset',
        headHtml: `<h4 id="kinds-hunt-span-title" tabindex="-1">${e(label(s))}</h4>`,
        sections: [
          stats([
            { label: say.sidebarService, value: s.service },
            { label: say.sidebarKind, value: s.kind },
            { label: say.sidebarStatus, value: s.status },
            { label: say.sidebarParent, value: parent ? label(parent) : say.sidebarNoParent },
            { label: say.sidebarTraceId, value: s.traceId },
          ]),
          Object.keys(s.attributes).length
            ? table({ caption: say.sidebarAttrCaption, head: [say.sidebarAttrName, say.sidebarAttrValue], rows: Object.entries(s.attributes) })
            : note(say.sidebarNoAttrs),
          flag,
        ],
      });
    };

    const showSpan = (id, { focus }) => {
      shown = id;
      opened.add(id);
      detail.innerHTML = sidebar(byId.get(id));
      detail.querySelector('#kinds-flag').onclick = () => flagIt(id);
      paintRows();
      if (focus) detail.querySelector('#kinds-hunt-span-title').focus();
    };

    const flagIt = (id) => {
      const r = flagSpan(spans, culprit, hunt, id);
      hunt = r.state;
      const s = byId.get(id);
      if (r.outcome === 'wrong') {
        ladder.miss();
        verdict('error', `${fillSlots(say.flagWrongHead, { name: e(s.name), service: e(s.service) })} ${whyNot(id)} ${say.flagWrongTail}`);
        showSpan(id, { focus: false });
        status.focus();
      } else if (r.outcome === 'right') {
        // (Another outcome never comes from the UI: a ruled-out or solved span's button is disabled.)
        verdict('success', fillSlots(say.flagRight, { name: e(s.name), service: e(s.service) }));
        showSpan(id, { focus: false });
        next.disabled = false;
        body.querySelector('#kinds-hunt-win-title').textContent = say.huntWinTitle;
        ladder.succeed();
      }
    };

    rowBtns.forEach((b) => {
      b.onclick = () => {
        // A wrong-flag verdict is about the span just flagged; once the player moves on it would read as about this one.
        if (!hunt.solved) quiet(ctx, status);
        showSpan(b.dataset.openSpan, { focus: true });
      };
    });
    next.onclick = stepFix;
    paintRows();
    focusFirst(rowBtns[0], { fallback: status });
  };

  const stepFix = () => {
    ctx.renderStep(
      step({
        surface: 'game',
        wide: true,
        bodyHtml: `${ctx.speech(say.fixIntro)}` +
          `${shell()}${question({ id: 'kinds-q', html: fixStep.question })}${choiceHtml(ctx, fixStep.choices, { id: fixStep.id, labelledBy: 'kinds-q' })}`,
      }),
      actions({ wide: true, buttonsHtml: finishButton('kinds-finish', say.fixReason) }),
    );
    drawView(spans);
    const finish = bar.querySelector('#kinds-finish');
    mountChoice(ctx, fixStep.choices, {
      id: fixStep.id,
      onRight: () => {
        drawView(fixStep.choices.find((c) => c.right).spans);
        finish.disabled = false;
        return body.querySelector('#kinds-alert-title'); // the change the player should see; Finish stays in the footer
      },
    });
    finish.onclick = () =>
      ctx.finish({
        text: say.finish,
        cards: ['span-kind-edges'],
      });
  };

  stepHunt();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { ...BIND, screens });
}

export default withText(CORE);
