// Level 6.3: What costs money. The player compares how a vendor can meter telemetry: per host (the
// bill follows hosts, not telemetry), per GB (bytes, so the size of each record counts) and per signal
// (spans, log records and metric data points, so the count counts and the size does not). A Choice
// covers per host; two Trade-off steps price the same kind of plan under per-GB and per-signal
// metering. The drivers are volume, cardinality, retention and sampling, taught without a price.
// Spec: docs/OUTLINE.md §4 Act 6.
// Spec: https://opentelemetry.io/docs/concepts/sampling/ , https://prometheus.io/docs/practices/instrumentation/#do-not-overuse-labels
// The per-host Choice is an answer pool (#390): its extra answers use only the per-host model stated in its intro
// (a flat amount for each host that sends telemetry), the OpenTelemetry sampling page above (sampling is one of the
// most effective ways to reduce the cost of observability) and the Prometheus page above (each labelset is another
// time series). Retention is the level's own explain text. No Dash0 claim is made in the pool.
// Docs (Dash0): https://www.dash0.com/pricing , https://www.dash0.com/docs/dash0/cost-control , https://www.dash0.com/docs/dash0/cost-control/spam-filters , https://www.dash0.com/docs/dash0/cost-control/install-forecast
//
// Every number here is illustrative and invented for Kettle & Co: the units are not a price list and
// the three models are generic, not a description of any one vendor. The one product claim is
// Dash0's: it meters spans, log records and metric data points, charges ingest on every signal sent
// (before filtering) and index only on what is kept, and its cost-control docs describe dashboards
// that rank services by telemetry volume. No price, plan name or per-service cost is stated.
//
// The words are in content/core/levels/what-costs-money.mjs (docs/CONTENT.md); this file keeps the answers, the costs and the wiring.
import CORE from '../content/core/levels/what-costs-money.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// Step 2: per-GB metering. Cost is bytes sent per day, in GB (illustrative). Bytes are the meter, so the size of a
// record counts as much as how many there are: the bodies are most of a log's bytes, and halving the lines does
// not take them out. 'error-detail' can be met by an error trace or by a log line with its body, so a pricier
// option can keep more than the cheaper one that is enough. No cost or Keeps heuristic finds the plan
// (test/trade-off-balance.test.mjs probes them all).
const GB = {
  id: 'wcm-gb',
  cap: 60,
  helps: { hints: true },
  knobs: [
    {
      id: 'traces',
      options: [
        { id: 'head-25', cost: 30 },
        { id: 'tail', cost: 25, keeps: ['slow-traces', 'error-detail'] },
        { id: 'head-1', cost: 2 },
        { id: 'errors-only', cost: 15, keeps: ['error-detail'] },
        { id: 'head-10', cost: 12 },
      ],
    },
    {
      id: 'logs',
      options: [
        { id: 'full', cost: 80, keeps: ['incident-logs', 'error-detail'] },
        { id: 'warn', cost: 14, keeps: ['error-detail'] },
        { id: 'half', cost: 40, keeps: ['incident-logs'] },
        { id: 'trimmed', cost: 30, keeps: ['incident-logs'] },
        { id: 'errors-only', cost: 6, keeps: ['error-detail'] },
      ],
    },
  ],
  needs: [{ id: 'slow-traces' }, { id: 'incident-logs' }, { id: 'error-detail' }],
  answer: { traces: 'tail', logs: 'trimmed' },
};

// Step 3: per-signal metering. Cost is the number of signals, in cost units per day (illustrative). The count
// is the meter, so a smaller record costs the same and fewer records cost less: packing a request's lines into one
// record is the lever, where cutting the bodies (the lever of the last step) is not. A span can carry the request
// detail too, so every span keeps more than the tail sample at a price that does not fit. No cost or Keeps
// heuristic finds the plan (test/trade-off-balance.test.mjs probes them all).
const SIGNAL = {
  id: 'wcm-signal',
  cap: 30,
  helps: { hints: true },
  knobs: [
    {
      id: 'interval',
      options: [
        { id: 's30', cost: 10, keeps: ['fast-alerts'] },
        { id: 'm5', cost: 1 },
        { id: 's10', cost: 30, keeps: ['fast-alerts'] },
        { id: 's60', cost: 5, keeps: ['fast-alerts'] },
        { id: 'm2', cost: 2.5 },
      ],
    },
    {
      id: 'records',
      options: [
        { id: 'per-line', cost: 40, keeps: ['request-detail'] },
        { id: 'failed-only', cost: 3 },
        { id: 'per-request', cost: 10, keeps: ['request-detail'] },
        { id: 'half', cost: 20 },
        { id: 'per-line-trimmed', cost: 40, keeps: ['request-detail'] },
      ],
    },
    {
      id: 'spans',
      options: [
        { id: 'all', cost: 50, keeps: ['slow-traces', 'request-detail'] },
        { id: 'head', cost: 1 },
        { id: 'head-10', cost: 5 },
        { id: 'tail', cost: 12, keeps: ['slow-traces'] },
        { id: 'tail-errors', cost: 8 },
      ],
    },
  ],
  needs: [{ id: 'fast-alerts' }, { id: 'request-detail' }, { id: 'slow-traces' }],
  answer: { interval: 's60', records: 'per-request', spans: 'tail' },
};

// The budgets the copy quotes, filled into the content's {{name}} marks.
const VARS = { 'gb-cap': GB.cap, 'signal-cap': SIGNAL.cap };

const SKELETON = {
  id: 'what-costs-money',
  no: '6.3',
  icon: '\u{1F4B8}',
  cards: [],
  lights: ['collector'],
  scoring: { parMs: null },
  play: {
    prefix: 'wcm',
    steps: [
      {
        qid: 'wcm-q-host',
        // Step 1: a per-host model, an answer pool (docs/CONTENT.md section 10): the content lists 20 answers, a showing
        // draws 4 (one of the 3 right, 3 of the 17 wrong). Every right answer is marked here, and a right answer added
        // in the content file without `right: true` would be graded wrong. 'drop-debug' is the tempting near-miss the
        // 50/50 keeps. Every choice's text is in the content file.
        choice: {
          id: 'wcm-host',
          draw: 4,
          choices: [
            { key: 'fewer-hosts', right: true },
            { key: 'consolidate-vms', right: true },
            { key: 'retire-idle', right: true },
            { key: 'drop-debug', keep: true },
          ],
        },
      },
      { qid: 'wcm-q-gb', tradeoff: GB },
      { qid: 'wcm-q-signal', tradeoff: SIGNAL },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
