// Level 2.5: Baggage. Storefront wants to put entries in baggage; the player sorts what
// may travel with every request from what never should, then says whether a downstream
// service's spans carry a baggage entry on their own.
// Spec: docs/M1-DESIGN.md §6 Act 2.
// Spec: https://opentelemetry.io/docs/concepts/signals/baggage/ , https://www.w3.org/TR/baggage/
//
// A run(ctx) level: its words are in content/core/levels/baggage.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the answers and the screens.
import CORE from '../content/core/levels/baggage.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { actions, finishButton, nextButton, question, step } from '../lib/ui/index.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { mountSort, renderSort } from '../lib/widgets/sort-it-view.mjs';
import { newSortState } from '../lib/widgets/sort-it.mjs';

// This level's copy has no figures a grader computes over and no values only the code knows: no fill-ins.
const VARS = {};
const SLOTS = [];

const SKELETON = {
  id: 'baggage',
  no: '2.5',
  icon: '\u{1F9F3}',
  mechanics: ['sort'],
  hintless: ['sort'], // its one sort has helps.hints off: no Hint button
  widgets: ['sort', 'choice'],
  cards: ['baggage-leaks'],
  lights: [],
  scoring: { parMs: null },
  run: {
    // Step 1. Label wording must not give the bucket away (test/sort-tells.test.mjs).
    sort: {
      id: 'bag-sort',
      helps: { hints: false },
      buckets: [{ id: 'ok' }, { id: 'never' }],
      items: [
        { id: 'variant', bucket: 'ok' },
        { id: 'email', bucket: 'never' },
        { id: 'tier', bucket: 'ok' },
        { id: 'token', bucket: 'never' },
        { id: 'last4', bucket: 'never' },
      ],
    },
    // Step 2: does baggage reach a downstream service's spans? `why` follows "Right." or "Not quite.".
    onSpans: [{ key: 'only-if-copied', right: true }],
  },
};

/** The level's answer tables, in play order (pinned by test/act-2.test.mjs), from the bound words `say`. */
const contentOf = (say) => ({
  steps: [{ sort: say.sort }, { id: 'bag', choices: say.onSpans }],
});
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, { vars: VARS, slots: SLOTS }).run);

function screens(ctx, say) {
  const bar = ctx.ovActions;
  const [{ sort: SORT }, { choices: ON_SPANS }] = contentOf(say).steps; // the same tables CONTENT holds

  const stepSort = () => {
    ctx.renderStep(
      step({
        wide: true,
        bodyHtml: `${ctx.speech(say.sortIntro)}${question({ id: 'bag-q-sort', html: say.sortQuestion })}${renderSort(SORT, newSortState(SORT), { escapeHtml: ctx.escapeHtml, labelledBy: 'bag-q-sort' })}`,
      }),
      actions({ wide: true, buttonsHtml: nextButton('bag-next', say.sortReason) }),
    );
    const next = bar.querySelector('#bag-next');
    mountSort(ctx, SORT, {
      onComplete: () => {
        next.disabled = false;
        return next;
      },
    });
    next.onclick = stepOnSpans;
  };

  const stepOnSpans = () => {
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.onSpansIntro)}${question({ id: 'bag-q-spans', html: say.onSpansQuestion })}${choiceHtml(ctx, ON_SPANS, { id: 'bag', labelledBy: 'bag-q-spans' })}`,
      }),
      actions({ wide: false, buttonsHtml: finishButton('bag-finish', say.onSpansReason) }),
    );
    const finish = bar.querySelector('#bag-finish');
    mountChoice(ctx, ON_SPANS, {
      id: 'bag',
      onRight: () => {
        finish.disabled = false;
        return finish;
      },
    });
    finish.onclick = () =>
      ctx.finish({
        text: say.finish,
        cards: ['baggage-leaks'],
      });
  };

  stepSort();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { vars: VARS, slots: SLOTS, screens });
}

export default withText(CORE);
