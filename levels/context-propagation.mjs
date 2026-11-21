// Level 2.4: Context propagation. A checkout request shows up as two traces. The player
// reads the hop headers and finds the nginx proxy that drops `traceparent`, picks the one
// header a receiver would accept, then joins checkout's SERVER span to the parent its
// header names. Spec: docs/M1-DESIGN.md §6 Act 2.
// Spec: https://www.w3.org/TR/trace-context/#traceparent-header
//
// A run(ctx) level: its words are in content/core/levels/context-propagation.mjs (docs/CONTENT.md section 11), read here
// as say.<name>; this file keeps the answers, the hop and span fixtures and the screens.
import CORE from '../content/core/levels/context-propagation.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { fillSlots } from '../lib/content/placeholders.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { mountBuild, renderBuild } from '../lib/widgets/build-it-view.mjs';
import { newBuildState } from '../lib/widgets/build-it.mjs';
import { actions, finishButton, nextButton, prose, question, step } from '../lib/ui/index.mjs';

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736';
const NEW_TRACE = '7f3a9c1e5b2d4f6a8c0e2b4d6f8a1c3e';
const STORE = 'e457b5a2e4d86bd1';
const CALL = '00f067aa0ba902b7';
const CHECKOUT = '6e0c63257de34c92';
const ORDERS_CALL = 'b9c7c989f97918e1';
const ORDERS = '4a5b6c7d8e9f0a1b';
const TRACEPARENT = `00-${TRACE}-${CALL}-01`;

const span = (spanId, service, name, kind, startMs, endMs, parentId) => ({
  spanId, traceId: TRACE, name, service, kind, startMs, endMs, status: 'UNSET',
  attributes: {}, events: [], parentId, links: [],
});

// Step 1: the headers on each hop of one request (data text, escaped when shown), and the
// two root spans the backend shows for it.
const HOPS = [
  { from: 'storefront', to: 'nginx', traceparent: TRACEPARENT },
  { from: 'nginx', to: 'checkout', traceparent: null },
];
const ROOTS = [
  { traceId: TRACE, service: 'storefront', name: 'POST /checkout' },
  { traceId: NEW_TRACE, service: 'checkout', name: 'POST /checkout' },
];

// The valid header the copy quotes (a figure); the hop, root and header values the screens show are slots, known only to the code.
const VARS = { 'valid-traceparent': TRACEPARENT };
const SLOTS = ['from', 'to', 'header', 'name', 'service', 'trace'];
// The run entries that are prose and may mark glossary terms (docs/CONTENT.md section 5.1). Drawn through ctx.speech.
export const TERMS = ['whereIntro'];
const BIND = { vars: VARS, slots: SLOTS, terms: TERMS };

// Step 3: nginx now forwards the header, so checkout's spans carry trace 4bf9..., but its
// SERVER span still arrives as a root. The answer gives it the parent the parent-id names.
// Help ladder (docs/M1-DESIGN.md §4.2): no queue, guide or tint, a Check button, hints on.
const TREE = {
  id: 'prop-tree',
  spans: [
    span(STORE, 'storefront', 'POST /checkout', 'SERVER', 0, 100, null),
    span(CALL, 'storefront', 'POST checkout', 'CLIENT', 10, 90, STORE),
    span(CHECKOUT, 'checkout', 'POST /checkout', 'SERVER', 15, 85, null),
    span(ORDERS_CALL, 'checkout', 'POST orders', 'CLIENT', 30, 60, CHECKOUT),
    span(ORDERS, 'orders', 'POST /orders', 'SERVER', 32, 58, ORDERS_CALL),
  ],
  edit: ['parent'],
  answer: { [CHECKOUT]: { parentId: CALL } },
  helps: { hints: true },
};

const SKELETON = {
  id: 'context-propagation',
  no: '2.4',
  icon: '\u{1F517}',
  mechanics: ['build'],
  widgets: ['choice', 'build'],
  cards: ['broken-propagation'],
  lights: ['orders'],
  scoring: { parMs: null },
  run: {
    // Step 1: `why` follows "Right." or "Not quite.".
    where: [{ key: 'proxy', right: true }],
    // Step 2: the traceparent format. Labels are authored constants.
    valid: [{ key: 'valid', right: true }],
  },
};

/** The level's answer tables, in play order (pinned by test/act-2.test.mjs), from the bound words `say`. */
const contentOf = (say) => ({
  steps: [
    { id: 'prop', question: say.whereQuestion, choices: say.where, hops: HOPS, roots: ROOTS },
    { id: 'prop-tp', question: say.validQuestion, choices: say.valid },
    { build: TREE },
  ],
});
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, BIND).run);

function screens(ctx, say) {
  const bar = ctx.ovActions;
  const e = ctx.escapeHtml;
  const [{ choices: WHERE }, { choices: VALID }] = contentOf(say).steps; // the same tables CONTENT holds
  const next = (onclick) => {
    const btn = bar.querySelector('#prop-next');
    btn.onclick = onclick;
    return btn;
  };

  const stepWhere = () => {
    const hops = HOPS.map(
      (h) =>
        `<li>${
          h.traceparent
            ? fillSlots(say.hopWith, { from: e(h.from), to: e(h.to), header: e(h.traceparent) })
            : fillSlots(say.hopWithout, { from: e(h.from), to: e(h.to) })
        }</li>`,
    ).join('');
    const roots = ROOTS.map(
      (r) => `<li>${fillSlots(say.rootLine, { name: e(r.name), service: e(r.service), trace: e(r.traceId.slice(0, 8)) })}</li>`,
    ).join('');
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.whereIntro)}${prose(`${say.whereHopsTitle}<ul>${hops}</ul>${say.whereRootsTitle}<ul>${roots}</ul>`)}${question({ id: 'prop-q-where', html: say.whereQuestion })}${choiceHtml(ctx, WHERE, { id: 'prop', labelledBy: 'prop-q-where' })}`,
      }),
      actions({ wide: false, buttonsHtml: nextButton('prop-next', say.whereReason) }),
    );
    const btn = next(stepValid);
    mountChoice(ctx, WHERE, {
      id: 'prop',
      onRight: () => {
        btn.disabled = false;
        return btn;
      },
    });
  };

  const stepValid = () => {
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.validIntro)}${question({ id: 'prop-q-tp', html: say.validQuestion })}${choiceHtml(ctx, VALID, { id: 'prop-tp', labelledBy: 'prop-q-tp' })}`,
      }),
      actions({ wide: false, buttonsHtml: nextButton('prop-next', say.validReason) }),
    );
    const btn = next(stepTree);
    mountChoice(ctx, VALID, {
      id: 'prop-tp',
      onRight: () => {
        btn.disabled = false;
        return btn;
      },
    });
  };

  const stepTree = () => {
    ctx.renderStep(
      step({
        wide: true,
        bodyHtml: `${ctx.speech(fillSlots(say.treeIntro, { header: e(TRACEPARENT) }))}${question({ html: say.treeQuestion })}${renderBuild(TREE, newBuildState(TREE), { escapeHtml: e })}`,
      }),
      actions({ wide: true, buttonsHtml: finishButton('prop-finish', say.treeReason) }),
    );
    const finish = bar.querySelector('#prop-finish');
    mountBuild(ctx, TREE, {
      onComplete: () => {
        finish.disabled = false;
        return finish;
      },
    });
    finish.onclick = () =>
      ctx.finish({
        text: say.finish,
        cards: ['broken-propagation'],
      });
  };

  stepWhere();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { ...BIND, screens });
}

export default withText(CORE);
