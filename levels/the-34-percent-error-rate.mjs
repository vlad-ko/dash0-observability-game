// Level 9.2: The 34% error rate. Act 9 "Live Demo" (docs/LIVE-DEMO.md). The player hears a confident answer to a customer, "yes, 34% of
// checkout requests fail, the numbers come from the spans", and says whether it holds (Choice), then picks the setup that keeps
// every error and a true error rate inside a cap on what is sent to the backend (Trade-off). The answer is
// wrong: with tail sampling that keeps every error plus a share of the rest, the ratio of errors to kept spans is not the ratio
// of errors to requests. The presenter has no name and no affiliation.
// Source: an anonymised call question (docs/LIVE-DEMO.md). Nothing below identifies a customer, a person or a product.
// Spec: https://opentelemetry.io/docs/concepts/sampling/#tail-sampling , https://opentelemetry.io/docs/collector/configuration/#connectors
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/signal-control/sample-traces , https://www.dash0.com/docs/dash0/telemetry/signal-control/edge/about-signalcontrol-edge
//
// Facts used (each read on the pages above, 2026-11-05): tail sampling decides on all or most of the spans of a trace, so it can
// always keep traces with an error (the sampling concepts page). A connector is an exporter at the end of one pipeline and a receiver
// at the start of another, and processors run in the order listed (the Collector configuration page). Dash0 computes RED metrics before
// sampling when it samples traces (SignalControl, the sample-traces page), and the SignalControl Edge `dash0redmetrics` connector runs in
// the pre-sampling pipeline, from 100% of spans before sampling (the Edge page). Not claimed: what a Dash0 RED view shows when the
// customer samples in their own Collector before sending, which neither page documents.
// The Collector pipeline fix (a pipeline of its own with no sampling processor) is level 6.2 and is only pointed back to here.
//
// Invented for the game: every figure, from the one table below (1,000 requests a second, 50 of them failed, a policy that keeps every
// error and 10% of the rest, a cap of 200 spans a second), and the scenario. Counting one request as one span of the entry service is
// a simplification. No pricing is stated.
//
// The words are in content/core/levels/the-34-percent-error-rate.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/the-34-percent-error-rate.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const REQUESTS = 1000; // a second, at the load balancer
const ERRORS = 50; // a second, failed requests
const KEEP_PCT = 10; // the probabilistic policy keeps this share of the traces that did not fail
const CAP = 200; // spans a second the backend takes
const HEALTHY = REQUESTS - ERRORS;
const KEPT_HEALTHY = Math.round((HEALTHY * KEEP_PCT) / 100);
const STORED = ERRORS + KEPT_HEALTHY;
const UNIFORM = Math.round((REQUESTS * KEEP_PCT) / 100);
const UNIFORM_ERRORS = Math.round((ERRORS * KEEP_PCT) / 100); // failed traces a uniform sample keeps each second
const DECOY_PCT = 18; // a dearer random policy that still fits the cap
const DECOY = Math.round((REQUESTS * DECOY_PCT) / 100);
const DECOY_ERRORS = Math.round((ERRORS * DECOY_PCT) / 100);
const MORE_PCT = 20; // every error plus a larger share of the rest
const STORED_MORE = ERRORS + Math.round((HEALTHY * MORE_PCT) / 100);
const STORED_PCT = Math.round((ERRORS / STORED) * 100);
const TRUE_PCT = Math.round((ERRORS / REQUESTS) * 100);

const TIMES_OVER = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 10: 'ten' }[REQUESTS / CAP] ?? String(REQUESTS / CAP); // keep-all against the cap
const n = (x) => x.toLocaleString('en-US');
const WRONG_SUM = `${ERRORS} / ${STORED} = ${STORED_PCT}%`;
const TRUE_SUM = `${ERRORS} / ${n(REQUESTS)} = ${TRUE_PCT}%`;

// The figures the copy quotes, each filled into the content's {{name}} marks with the same expression and formatting the copy used.
// STORED appears both plain and through n(), so it has two names.
const VARS = {
  requests: n(REQUESTS),
  'keep-pct': KEEP_PCT,
  errors: ERRORS,
  'kept-healthy': KEPT_HEALTHY,
  stored: STORED,
  'stored-n': n(STORED),
  'stored-pct': STORED_PCT,
  'wrong-sum': WRONG_SUM,
  'true-sum': TRUE_SUM,
  'true-pct': TRUE_PCT,
  cap: CAP,
  uniform: n(UNIFORM),
  'uniform-errors': UNIFORM_ERRORS,
  'decoy-pct': DECOY_PCT,
  decoy: n(DECOY),
  'decoy-errors': DECOY_ERRORS,
  'more-pct': MORE_PCT,
  'stored-more': n(STORED_MORE),
  'times-over': TIMES_OVER,
  healthy: n(HEALTHY),
};

// Step 1: does the presenter's answer hold? `why` follows "Right." or "Not quite."; only the right choice is listed here.
const VERDICT = [{ key: 'wrong', right: true }];

// Step 2: the setup. Two knobs: five sampling policies and three places to compute the rate.
// Fifteen plans, one passes. Costs are spans a second sent to the backend. Every whyNot is a whole sentence that names its own option, so it holds
// with either option of the other knob.
const PLAN = {
  id: 'ser-plan',
  cap: CAP,
  knobs: [
    {
      id: 'sampler',
      options: [
        { id: 'probabilistic-10pct', cost: UNIFORM, keeps: ['true-rate'] },
        { id: 'keep-all', cost: REQUESTS, keeps: ['every-error', 'true-rate'] },
        { id: 'probabilistic-18pct', cost: DECOY, keeps: ['true-rate'] },
        { id: 'errors-10pct', cost: STORED, keeps: ['every-error'] },
        { id: 'errors-20pct', cost: STORED_MORE, keeps: ['every-error'] },
      ],
    },
    {
      id: 'rate',
      options: [
        { id: 'red-before', cost: 0, keeps: ['true-rate'] },
        { id: 'mirror', cost: REQUESTS, keeps: ['true-rate'] },
        { id: 'stored-spans', cost: 0 },
      ],
    },
  ],
  needs: [{ id: 'every-error' }, { id: 'true-rate' }],
  answer: { sampler: 'errors-10pct', rate: 'red-before' },
};

// The level as it was, minus the words.
const SKELETON = {
  id: 'the-34-percent-error-rate',
  no: '9.2',
  icon: '\u{1F399}',
  cards: [],
  lights: ['collector'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'ser',
    steps: [
      { qid: 'ser-q-verdict', choice: { id: 'ser-verdict', choices: VERDICT } },
      { qid: 'ser-q-plan', tradeoff: PLAN },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
