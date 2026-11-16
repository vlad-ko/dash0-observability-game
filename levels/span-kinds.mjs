// Level 2.2: Span kinds, a symptom hunt (the pilot for the Build it redesign, #364). An alert fired
// for payments (2 requests a minute against the 22 it usually handles), finance says the card provider billed a charge for
// every checkout, and the simulated Dash0 view draws no checkout to payments edge. The player opens
// the spans, reads their fields and flags the span that makes the view wrong (payments' POST /charge,
// recorded INTERNAL although it handles checkout's call), then picks the change that fixes the alert
// and the map, each option previewing payments' rate after the change (the map shows once a pick is made:
// in the redraw on the right pick, and in each wrong pick's text). The view rules are the
// game's simulation (lib/service-view.mjs); every figure on screen comes from serviceView.
// Spec: docs/M1-DESIGN.md §6 Act 2.
// Spec: https://opentelemetry.io/docs/specs/otel/trace/api/#spankind
// Spec: https://opentelemetry.io/docs/specs/otel/trace/api/#span-creation (SpanKind defaults to INTERNAL when not specified; confirmed in the fetched spec text)
import {
  actions, button, chip, eyebrow, feedback, finishButton, nextButton, note, option, options, panel, question, setFeedback, sideColumn, split,
  stats, step, stepHead, table,
} from '../lib/ui/index.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { focusFirst } from '../lib/widgets/focus.mjs';
import { mountHintLadder, ruleText } from '../lib/widgets/help-ladder.mjs';
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

const FLAG_WHY = {
  [VALIDATE]: 'Work inside payments, not a call between services, so INTERNAL is the right kind.',
  [REFUND]: 'It handles an incoming request and is recorded SERVER, so payments counts it. A webhook started it, not this checkout, so no edge is expected.',
  [STORE_SERVER]: 'It handles the incoming request and is recorded SERVER, so storefront is counted correctly. The alert is about payments.',
  [STORE_CLIENT]: 'It is the caller\'s side of the call into checkout, recorded CLIENT, and it pairs with checkout\'s SERVER span.',
  [CHECKOUT]: 'It handles storefront\'s call and is recorded SERVER, so checkout is counted and the storefront to checkout edge draws.',
  [TOTALS]: 'Work inside checkout, not a call between services, so INTERNAL is the right kind.',
  [PAY_CALL]: 'It is checkout\'s call out to payments, recorded CLIENT, which is right for the caller.',
  [PROVIDER]: 'It is payments\' call out to the card provider, recorded CLIENT, which is right. The provider sends no spans of its own, so no edge is expected there.',
};

const WATCH = 'payments';
// The rate the alert expects: what payments handles once its span is right (read through the view, never typed).
const EXPECTED = serviceView(withKind(SPANS, CHARGE, 'SERVER'), { perMin: PER_MIN, watch: WATCH }).watched;
/** The view of `spans`: the one expression of every figure on screen (rates, edges, the alert). */
const viewOf = (spans) => serviceView(spans, { perMin: PER_MIN, watch: WATCH, expected: EXPECTED });

/** "a → b, c → d" (or "none") for `edges` (service names escaped). */
const edgesList = (edges, e) => (edges.length ? edges.map((x) => `${e(x.from)} → ${e(x.to)}`).join(', ') : 'none');
/** "Map edges: a → b, c → d." */
const edgesLine = (edges, e) => `Map edges: ${edgesList(edges, e)}.`;

// Step 2: each option changes one span; its label previews payments' rate after the change. The map shows only after
// the pick: in the redraw on the right pick, and in each wrong option's "Not quite." text. `why` follows "Right." or "Not quite.".
const preview = (spans) => `<br>Preview: ${WATCH} ${viewOf(spans).watched} requests/min.`;
const mapAfter = (spans) => ` With that change the map edges would be: ${edgesList(viewOf(spans).edges, escapeHtml)}.`;
const FIX_CHANGES = {
  server: withKind(SPANS, CHARGE, 'SERVER'),
  provider: withKind(SPANS, PROVIDER, 'SERVER'),
  client: withKind(SPANS, CHARGE, 'CLIENT'),
  rename: SPANS.map((s) => (s.spanId === CHARGE ? { ...s, name: 'payments.charge' } : { ...s })),
};
const FIX = [
  {
    key: 'server',
    label: `Set <code>POST /charge</code> to SERVER${preview(FIX_CHANGES.server)}`,
    right: true,
    why: 'SERVER marks the span that handles an incoming call, and spans are INTERNAL unless the code gives a kind, which <code>POST /charge</code> never did. With SERVER the view counts the request payments handled and pairs the span with checkout\'s CLIENT span, so the edge draws.',
  },
  {
    key: 'provider',
    label: `Set <code>POST provider/charges</code> to SERVER${preview(FIX_CHANGES.provider)}`,
    why: 'That clears the alert but fixes the wrong span. It is payments\' own call out to the card provider, a CLIENT call, and its parent is a payments span, so it pairs with nothing and the checkout → payments edge stays missing.' + mapAfter(FIX_CHANGES.provider),
  },
  {
    key: 'client',
    label: `Set <code>POST /charge</code> to CLIENT${preview(FIX_CHANGES.client)}`,
    why: 'CLIENT marks the caller\'s side, but payments receives this call. The alert still fires, and an edge needs a CLIENT span with a SERVER child, so none draws.' + mapAfter(FIX_CHANGES.client),
  },
  {
    key: 'rename',
    label: `Rename <code>POST /charge</code> to <code>payments.charge</code>${preview(FIX_CHANGES.rename)}`,
    why: 'The view reads the kind, not the name. Renamed, the span is still INTERNAL and nothing changes.' + mapAfter(FIX_CHANGES.rename),
  },
];
// The spans each option leaves behind, for the view the player sees once the right one is picked (and for the tests).
for (const c of FIX) Object.defineProperty(c, 'spans', { value: FIX_CHANGES[c.key] });

export const CONTENT = {
  steps: [
    { hunt: { id: 'kinds-hunt', spans: SPANS, culprit: CHARGE, perMin: PER_MIN, watch: WATCH, expected: EXPECTED } },
    { id: 'kinds-fix', question: 'Which change fixes the alert and the map?', choices: FIX },
  ],
};

const RULE = ruleText({
  costs: 'a wrong flag, a hint',
  free: 'Opening a span is free.',
});

const HINTS = [
  'A span with an <code>http.route</code> is serving a request. Which spans carry one?',
  'Check the kind of each span that has a route. A span that serves a call should be SERVER, whether its caller is in this trace or outside it. Does one of them not match?',
  'Flag <code>POST /charge</code> in payments: it has a route and sits under checkout\'s CLIENT span, but it is INTERNAL.',
];

export default {
  id: 'span-kinds',
  no: '2.2',
  name: 'Span kinds',
  sub: 'Which side of the call?',
  icon: '\u{1F500}',
  rewardTitle: 'Map maker',
  mechanics: ['spot'],
  widgets: ['choice'],
  cards: ['span-kind-edges'],
  lights: ['payments'],
  scoring: { parMs: null },
  run(ctx) {
    const bar = ctx.ovActions;
    const body = ctx.ovBody;
    const e = ctx.escapeHtml;
    const { spans, culprit, watch, expected } = CONTENT.steps[0].hunt;
    const byId = new Map(spans.map((s) => [s.spanId, s]));
    const services = [...new Set(spans.map((s) => s.service))];
    const label = (s) => `${s.name} (${s.service})`;

    const alertHtml = (view) => {
      const firing = view.firing === true;
      const hourly = FINANCE_CHARGES.toLocaleString('en-US');
      const finance = `the card provider billed ${hourly} charges in the same hour, one for every checkout`;
      const text = firing
        ? `By this view's count, ${e(watch)} handled ${view.watched} requests/min over the last 60 minutes, below the ${expected} it usually handles. Finance: ${finance}.`
        : `By this view's count, ${e(watch)} is back at the ${expected} requests/min it usually handles. Finance: ${finance}.`;
      return panel({
        variant: firing ? 'alert' : undefined,
        headHtml: `${eyebrow(firing ? 'Firing' : 'Resolved')}<h3 id="kinds-alert-title" tabindex="-1">${e(watch)}: ${view.watched ?? 'no data'} requests/min</h3>`,
        sections: [`<p id="kinds-alert-text">${text}</p>`],
      });
    };

    const viewHtml = () => panel({
      id: 'kinds-view',
      headHtml: chip({ text: 'Simulated Dash0 view', tone: 'attention' }),
      sections: [
        `<div id="kinds-rates"></div>`,
        feedback({ id: 'kinds-edges' }),
        note('This simulated view counts a service\'s requests from its SERVER spans and draws an edge from a CLIENT span to its SERVER child in another service. Backends can derive both from span kind.'),
      ],
    });

    const drawView = (list, { scroll = false } = {}) => {
      const view = viewOf(list);
      body.querySelector('#kinds-alert').innerHTML = alertHtml(view);
      body.querySelector('#kinds-rates').innerHTML = stats(view.rates.map((r) => ({ label: r.service, value: `${r.perMin} requests/min` })));
      setFeedback(body.querySelector('#kinds-edges'), 'neutral', edgesLine(view.edges, e), { scroll });
    };
    // At 320px the step's first control and its question must be on screen when the How to play card closes, so the
    // view (and on the hunt screen the alert) sort after them (widgets.css; the markup order stays alert, board, view).
    const lastView = () => `<div class="kinds-last">${viewHtml()}</div>`;
    const shell = () => `<div id="kinds-alert"></div>${lastView()}`;

    const stepHunt = () => {
      const rows = waterfall(spans).rows.map((r) => {
        const s = byId.get(r.spanId);
        const parent = s.parentId === null ? null : byId.get(s.parentId);
        const meta = `${chip({ text: s.service, swatch: services.indexOf(s.service) })} ${chip({ text: `${s.startMs} to ${s.endMs} ms` })}` +
          (parent ? ` ${chip({ text: `under ${parent.name}` })}` : '');
        return option({ attr: 'open-span', value: s.spanId, kind: 'line', labelHtml: e(s.name), metaHtml: meta, pressed: false });
      }).join('');
      const board = panel({
        headHtml: stepHead({ step: 1, titleHtml: 'Open the spans' }),
        sections: [options({ id: 'kinds-hunt-spans', itemsHtml: rows })],
      });
      // The span sidebar sits beside the rows from 960px (a nested kit split), under them below.
      const detailHtml = `<div id="kinds-hunt-span" aria-live="polite">${note('Open a span to see its fields. Flag the span you think makes the view wrong. A wrong flag rules that span out and costs one penalty.')}</div>` +
        feedback({ id: 'kinds-hunt-status', bar: true });
      const side = sideColumn({ id: 'kinds-hunt', titleHtml: 'Find the culprit', counts: [{ key: 'wrong', label: '' }], hints: true, ruleHtml: RULE });
      ctx.renderStep(
        step({
          wide: true,
          bodyHtml: `${ctx.speech(
            'You\'re on call. An alert fired for payments, but finance says the card provider billed a charge for every checkout. ' +
              'Open the spans below, read their fields, and flag the span that makes the view wrong. Opening a span is free.',
          )}<div data-kinds-hunt>${split({ mainHtml: `<div id="kinds-alert" class="kinds-late"></div>${split({ mainHtml: board, sideHtml: detailHtml })}${lastView()}`, sideHtml: side })}</div>`,
        }),
        actions({ wide: true, buttonsHtml: nextButton('kinds-next', 'Flag the span behind the alert to continue.') }),
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
      const say = (tone, html) => setFeedback(status, tone, html, { scroll: true });

      const ladder = mountHintLadder(ctx, box, 'kinds-hunt', {
        swirl: playSwirl,
        fallback: () => rowBtns[0],
        wrongNouns: ['wrong flag', 'wrong flags'],
        hint: (tier) => ({ html: `<p>${HINTS[tier - 1]}</p>` }),
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
          label: ruledOut ? 'Ruled out' : hunt.solved ? (s.spanId === culprit ? 'Flagged' : 'Hunt over') : 'Flag this span',
          variant: 'primary',
          disabled: ruledOut || hunt.solved,
        });
        return panel({
          variant: 'inset',
          headHtml: `<h4 id="kinds-hunt-span-title" tabindex="-1">${e(label(s))}</h4>`,
          sections: [
            stats([
              { label: 'Service', value: s.service },
              { label: 'Kind', value: s.kind },
              { label: 'Status', value: s.status },
              { label: 'Parent', value: parent ? label(parent) : 'none (root)' },
              { label: 'Trace ID', value: s.traceId },
            ]),
            Object.keys(s.attributes).length
              ? table({ caption: 'Attributes', head: ['Attribute', 'Value'], rows: Object.entries(s.attributes) })
              : note('No attributes.'),
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
          say('error', `Not quite. <strong>${e(s.name)}</strong> (${e(s.service)}) is not the cause. ${FLAG_WHY[id]} That counts as one penalty.`);
          showSpan(id, { focus: false });
          status.focus();
        } else if (r.outcome === 'right') {
          // (Another outcome never comes from the UI: a ruled-out or solved span's button is disabled.)
          say(
            'success',
            `Right. <strong>${e(s.name)}</strong> handles checkout's call. It was recorded INTERNAL, so nothing counts it as a request ${e(s.service)} handled, and nothing pairs it with checkout's CLIENT span.`,
          );
          showSpan(id, { focus: false });
          next.disabled = false;
          body.querySelector('#kinds-hunt-win-title').textContent = 'Culprit found';
          ladder.succeed();
        }
      };

      rowBtns.forEach((b) => {
        b.onclick = () => showSpan(b.dataset.openSpan, { focus: true });
      });
      next.onclick = stepFix;
      paintRows();
      focusFirst(rowBtns[0], { fallback: status });
    };

    const stepFix = () => {
      const fixStep = CONTENT.steps[1];
      ctx.renderStep(
        step({
          wide: true,
          bodyHtml: `${ctx.speech('Checkout calls payments, so the map should draw checkout → payments, and payments should be back at its usual rate. Each option shows payments\' rate after the change; the map shows once you pick.')}` +
            `${shell()}${question({ id: 'kinds-q', html: fixStep.question })}${choiceHtml(ctx, fixStep.choices, { id: fixStep.id, labelledBy: 'kinds-q' })}`,
        }),
        actions({ wide: true, buttonsHtml: finishButton('kinds-finish', 'Pick the fix to finish the level.') }),
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
          text: 'POST /charge now says it handles the call: the view counts payments\' requests and draws the checkout → payments edge. Backends can derive both from span kind.',
          cards: ['span-kind-edges'],
        });
    };

    stepHunt();
  },
};
