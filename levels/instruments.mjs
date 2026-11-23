// Level 3.1: Instruments. The player sorts eight measurements from Kettle & Co's services into
// the instrument that fits (Counter, UpDownCounter, Gauge, Histogram), picks how to report a
// heap size you can read at any time (an asynchronous instrument), then says what a Gauge
// used for a count costs: the sum and start time a rate needs.
// Spec: docs/OUTLINE.md §4 Act 3.
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/api/#synchronous-and-asynchronous-instruments , https://opentelemetry.io/docs/specs/otel/metrics/api/#updowncounter , https://opentelemetry.io/docs/specs/otel/metrics/api/#gauge
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/data-model/#sums , https://opentelemetry.io/docs/specs/otel/metrics/data-model/#gauge
// The two Choices are answer pools (#390, docs/CONTENT.md section 10): the content lists 10 and 14 answers and a showing draws 3. Their extra answers rest on
// the pages above (read 2026-11-21): the API's Gauge, Asynchronous Gauge, Asynchronous Counter and Asynchronous UpDownCounter notes (heap size as the example of
// an additive value, CPU time of a value that only grows, a callback that reports the absolute value), its unit and attributes (optional on every instrument,
// accepted by a Gauge's record call), its integer and floating-point Gauge forms and its concurrency requirement (every Instrument method safe for concurrent use);
// the data model's Gauge (no aggregation semantic, the last sampled value of a window, its own attributes), the start time that is strongly recommended
// on Sum points and optional on a Gauge, and the aggregation temporality that only Sum and Histogram points have; the Prometheus compatibility page (a monotonic
// Sum gets `_total`, a Gauge stays a gauge): https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/#otlp-metric-points-to-prometheus
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/api/#concurrency-requirements , https://opentelemetry.io/docs/specs/otel/metrics/api/#instrument-unit , https://prometheus.io/docs/prometheus/latest/querying/functions/#rate
// The instr-sort pool (#390) adds these, read 2026-11-22: the API's example uses (Counter: bytes received, accounts created; Gauge: the background noise
// level, where summing several rooms makes no sense, and the CPU fan speed; UpDownCounter: increments and decrements, and use Counter if the value only
// grows; Histogram: the request duration and payload size); the semantic conventions' db.client.connection.count and http.client.open_connections
// (UpDownCounter), db.client.operation.duration and http.server.request.body.size (Histogram). The services and places are invented.
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/api/#counter , https://opentelemetry.io/docs/specs/otel/metrics/api/#histogram
// Spec: https://opentelemetry.io/docs/specs/semconv/database/database-metrics/ , https://opentelemetry.io/docs/specs/semconv/http/http-metrics/
//
// The words are in content/core/levels/instruments.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/instruments.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// Step 1: an answer pool (#390, docs/CONTENT.md section 10). The content lists 16 measurements, 4 per instrument, and a
// showing draws 2 of each (what it showed before the pool). Every item needs its bucket here. Label wording must not give
// the bucket away: test/sort-tells.test.mjs scores every board, test/pool-content.test.mjs the pool.
const SORT = {
  id: 'instr-sort',
  helps: { hints: false },
  draw: { counter: 2, 'up-down-counter': 2, gauge: 2, histogram: 2 },
  buckets: [{ id: 'counter' }, { id: 'up-down-counter' }, { id: 'gauge' }, { id: 'histogram' }],
  items: [
    { id: 'orders-placed', bucket: 'counter' },
    { id: 'warehouse-temp', bucket: 'gauge' },
    { id: 'queue-length', bucket: 'up-down-counter' },
    { id: 'checkout-duration', bucket: 'histogram' },
    { id: 'payment-declines', bucket: 'counter' },
    { id: 'cache-hit-ratio', bucket: 'gauge' },
    { id: 'active-requests', bucket: 'up-down-counter' },
    { id: 'response-bytes', bucket: 'histogram' },
    { id: 'accounts-created', bucket: 'counter' },
    { id: 'fan-speed', bucket: 'gauge' },
    { id: 'db-connections', bucket: 'up-down-counter' },
    { id: 'query-duration', bucket: 'histogram' },
    { id: 'bytes-received', bucket: 'counter' },
    { id: 'noise-level', bucket: 'gauge' },
    { id: 'provider-connections', bucket: 'up-down-counter' },
    { id: 'request-body-size', bucket: 'histogram' },
  ],
};

// Steps 2 and 3: `why` follows "Right." or "Not quite."; only the right choice is listed here.
const SKELETON = {
  id: 'instruments',
  no: '3.1',
  icon: '\u{1F4CF}',
  cards: ['gauge-not-count'],
  lights: ['kafka'],
  scoring: { parMs: null },
  play: {
    prefix: 'instr',
    steps: [
      { qid: 'instr-q-sort', sort: SORT },
      {
        qid: 'instr-q-async',
        // An answer pool: 3 right and 7 wrong in the content, a showing draws 3 (what it showed before). Every right answer is marked here, and a right
        // answer added in the content file without `right: true` would be graded wrong.
        choice: {
          id: 'instr-async',
          draw: 3,
          choices: [
            { key: 'async-updown', right: true },
            { key: 'observable-updown', right: true },
            { key: 'on-demand-additive', right: true },
          ],
        },
      },
      {
        qid: 'instr-q-gauge',
        // An answer pool: 3 right and 11 wrong in the content, a showing draws 3.
        choice: {
          id: 'instr-gauge',
          draw: 3,
          choices: [
            { key: 'sampled-not-sum', right: true },
            { key: 'no-aggregation', right: true },
            { key: 'start-time', right: true },
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
