// Level 3.3: Histograms. The player learns what an exponential histogram does that an explicit one
// does not, writes the query for an average and sees it hide a tail, reads a p99 off the
// `_bucket` series with histogram_quantile, learns what a p99 stuck on the top bucket bound means,
// and writes the same percentile per service the way a Dash0 panel would.
// Spec: docs/OUTLINE.md §4 Act 3.
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/data-model/#exponentialhistogram , https://opentelemetry.io/docs/specs/otel/metrics/sdk/#explicit-bucket-histogram-aggregation
// Spec: https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/#histograms , https://prometheus.io/docs/practices/histograms/ , https://prometheus.io/docs/prometheus/latest/querying/functions/#histogram_quantile
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/metrics/about-metrics , https://www.dash0.com/docs/dash0/telemetry/metrics/query-metrics
// The first Choice is an answer pool (#390, docs/CONTENT.md section 10): the content lists 13 answers and a showing draws 3. Its extra answers rest on the SDK page
// (Base2 Exponential Bucket Histogram Aggregation: a maximum size of 160 buckets that covers 1 ms to 100 s with under 5% relative error, a maximum scale of 20, the scale adjusted
// to the data) and the data model (ExponentialHistogram: boundaries at integer powers of base = 2**(2**(-scale)), the same relative error in every bucket, buckets that map exactly
// into a lesser scale, "perfect subsetting"; a histogram keeps counts in buckets, never the individual values), read 2026-11-21:
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/sdk/#base2-exponential-bucket-histogram-aggregation , https://opentelemetry.io/docs/specs/otel/metrics/data-model/#exponentialhistogram
// The bucket Choice stays fixed: its answer is read off the p99 of 2.5 and the bucket bounds on the screen.
// Docs (Step 4 copy: OTel attribute names written with underscores in PromQL, `service.name` as `service_name`; the practice labels `service` and `route` are the game's own): https://www.dash0.com/docs/dash0/dashboards/reference-drilldown-filter-translation
//
// The words are in content/core/levels/histograms.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
// The PromQL references stay here: the query widget's grader runs them against the dataset.
import CORE from '../content/core/levels/histograms.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// Steps 1 and 4: `why` follows "Right." or "Not quite."; only the right choice is listed here.
const SKELETON = {
  id: 'histograms',
  no: '3.3',
  icon: '\u{1F4CA}',
  cards: ['averages-hide-tails'],
  lights: ['payment-provider'],
  scoring: { parMs: null },
  play: {
    prefix: 'hist',
    steps: [
      {
        qid: 'hist-q-kind',
        // An answer pool: 4 right and 9 wrong in the content, a showing draws 3. Every right answer is marked here, and a right
        // answer added in the content file without `right: true` would be graded wrong.
        choice: {
          id: 'hist-kind',
          draw: 3,
          choices: [
            { key: 'exponential', right: true },
            { key: 'wider', right: true },
            { key: 'same-error', right: true },
            { key: 'merge', right: true },
          ],
        },
      },
      {
        qid: 'hist-q-avg',
        query: {
          id: 'hist-avg',
          dataset: 'checkout-http',
          at: 3600,
          reference:
            'sum(rate(http_server_request_duration_seconds_sum{route="/pay"}[5m])) / ' +
            'sum(rate(http_server_request_duration_seconds_count{route="/pay"}[5m]))',
          helps: { hints: true },
        },
      },
      {
        qid: 'hist-q-p99',
        query: {
          id: 'hist-p99',
          dataset: 'checkout-http',
          at: 3600,
          reference:
            'histogram_quantile(0.99, sum by (le) (rate(http_server_request_duration_seconds_bucket{route="/pay"}[5m])))',
          helps: { hints: true },
        },
      },
      { qid: 'hist-q-buckets', choice: { id: 'hist-buckets', choices: [{ key: 'top-bucket', right: true }] } },
      {
        qid: 'hist-q-p95',
        query: {
          id: 'hist-p95',
          dataset: 'checkout-http',
          at: 3600,
          reference:
            'histogram_quantile(0.95, sum by (service, le) (rate(http_server_request_duration_seconds_bucket[5m])))',
          helps: { hints: true },
        },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: {} });
}

export default withText(CORE);
