// Level 0.1: Monitoring vs observability. Day one on call: the player sorts questions
// into the ones a dashboard was built for and the new ones nobody planned, then names
// what makes the new kind answerable. Spec: docs/M1-DESIGN.md §6 Act 0.
// Spec: https://opentelemetry.io/docs/concepts/observability-primer/#what-is-observability
//
// A run(ctx) level: its words are in content/core/levels/monitoring-vs-observability.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the answers and the screens.
import CORE from '../content/core/levels/monitoring-vs-observability.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { actions, finishButton, nextButton, question, step } from '../lib/ui/index.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { mountSort, renderSort } from '../lib/widgets/sort-it-view.mjs';
import { newSortState } from '../lib/widgets/sort-it.mjs';

// This level's copy has no figures a grader computes over and no values only the code knows: no fill-ins.
const VARS = {};
const SLOTS = [];
// The run entries that are prose and may mark glossary terms (docs/CONTENT.md section 5.1). Drawn through ctx.renderStep.
export const TERMS = ['answerableIntro'];
const BIND = { vars: VARS, slots: SLOTS, terms: TERMS };

const SKELETON = {
  id: 'monitoring-vs-observability',
  no: '0.1',
  icon: '\u{1F52D}',
  mechanics: ['sort'],
  widgets: ['sort', 'choice'],
  cards: [],
  lights: [],
  scoring: { parMs: null },
  run: {
    // Step 1. Label wording must not give the bucket away (test/sort-tells.test.mjs).
    sort: {
      id: 'mvo-sort',
      helps: { hints: true },
      buckets: [{ id: 'known' }, { id: 'new' }],
      items: [
        { id: 'cpu', bucket: 'known' },
        { id: 'ios', bucket: 'new' },
        { id: '5xx', bucket: 'known' },
        { id: 'cust', bucket: 'new' },
        { id: 'disk', bucket: 'known' },
        { id: 'coupon', bucket: 'new' },
      ],
    },
    // Step 2: what makes the second kind answerable. `why` follows "Right." or "Not quite.".
    answerable: [{ key: 'rich', right: true }],
  },
};

/** The level's answer tables, in play order (pinned by test/act-0.test.mjs), from the bound words `say`. */
const contentOf = (say) => ({
  steps: [{ sort: say.sort }, { id: 'mvo', choices: say.answerable }],
});
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, BIND).run);

function screens(ctx, say) {
  const bar = ctx.ovActions;
  const [{ sort: SORT }, { choices: ANSWERABLE }] = contentOf(say).steps; // the same tables CONTENT holds

  const stepSort = () => {
    ctx.renderStep(
      step({
        surface: 'game',
        wide: true,
        bodyHtml: `${ctx.speech(say.sortIntro)}${question({ id: 'mvo-q-sort', html: say.sortQuestion })}${renderSort(SORT, newSortState(SORT), { escapeHtml: ctx.escapeHtml, labelledBy: 'mvo-q-sort' })}`,
      }),
      actions({ wide: true, buttonsHtml: nextButton('mvo-next', say.sortReason) }),
    );
    const next = bar.querySelector('#mvo-next');
    mountSort(ctx, SORT, {
      onComplete: () => {
        next.disabled = false;
        return next;
      },
    });
    next.onclick = stepAnswerable;
  };

  const stepAnswerable = () => {
    ctx.renderStep(
      step({
        surface: 'game',
        wide: false,
        bodyHtml: `${ctx.speech(say.answerableIntro)}${question({ id: 'mvo-q-why', html: say.answerableQuestion })}${choiceHtml(ctx, ANSWERABLE, { id: 'mvo', labelledBy: 'mvo-q-why' })}`,
      }),
      actions({ wide: false, buttonsHtml: finishButton('mvo-finish', say.answerableReason) }),
    );
    const finish = bar.querySelector('#mvo-finish');
    mountChoice(ctx, ANSWERABLE, {
      id: 'mvo',
      onRight: () => {
        finish.disabled = false;
        return finish;
      },
    });
    finish.onclick = () =>
      ctx.finish({
        text: say.finish,
        cards: [],
      });
  };

  stepSort();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { ...BIND, screens });
}

export default withText(CORE);
