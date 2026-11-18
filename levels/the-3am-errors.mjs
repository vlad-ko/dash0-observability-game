// Act 4 boss: The 3 a.m. errors. Orders starts logging a burst of errors and the error budget burns while
// the player investigates: from the error logs (one pattern, one record with a trace_id), to the trace
// that record points at (the call to inventory succeeded, orders failed to read the reply), to the deploy
// that changed the reply (inventory 3.1.0 renamed a field). Three views hold the chain (clues); two are red
// herrings; the rest are neutral. Scored. A plain-data Scenario for the incident engine, played through one
// declarative `incident` step (lib/widgets/incident.mjs, docs/M1-DESIGN.md §4.3, docs/DECLARATIVE-LEVELS.md §2).
// The scenario is designed for this game: docs/OUTLINE.md §4 Act 4 gives only "error burst; correlate logs to
// the trace to the deploy", with the Dash0 tie-in "one query language across signals".
// Spec: docs/OUTLINE.md §4 Act 4.
// Spec: https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-traceid , https://opentelemetry.io/docs/specs/otel/logs/
// Spec: https://opentelemetry.io/docs/concepts/signals/traces/ , https://opentelemetry.io/docs/specs/semconv/registry/attributes/service/
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/query-data/query-builder/about-query-builder , https://www.dash0.com/docs/dash0/telemetry/query-data/query-builder/analyze-logs
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/logging/patterns , https://www.dash0.com/docs/dash0/telemetry/logging/log-ai-processing
//
// Facts used, each from the pages above: TraceId and SpanId are fields of a log record, which is what lets a
// backend go from a log to the trace it was written in (logs data model); a trace is the spans that share a
// trace id, and a span's service.version is a resource attribute (traces concept, semantic conventions).
// Dash0: the Patterns view clusters similar log messages into templates with a record count and the severity
// breakdown, and Log AI extracts the variable parts as named attributes; PromQL is the query language of
// Dash0, and the Query Builder has tabs for logging, tracing and metrics that show the PromQL they build.
// Nothing below claims more than that a filter such as service.name reads the same in each of them.
// The closing Choice step uses the logs specification's three dimensions of correlation: by time ("the most basic
// form"), by trace context (TraceId and SpanId in the record) and by origin (the Resource).
//
// The words are in content/core/levels/the-3am-errors.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/the-3am-errors.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

// The figure the copy quotes: the trace id the error log record carries and the trace view shows.
const VARS = { 'trace-id': TRACE_ID };

const SCENARIO = {
  id: 'the-3am-errors',
  budget: { startPct: 100, burnPctPerMin: 5 },
  views: [
    { id: 'error-patterns', costMin: 4, kind: 'clue' },
    { id: 'trace-of-error', costMin: 5, kind: 'clue' },
    { id: 'deploys', costMin: 3, kind: 'clue' },
    { id: 'db-metrics', costMin: 3, kind: 'neutral' },
    { id: 'gateway-traffic', costMin: 2, kind: 'neutral' },
    { id: 'orders-pods', costMin: 2, kind: 'neutral' },
    { id: 'warn-noise', costMin: 4, kind: 'herring' },
    { id: 'provider-errors', costMin: 3, kind: 'herring' },
  ],
  hypotheses: [
    { id: 'inventory-reply', right: true },
    { id: 'orders-release', right: false },
    { id: 'database', right: false },
    { id: 'traffic-spike', right: false },
  ],
  answerAfterViews: 2,
};

// The level as it was, minus the words. Only the answers are marked: every choice's text is in the content file.
const SKELETON = {
  id: 'the-3am-errors',
  no: null,
  icon: '\u{1F319}',
  cards: [],
  lights: ['orders'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'tae',
    steps: [
      { incident: SCENARIO },
      {
        qid: 'tae-q-link',
        choice: { id: 'tae-link', choices: [{ key: 'trace-and-resource', right: true }] },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
