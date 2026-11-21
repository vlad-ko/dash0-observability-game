// Level 3.4: PromQL basics. The player learns how an OpenTelemetry metric name turns into a
// Prometheus one (units and _total), writes rate with sum by and a range, writes increase over a
// window that contains a restart, and learns that Dash0 exposes metrics under both names and turns
// logs and spans into metrics you query with the same PromQL.
// Spec: docs/OUTLINE.md §4 Act 3.
// Spec: https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/#otlp-metric-points-to-prometheus , https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/#sums
// Spec: https://prometheus.io/docs/prometheus/latest/querying/functions/#rate , https://prometheus.io/docs/prometheus/latest/querying/functions/#increase , https://prometheus.io/docs/prometheus/latest/querying/operators/#aggregation-operators
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/metrics/understand-otel-metric-names , https://www.dash0.com/docs/dash0/telemetry/metrics/understand-synthetic-metrics
// The last Choice is an answer pool (#390, docs/CONTENT.md section 10): the content lists 13 answers and a showing draws 3. Its extra answers rest on the two Dash0 pages
// above, read 2026-11-21: otel_metric_name is derived by Dash0 (not sent by instrumentation) and holds the original name, which keeps a query stable whatever the translation does;
// otel_metric_type holds the OTLP type (sum, gauge, histogram, exponential_histogram, summary), otel_metric_unit the unit; synthetic metrics are derived on demand from the raw
// records, counter-shaped ones are wrapped in increase() in the visual Query Builder tabs, gauge-shaped ones such as dash0.metrics.timeseries are not. The name and total
// Choices stay fixed: each answer is a name worked out from the metric name and unit on the screen.
// Docs (the rate query copy: OTel attribute names written with underscores in PromQL, `service.name` as `service_name`; the practice labels `service`, `route`, `status` are the game's own): https://www.dash0.com/docs/dash0/dashboards/reference-drilldown-filter-translation
//
// The words are in content/core/levels/promql-basics.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
// The PromQL references stay here: the query widget's grader runs them against the dataset.
import CORE from '../content/core/levels/promql-basics.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// `why` follows "Right." or "Not quite."; only the right choice is listed here.
const SKELETON = {
  id: 'promql-basics',
  no: '3.4',
  icon: '\u{1F50E}',
  cards: ['prometheus-names'],
  lights: ['shipping'],
  scoring: { parMs: null },
  play: {
    prefix: 'pql',
    steps: [
      { qid: 'pql-q-unit', choice: { id: 'pql-unit', choices: [{ key: 'seconds-bucket', right: true }] } },
      { qid: 'pql-q-total', choice: { id: 'pql-total', choices: [{ key: 'total', right: true }] } },
      {
        qid: 'pql-q-rate',
        query: {
          id: 'pql-rate',
          dataset: 'checkout-http',
          at: 3600,
          reference: 'sum by (route) (rate(http_server_requests_total{service="checkout", status="500"}[5m]))',
          helps: { hints: true },
        },
      },
      {
        qid: 'pql-q-increase',
        query: {
          id: 'pql-increase',
          dataset: 'checkout-http',
          at: 2700,
          reference: 'sum(increase(http_server_requests_total{route="/pay"}[10m]))',
          helps: { hints: true },
        },
      },
      {
        qid: 'pql-q-dash0',
        // An answer pool: 4 right and 9 wrong in the content, a showing draws 3. Every right answer is marked here, and a right
        // answer added in the content file without `right: true` would be graded wrong.
        choice: {
          id: 'pql-dash0',
          draw: 3,
          choices: [
            { key: 'both-names', right: true },
            { key: 'stable-selector', right: true },
            { key: 'type-label', right: true },
            { key: 'wrapped-increase', right: true },
          ],
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
