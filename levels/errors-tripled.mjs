// Act 6 boss: Errors tripled overnight. The error ratio on the checkout dashboard went from 4.0% to 12.2% at 02:05 while the
// load balancer's request rate stayed flat and the error count stayed at 40 a second. The player compares the two request
// rates (span metrics fell 67%, the load balancer did not), sees the error count did not move, and finds the Collector change
// that put tail_sampling in the traces pipeline that feeds the span_metrics connector: the policies keep every error and 30% of
// the rest, so the connector counts all 40 errors but only 328 of 1,000 requests. Three views hold the chain (clues); two are
// red herrings; two are neutral. Scored. A plain-data Scenario for the incident engine, played through one declarative
// `incident` step (lib/widgets/incident.mjs, docs/M1-DESIGN.md §4.3, docs/DECLARATIVE-LEVELS.md §2), then one closing Choice
// on why the ratio moved when the count did not, which grades the nuance of 6.1 and 6.2 (a uniform sampler leaves a ratio alone,
// a sampler that keeps every error does not; compute span metrics before sampling).
// Spec: docs/OUTLINE.md §4 Act 6.
// Spec: https://opentelemetry.io/docs/concepts/sampling/#tail-sampling , https://opentelemetry.io/docs/collector/configuration/#connectors
// Docs (GitHub READMEs, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/tailsamplingprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/connector/spanmetricsconnector/README.md , https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/connector/README.md
// Dash0 tie-in: n/a. No Dash0 docs page was checked for this scenario, and nothing below names a Dash0 feature.
//
// The gateway is one pod, on purpose: tail sampling needs all the spans of a trace at one instance, so two gateway pods would
// need a first tier that routes by trace ID (level 5.4; the sampling concepts page).
// Facts used (each read on the pages above): tail sampling decides on all or most of the spans of a trace, and one thing it can
// do is always sample traces that contain an error (sampling concepts). The tail_sampling processor has a `status_code` policy
// (`status_codes: [ERROR]`) and a `probabilistic` policy (`sampling_percentage`), and a trace that another policy sampled is not
// dropped by the probabilistic one (processor README, paraphrased), so errors plus a percentage of the rest keeps both. A connector is an
// exporter at the end of a pipeline and a receiver at the start of another, and is enabled through the pipelines in `service`
// (configuration page), so span_metrics receives what leaves the processors of the traces pipeline that lists it. The connector
// counts the spans it receives into `traces.span.metrics.calls`, with `status.code` as a dimension, and error counts are the
// calls with an Error status code (connector README). The component was renamed from spanmetrics to span_metrics (same README).
// The config shown is the whole gateway config (the + and - lines are the change), and a test assembles and checks it: every component
// defined, nothing unused, span_metrics exported by one traces pipeline and received by one metrics pipeline, and exactly one span_metrics
// instance (the spanmetrics README's Single Writer Principle), so no other pipeline feeds the same connector unsampled.
//
// Invented for the game: all the figures (one table below: 1,000 requests a second, 40 of them failed, a policy that keeps every
// error and 30% of the rest), the times, the services, the deploy and the provider incident. The table is arranged so the title is
// true: 40 of 1,000 is 4.0%, 40 of 328 is 12.2%, about 3x. With errors all kept and only 10% of the rest, the same arithmetic gives
// about 7x for a 4% error rate; 30% is what makes it 3x. Counting one request as one span of the entry service is a simplification.
//
// The words are in content/core/levels/errors-tripled.mjs (docs/CONTENT.md); this file keeps the figures, the answers and the wiring.
import CORE from '../content/core/levels/errors-tripled.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const REQUESTS = 1000; // a second, at the load balancer, before and after
const ERRORS = 40; // a second, before and after
const BLIP = 52; // failed requests a second at the provider's incident peak, 03:30 to 03:40
const KEEP_PCT = 30; // the probabilistic policy keeps this share of the traces that did not fail
const HEALTHY = REQUESTS - ERRORS;
const KEPT_HEALTHY = Math.round((HEALTHY * KEEP_PCT) / 100);
const KEPT = ERRORS + KEPT_HEALTHY;
const DROP = Math.round((1 - KEPT / REQUESTS) * 100);
const n = (x) => x.toLocaleString('en-US');
const pct = (x) => `${((x * 100)).toFixed(1)}%`;
const BEFORE = pct(ERRORS / REQUESTS);
const AFTER = pct(ERRORS / KEPT);

// The figures the copy quotes, each filled into the content's {{name}} marks with the same expression and formatting the copy used.
const VARS = {
  after: AFTER,
  before: BEFORE,
  requests: n(REQUESTS),
  kept: KEPT,
  drop: DROP,
  errors: ERRORS,
  'keep-pct': KEEP_PCT,
  blip: BLIP,
  healthy: n(HEALTHY),
  'drop-pct': 100 - KEEP_PCT,
};

// Step 1's scenario without its words. The kind of each view and what it costs are logic; the alert, the views' pages and the
// hypotheses' text are in the content file.
const SCENARIO = {
  id: 'errors-tripled',
  budget: { startPct: 100, burnPctPerMin: 6 },
  views: [
    { id: 'rate-vs-lb', costMin: 3, kind: 'clue' },
    { id: 'error-count', costMin: 3, kind: 'clue' },
    { id: 'collector-diff', costMin: 3, kind: 'clue' },
    { id: 'collector-health', costMin: 3, kind: 'neutral' },
    { id: 'backend-ingest', costMin: 3, kind: 'neutral' },
    { id: 'payments-deploy', costMin: 3, kind: 'herring' },
    { id: 'provider-blip', costMin: 4, kind: 'herring' },
  ],
  hypotheses: [
    { id: 'metrics-after-sampling', right: true },
    { id: 'payments-regression', right: false },
    { id: 'traffic-fell', right: false },
    { id: 'provider-failing', right: false },
  ],
  answerAfterViews: 3,
};

const SKELETON = {
  id: 'errors-tripled',
  no: null,
  icon: '\u{1F4C8}',
  cards: [],
  lights: ['collector'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'eto',
    steps: [
      { incident: SCENARIO },
      {
        qid: 'eto-q-ratio',
        // Step 2: why the ratio moved when the count did not. Only the answer is marked; every choice's text is in the content file.
        choice: { id: 'eto-ratio', choices: [{ key: 'counted-after-sampling', right: true }] },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
