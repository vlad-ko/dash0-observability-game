// Level 2.1: Spans and traces. The player names what makes spans one trace (a shared trace
// ID, not a trace object), rebuilds one request's span tree in Build it, and explains the
// overlapping span that stays a root: it is another request. Its trace is fixture B1
// (test/fixtures/build-b1.mjs reuses TREE). Spec: docs/M1-DESIGN.md §6 Act 2.
// Spec: https://opentelemetry.io/docs/specs/otel/overview/#traces , https://opentelemetry.io/docs/specs/otel/trace/sdk/#span-processor
// Spec: https://opentelemetry.io/docs/specs/semconv/http/http-spans/ (span B: an HTTP client span is named "{method} {target}"
// only when a low-cardinality target such as url.template is available, else "{method}"; storefront's call names no
// template, so it is "POST", not "POST api-gateway". No other span here is named POST, so labels stay distinct, #69.)
//
// A run(ctx) level: its words are in content/core/levels/spans-and-traces.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the answers, the span fixtures and the screens.
import CORE from '../content/core/levels/spans-and-traces.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { fillSlots } from '../lib/content/placeholders.mjs';
import { actions, finishButton, nextButton, question, step } from '../lib/ui/index.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { mountBuild, renderBuild } from '../lib/widgets/build-it-view.mjs';
import { buildReason } from '../lib/widgets/build-it-help.mjs';
import { newBuildState } from '../lib/widgets/build-it.mjs';

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736';
const OTHER_TRACE = '0af7651916cd43dd8448eb211c80319c';
const A = '00f067aa0ba902b7';
const B = 'b7ad6b7169203331';
const C = '53995c3f42cd8ad8';
const D = '1d5c3a2f8e4b6a90';
const E = '9e1f2a3b4c5d6e7f';

const span = (spanId, traceId, service, name, kind, startMs, endMs) => ({
  spanId, traceId, name, service, kind, startMs, endMs, status: 'UNSET',
  attributes: {}, events: [], parentId: null, links: [],
});

// This level's copy has no figures a grader computes over: no fill-ins. The one slot is the Build it widget's own reason.
const VARS = {};
const SLOTS = ['reason'];

// Step 2: the spans arrive one at a time in start order (the queue), A already placed; the
// answer gives B, C and D their parents. E overlaps C in time on purpose: parenting it there
// is a cross-trace parent. Every help is on (docs/M1-DESIGN.md §4.2, the help ladder).
const TREE = {
  id: 'sat-tree',
  spans: [
    span(A, TRACE, 'storefront', 'POST /checkout', 'SERVER', 0, 100),
    span(B, TRACE, 'storefront', 'POST', 'CLIENT', 10, 90),
    span(C, TRACE, 'api-gateway', 'POST /checkout', 'SERVER', 15, 85),
    span(D, TRACE, 'api-gateway', 'validate cart', 'INTERNAL', 20, 30),
    span(E, OTHER_TRACE, 'storefront', 'GET /products', 'SERVER', 40, 60),
  ],
  edit: ['parent'],
  answer: { [B]: { parentId: A }, [C]: { parentId: B }, [D]: { parentId: C } },
  helps: { queue: true, tint: true, guide: true, instant: true, hints: true },
};

const SKELETON = {
  id: 'spans-and-traces',
  no: '2.1',
  icon: '\u{1F9F5}',
  mechanics: ['build'],
  widgets: ['choice', 'build'],
  cards: ['no-trace-object'],
  lights: ['storefront', 'api-gateway'],
  scoring: { parMs: null },
  run: {
    // Step 1: what makes these spans one trace. `why` follows "Right." or "Not quite.".
    oneTrace: [{ key: 'trace-id', right: true }],
    tree: TREE,
    // Step 3: the span that stays a root.
    other: [{ key: 'other-request', right: true }],
  },
};

/** The level's answer tables, in play order (pinned by test/act-2.test.mjs), from the bound words `say`. */
const contentOf = (say) => ({
  steps: [
    { id: 'sat', question: say.oneTraceQuestion, choices: say.oneTrace },
    { build: say.tree },
    { id: 'sat-e', choices: say.other },
  ],
});
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, { vars: VARS, slots: SLOTS }).run);

function screens(ctx, say) {
  const bar = ctx.ovActions;
  const [{ choices: ONE_TRACE }, { build: TREE_SPEC }, { choices: OTHER }] = contentOf(say).steps; // the same tables CONTENT holds
  const next = (onclick) => {
    const btn = bar.querySelector('#sat-next');
    btn.onclick = onclick;
    return btn;
  };

  const stepOneTrace = () => {
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.oneTraceIntro)}${question({ id: 'sat-q-one', html: say.oneTraceQuestion })}${choiceHtml(ctx, ONE_TRACE, { id: 'sat', labelledBy: 'sat-q-one' })}`,
      }),
      actions({ wide: false, buttonsHtml: nextButton('sat-next', say.oneTraceReason) }),
    );
    const btn = next(stepTree);
    mountChoice(ctx, ONE_TRACE, {
      id: 'sat',
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
        bodyHtml: `${ctx.speech(say.treeIntro)}${question({ html: say.treeQuestion })}${renderBuild(TREE_SPEC, newBuildState(TREE_SPEC), { escapeHtml: ctx.escapeHtml })}`,
      }),
      actions({ wide: true, buttonsHtml: nextButton('sat-next', fillSlots(say.treeReason, { reason: buildReason(TREE_SPEC) })) }),
    );
    const btn = next(stepOther);
    mountBuild(ctx, TREE_SPEC, {
      onComplete: () => {
        btn.disabled = false;
        return btn;
      },
    });
  };

  const stepOther = () => {
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.otherIntro)}${question({ id: 'sat-q-other', html: say.otherQuestion })}${choiceHtml(ctx, OTHER, { id: 'sat-e', labelledBy: 'sat-q-other' })}`,
      }),
      actions({ wide: false, buttonsHtml: finishButton('sat-finish', say.otherReason) }),
    );
    const finish = bar.querySelector('#sat-finish');
    mountChoice(ctx, OTHER, {
      id: 'sat-e',
      onRight: () => {
        finish.disabled = false;
        return finish;
      },
    });
    finish.onclick = () =>
      ctx.finish({
        text: say.finish,
        cards: ['no-trace-object'],
      });
  };

  stepOneTrace();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { vars: VARS, slots: SLOTS, screens });
}

export default withText(CORE);
