// Level 2.7: Auto vs manual. The player sorts what zero-code instrumentation covers in cart
// from what only their own code adds, finds why each of cart's fetch calls shows two CLIENT
// spans (an injected agent plus a tracing.js NodeSDK), and picks the fix.
// Spec: docs/M1-DESIGN.md §6 Act 2.
// Docs (GitHub README, not an allowed Spec host; it says instrumentation-undici subscribes to diagnostics_channel and does not state that two setups double the spans, so the copy is the scenario, not a general claim): https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/packages/instrumentation-undici/README.md
// Spec: https://opentelemetry.io/docs/zero-code/js/ , https://opentelemetry.io/docs/platforms/kubernetes/operator/automatic/ , https://opentelemetry.io/docs/specs/otel/trace/api/#spankind , https://opentelemetry.io/docs/concepts/signals/traces/
//
// The words are in content/core/levels/auto-vs-manual.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/auto-vs-manual.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 1. Label wording must not give the bucket away (test/sort-tells.test.mjs).
const SORT = {
  id: 'avm-sort',
  helps: { hints: false },
  buckets: [{ id: 'auto' }, { id: 'manual' }],
  items: [
    { id: 'server', bucket: 'auto' },
    { id: 'loyalty', bucket: 'manual' },
    { id: 'redis', bucket: 'auto' },
    { id: 'coupon', bucket: 'manual' },
    { id: 'client', bucket: 'auto' },
    { id: 'item-count', bucket: 'manual' },
  ],
};

// Step 2: why does each fetch call show two CLIENT spans? `why` follows "Right." or "Not quite."; only the right choice is listed here.
const WHY = [{ key: 'two-setups', right: true }];

// Step 3: the fix. Only the right choice is listed here.
const FIX = [{ key: 'keep-one', right: true }];

const SKELETON = {
  id: 'auto-vs-manual',
  no: '2.7',
  icon: '\u{1F916}',
  mechanics: ['sort'],
  cards: ['double-instrumentation'],
  lights: ['cart'],
  scoring: { parMs: null },
  play: {
    prefix: 'avm',
    steps: [
      { qid: 'avm-q-sort', sort: SORT },
      { qid: 'avm-q-why', choice: { id: 'avm-why', choices: WHY } },
      { qid: 'avm-q-fix', choice: { id: 'avm-fix', choices: FIX } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

/** The level's answer tables, in play order (pinned by test/act-2.test.mjs); derived from the core text joined to the logic, never written by hand. */
export const CONTENT = {
  steps: withText(CORE).play.steps.map((s) =>
    s.choice ? { id: s.choice.id, question: s.question, choices: s.choice.choices } : { sort: s.sort },
  ),
};

export default withText(CORE);
