// Level 4.1: Structured logs. The player sorts the fields of one log record into body, attributes,
// severity, resource and trace context, says how to record the facts of a payment decline (a short
// message in the Body, the facts as Attributes), says which severity to filter on (the number, not
// the text), and says what to do about the Logs Bridge API (keep the logger, add an appender).
// Spec: docs/OUTLINE.md §4 Act 4.
// Spec: https://opentelemetry.io/docs/specs/otel/logs/data-model/ , https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-body , https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-attributes
// Spec: https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitytext , https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber , https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-resource
// Spec: https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-traceid , https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-spanid , https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-traceflags
// Spec: https://opentelemetry.io/docs/specs/otel/logs/ , https://opentelemetry.io/docs/specs/otel/logs/api/ , https://opentelemetry.io/docs/concepts/signals/logs/
// Spec: https://www.w3.org/TR/trace-context/#trace-id
//
// Facts used, each from the pages above: the data model lists Timestamp, TraceId, SpanId, TraceFlags,
// SeverityText, SeverityNumber, Body, Resource, InstrumentationScope and Attributes; the Body is the
// message (a string, or structured data); Attributes are "additional information about the specific
// event occurrence" and can vary per record, unlike the Resource; SeverityText is "the original string
// representation of the severity as it is known at the source" and SeverityNumber is an integer from 1
// to 24 (TRACE 1-4, DEBUG 5-8, INFO 9-12, WARN 13-16, ERROR 17-20, FATAL 21-24), smaller meaning less
// severe; the Logs API "was primarily designed for library authors to build log appenders", and the
// concepts page says an application developer should not call the Logs Bridge API directly but use a
// preferred logging library with a log appender. The specification also says the Logs API can be used
// directly by applications (for instance to emit structured events), so the level says "keep your
// logger", not "never call the Logs API".
// Dash0 tie-in: none for this level (docs/OUTLINE.md §4 Act 4: n/a); the pooled severity answers use the severity ranges of
// https://www.dash0.com/docs/dash0/telemetry/logging/log-severities (Dash0 docs, not an allowed Spec host).
// Pooled answers (#390): the data model fields above for the sl-attrs and sl-severity pools (Attributes, Resource, InstrumentationScope,
// EventName, TraceId, SeverityNumber comparison); https://opentelemetry.io/docs/concepts/signals/logs/ for semistructured text and the
// Logger Provider and Logger of the Bridge API; https://opentelemetry.io/docs/specs/otel/logs/ for the richer feature set of logging libraries.
//
// The words are in content/core/levels/structured-logs.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/structured-logs.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 1. One record from Kettle & Co's payments service, as twelve pieces. Buckets are the fields of the
// data model (their ids and labels are in the content file). Labels must not give the bucket away
// (test/sort-tells.test.mjs). `whyNot` (in the content file) is shown for the buckets an item is
// likely to be confused with.
const SORT = {
  id: 'sl-sort',
  helps: { hints: false },
  buckets: [{ id: 'body' }, { id: 'attributes' }, { id: 'severity' }, { id: 'resource' }, { id: 'trace' }],
  items: [
    { id: 'msg-declined', bucket: 'body' },
    { id: 'order-id', bucket: 'attributes' },
    { id: 'severity-text', bucket: 'severity' },
    { id: 'service-name', bucket: 'resource' },
    { id: 'trace-id', bucket: 'trace' },
    { id: 'msg-retry', bucket: 'body' },
    { id: 'payment-method', bucket: 'attributes' },
    { id: 'severity-number', bucket: 'severity' },
    { id: 'pod-name', bucket: 'resource' },
    { id: 'span-id', bucket: 'trace' },
    { id: 'retry-attempt', bucket: 'attributes' },
    { id: 'trace-flags', bucket: 'trace' },
  ],
};

// The level as it was, minus the words. Only the answers are marked: every choice's text is in the content file.
const SKELETON = {
  id: 'structured-logs',
  no: '4.1',
  icon: '\u{1F4DC}',
  cards: ['severity-number-not-text'],
  lights: ['payments'],
  scoring: { parMs: null },
  play: {
    prefix: 'sl',
    steps: [
      { qid: 'sl-q-sort', sort: SORT },
      {
        qid: 'sl-q-attrs',
        choice: {
          id: 'sl-attrs',
          draw: 3,
          choices: [{ key: 'short-message', right: true }, { key: 'named-attrs', right: true }, { key: 'pairs-on-record', right: true }, { key: 'facts-out-of-text', right: true }],
        },
      },
      {
        qid: 'sl-q-severity',
        choice: {
          id: 'sl-severity',
          draw: 3,
          choices: [{ key: 'number', right: true }, { key: 'number-range', right: true }, { key: 'number-from-warn', right: true }, { key: 'severity-range', right: true }],
        },
      },
      {
        qid: 'sl-q-bridge',
        choice: {
          id: 'sl-bridge',
          draw: 3,
          choices: [{ key: 'keep-logger', right: true }, { key: 'leave-calls', right: true }, { key: 'appender-and-sdk', right: true }, { key: 'library-bridge', right: true }],
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
