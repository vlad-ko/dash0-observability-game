// Level 9.1: Filter, sampler, or both? Act 9 "Live Demo" (docs/LIVE-DEMO.md). The player hears a confident answer to a customer,
// "yes, a filter in your Collector keeps only the traces with an error", and says whether it holds (Choice), then sorts nine goals
// by what they take: a filter processor, a tail sampler, or both (Sort it). The answer is wrong: a filter judges one span at a
// time, so it keeps the failed spans and drops the healthy spans of the same trace. The presenter has no name and no affiliation.
// Source: an anonymised call question (docs/LIVE-DEMO.md). Nothing below identifies a customer, a person or a product.
// Spec: https://opentelemetry.io/docs/concepts/sampling/#tail-sampling , https://opentelemetry.io/docs/collector/transforming-telemetry/ ,
// https://opentelemetry.io/docs/specs/semconv/resource/deployment-environment/
// Docs (GitHub READMEs, not an allowed Spec host): the tailsamplingprocessor README and the filterprocessor README in
// https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/tailsamplingprocessor/README.md and https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/filterprocessor/README.md
// Dash0 docs: https://www.dash0.com/docs/dash0/cost-control/spam-filters , https://www.dash0.com/docs/dash0/telemetry/signal-control/about-signal-control
//
// Facts used (read on the pages above, 2026-11-05): the filter processor evaluates its conditions on each span, span event, log
// record or data point alone. Tail sampling decides on all or most of the spans of a trace. Its policies include status_code,
// latency (earliest start to latest end), string_attribute (resource and span attributes) and span_count. The sampler keeps or
// drops whole traces, and traces only. deployment.environment.name is a resource attribute.
//
// Dash0 (read 2026-11-05): spam filters drop spans, logs, metrics and web events at ingestion; SignalControl is a rule-based pipeline
// that filters, converts, samples and aggregates signals before storage. The finish text claims no whole-trace decision for it.
//
// Invented for the game: the trace table below and the scenario, and the nine goals. No YAML. No pricing.
//
// The words are in content/core/levels/filter-or-sampler.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/filter-or-sampler.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// One failed checkout trace as it reaches the Collector: span, service, status.
const TRACE = [
  ['POST /checkout', 'storefront', 'Error'],
  ['GET /cart/{id}', 'cart', 'Unset'],
  ['POST /orders', 'checkout', 'Error'],
  ['reserve stock', 'inventory', 'Unset'],
  ['UPDATE stock', 'inventory', 'Unset'],
  ['charge card', 'payments', 'Error'],
  ['SELECT payment_methods', 'payments', 'Unset'],
];
const SPANS = TRACE.length;
const ERRORS = TRACE.filter(([, , status]) => status === 'Error').length;
const DROPPED = SPANS - ERRORS;
const HEALTHY = TRACE.filter(([, , status]) => status === 'Unset').map(([span]) => `<code>${span}</code>`);
const HEALTHY_LIST = `${HEALTHY.slice(0, -1).join(', ')} and ${HEALTHY.at(-1)}`;

const ROWS = TRACE.map(([span, service, status]) => `<tr><td>${span}</td><td>${service}</td><td>${status}</td></tr>`).join('');

// The figures the copy quotes, each filled into the content's {{name}} marks with the same expression and formatting the copy used.
const VARS = {
  spans: SPANS,
  rows: ROWS,
  dropped: DROPPED,
  'healthy-list': HEALTHY_LIST,
  errors: ERRORS,
};

// Step 1: does the presenter's answer hold? `why` follows "Right." or "Not quite."; only the right choice is listed here.
const VERDICT = [{ key: 'wrong', right: true }];

// Step 2: nine goals, three buckets. Sizes 4 / 3 / 2 (tail, filter, both). Labels must not give the bucket away
// (test/sort-tells.test.mjs).
const SORT = {
  id: 'fos-sort',
  helps: { hints: false },
  buckets: [{ id: 'filter' }, { id: 'tail' }, { id: 'both' }],
  items: [
    { id: 'errors-whole', bucket: 'tail' },
    { id: 'healthz', bucket: 'filter' },
    { id: 'slow-no-cache', bucket: 'both' },
    { id: 'slow', bucket: 'tail' },
    { id: 'debug-logs', bucket: 'filter' },
    { id: 'many-spans', bucket: 'tail' },
    { id: 'production-only', bucket: 'filter' },
    { id: 'via-payments', bucket: 'tail' },
    { id: 'errors-no-keepalive', bucket: 'both' },
  ],
};

// The level as it was, minus the words.
const SKELETON = {
  id: 'filter-or-sampler',
  no: '9.1',
  icon: '\u{1F4E2}',
  cards: [],
  lights: ['collector'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'fos',
    steps: [
      { qid: 'fos-q-verdict', choice: { id: 'fos-verdict', choices: VERDICT } },
      { qid: 'fos-q-sort', sort: SORT },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
