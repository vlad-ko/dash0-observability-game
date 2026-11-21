// Level 7.1: Good alerts. Act 7 "Alerting and SLOs". Kettle & Co's on-call engineer was paged all night, mostly for nothing. The
// player reads seven Prometheus alerting rules and spots the three that page badly (Spot it): one compares a counter's total with a
// threshold, so it fires for good; one pages on a cause (busy CPUs) no user feels; one has `for: 0s`, so it flaps. Then one Choice:
// how to fix the rule that has fired for three days (alert on increase() over a window, not a bigger threshold, not a longer `for`,
// not delta()). Hints are off (the default ladder: hints in early acts only).
// The Choice is an answer pool (#390, docs/CONTENT.md section 10): the content lists 20 answers and a showing draws 4. Its extra
// answers use only the pages below: increase() and rate() (counters only, resets adjusted for), delta() and predict_linear() (gauges
// only), resets(), changes(), absent() and avg_over_time() on the functions page; the `for` and `keep_firing_for` clauses on the
// alerting rules page; a gauge against a counter on the metric types page; and paging on user-visible errors and avoiding pages with
// nothing to do on the alerting practices page. The rest is reasoning from "the total only grows" in this level's own scenario.
// Spec: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/ , https://prometheus.io/docs/practices/alerting/ , https://prometheus.io/docs/prometheus/latest/querying/functions/ , https://prometheus.io/docs/concepts/metric_types/#counter
// Dash0 docs: https://www.dash0.com/docs/dash0/monitoring/alerting/create-check-rules , https://www.dash0.com/docs/dash0/monitoring/alerting/create-check-rules-from-scratch
//
// Facts used (each read on the pages above, 2026-11-05): an alerting rule has an `expr` and an optional `for` clause, which makes
// Prometheus wait that long between first seeing an element in the expression's output and counting the alert as firing for it, and it
// checks the alert stays active at each evaluation (alerting rules page). Alert on symptoms tied to end-user pain rather than every
// possible cause (the alerting practices page). A counter is cumulative: it only increases, or is reset to zero on restart (the metric
// types page). `increase()` and `rate()` adjust automatically for counter resets from target restarts, and `delta` should only be used
// with gauges (the functions page). Dash0 check rules continuously evaluate PromQL expressions against telemetry and trigger alerts when
// values cross defined thresholds, and the For grace period is how long the threshold must be exceeded before alerting (the two Dash0
// pages). Not claimed: that a Prometheus rule file is accepted by Dash0 as it is.
//
// Invented for the game: the company, the services, the metric names, every threshold and window, and the seven rules. The rules are
// shown one per line as "alert: name expr: expression for: duration", not as a rules file.
//
// The words are in content/core/levels/good-alerts.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/good-alerts.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

const SKELETON = {
  id: 'good-alerts',
  no: '7.1',
  icon: '\u{1F514}',
  cards: ['rate-not-value'],
  lights: ['checkout'],
  scoring: { parMs: null },
  play: {
    prefix: 'ga',
    steps: [
      {
        qid: 'ga-q-spot',
        spot: {
          id: 'ga-spot',
          target: 'config',
          helps: { hints: false },
          faults: ['counter-value', 'cause-cpu', 'no-for'],
        },
      },
      {
        qid: 'ga-q-fix',
        // An answer pool: 3 right and 17 wrong in the content, a showing draws 4. Every right answer is marked here, and a right
        // answer added in the content file without `right: true` would be graded wrong. 'for-1h' is the tempting near-miss the
        // 50/50 keeps. Every choice's text is in the content file.
        choice: {
          id: 'ga-fix',
          draw: 4,
          choices: [{ key: 'increase', right: true }, { key: 'rate-5m', right: true }, { key: 'error-share', right: true }, { key: 'for-1h', keep: true }],
        },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
