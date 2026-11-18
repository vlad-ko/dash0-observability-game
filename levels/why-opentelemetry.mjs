// Level 0.3: Why OpenTelemetry. The player sorts the parts of OTel (API, SDK, OTLP,
// Collector, semantic conventions), then picks what a shared library depends on: only
// the API, a no-op until the application installs an SDK. Spec: docs/M1-DESIGN.md §6 Act 0.
// Spec: https://opentelemetry.io/docs/concepts/instrumentation/libraries/#opentelemetry-api
// Docs (package names in the options: `@opentelemetry/sdk-node` and the OTLP HTTP trace exporter `@opentelemetry/exporter-trace-otlp-http`): https://opentelemetry.io/docs/languages/js/getting-started/nodejs/ , https://opentelemetry.io/docs/languages/js/exporters/ , https://opentelemetry.io/docs/languages/sdk-configuration/general/
//
// A run(ctx) level: its words are in content/core/levels/why-opentelemetry.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the answers and the screens.
import CORE from '../content/core/levels/why-opentelemetry.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { actions, finishButton, nextButton, question, step } from '../lib/ui/index.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { mountSort, renderSort } from '../lib/widgets/sort-it-view.mjs';
import { newSortState } from '../lib/widgets/sort-it.mjs';

// This level's copy has no figures a grader computes over and no values only the code knows: no fill-ins.
const VARS = {};
const SLOTS = [];

const SKELETON = {
  id: 'why-opentelemetry',
  no: '0.3',
  icon: '\u{1F9E9}',
  mechanics: ['sort'],
  widgets: ['sort', 'choice'],
  cards: ['api-vs-sdk'],
  lights: [],
  scoring: { parMs: null },
  run: {
    // Step 1. Items do not follow the bucket order.
    parts: {
      id: 'otel-parts',
      helps: { hints: true },
      buckets: [{ id: 'api' }, { id: 'sdk' }, { id: 'otlp' }, { id: 'collector' }, { id: 'semconv' }],
      items: [
        { id: 'wire', bucket: 'otlp' },
        { id: 'start-span', bucket: 'api' },
        { id: 'method', bucket: 'semconv' },
        { id: 'pipeline', bucket: 'collector' },
        { id: 'batch', bucket: 'sdk' },
      ],
    },
    // Step 2: what a shared library depends on. `why` follows "Right." or "Not quite.".
    dependsOn: [{ key: 'api', right: true }],
  },
};

/** The level's answer tables, in play order (pinned by test/act-0.test.mjs), from the bound words `say`. */
const contentOf = (say) => ({
  steps: [{ sort: say.parts }, { id: 'otel', choices: say.dependsOn }],
});
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, { vars: VARS, slots: SLOTS }).run);

function screens(ctx, say) {
  const bar = ctx.ovActions;
  const [{ sort: PARTS }, { choices: DEPENDS_ON }] = contentOf(say).steps; // the same tables CONTENT holds

  const stepParts = () => {
    ctx.renderStep(
      step({
        wide: true,
        bodyHtml: `${ctx.speech(say.partsIntro)}${question({ id: 'otel-q-parts', html: say.partsQuestion })}${renderSort(PARTS, newSortState(PARTS), { escapeHtml: ctx.escapeHtml, labelledBy: 'otel-q-parts' })}`,
      }),
      actions({ wide: true, buttonsHtml: nextButton('otel-next', say.partsReason) }),
    );
    const next = bar.querySelector('#otel-next');
    mountSort(ctx, PARTS, {
      onComplete: () => {
        next.disabled = false;
        return next;
      },
    });
    next.onclick = stepDependsOn;
  };

  const stepDependsOn = () => {
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.dependsOnIntro)}${question({ id: 'otel-q-dep', html: say.dependsOnQuestion })}${choiceHtml(ctx, DEPENDS_ON, { id: 'otel', labelledBy: 'otel-q-dep' })}`,
      }),
      actions({ wide: false, buttonsHtml: finishButton('otel-finish', say.dependsOnReason) }),
    );
    const finish = bar.querySelector('#otel-finish');
    mountChoice(ctx, DEPENDS_ON, {
      id: 'otel',
      onRight: () => {
        finish.disabled = false;
        return finish;
      },
    });
    finish.onclick = () =>
      ctx.finish({
        text: say.finish,
        cards: ['api-vs-sdk'],
      });
  };

  stepParts();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { vars: VARS, slots: SLOTS, screens });
}

export default withText(CORE);
