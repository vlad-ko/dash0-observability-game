// Level 3.2: Temporality. The player spots the delta series among seven (the ones a
// Prometheus-style backend cannot take as they are), picks the Collector's deltatocumulative
// processor as the way to convert them, says what a restart does to a cumulative counter, and
// learns that Dash0 accepts both temporalities.
// Spec: docs/OUTLINE.md §4 Act 3.
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/data-model/#temporality , https://opentelemetry.io/docs/specs/otel/metrics/data-model/#sums-delta-to-cumulative
// Spec: https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/#sums , https://opentelemetry.io/docs/collector/components/processor/
// Docs (Dash0 step: delta histograms are queried as native histograms, not through _bucket/_sum/_count): https://www.dash0.com/docs/dash0/telemetry/metrics/common-metric-query-issues
//
// The words are in content/core/levels/temporality.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/temporality.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// Step 1. Lines read `name{labels}`; the debug view adds the temporality of Sum and Histogram
// series. A Gauge has none. The text lists `whyNot` for a picked line that needs no conversion.
const SPOT = {
  id: 'temp-spot',
  target: 'metric',
  helps: { hints: true },
  faults: ['emails-sent', 'checkout-duration', 'payments-declined'],
};

// Steps 2 to 4: `why` follows "Right." or "Not quite."; only the right choice is listed here.
const SKELETON = {
  id: 'temporality',
  no: '3.2',
  icon: '\u{1F552}',
  cards: ['delta-needs-converting'],
  lights: ['notifications'],
  scoring: { parMs: null },
  play: {
    prefix: 'temp',
    steps: [
      { qid: 'temp-q-spot', spot: SPOT },
      // The delta series come from an agent you cannot change.
      { qid: 'temp-q-convert', choice: { id: 'temp-convert', choices: [{ key: 'deltatocumulative', right: true }] } },
      { qid: 'temp-q-restart', choice: { id: 'temp-restart', choices: [{ key: 'reset', right: true }] } },
      { qid: 'temp-q-dash0', choice: { id: 'temp-dash0', choices: [{ key: 'both', right: true }] } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: {} });
}

export default withText(CORE);
