// Level 3.6: Exemplars. The player spots, among eight points of the payments latency histogram, the
// ones that carry an exemplar (a recorded measurement with the trace_id and span_id of the span it was
// recorded in), and says why the other points have none (no measurement in them was recorded inside a
// sampled span). There is no Query it step: the PromQL subset has no exemplar support (issue #109), so
// the level uses Spot it with `target: 'config'` and Choice. `target: 'metric'` was not used: it only
// accepts a line that reads `name{labels}` and ends at the closing brace, so it cannot carry a point
// and its exemplar.
// Spec: docs/OUTLINE.md §4 Act 3.
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/data-model/#exemplars
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/sdk/#exemplar , https://opentelemetry.io/docs/specs/otel/metrics/sdk/#exemplarfilter , https://opentelemetry.io/docs/specs/otel/metrics/sdk/#exemplarreservoir
// Spec: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#exemplar
//
// Facts used, each from the pages above: an exemplar is a recorded value that associates OpenTelemetry
// context to a metric event, and one use is to link traces with metrics; it has the optional trace
// (trace_id, span_id), the time, the value and filtered attributes (data model). The SDK exemplar says
// that for synchronous instruments the trace ID and span ID are those of the active Span in the
// Context of the Measurement at API call time. A Metric SDK MUST provide the ExemplarFilter and
// ExemplarReservoir hooks, exemplar sampling SHOULD be on by default, the filter's default SHOULD be
// TraceBased, and the SDK MUST support AlwaysOn, AlwaysOff and TraceBased. The filter decides which
// measurements are eligible and the reservoir makes the final decision; TraceBased makes eligible the
// measurements recorded in the context of a sampled parent span; the reservoir MAY sample further
// than the filter. OTEL_METRICS_EXEMPLAR_FILTER takes always_on, always_off or trace_based, default
// trace_based (SDK environment variables).
// Dash0 tie-in: n/a. OUTLINE §4 Act 3 row 3.6 says "jump from a spike to a trace", but no page of the
// Dash0 docs (every page in https://www.dash0.com/sitemaps/docs.xml, 436 on 2026-11-01) describes
// exemplars in the UI; the only mention is the quota of 8 exemplars per data point on
// https://www.dash0.com/docs/dash0/cost-control/quotas-and-limits . So the level states no Dash0
// behaviour and has no Dash0 step. OUTLINE is not edited here.
//
// The words are in content/core/levels/exemplars.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/exemplars.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// Step 1. Eight points of payments.charge.duration (a histogram, seconds), as a debug view would print
// them: time, series, the point's fields (count, sum, min and max of the window, two decimals) and its
// exemplar field. Six 15 s windows of one /pay series (09:14:00 to 09:15:15, the same label set on each)
// show a spike from 09:14:30 to 09:15:00: charges got slow, so fewer finish and the sums jump. A
// scheduler-run job (refund-batch) and a series that has a trace id and span id as labels are on the
// list too. The faults are the three points whose exemplar field holds a value, a trace_id and a
// span_id (the spike points hold two and three, one per recorded measurement, since a point can carry
// several; the quiet window holds one). The content's `whyNot` is shown for a picked point that has none. The text
// never says why a point has none; step 2 asks.
// The numbers are placed so that no blind rule reads the answer off them (test/spot-tells.test.mjs):
// among the answers and the decoys, count, sum, min, max, length, digits, words and "=" signs
// interleave. The decoys that are not the /pay series carry extra labels so their length and token
// counts sit between the answers'. Exemplar values lie within the point's min and max; the pay-label
// decoy's ids appear nowhere else. The point lines are in the content file, in the order the game shows them.
const SPOT = {
  id: 'exm-spot',
  target: 'config',
  helps: { hints: true },
  faults: ['pay-0914-15', 'pay-0914-30', 'pay-0915-00'],
};

// Step 2: why the other points have none. `why` follows "Right." or "Not quite."; only the right choice is listed here.
const SKELETON = {
  id: 'exemplars',
  no: '3.6',
  icon: '\u{1F3AF}',
  cards: ['exemplars-need-sampled-spans'],
  lights: ['payments'],
  scoring: { parMs: null },
  play: {
    prefix: 'exm',
    steps: [
      { qid: 'exm-q-spot', spot: SPOT },
      { qid: 'exm-q-why', choice: { id: 'exm-why', choices: [{ key: 'unsampled-or-no-span', right: true }] } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: {} });
}

export default withText(CORE);
