// Level 4.2: Correlation. The player attaches six log records to the spans they were written in (Build it
// in logs mode: a record is a standalone record that carries a trace_id and a span_id, never a child span),
// then says why three have no link (the log call ran outside an active span, or through a logger that is
// not bridged), how to get a worker's records linked (run the call inside a span), and what Dash0 shows
// for an unlinked record. The Spot it step of #91 is replaced by the Build it step, which grades the same
// nuance on more evidence; the three Choice steps are kept.
// Spec: docs/OUTLINE.md §4 Act 4.
// Spec: https://opentelemetry.io/docs/specs/otel/logs/data-model/ , https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-traceid , https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-spanid , https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-traceflags
// Spec: https://opentelemetry.io/docs/specs/otel/logs/api/ , https://opentelemetry.io/docs/specs/otel/logs/ , https://opentelemetry.io/docs/concepts/signals/logs/
// Spec: https://www.w3.org/TR/trace-context/#trace-id , https://www.w3.org/TR/trace-context/#parent-id
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/logging/log-sidebar , https://www.dash0.com/docs/dash0/telemetry/logging/related-logs , https://www.dash0.com/docs/dash0/telemetry/tracing/span-sidebar , https://www.dash0.com/docs/dash0/telemetry/tracing/view
//
// Facts used, each from the pages above: TraceId and SpanId are fields of the log record, set "for logs
// that are part of request processing" (the data model); the Logs API call takes a Context that, when
// implicit context is supported and none is passed, MUST be the current context (logs API); the concepts
// page says an SDK or auto-instrumentation correlates existing logs with the active trace and span, and
// that this goes through the log appender; an all-zero trace id and an all-zero span id are invalid
// (W3C Trace Context). Dash0: the Log Sidebar shows the span a log was created in (its Span Context);
// it reads TraceId and SpanId from the OTLP fields, and for other paths from recognised attribute
// names; the span's Related Logs & Events tab lists, by default, the logs and span events of the same
// trace, and can list by Resource (within 30 minutes of the span), which suits logs outside the trace
// such as background jobs. Nothing below says Dash0 matches an unlinked record any other way.
//
// The words are in content/core/levels/correlation.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/correlation.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The two orders and the cart span's name are held once here: the fixture below reads them, and so does the copy (as
// fill-ins), so a change to one cannot leave the other behind.
const ORDER = '8841';
const OTHER_ORDER = '8842';
const CART_SPAN = 'validate cart';

// What each {{name}} in the content file is replaced with.
const VARS = {
  order: ORDER,
  'other-order': OTHER_ORDER,
  'cart-span': CART_SPAN,
};

// Step 1: Build it in logs mode. Four spans (two orders at checkout, one charge at payments) and six
// records from Kettle & Co, none real. The player attaches each record to the span it was written in, or
// to none: the record's trace_id and span_id then fill in from that span. Three records get a span: the
// cart check (the innermost span, started as the current span), the neighbour order's record (same service
// and time as order 8841's spans, told apart by order.id) and the slow-provider warning. Three stay
// unlinked: startup (before any request), the retry worker (inside the charge span's window and service,
// but another thread wrote it, so no span was current) and the email (no notifications span on the board).
// Records are standalone: never a span row, never a child.
const T1 = '4bf92f3577b34da6a3ce929d0e0e4736';
const T2 = '0af7651916cd43dd8448eb211c80319c';
const CHECKOUT = 'b1a2c3d4e5f60718';
const CART = '00f067aa0ba902b7';
const CHARGE = '3ee05e5bb0f1ae0c';
const OTHER = 'b7ad6b7169203331';

const span = (spanId, traceId, parentId, name, service, kind, startMs, endMs, attributes = {}) => ({
  spanId, traceId, parentId, name, service, kind, startMs, endMs, status: 'UNSET', attributes, events: [], links: [],
});
const log = (id, timeMs, severity, service, body, attributes) => ({ id, timeMs, severity, service, body, traceId: null, spanId: null, attributes });

const BUILD = {
  id: 'cor-build',
  edit: ['logs'],
  spans: [
    span(CHECKOUT, T1, null, 'POST /checkout', 'checkout', 'SERVER', 0, 120, { 'order.id': ORDER }),
    span(CART, T1, CHECKOUT, CART_SPAN, 'checkout', 'INTERNAL', 20, 40),
    span(CHARGE, T1, CHECKOUT, 'POST /charge', 'payments', 'SERVER', 50, 110, { 'thread.name': 'http-exec-1' }),
    span(OTHER, T2, null, 'POST /checkout', 'checkout', 'SERVER', 30, 100, { 'order.id': OTHER_ORDER }),
  ],
  logs: [
    log('startup', -120, 'INFO', 'checkout', 'Listening on port 8080', { 'thread.name': 'main' }),
    log('cart', 30, 'DEBUG', 'checkout', 'Cart validated', { 'order.id': ORDER }),
    log('other-order', 60, 'INFO', 'checkout', 'Order accepted', { 'order.id': OTHER_ORDER }),
    log('provider-slow', 70, 'WARN', 'payments', 'Provider slow, retrying charge', { 'thread.name': 'http-exec-1' }),
    log('retry-worker', 95, 'ERROR', 'payments', 'Retry worker gave up on charge', { 'thread.name': 'retry-worker-2' }),
    log('email', 130, 'ERROR', 'notifications', `Email not sent for order ${ORDER}`, { 'thread.name': 'mail-pool-1' }),
  ],
  answer: { startup: null, cart: CART, 'other-order': OTHER, 'provider-slow': CHARGE, 'retry-worker': null, email: null },
};

// The level as it was, minus the words. Only the answers are marked: every choice's text is in the content file.
const SKELETON = {
  id: 'correlation',
  no: '4.2',
  icon: '\u{1F517}',
  cards: ['logs-need-an-active-span'],
  lights: ['checkout'],
  scoring: { parMs: null },
  play: {
    prefix: 'cor',
    steps: [
      { build: BUILD },
      {
        qid: 'cor-q-why',
        choice: {
          id: 'cor-why',
          draw: 3,
          choices: [{ key: 'no-active-span', right: true }, { key: 'no-span-current', right: true }, { key: 'start-up-and-workers', right: true }, { key: 'read-at-the-call', right: true }],
        },
      },
      {
        qid: 'cor-q-fix',
        choice: {
          id: 'cor-fix',
          draw: 3,
          choices: [{ key: 'run-in-span', right: true }, { key: 'span-per-attempt', right: true }, { key: 'carry-context-over', right: true }, { key: 'bring-back-context', right: true }],
        },
      },
      {
        qid: 'cor-q-dash0',
        choice: {
          id: 'cor-dash0',
          draw: 3,
          choices: [{ key: 'resource-mode', right: true }, { key: 'trace-mode-default', right: true }, { key: 'switch-to-resource', right: true }, { key: 'nothing-ties-it', right: true }],
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
