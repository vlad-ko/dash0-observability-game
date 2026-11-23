// Level 3.2: Temporality. The player spots the delta series among seven (the ones a
// Prometheus-style backend cannot take as they are), picks the Collector's deltatocumulative
// processor as the way to convert them, says what a restart does to a cumulative counter, and
// learns that Dash0 can query both temporalities.
// Spec: docs/OUTLINE.md §4 Act 3.
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/data-model/#temporality , https://opentelemetry.io/docs/specs/otel/metrics/data-model/#sums-delta-to-cumulative
// Spec: https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/#sums , https://opentelemetry.io/docs/collector/components/processor/
// Docs (Dash0 step: delta histograms are queried as native histograms, not through _bucket/_sum/_count): https://www.dash0.com/docs/dash0/telemetry/metrics/common-metric-query-issues
// The convert and Dash0 Choices are answer pools (#390, docs/CONTENT.md section 10): the content lists 20 and 13 answers and a showing draws 4 and 3. Their extra
// answers rest on pages read 2026-11-21: the deltatocumulative README (converts metrics from delta to cumulative by accumulating samples in memory, alpha, metrics),
// the cumulativetodelta README (converts the other way), the batch processor README (places data into batches), the memory limiter README (refuses data and forces garbage
// collection above its limits, to prevent out-of-memory situations), the Collector configuration page (data flows receivers, processors, exporters), and the Dash0 query
// pages (cumulative counters need rate() or increase() in PromQL mode, which the visual tabs add for you; a delta histogram is queried as a native
// histogram). No Dash0 page read says outright that Dash0 ingests both delta and cumulative (a search of the metrics docs found none), so the answers say only what the pages say: a delta histogram is queried as a native histogram and cumulative counters take rate() or increase(). The README says the processor converts "by accumulating samples in memory"; the answers state the consequence, that one Collector keeps each series' running total and has to see every point of it.
// Docs: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/deltatocumulativeprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/cumulativetodeltaprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/processor/batchprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/processor/memorylimiterprocessor/README.md , https://opentelemetry.io/docs/collector/configuration/ , https://www.dash0.com/docs/dash0/telemetry/metrics/query-metrics , https://www.dash0.com/docs/dash0/telemetry/metrics/common-metric-query-issues
// The restart Choice stays fixed: its answer is read off the 8,400 and the 35 on the screen, and a wrong answer restates that arithmetic.
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
      {
        qid: 'temp-q-convert',
        // An answer pool: 3 right and 17 wrong in the content, a showing draws 4 (what it showed before). Every right answer is marked
        // here, and a right answer added in the content file without `right: true` would be graded wrong.
        choice: {
          id: 'temp-convert',
          draw: 4,
          choices: [
            { key: 'deltatocumulative', right: true },
            { key: 'accumulate', right: true },
            { key: 'running-total-processor', right: true },
          ],
        },
      },
      // Fixed: the answer is read off the two figures on the screen, 8,400 then 35, and a wrong one restates the arithmetic.
      { qid: 'temp-q-restart', choice: { id: 'temp-restart', choices: [{ key: 'reset', right: true }] } },
      {
        qid: 'temp-q-dash0',
        // An answer pool: 4 right and 9 wrong in the content, a showing draws 3.
        choice: {
          id: 'temp-dash0',
          draw: 3,
          choices: [
            { key: 'both', right: true },
            { key: 'send-as-is', right: true },
            { key: 'histogram-catch', right: true },
            { key: 'not-every', right: true },
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
