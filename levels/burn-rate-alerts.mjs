// Level 7.3: Burn-rate alerts. Act 7 "Alerting and SLOs". Kettle & Co's checkout has a 99.9% SLO. The player writes a burn rate as a
// PromQL ratio of rates over one window (Query it, on the checkout-http data), then chooses the paging rule for two incidents told
// in numbers: a 5-minute window alone pages on a blip, a 1-hour window alone keeps paging after the fix, both together do neither
// (Choice). PromQL here has no and/or/unless, so the two-window rule cannot be a query. Hints are on for the Query it step only, as in 7.2.
// Spec: https://prometheus.io/docs/prometheus/latest/querying/functions/#rate , https://prometheus.io/docs/prometheus/latest/querying/operators/#arithmetic-binary-operators , https://prometheus.io/docs/concepts/metric_types/#counter
// Docs (the labels note: OTel attribute names written with underscores in PromQL; the practice labels are the game's own): https://www.dash0.com/docs/dash0/dashboards/reference-drilldown-filter-translation
// Dash0 docs: https://www.dash0.com/docs/dash0/monitoring/alerting/slos , https://www.dash0.com/docs/dash0/monitoring/alerting/alert-on-slos , https://www.dash0.com/docs/dash0/monitoring/alerting/about-notifications
//
// Facts used (each read on the page named in its parentheses, 2026-11-07): rate() calculates the per-second average rate of increase
// of the series in the range vector and adjusts for counter resets from target restarts (the functions page); a counter only goes up,
// or resets to zero on a restart (the metric types page); arithmetic operators are defined between a vector and a scalar (the
// operators page). In Dash0, a burn rate of 1 spends the error budget exactly as the window closes and a burn rate of 10 spends it ten
// times faster; SLOs have a rolling 28-day window; the fast burn signal fires when 2% of the window's budget is spent in an hour, and on
// the 28-day window that tier is a burn rate of 13.44; each tier pairs its window with a shorter confirmation window, so the signal
// fires only while the problem is still happening and clears on its own after recovery, and the longer window decides how much
// evidence is needed; the SLO exposes ready-made fast burn and slow burn signals and you create a check rule on them instead of
// combining two windows yourself; notification channels deliver alerts from check rules and synthetic checks (the SLOs page, the
// alerting on SLOs page, the notification channels page).
//
// Worked out in the game, not copied from a source (test/burn-rate-alerts.test.mjs recomputes each): the burn rate of a failure ratio
// is the ratio divided by (1 - target); the 14.4 line is 2% of a 30-day budget spent in one hour, 0.02 x 720 hours; every number in the
// two incidents. The 30-day window is illustrative (the data is one hour; Dash0 uses 28 days).
//
// Invented for the game: the company, the 99.9% target, the two incidents. The dataset has no blip followed by a sustained burn, so
// the blip against the sustained failure is told in the copy and graded by the Choice, never shown in the data, and the copy says so.
//
// The words are in content/core/levels/burn-rate-alerts.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/burn-rate-alerts.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

const SKELETON = {
  id: 'burn-rate-alerts',
  no: '7.3',
  icon: '\u{1F525}',
  cards: ['multi-window-burn'],
  lights: ['checkout'],
  scoring: { parMs: null },
  play: {
    prefix: 'br',
    steps: [
      {
        qid: 'br-q-burn',
        query: {
          id: 'br-burn',
          dataset: 'checkout-http',
          at: 3600,
          reference:
            'sum(rate(http_server_requests_total{service="checkout", status="500"}[1h])) / ' +
            'sum(rate(http_server_requests_total{service="checkout"}[1h])) / 0.001',
          helps: { hints: true },
        },
      },
      {
        qid: 'br-q-rule',
        choice: { id: 'br-rule', choices: [{ key: 'short-only' }, { key: 'long-only' }, { key: 'either' }, { key: 'both', right: true }] },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
