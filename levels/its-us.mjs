// Act 9 boss: It's us. The game's own save path failed while the player played. The level has two steps: a game `spot` step, where the
// player picks their own failed span out of a list of spans from several attempts (filter on an attribute, read the span status), then an
// In Dash0 step (task 'its-us-find', seeded), where the same hunt happens in the game's own Dash0 organisation: the Trace Explorer, a look for
// the attempt id the step shows (the link opens it without a filter), the Trace View, the failing span in the Span Sidebar, its attributes and its span events. The task
// server sends the incident and grades the four answers; the game never sends anything, so this file reads no telemetry session (docs/DASH0-LAB.md).
// A player who cannot do the In Dash0 step (signed out, task server off) plays the spot step alone (lib/play.mjs, D7).
// Spec: https://opentelemetry.io/docs/specs/otel/trace/api/#set-status , https://opentelemetry.io/docs/specs/otel/trace/api/#add-events
// Spec: https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding
// Spec: https://www.dash0.com/docs/dash0/telemetry/tracing/about-tracing , https://www.dash0.com/docs/dash0/telemetry/tracing/view , https://www.dash0.com/docs/dash0/telemetry/tracing/span-sidebar
// Spec: https://www.dash0.com/docs/dash0/telemetry/tracing/span-events , https://www.dash0.com/docs/dash0/miscellaneous/glossary/filtering
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/tracing/about-tracing , https://www.dash0.com/docs/dash0/telemetry/tracing/span-table , https://www.dash0.com/docs/dash0/telemetry/tracing/view , https://www.dash0.com/docs/dash0/telemetry/tracing/span-sidebar , https://www.dash0.com/docs/dash0/telemetry/tracing/span-events , https://www.dash0.com/docs/dash0/miscellaneous/glossary/filtering
// Facts used (read 2026-11-27):
// - Span status is Unset (the default), Ok (the operation has been validated by an application developer or operator to have completed successfully)
//   or Error (the operation contains an error) (Trace API, Set Status).
// - The Trace Explorer has a Filter, a Command Menu and a Time Picker (the time range of all views); the Span Table shows spans; the Trace View
//   shows one trace; the Span Sidebar opens when a record in the Span Table or Trace View is selected (tracing/about-tracing; the Span Table and Span Sidebar: span-table, span-sidebar).
// - A filter picks a key first, then an operator (is / equals), then the value (glossary/filtering).
// - The Span Sidebar's Overview tab has a "View full trace" button that opens the Trace View; its Attributes tab lists the span's key-value pairs;
//   its Related Logs & Events tab shows log records and span events; its Source tab shows the full resourceSpans structure as sent to Dash0
//   (tracing/span-sidebar). In the Trace View the Errors tag shows only failed spans (tracing/view).
// - A span event has a name (such as exception, cache.miss, retry), a timestamp and attributes; retries can be recorded as events on the enclosing span
//   (tracing/span-events). The OTLP JSON encoding writes traceId as a hex string (otlp, JSON Protobuf encoding).
// Not on a Dash0 page, so unverified (#195, P8): that game.attempt.id is offered as a filter key in the game's own Dash0 organisation (the filter page says Dash0 offers
// "all available and relevant keys"), and that the deep link's time window still shows the trace. The In Dash0 step's words
// say to check the time range if the list is empty.
// Invented: the attempt ids (att-4d27 and the others), the span lines of the spot step, and the attribute names game.attempt.id and game.fault.code
// (the game's own, set by the task server; lib/dash0-task/stamp.mjs, lib/incident-lab.mjs).
//
// A play level: its words are in content/core/levels/its-us.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/its-us.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// Step 1. Lines read `operation=... status=... game.attempt.id=...` (the widget wants a key=value line for a span). Only the player's own span in error is a fault.
const SPOT = {
  id: 'its-spot',
  target: 'span',
  helps: { hints: false }, // the Act 9 boss has no helps (#240)
  faults: ['mine-error'],
};

// Step 2. The task server grades each answer; none is ever in this file (lib/dash0-task/tasks.mjs lists the ids).
const DASH0 = {
  id: 'its-find',
  task: 'its-us-find',
  grader: 'seeded',
  answers: ['operation', 'faultCode', 'retryCount', 'traceId'],
};

const SKELETON = {
  id: 'its-us',
  no: null,
  icon: '\u{1F575}',
  cards: [],
  lights: ['collector'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'its',
    steps: [
      { qid: 'its-q-spot', spot: SPOT },
      { dash0: DASH0 },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: {} });
}

export default withText(CORE);
