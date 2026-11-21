// Level 2.3: Status and errors. Five spans from one shop, each with an HTTP code and the
// status its instrumentation set; the player sorts the right statuses from the wrong ones
// (a 4xx is Error only on the CLIENT span, a 5xx is Error on either span), then says what Ok followed by Error leaves.
// Spec: docs/M1-DESIGN.md §6 Act 2.
// Spec: https://opentelemetry.io/docs/specs/semconv/http/http-spans/#status , https://opentelemetry.io/docs/specs/otel/trace/api/#set-status
//
// A run(ctx) level: its words are in content/core/levels/status-and-errors.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the answers and the screens.
import CORE from '../content/core/levels/status-and-errors.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { actions, finishButton, nextButton, question, step } from '../lib/ui/index.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { mountSort, renderSort } from '../lib/widgets/sort-it-view.mjs';
import { newSortState } from '../lib/widgets/sort-it.mjs';

// This level's copy has no figures a grader computes over and no values only the code knows: no fill-ins.
const VARS = {};
const SLOTS = [];
// The run entries that are prose and may mark glossary terms (docs/CONTENT.md section 5.1). Drawn through ctx.speech.
export const TERMS = ['sortIntro'];
const BIND = { vars: VARS, slots: SLOTS, terms: TERMS };

const SKELETON = {
  id: 'status-and-errors',
  no: '2.3',
  icon: '\u{1F6A6}',
  mechanics: ['sort'],
  widgets: ['sort', 'choice'],
  cards: ['span-status'],
  lights: ['catalog'],
  scoring: { parMs: null },
  run: {
    // Step 1. a and b are the two sides of one call: storefront asks catalog for a product
    // that does not exist.
    sort: {
      id: 'status-sort',
      helps: { hints: true },
      buckets: [{ id: 'ok' }, { id: 'wrong' }],
      items: [
        { id: 'a', bucket: 'ok' },
        { id: 'b', bucket: 'wrong' },
        { id: 'c', bucket: 'wrong' },
        { id: 'd', bucket: 'ok' },
        { id: 'e', bucket: 'ok' },
      ],
    },
    // Step 2: Ok, then Error, on one span. `why` follows "Right." or "Not quite.".
    okThenError: [{ key: 'stays-ok', right: true }],
  },
};

/** The level's answer tables, in play order (pinned by test/act-2.test.mjs), from the bound words `say`. */
const contentOf = (say) => ({
  steps: [{ sort: say.sort }, { id: 'status', choices: say.okThenError }],
});
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, BIND).run);

function screens(ctx, say) {
  const bar = ctx.ovActions;
  const [{ sort: SORT }, { choices: OK_THEN_ERROR }] = contentOf(say).steps; // the same tables CONTENT holds

  const stepSort = () => {
    ctx.renderStep(
      step({
        wide: true,
        bodyHtml: `${ctx.speech(say.sortIntro)}${question({ id: 'status-q-sort', html: say.sortQuestion })}${renderSort(SORT, newSortState(SORT), { escapeHtml: ctx.escapeHtml, labelledBy: 'status-q-sort' })}`,
      }),
      actions({ wide: true, buttonsHtml: nextButton('status-next', say.sortReason) }),
    );
    const next = bar.querySelector('#status-next');
    mountSort(ctx, SORT, {
      onComplete: () => {
        next.disabled = false;
        return next;
      },
    });
    next.onclick = stepOkThenError;
  };

  const stepOkThenError = () => {
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.okThenErrorIntro)}${question({ id: 'status-q-final', html: say.okThenErrorQuestion })}${choiceHtml(ctx, OK_THEN_ERROR, { id: 'status', labelledBy: 'status-q-final' })}`,
      }),
      actions({ wide: false, buttonsHtml: finishButton('status-finish', say.okThenErrorReason) }),
    );
    const finish = bar.querySelector('#status-finish');
    mountChoice(ctx, OK_THEN_ERROR, {
      id: 'status',
      onRight: () => {
        finish.disabled = false;
        return finish;
      },
    });
    finish.onclick = () =>
      ctx.finish({
        text: say.finish,
        cards: ['span-status'],
      });
  };

  stepSort();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { ...BIND, screens });
}

export default withText(CORE);
