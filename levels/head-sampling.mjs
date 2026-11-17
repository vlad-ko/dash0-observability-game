// Level 6.1: Head sampling. The player picks the sampler setup for three services that fits a span budget and keeps
// whole traces: the decision is made once, at the root, and a child service has to follow the parent's sampled flag
// (ParentBased), or its spans arrive for traces whose root was dropped and the traces have holes.
// Spec: docs/OUTLINE.md §4 Act 6.
// Spec: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/ , https://opentelemetry.io/docs/specs/otel/trace/sdk/#parentbased , https://opentelemetry.io/docs/specs/otel/trace/sdk/#traceidratiobased
// Spec: https://www.w3.org/TR/trace-context-2/#sampled-flag , https://opentelemetry.io/docs/concepts/sampling/#head-sampling
//
// Facts used (each read on the page above): OTEL_TRACES_SAMPLER defaults to parentbased_always_on; parentbased_traceidratio is
// ParentBased(root=TraceIdRatioBased) and OTEL_TRACES_SAMPLER_ARG is its ratio, a number in [0..1]. ParentBased calls its root
// sampler only for a span with no parent; with a parent it uses the parent's sampled flag (defaults: sampled gives AlwaysOn, not
// sampled gives AlwaysOff). TraceIdRatioBased MUST ignore the parent's sampled flag. Both halves of what the spec says about its
// decision: the Stable text says it MUST be a deterministic hash of the trace ID, so a given trace ID is sampled or not
// independent of language and time; a Development warning says the exact algorithm was never specified and different SDKs or
// versions may differ. The spec recommends it only for root spans, in combination with ParentBased; this level does not
// teach the disagreement and makes no claim either way. The spec also marks TraceIdRatioBased as deprecated in favour of
// the ProbabilitySampler (Development), which this level does not teach. The sampled flag travels in the W3C traceparent header.
// Head sampling decides without looking at the whole trace, so it cannot ensure that traces with an error are kept (the sampling concepts page).
//
// Widget: Trade-off. It grades the option the player picks against authored costs and keeps; it does not simulate a
// sampler. A child's cost depends on the root's ratio and the widget adds the costs of the knobs, so the root is not a
// knob: storefront already runs the 1 in 10 ratio the team wants, and the two knobs are the settings of checkout and
// payments, whose costs are exact at that ratio. The "break" of a child that ignores its parent (always_on, or a plain
// traceidratio) is authored arithmetic from the one table below, shown in the copy, not something an engine runs.
// Spans per second is the unit; the table is invented but fixed, and every number in the copy is computed from it.
//
// The words are in content/core/levels/head-sampling.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/head-sampling.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The table. A trace through Kettle & Co's checkout makes 12 spans: 4 in storefront (the root), 5 in checkout, 3 in payments.
const TRACES = 400; // new traces a second
const SPANS = { storefront: 4, checkout: 5, payments: 3 };
const WHOLE = SPANS.storefront + SPANS.checkout + SPANS.payments;
const CAP = 760; // spans a second the backend budget allows

const n = (x) => x.toLocaleString('en-US');
const FULL = TRACES * WHOLE;
const TEN = TRACES * 0.1; // traces a second kept at 1 in 10
const DROPPED = TRACES - TEN; // traces whose root was dropped

const SAMPLER = 'OTEL_TRACES_SAMPLER';
const ARG = 'OTEL_TRACES_SAMPLER_ARG';

const STOREFRONT = TEN * SPANS.storefront;
const KIDS_CAP = CAP - STOREFRONT; // spans a second left for checkout and payments once storefront has its share
const forTen = (service) => TEN * SPANS[service]; // spans a second of a service that follows the root
const forAll = (service) => TRACES * SPANS[service]; // spans a second of a service that samples every trace itself
const forRatio = (service, r) => TRACES * r * SPANS[service]; // a service that applies its own ratio to every trace
const orphanTraces = (r) => TRACES * r - TEN; // traces a plain ratio keeps that the root dropped (a higher ratio keeps every trace a lower one does)

// The figures the copy quotes, each filled into the content's {{name}} marks with the same expression and formatting the copy used.
const VARS = {
  traces: n(TRACES),
  whole: WHOLE,
  's-storefront': SPANS.storefront,
  's-checkout': SPANS.checkout,
  's-payments': SPANS.payments,
  full: n(FULL),
  cap: n(CAP),
  sampler: SAMPLER,
  arg: ARG,
  ten: n(TEN),
  storefront: n(STOREFRONT),
  'kids-cap': n(KIDS_CAP),
  'all-checkout': n(forAll('checkout')),
  'r05-traces': n(TRACES * 0.05),
  'r05-spans': n(forRatio('checkout', 0.05)),
  'r25-traces': n(TRACES * 0.25),
  'r25-spans': n(forRatio('checkout', 0.25)),
  'ten-checkout': n(forTen('checkout')),
  'ten-payments': n(forTen('payments')),
  'r50-traces': n(TRACES * 0.5),
  'r50-spans': n(forRatio('payments', 0.5)),
  'all-payments': n(forAll('payments')),
  dropped: n(DROPPED),
  'dropped-checkout': n(DROPPED * SPANS.checkout),
  orphan25: n(orphanTraces(0.25)),
  'orphan25-spans': n(orphanTraces(0.25) * SPANS.checkout),
  orphan50: n(orphanTraces(0.5)),
  'orphan50-spans': n(orphanTraces(0.5) * SPANS.payments),
  'dropped-payments': n(DROPPED * SPANS.payments),
};

// The root keeps 1 in 10 (storefront, fixed); two knobs set what checkout and payments do with the root's decision.
// The cards show costs and not what an option keeps until a Check: the player has to know that ParentBased, the
// default, follows the sampled flag, and what always_on and a plain ratio do instead. No blind rule finds the plan
// (test/trade-off-balance.test.mjs probes them). Checkout and payments are two knobs; only checkout has a
// need (its spans in every kept trace), because every payments option would keep a payments need: payments is
// decided by the cap, where a plain ratio or always_on is over it. A checkout ratio below the root's keeps only
// part of the root's traces (a higher ratio samples every trace a lower one does), so it keeps no need.
const PLAN = {
  id: 'hs-plan',
  cap: KIDS_CAP,
  helps: { hints: true },
  knobs: [
    {
      id: 'checkout',
      options: [
        { id: 'always-on', cost: forAll('checkout'), keeps: ['checkout-whole'] },
        { id: 'ratio-5pct', cost: forRatio('checkout', 0.05) },
        { id: 'ratio', cost: forRatio('checkout', 0.25), keeps: ['checkout-whole'] },
        { id: 'follow', cost: forTen('checkout'), keeps: ['checkout-whole'] },
        { id: 'always-off', cost: 0 },
      ],
    },
    {
      id: 'payments',
      options: [
        { id: 'follow', cost: forTen('payments') },
        { id: 'ratio', cost: forRatio('payments', 0.5) },
        { id: 'always-on', cost: forAll('payments') },
      ],
    },
  ],
  needs: [{ id: 'checkout-whole' }],
  answer: { checkout: 'follow', payments: 'follow' },
};

const SKELETON = {
  id: 'head-sampling',
  no: '6.1',
  icon: '\u{1F3B2}',
  cards: ['parent-based-sampling'],
  lights: ['storefront'],
  scoring: { parMs: null },
  play: {
    prefix: 'hs',
    steps: [
      { qid: 'hs-q-plan', tradeoff: PLAN },
      {
        qid: 'hs-q-why',
        // Step 2: the nuance in words. Only the answer is marked; every choice's text is in the content file.
        choice: { id: 'hs-why', choices: [{ key: 'own-decision', right: true }] },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
