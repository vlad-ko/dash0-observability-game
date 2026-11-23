// Level 8.3: Migrating vendors. Act 8 "Operating at scale". Kettle & Co moves its dashboards and alerts from a proprietary monitoring
// tool (invented, never named) to a tool that queries with PromQL over OpenTelemetry metrics. The player sorts twelve constructs (drawn from a pool of sixteen) by
// what the move does to them: translated, approximated, manual or skipped (Sort it), then decides what to do with a converted p99 alert
// whose estimate pages where the old tool stayed quiet (Choice). Nothing is translated or run. Hints are off on the sort (the default
// ladder: hints in early acts only).
// Spec: https://prometheus.io/docs/prometheus/latest/querying/functions/ , https://prometheus.io/docs/practices/histograms/ , https://opentelemetry.io/docs/specs/otel/metrics/sdk/#explicit-bucket-histogram-aggregation
// Dash0 docs: https://www.dash0.com/docs/dash0/dashboards/import-dashboards
// Owner: DART naming confirmed by the owner 2026-11-09 (#263); no public page
//
// Facts used (each read on the page named, 2026-11-07). Prometheus functions page: `predict_linear(v range-vector, t scalar)` predicts the value of a
// series t seconds from now using simple linear regression, and should only be used with gauges; `increase` is "extrapolated to cover the
// full time range", so it can return a non-integer result even when a counter only increases by integers; for classic histograms
// `histogram_quantile` interpolates inside the bucket the quantile falls into, assuming the observations are spread uniformly in that
// bucket (linear interpolation). Prometheus histograms page: the quantile is calculated on the server from bucket counts; a bucket
// boundary exactly at an SLO value allows an accurate calculation, and the estimate is more accurate with higher bucket resolution.
// OpenTelemetry metrics SDK: the Explicit Bucket Histogram Aggregation takes the bucket Boundaries as a configuration parameter, and the
// ExplicitBucketBoundaries advisory parameter can be set on an instrument. Dash0 import page: Grafana dashboards import through a
// conversion utility that converts Prometheus queries only (Elasticsearch, InfluxDB and custom data sources are not supported), supports
// time series, stat, gauge, pie, table and text panels, shows a placeholder for a panel it cannot convert (heatmaps and custom panels are
// the examples), may omit some panel options, and translates an unsupported variable into a text variable.
//
// Stated as reasoning, with no source: the four buckets are the game's plain generic labels (translated, approximated, manual, skipped), not
// the statuses of any named migration tool. The old tool, its functions and what it computes are invented, so each sort item says in its
// label what the old tool does; no claim is made about any real vendor. DART is named from the owner line above only: its name and that
// it brings dashboards, alerts and rules over to Dash0 as Terraform, nothing about how it works; the four buckets are not its statuses.
// A big-number "exact count" is placed in "approximated" because `increase` extrapolates; that is a property of PromQL's `increase` as
// the functions page states it, not of any tool.
//
// The sort pool (#390) adds four constructs on the same facts: a median panel (histogram_quantile, as for the percentiles), a free-disk
// alert on a gauge, or a ratio of two gauges, against a fixed threshold (nothing estimated), a panel filled by a script the old tool runs (no
// query for PromQL to convert, as for the logs panel) and a test copy of a dashboard (nothing to carry over). Facts re-read 2026-11-22.
//
// Invented for the game: the company, the old tool, the sixteen constructs, and every number in step 2 (1,000 requests in 5 minutes, 900 at
// or under 0.5 s, 985 at or under 1 s, 1,000 at or under 2.5 s, the 15 slowest between 1.0 and 1.1 s, a 1.2 s threshold). The estimate
// 1 + (990 - 985) / (1000 - 985) * (2.5 - 1) = 1.5 s, and 1.067 s with a boundary at 1.2 s, are recomputed in test/migrating-vendors.test.mjs.
//
// The words are in content/core/levels/migrating-vendors.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/migrating-vendors.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 1: the bucket of each item. Every bucket and item label, and every explanation, is in the content file. An answer pool (#390,
// docs/CONTENT.md section 10): 4 items in each bucket, and a showing draws 3 of each (the twelve it showed before the pool).
const SORT = {
  id: 'mv-sort',
  helps: { hints: false },
  draw: { translated: 3, approximated: 3, manual: 3, skipped: 3 },
  buckets: [{ id: 'translated' }, { id: 'approximated' }, { id: 'manual' }, { id: 'skipped' }],
  items: [
    { id: 'p95-chart', bucket: 'approximated' },
    { id: 'ratio-alert', bucket: 'translated' },
    { id: 'agent-panel', bucket: 'skipped' },
    { id: 'anomaly-chart', bucket: 'manual' },
    { id: 'memory-chart', bucket: 'translated' },
    { id: 'p99-alert', bucket: 'approximated' },
    { id: 'retired-alert', bucket: 'skipped' },
    { id: 'failed-count', bucket: 'approximated' },
    { id: 'paging-alert', bucket: 'manual' },
    { id: 'unused-dashboard', bucket: 'skipped' },
    { id: 'disk-alert', bucket: 'translated' },
    { id: 'logs-panel', bucket: 'manual' },
    { id: 'median-panel', bucket: 'approximated' },
    { id: 'free-disk-alert', bucket: 'translated' },
    { id: 'style-copy', bucket: 'skipped' },
    { id: 'script-panel', bucket: 'manual' },
  ],
};

const SKELETON = {
  id: 'migrating-vendors',
  no: '8.3',
  icon: '\u{1F69A}',
  cards: [],
  lights: ['storefront'],
  scoring: { parMs: null },
  play: {
    prefix: 'mv',
    steps: [
      { qid: 'mv-q-sort', sort: SORT },
      {
        qid: 'mv-q-fix',
        // Only the answer is marked; every choice's text is in the content file.
        choice: { id: 'mv-fix', choices: [{ key: 'boundary', right: true }] },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
