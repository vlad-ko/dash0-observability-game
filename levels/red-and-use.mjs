// Level 3.7: RED and USE. The player pairs the two checklists with what they read (RED for a
// service's requests, USE for a resource), tells saturation from utilisation, learns how the
// Collector's spanmetrics connector turns spans into RED metrics, writes the rate, the error ratio
// and the p95 duration of each service from those span metrics, and learns that Dash0 derives RED
// from spans without a connector.
// Spec: docs/OUTLINE.md §4 Act 3.
// Spec: https://opentelemetry.io/docs/collector/components/connector/ , https://opentelemetry.io/docs/specs/semconv/http/http-spans/
// Spec: https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/#otlp-metric-points-to-prometheus , https://prometheus.io/docs/prometheus/latest/querying/functions/#histogram_quantile
// Source (spanmetrics connector README, names, dimensions, units, status codes and the feature gates): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/connector/spanmetricsconnector/README.md
// Docs (component type at v0.164.0: `span_metrics`; `spanmetrics` is the deprecated alias): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/connector/spanmetricsconnector/metadata.yaml
// Source (USE method, Brendan Gregg): https://www.brendangregg.com/usemethod.html
// Source (RED method, Tom Wilkie, as presented at GrafanaCon EU 2018): https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/
// Dash0 docs: https://www.dash0.com/docs/dash0/monitoring/services/built-in-metrics , https://www.dash0.com/docs/dash0/telemetry/metrics/understand-synthetic-metrics
//
// The words are in content/core/levels/red-and-use.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
// The PromQL references stay here: the query widget's grader runs them against the dataset.
import CORE from '../content/core/levels/red-and-use.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// `why` follows "Right." or "Not quite."; only the right choice is listed here.
const SKELETON = {
  id: 'red-and-use',
  no: '3.7',
  icon: '\u{1F6A6}',
  cards: ['red-and-use'],
  lights: ['checkout'],
  scoring: { parMs: null },
  play: {
    prefix: 'ru',
    steps: [
      { qid: 'ru-q-methods', choice: { id: 'ru-methods', choices: [{ key: 'red-services-use-resources', right: true }] } },
      { qid: 'ru-q-saturation', choice: { id: 'ru-saturation', choices: [{ key: 'saturation', right: true }] } },
      { qid: 'ru-q-connector', choice: { id: 'ru-connector', choices: [{ key: 'spanmetrics', right: true }] } },
      {
        qid: 'ru-q-rate',
        query: {
          id: 'ru-rate',
          dataset: 'checkout-spanmetrics',
          at: 3600,
          reference: 'sum by (service_name) (rate(traces_span_metrics_calls_total{span_kind="SPAN_KIND_SERVER"}[5m]))',
          helps: { hints: true },
        },
      },
      {
        qid: 'ru-q-errors',
        query: {
          id: 'ru-errors',
          dataset: 'checkout-spanmetrics',
          at: 3600,
          reference:
            'sum by (service_name) (rate(traces_span_metrics_calls_total{span_kind="SPAN_KIND_SERVER", status_code="STATUS_CODE_ERROR"}[5m])) / ' +
            'sum by (service_name) (rate(traces_span_metrics_calls_total{span_kind="SPAN_KIND_SERVER"}[5m]))',
          helps: { hints: true },
        },
      },
      {
        qid: 'ru-q-duration',
        query: {
          id: 'ru-duration',
          dataset: 'checkout-spanmetrics',
          at: 3600,
          reference:
            'histogram_quantile(0.95, sum by (service_name, le) (rate(traces_span_metrics_duration_milliseconds_bucket{span_kind="SPAN_KIND_SERVER"}[5m])))',
          helps: { hints: true },
        },
      },
      { qid: 'ru-q-dash0', choice: { id: 'ru-dash0', choices: [{ key: 'derived', right: true }] } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: {} });
}

export default withText(CORE);
