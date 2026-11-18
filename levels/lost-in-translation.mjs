// Level 9.5: Lost in translation. Act 9 "Live Demo" (docs/LIVE-DEMO.md). The player hears a confident answer to a customer,
// "setting the SDK to delta only changes how it keeps its state, so nothing changes downstream", and says whether it holds
// (Choice), then spots the series that now arrive as delta from seven lines (Spot it). The answer is wrong: with
// OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta, Counter, Asynchronous Counter and Histogram instruments export delta
// and UpDownCounters stay cumulative. The presenter has no name and no affiliation.
// How it differs from 3.2 (Temporality): 3.2 hands the player a debug view that already prints each series' temporality and asks
// them to read it, then to pick a fix. Here no line says its temporality: the player derives it from the instrument kind, the
// environment variable and which service changed it. Nothing about the Collector fix is asked.
// Source: an anonymised call question (docs/LIVE-DEMO.md). Nothing below identifies a customer, a person or a product.
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/sdk_exporters/otlp/ , https://opentelemetry.io/docs/specs/otel/metrics/data-model/#gauge
// Spec: https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/#sums
// Docs (GitHub README, not an allowed Spec host): the prometheusremotewriteexporter README at
// https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/exporter/prometheusremotewriteexporter/README.md
//
// Facts used (each read on the pages above, 2026-11-08). The OTLP exporter page: OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE
// defaults to cumulative, and "Delta: Choose Delta aggregation temporality for Counter, Asynchronous Counter and Histogram
// instrument kinds, choose Cumulative aggregation for UpDownCounter and Asynchronous UpDownCounter instrument kinds." The data model: "Gauges do not provide an
// aggregation semantic", so a gauge has no temporality. The Prometheus compatibility page: a cumulative monotonic Sum becomes a
// Prometheus Counter, and a delta monotonic Sum "MAY be converted to a cumulative temporality"; a delta Histogram "MAY be
// aggregated into a Cumulative aggregation temporality ... or MUST be dropped". The README at v0.164.0: "Non-cumulative monotonic,
// histogram, and summary OTLP metrics are dropped by this exporter."
// Not claimed: what any Dash0 page says about delta series, and the LowMemory value (it keeps Asynchronous Counters cumulative).
//
// Invented for the game: the services, the seven series, and the scenario, including that each service sets the preference for itself,
// so payments keeps the cumulative default. No pricing.
//
// The words are in content/core/levels/lost-in-translation.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/lost-in-translation.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const VARS = {};

// Step 1: does the presenter's answer hold? `why` follows "Right." or "Not quite."; only the right choice is listed here.
const VERDICT = [{ key: 'wrong', right: true }];

// Step 2: seven series. Lines read `name{labels}`; none says its temporality, so the player derives it. `whyNot` is shown for a picked
// line that still arrives as cumulative or has no temporality.
const SPOT = {
  id: 'lit-spot',
  target: 'metric',
  helps: { hints: false },
  lines: [
    { id: 'queue-depth' },
    { id: 'orders-placed' },
    { id: 'payments-declined' },
    { id: 'cpu-time' },
    { id: 'orders-in-flight' },
    { id: 'db-pool' },
    { id: 'checkout-duration' },
  ],
  faults: ['orders-placed', 'cpu-time', 'checkout-duration'],
};

// The level as it was, minus the words.
const SKELETON = {
  id: 'lost-in-translation',
  no: '9.5',
  icon: '\u{1F310}',
  cards: [],
  lights: ['collector'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'lit',
    steps: [
      { qid: 'lit-q-verdict', choice: { id: 'lit-verdict', choices: VERDICT } },
      { qid: 'lit-q-spot', spot: SPOT },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
