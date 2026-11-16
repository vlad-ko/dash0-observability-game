// Level 2.2: Span kinds, a symptom hunt (the pilot for the Build it redesign, #364). An alert fired
// for payments, finance says the card provider billed charges all hour, and the simulated Dash0 view
// counts no requests for payments and draws no checkout to payments edge. The player opens the spans
// of one checkout, reads their fields and flags the span that makes the view wrong (payments' POST
// /charge, recorded INTERNAL although it handles checkout's call), then picks the change that fixes
// the alert and the map. The view rules are the game's simulation (lib/service-view.mjs).
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
import { flagSpan, newHunt, serviceView, withKind } from '../lib/service-view.mjs';
import { playSwirl } from '../lib/swirl-render.mjs';

const CHECKOUT_TRACE = 'c4e1b2a3d5f60718293a4b5c6d7e8f90';
const STORE_SERVER = '9c8b7a6f5e4d3c2b';
const STORE_CLIENT = '1a2b3c4d5e6f7a8b';
const CHECKOUT = '3a7f5c9e1b2d4f60';
const TOTALS = 'e8b14d2c6a9f0357';
const PAY_CALL = '6c2d8e0f4a1b3957';
const CHARGE = 'b5f3a1c7e9d20486';
const PROVIDER = '0d9e7c5b3a1f8264';

const PER_MIN = 20;
const FINANCE_CHARGES = PER_MIN * 60;

const span = (spanId, service, name, kind, startMs, endMs, parentId, attributes) => ({
  spanId, traceId: CHECKOUT_TRACE, name, service, kind, startMs, endMs, status: 'UNSET', attributes, events: [], parentId, links: [],
});
const server = (route) => ({ 'http.request.method': 'POST', 'http.route': route });
const client = (address) => ({ 'http.request.method': 'POST', 'server.address': address });

const SPANS = [
  span(STORE_SERVER, 'storefront', 'POST /checkout', 'SERVER', 0, 140, null, server('/checkout')),
  span(STORE_CLIENT, 'storefront', 'POST checkout', 'CLIENT', 5, 135, STORE_SERVER, client('checkout')),
  span(CHECKOUT, 'checkout', 'POST /checkout', 'SERVER', 10, 130, STORE_CLIENT, server('/checkout')),
  span(TOTALS, 'checkout', 'compute totals', 'INTERNAL', 15, 25, CHECKOUT, {}),
  span(PAY_CALL, 'checkout', 'POST payments', 'CLIENT', 30, 110, CHECKOUT, client('payments')),
  span(CHARGE, 'payments', 'POST /charge', 'INTERNAL', 35, 105, PAY_CALL, server('/charge')),
  span(PROVIDER, 'payments', 'POST provider/charges', 'CLIENT', 40, 100, CHARGE, client('provider')),
];

const FLAG_WHY = {
  [STORE_SERVER]: 'It handles the incoming request and is recorded SERVER, so storefront is counted correctly. The alert is about payments.',
  [STORE_CLIENT]: 'It is the caller\'s side of the call into checkout, recorded CLIENT, and it pairs with checkout\'s SERVER span.',
  [CHECKOUT]: 'It handles storefront\'s call and is recorded SERVER, so checkout is counted and the storefront to checkout edge draws.',
  [TOTALS]: 'Work inside checkout, not a call between services, so INTERNAL is the right kind.',
  [PAY_CALL]: 'It is checkout\'s call out to payments, recorded CLIENT, which is right for the caller.',
  [PROVIDER]: 'It is payments\' call out to the card provider, recorded CLIENT, which is right. The provider sends no spans of its own, so no edge is expected there.',
};

const FIX = [
  {
    key: 'server',
    label: 'Start <code>POST /charge</code> with kind SERVER',
    right: true,
    why: 'SERVER marks the span that handles an incoming call. The view now counts payments\' requests and pairs the span with checkout\'s CLIENT span, so the edge draws.',
  },
  {
    key: 'client',
    label: 'Start it with kind CLIENT',
    why: 'CLIENT marks the caller\'s side. payments receives this call, so it still counts no requests, and a CLIENT under checkout\'s CLIENT pairs with nothing.',
  },
  {
    key: 'parent',
    label: 'Give it a parent span',
    why: 'It already has one, checkout\'s <code>POST payments</code>. A parent says which span caused which, not which side of the call a span is on.',
  },
  {
    key: 'rename',
    label: 'Rename it to <code>payments.charge</code>',
    why: 'The view reads the kind, not the name. Renamed, it is still INTERNAL.',
  },
];

export const CONTENT = {
  steps: [
    { hunt: { id: 'kinds-hunt', spans: SPANS, culprit: CHARGE, perMin: PER_MIN, watch: 'payments' } },
    { id: 'kinds-fix', question: 'Which change fixes the alert and the map?', choices: FIX },
  ],
};

const RULE = ruleText({
  costs: 'a wrong flag, a hint',
  free: 'Opening a span is free.',
});

const HINTS = [
  'The alert counts requests a service handled. Which span kind marks the handling side of a call?',
  'Compare the payments spans with checkout\'s. checkout\'s handler is SERVER. What is payments\'?',
  'Flag <code>POST /charge</code> in payments: it handles checkout\'s call but is INTERNAL.',
];

const edgesLine = (edges, e) => {
  const list = edges.map((x) => `${e(x.from)} → ${e(x.to)}`);
  return `Map edges: ${list.length ? list.join(', ') : 'none'}.`;
};

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
    const { spans, culprit, perMin, watch } = CONTENT.steps[0].hunt;
    const byId = new Map(spans.map((s) => [s.spanId, s]));
    const services = [...new Set(spans.map((s) => s.service))];
    const label = (s) => `${s.name} (${s.service})`;

    const alertHtml = (view) => {
      const firing = view.firing === true;
      const hourly = FINANCE_CHARGES.toLocaleString('en-US');
      const text = firing
        ? `By this view's count, ${e(watch)} handled no requests in the last 60 minutes. Finance: the card provider billed ${hourly} charges in the same hour.`
        : `The view now counts ${e(watch)}'s requests, in line with finance: the card provider billed ${hourly} charges in the hour.`;
      return panel({
        variant: firing ? 'alert' : undefined,
        headHtml: `${eyebrow(firing ? 'Firing' : 'Resolved')}<h3 id="kinds-alert-title">${e(watch)}: ${view.watched ?? 'no data'} requests/min</h3>`,
        sections: [`<p id="kinds-alert-text">${text}</p>`],
      });
    };

    const viewHtml = () => panel({
      id: 'kinds-view',
      headHtml: chip({ text: 'Simulated Dash0 view', tone: 'attention' }),
      sections: [
        `<div id="kinds-rates"></div>`,
        feedback({ id: 'kinds-edges' }),
        note('This simulated view counts a service\'s requests from its SERVER spans and draws an edge from a CLIENT span to its SERVER child in another service. Backends derive both from span kind.'),
      ],
    });

    const drawView = (list, { scroll = false } = {}) => {
      const view = serviceView(list, { perMin, watch });
      body.querySelector('#kinds-alert').innerHTML = alertHtml(view);
      body.querySelector('#kinds-rates').innerHTML = stats(view.rates.map((r) => ({ label: r.service, value: `${r.perMin} requests/min` })));
      setFeedback(body.querySelector('#kinds-edges'), 'neutral', edgesLine(view.edges, e), { scroll });
    };
    const shell = () => `<div id="kinds-alert"></div>${viewHtml()}`;

    const stepHunt = () => {
      const rows = waterfall(spans).rows.map((r) => {
        const s = byId.get(r.spanId);
        const parent = s.parentId === null ? null : byId.get(s.parentId);
        const meta = `${chip({ text: s.service, swatch: services.indexOf(s.service) })} ${chip({ text: `${s.startMs} to ${s.endMs} ms` })}` +
          (parent ? ` ${chip({ text: `under ${parent.name}` })}` : '');
        return option({ attr: 'open-span', value: s.spanId, kind: 'line', labelHtml: e(s.name), metaHtml: meta, pressed: false });
      }).join('');
      const board = panel({
        headHtml: stepHead({ step: 1, titleHtml: 'Open the spans', noteHtml: 'Every checkout this hour looks like this trace. Opening a span is free.' }),
        sections: [
          options({ id: 'kinds-hunt-spans', itemsHtml: rows }),
          `<div id="kinds-hunt-span" aria-live="polite">${note('Open a span to see its fields.')}</div>` + feedback({ id: 'kinds-hunt-status', bar: true }),
        ],
      });
      const side = sideColumn({ id: 'kinds-hunt', titleHtml: 'Culprit found', counts: [{ key: 'wrong', label: '' }], hints: true, ruleHtml: RULE });
      ctx.renderStep(
        step({
          wide: true,
          bodyHtml: `${ctx.speech(
            'You\'re on call. An alert fired for payments, but finance says the card provider billed charges all hour. ' +
              'Open the spans of a recent checkout, read their fields, and flag the span that makes the view wrong.',
          )}<div data-kinds-hunt>${split({ mainHtml: shell() + board, sideHtml: side })}</div>`,
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
          label: ruledOut ? 'Ruled out' : hunt.solved && s.spanId === culprit ? 'Flagged' : 'Flag this span',
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
        } else if (r.outcome === 'repeat') {
          say('neutral', 'You already ruled that span out. Nothing new was counted.');
          status.focus();
        } else if (r.outcome === 'right') {
          say(
            'success',
            `Right. <strong>${e(s.name)}</strong> handles checkout's call, but it was recorded INTERNAL, so nothing counts it as a request ${e(s.service)} handled and nothing pairs it with checkout's CLIENT span.`,
          );
          showSpan(id, { focus: false });
          next.disabled = false;
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
          bodyHtml: `${ctx.speech('<code>POST /charge</code> is started without a kind, and spans are INTERNAL unless the code gives one.')}` +
            `${shell()}${question({ id: 'kinds-q', html: fixStep.question })}${choiceHtml(ctx, fixStep.choices, { id: fixStep.id, labelledBy: 'kinds-q' })}`,
        }),
        actions({ wide: true, buttonsHtml: finishButton('kinds-finish', 'Pick the fix to finish the level.') }),
      );
      drawView(spans);
      const finish = bar.querySelector('#kinds-finish');
      mountChoice(ctx, fixStep.choices, {
        id: fixStep.id,
        onRight: () => {
          drawView(withKind(spans, culprit, 'SERVER'));
          finish.disabled = false;
          return finish;
        },
      });
      finish.onclick = () =>
        ctx.finish({
          text: 'POST /charge now says it handles the call: the view counts payments\' requests and draws the checkout → payments edge. Backends derive both from span kind.',
          cards: ['span-kind-edges'],
        });
    };

    stepHunt();
  },
};
