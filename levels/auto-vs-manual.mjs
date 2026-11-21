// Level 2.7: Auto vs manual. The player sorts what zero-code instrumentation covers in cart
// from what only their own code adds, finds why each of cart's fetch calls shows two CLIENT
// spans (an injected agent plus a tracing.js NodeSDK), and picks the fix.
// Spec: docs/M1-DESIGN.md §6 Act 2.
// Docs (GitHub README, not an allowed Spec host; it says instrumentation-undici subscribes to diagnostics_channel and does not state that two setups double the spans, so the copy is the scenario, not a general claim): https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/packages/instrumentation-undici/README.md
// Spec: https://opentelemetry.io/docs/zero-code/js/ , https://opentelemetry.io/docs/platforms/kubernetes/operator/automatic/ , https://opentelemetry.io/docs/specs/otel/trace/api/#spankind , https://opentelemetry.io/docs/concepts/signals/traces/
// The pools (#390) add these facts, all from pages fetched on 2026-11-20. Spec: https://opentelemetry.io/docs/languages/js/instrumentation/ (span events with addEvent, links in the options of a span, span status Unset by default and settable until the span ends, recording exceptions, counters, up-down counters and histograms from the meter) , https://opentelemetry.io/docs/concepts/signals/baggage/ , https://opentelemetry.io/docs/concepts/signals/metrics/ , https://opentelemetry.io/docs/concepts/signals/logs/ , https://opentelemetry.io/docs/concepts/context-propagation/ , https://opentelemetry.io/docs/concepts/resources/ , https://opentelemetry.io/docs/concepts/sampling/ , https://opentelemetry.io/docs/concepts/instrumentation/zero-code/ (zero-code instruments the libraries you use, not your own code).
// Docs (GitHub READMEs, not an allowed Spec host; each is the one statement of what that instrumentation emits, and the pool says no more than it does): opentelemetry-js-contrib packages/auto-instrumentations-node (the supported list, and OTEL_NODE_DISABLED_INSTRUMENTATIONS, OTEL_EXPORTER_OTLP_PROTOCOL and OTEL_NODE_RESOURCE_DETECTORS), instrumentation-pg (a pg.query span when client.query() is called), instrumentation-kafkajs (a PRODUCER span named send plus the topic), instrumentation-pino (trace context injected into pino log records), instrumentation-runtime-node (event loop delay and heap metrics), instrumentation-mongodb (spans with db.collection.name), instrumentation-aws-sdk (rpc.service and rpc.method), instrumentation-graphql (a span for each resolver invocation by default), instrumentation-express (routers, middleware and request handlers), instrumentation-undici (undici and the global fetch, a diagnostics channel, requireParentforSpans), opentelemetry-js instrumentation-http (the http and https modules); opentelemetry-collector processor/filterprocessor (can drop spans).
//
// The words are in content/core/levels/auto-vs-manual.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/auto-vs-manual.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 1: an answer pool (#390, docs/CONTENT.md section 10). The content lists 20 items, 10 for each bucket, and a
// showing draws 3 from each bucket (what it showed before the pool). Every item needs its bucket here. Label wording
// must not give the bucket away: test/sort-tells.test.mjs scores every board, test/pool-content.test.mjs the pool.
const SORT = {
  id: 'avm-sort',
  helps: { hints: false },
  draw: { auto: 3, manual: 3 },
  buckets: [{ id: 'auto' }, { id: 'manual' }],
  items: [
    { id: 'server', bucket: 'auto' },
    { id: 'loyalty', bucket: 'manual' },
    { id: 'redis', bucket: 'auto' },
    { id: 'coupon', bucket: 'manual' },
    { id: 'client', bucket: 'auto' },
    { id: 'item-count', bucket: 'manual' },
    { id: 'postgres', bucket: 'auto' },
    { id: 'coupon-event', bucket: 'manual' },
    { id: 'kafka', bucket: 'auto' },
    { id: 'orders-counter', bucket: 'manual' },
    { id: 'pino', bucket: 'auto' },
    { id: 'basket-histogram', bucket: 'manual' },
    { id: 'runtime', bucket: 'auto' },
    { id: 'job-link', bucket: 'manual' },
    { id: 'mongodb', bucket: 'auto' },
    { id: 'payment-error', bucket: 'manual' },
    { id: 's3', bucket: 'auto' },
    { id: 'open-baskets', bucket: 'manual' },
    { id: 'graphql', bucket: 'auto' },
    { id: 'declined-status', bucket: 'manual' },
  ],
};

// Step 2: why does each fetch call show two CLIENT spans? `why` follows "Right." or "Not quite.". An answer pool: the
// content lists 20 answers and a showing draws 3 (one of the 4 right, 2 of the 16 wrong). Every right answer is marked
// here; a right answer added in the content file without `right: true` would be graded wrong.
const WHY = [
  { key: 'two-setups', right: true },
  { key: 'agent-and-sdk', right: true },
  { key: 'two-fetch-hooks', right: true },
  { key: 'tracing-repeats-agent', right: true },
];

// Step 3: the fix, an answer pool of 20 that draws 3 (4 right, 16 wrong). Every right answer is marked here.
const FIX = [
  { key: 'keep-one', right: true },
  { key: 'agent-only', right: true },
  { key: 'either-not-both', right: true },
  { key: 'drop-second-sdk', right: true },
];

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
      { qid: 'avm-q-why', choice: { id: 'avm-why', draw: 3, choices: WHY } },
      { qid: 'avm-q-fix', choice: { id: 'avm-fix', draw: 3, choices: FIX } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

/** The level's answer tables, in play order (pinned by test/act-2.test.mjs); derived from the core text joined to the logic, never written by hand. A pooled choice states its `draw`. */
export const CONTENT = {
  steps: withText(CORE).play.steps.map((s) =>
    s.choice ? { id: s.choice.id, question: s.question, choices: s.choice.choices, draw: s.choice.draw } : { sort: s.sort },
  ),
};

export default withText(CORE);
