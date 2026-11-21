// Level 0.2: The signals. The player sorts telemetry, then questions, into metric, log,
// trace and profile, and names the newest, still-maturing signal (profiles: spec Alpha,
// OTLP Development, checked 2026-10-30). Spec: docs/M1-DESIGN.md §6 Act 0.
// Spec: https://opentelemetry.io/docs/concepts/signals/profiles/
//
// A run(ctx) level: its words are in content/core/levels/the-signals.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the answers and the screens.
import CORE from '../content/core/levels/the-signals.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { actions, finishButton, nextButton, question, step } from '../lib/ui/index.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { mountSort, renderSort } from '../lib/widgets/sort-it-view.mjs';
import { newSortState } from '../lib/widgets/sort-it.mjs';

// This level's copy has no figures a grader computes over and no values only the code knows: no fill-ins.
const VARS = {};
const SLOTS = [];
// The run entries that are prose and may mark glossary terms (docs/CONTENT.md section 5.1). Drawn through ctx.renderStep.
export const TERMS = ['dataIntro'];
const BIND = { vars: VARS, slots: SLOTS, terms: TERMS };

// The four buckets both sorts share (their labels are the content's `signals`).
const SIGNALS = [{ id: 'metric' }, { id: 'log' }, { id: 'trace' }, { id: 'profile' }];

const SKELETON = {
  id: 'the-signals',
  no: '0.2',
  icon: '\u{1F4E1}',
  mechanics: ['sort'],
  widgets: ['sort', 'choice'],
  cards: ['profiles-signal'],
  lights: [],
  scoring: { parMs: null },
  run: {
    signals: SIGNALS,
    // Step 1: telemetry. Items do not follow the bucket order.
    data: {
      id: 'sig-data',
      helps: { hints: true },
      items: [
        { id: 'duration', bucket: 'metric' },
        { id: 'declined', bucket: 'log' },
        { id: 'stacks', bucket: 'profile' },
        { id: 'cpu-time', bucket: 'metric' },
        { id: 'checkout-span', bucket: 'trace' },
      ],
    },
    // Step 2: questions, each best answered by one signal.
    ask: {
      id: 'sig-ask',
      helps: { hints: true },
      items: [
        { id: 'rps', bucket: 'metric' },
        { id: 'provider', bucket: 'log' },
        { id: 'cpu-fn', bucket: 'profile' },
        { id: 'slow-call', bucket: 'trace' },
      ],
    },
    // Step 3: the newest signal. `why` follows "Right." or "Not quite.".
    newest: [{ key: 'profiles', right: true }],
  },
};

/** The level's answer tables, in play order (pinned by test/act-0.test.mjs), from the bound words `say`. Both sorts share the buckets. */
const contentOf = (say) => ({
  steps: [
    { sort: { ...say.data, buckets: say.signals } },
    { sort: { ...say.ask, buckets: say.signals } },
    { id: 'sig', choices: say.newest },
  ],
});
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, BIND).run);

function screens(ctx, say) {
  const bar = ctx.ovActions;
  const [{ sort: DATA }, { sort: ASK }, { choices: NEWEST }] = contentOf(say).steps; // the same tables CONTENT holds
  const next = () => bar.querySelector('#sig-next');
  const unlock = (btn) => () => {
    btn.disabled = false;
    return btn;
  };

  const sortStep = (spec, intro, questionHtml, then) => {
    ctx.renderStep(
      step({
        wide: true,
        bodyHtml: `${ctx.speech(intro)}${question({ id: `${spec.id}-q`, html: questionHtml })}${renderSort(spec, newSortState(spec), { escapeHtml: ctx.escapeHtml, labelledBy: `${spec.id}-q` })}`,
      }),
      actions({ wide: true, buttonsHtml: nextButton('sig-next', say.sortReason) }),
    );
    mountSort(ctx, spec, { onComplete: unlock(next()) });
    next().onclick = then;
  };

  const stepData = () => sortStep(DATA, say.dataIntro, say.dataQuestion, stepAsk);

  const stepAsk = () => sortStep(ASK, say.askIntro, say.askQuestion, stepNewest);

  const stepNewest = () => {
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.newestIntro)}${question({ id: 'sig-q-new', html: say.newestQuestion })}${choiceHtml(ctx, NEWEST, { id: 'sig', labelledBy: 'sig-q-new' })}`,
      }),
      actions({ wide: false, buttonsHtml: finishButton('sig-finish', say.newestReason) }),
    );
    const finish = bar.querySelector('#sig-finish');
    mountChoice(ctx, NEWEST, { id: 'sig', onRight: unlock(finish) });
    finish.onclick = () =>
      ctx.finish({
        text: say.finish,
        cards: ['profiles-signal'],
      });
  };

  stepData();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { ...BIND, screens });
}

export default withText(CORE);
