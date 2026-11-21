// Level 7.2: SLIs and SLOs. Act 7 "Alerting and SLOs". Kettle & Co's checkout team wants a number for "checkout works". The player
// picks the shape of an SLI (good requests over valid requests, Choice), writes it as a PromQL ratio of rates over the checkout server
// spans (Query it), reads an error budget off an SLO target (Choice), and then meets the nuance: server spans never see a request the
// load balancer turned away, so the user-facing SLI is measured at the edge (Choice with a tempting wrong option). Hints are on for
// the Query it step only, as in 3.7.
// Spec: https://prometheus.io/docs/prometheus/latest/querying/functions/#rate , https://prometheus.io/docs/concepts/metric_types/#counter
// Spec: https://opentelemetry.io/docs/specs/semconv/http/http-spans/ , https://opentelemetry.io/docs/collector/components/connector/
// Docs (GitHub, spanmetrics connector README at v0.164.0, as levels/red-and-use.mjs cites it): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/connector/spanmetricsconnector/README.md
// Dash0 docs (the one sentence in the pool of the first Choice, read 2026-11-20: the SLI is a ratio of good, or of bad, events to total events): https://www.dash0.com/docs/dash0/monitoring/alerting/slos
// The first and the last Choice are answer pools (#390, docs/CONTENT.md section 10): the content lists 20 answers each and a showing draws 3.
// Their extra answers rest on the game's own definitions below, on "a counter only grows" (the metric types page above) and on reasoning
// about where a request is counted (a refused request leaves no span, no log line and no query). The budget Choice stays fixed: its
// answer is one number worked out from the 99.9% and the 1,000,000 requests on the screen.
//
// Facts used (each read on the page named in its parentheses, 2026-11-07): rate() calculates the per-second average rate of increase of the series in
// the range vector, and counter resets from target restarts are adjusted for (the functions page); a counter only goes up, or resets
// to zero on a restart (the metric types page); an HTTP server span is set to the error status for a 5xx and otherwise left unset
// (the HTTP spans page, as already used by 3.7); the spanmetrics connector counts spans into a calls metric, which a Prometheus
// backend sees as traces_span_metrics_calls_total, by service.name, span.name, span.kind and status.code, with the status codes
// STATUS_CODE_UNSET, STATUS_CODE_OK and STATUS_CODE_ERROR and the span kinds such as SPAN_KIND_SERVER (the spanmetrics README, as
// in 3.7; the connector page only lists the connectors).
//
// Invented for the game, not claimed from any source: the company, the numbers, the 99.9% target, the 30-day window (labelled
// illustrative in the copy because the data is one hour) and the load balancer story. The definitions of SLI, SLO and error budget
// are in the game's own words: an SLI is a ratio of good requests to valid requests, an SLO is the target for it, the budget is what the
// target leaves over. No edge counter exists in the data, so the edge-vs-server step is a Choice, not a query. The one Dash0 claim is the SLI sentence in the pool of the first Choice (see the Dash0 docs line above).
//
// The words are in content/core/levels/slis-and-slos.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/slis-and-slos.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

const SKELETON = {
  id: 'slis-and-slos',
  no: '7.2',
  icon: '\u{1F3AF}',
  cards: [],
  lights: ['checkout', 'api-gateway'],
  scoring: { parMs: null },
  play: {
    prefix: 'sl',
    steps: [
      {
        qid: 'sl-q-sli',
        // An answer pool: 4 right and 16 wrong in the content, a showing draws 3. Every right answer is marked here, and a right
        // answer added in the content file without `right: true` would be graded wrong.
        choice: {
          id: 'sl-sli',
          draw: 3,
          choices: [
            { key: 'good-over-valid', right: true },
            { key: 'successful-requests', right: true },
            { key: 'failing-share', right: true },
            { key: 'non-error-share', right: true },
          ],
        },
      },
      {
        qid: 'sl-q-sli-query',
        query: {
          id: 'sl-sli-query',
          dataset: 'checkout-spanmetrics',
          at: 3600,
          reference:
            'sum(rate(traces_span_metrics_calls_total{service_name="checkout", span_kind="SPAN_KIND_SERVER", status_code!="STATUS_CODE_ERROR"}[5m])) / ' +
            'sum(rate(traces_span_metrics_calls_total{service_name="checkout", span_kind="SPAN_KIND_SERVER"}[5m]))',
          helps: { hints: true },
        },
      },
      {
        qid: 'sl-q-budget',
        choice: { id: 'sl-budget', choices: [{ key: 'thousand', right: true }, { key: 'hundred' }, { key: 'ten-thousand' }, { key: 'all-but' }] },
      },
      {
        qid: 'sl-q-edge',
        // An answer pool: 4 right and 16 wrong in the content, a showing draws 3 (the 50/50 is offered from 4 answers).
        choice: {
          id: 'sl-edge',
          draw: 3,
          choices: [
            { key: 'load-balancer', right: true },
            { key: 'lb-access-log', right: true },
            { key: 'ingress-metrics', right: true },
            { key: 'front-door-counts', right: true },
          ],
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
