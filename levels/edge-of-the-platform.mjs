// Level 9.8: Edge of the platform. Act 9 "Live Demo" (docs/LIVE-DEMO.md), Samoa. Kettle & Co's order function runs on a serverless platform that
// suspends its environment right after a handler returns, with a batch span processor. Its spans never arrive. The player picks
// the fix that gets every invocation's spans out before the handler returns (Choice: ForceFlush on the tracer provider; lowering the batch delay
// and calling Shutdown each time are the two that sound right and fail), then connects the worker's batch span to the three messages it handled
// (Build it, `edit: ['links']`), one from each of three traces, with two decoys: a publish span whose message is not in this batch, and the
// request span that is one publish span's parent. The step 2 board is solvable only from the batch's message list.
// Spec: https://opentelemetry.io/docs/specs/otel/trace/sdk/#forceflush-1 , https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/ , https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/
//
// Facts used (each read on the page named, 2026-11-08). Trace SDK, "ForceFlush" on the TracerProvider: it "provides a way for provider to
// immediately export all spans that have not yet been exported for all the internal processors", and it "MUST invoke ForceFlush on all
// registered SpanProcessors". Trace SDK, SpanProcessor ForceFlush: "ForceFlush SHOULD only be called in cases where it is absolutely necessary,
// such as when using some FaaS providers that may suspend the process after an invocation, but before the SpanProcessor exports the completed
// spans." Trace SDK, batching processor: it exports a batch "scheduledDelayMillis after the processor is constructed OR the first span is
// received by the span processor", or when the queue holds maxExportBatchSize spans, or when ForceFlush is called; `scheduledDelayMillis`
// "The default value is 5000". SDK environment variables: OTEL_BSP_SCHEDULE_DELAY is the "Delay interval (in milliseconds) between two
// consecutive exports", default 5000. Trace SDK, TracerProvider Shutdown: "Shutdown MUST be called only once for each TracerProvider instance.
// After the call to Shutdown, subsequent attempts to get a Tracer are not allowed." Shutdown "MUST be implemented at least by invoking Shutdown
// within all internal processors", and for a SpanProcessor "Shutdown MUST include the effects of ForceFlush". Messaging spans (semantic conventions 1.45.0, status Development): "A single
// "Process" or "Receive" span can account for a single message, for a batch of messages, or for no message at all", and "For each message it
// accounts for, the "Process" or "Receive" span SHOULD link to the message's creation context"; span links are "the only option to correlate
// producer and consumer(s) in batch scenarios as a span can only have a single parent".
//
// Stated as reasoning, with no source: that a lower delay cannot rescue the last span, because the root span ends as the handler returns and a
// timer can only fire after a span has ended, when this platform has already suspended the environment; that a warm environment is reused by
// later requests (the scenario says so); and that "Shutdown after each invocation" therefore breaks the later ones (the spec's only-once rule
// is the sourced part). The spec's FaaS sentence is the only place it mentions FaaS or short-lived environments; it is quoted, not paraphrased.
//
// Invented for the game: the company, the 120 ms handler, the suspension right after return, every id, trace id, name and time, the batch of
// three messages and the fourth message of another trace. No Dash0, hostname or pricing claim is made.
//
// The words are in content/core/levels/edge-of-the-platform.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/edge-of-the-platform.mjs';
import { bindLevel } from '../lib/content/bind.mjs';
import { shortTrace } from '../lib/widgets/build-it-names.mjs';

const HANDLER_MS = 120; // the handler runs this long, then the platform suspends the environment
const DELAY_MS = 5000; // OTEL_BSP_SCHEDULE_DELAY default
const LOWER_MS = 1000; // the lowered delay of the first wrong choice: still longer than the handler
const START = 100; // the worker's batch span starts here on the Build board

const T_A = '5d41402abc4b2a76b9719d911017c592';
const T_B = '7b8b965ad4bca0e41ab51de7b31363a1';
const T_C = '098f6bcd4621d373cade4e832627b4f6';
const T_D = '1f3870be274f6c49b3e31a0c6728957f';
const T_E = '2cf24dba5fb0a30e26e83b2ac5b9e29e';
const REQ_A = 'b3e1f0a4c9d27685';
const P1 = '4a7d2c9e1f3b8065';
const P2 = 'c81e3a5d7f092b46';
const P3 = 'e2b5094a6c1d7f38';
const P4 = '7f1a6d3c2e9b0845';
const PROC = 'd09a4e7b2c5f1863';

const span = (spanId, traceId, service, name, kind, startMs, endMs, parentId = null) => ({
  spanId, traceId, name, service, kind, startMs, endMs, status: 'UNSET', attributes: {}, events: [], parentId, links: [],
});

// Step 1: the fix. `why` follows "Right." or "Not quite.". Labels are of one length and each names its own mechanism.
// Only the right choice is listed here.
const FIX = [{ key: 'force-flush', right: true }];

// Step 2: the batch. The consumer is a root in a trace of its own. Four publish spans: three are the messages of the batch, one is the message
// of the next batch. PUBLISH ids and times are chosen so no ordering rule (start, span id, row) picks the three: the fourth message is
// published between the second and the third, and its span id lies between the first's and the second's.
const SPANS = [
  span(REQ_A, T_A, 'checkout', 'POST /orders', 'SERVER', 0, 40),
  span(P1, T_A, 'orders', 'orders publish', 'PRODUCER', 5, 15, REQ_A),
  span(P2, T_B, 'orders', 'orders publish', 'PRODUCER', 20, 30),
  span(P4, T_D, 'orders', 'orders publish', 'PRODUCER', 35, 45),
  span(P3, T_C, 'orders', 'orders publish', 'PRODUCER', 50, 60),
  span(PROC, T_E, 'orders-worker', 'orders process', 'CONSUMER', START, START + HANDLER_MS),
];
const BATCH = {
  id: 'eop-batch',
  spans: SPANS,
  edit: ['links'],
  answer: { [PROC]: { links: [P1, P2, P3] } },
  helps: {}, // no helps, a Check button, no hints
};

/** The batch's messages in delivery order: message, the span that created it, and that span's trace as the board names it. */
const MESSAGES = [['m-1', P1], ['m-2', P2], ['m-3', P3]].map(([message, spanId]) => {
  const s = SPANS.find((x) => x.spanId === spanId);
  return { message, spanId, trace: shortTrace(s.traceId) };
});

// The figures the copy quotes, each filled into the content's {{name}} marks with the same expression and formatting the copy used.
// The message table's rows are built from MESSAGES; its caption and headings are in the content file.
const VARS = {
  'handler-ms': HANDLER_MS,
  'delay-ms': DELAY_MS,
  'lower-ms': LOWER_MS,
  start: START,
  'message-rows': MESSAGES.map((m) => `<tr><td>${m.message}</td><td><code>${m.trace}</code></td></tr>`).join(''),
};

// The level as it was, minus the words.
const SKELETON = {
  id: 'edge-of-the-platform',
  no: '9.8',
  icon: '\u{1F9CA}',
  cards: [],
  lights: ['orders'],
  scoring: { parMs: null },
  play: {
    prefix: 'eop',
    steps: [
      { qid: 'eop-q-fix', choice: { id: 'eop-fix', choices: FIX } },
      { qid: 'eop-q-batch', build: BATCH },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);

// The level's answer tables (pinned by test/edge-of-the-platform.test.mjs), read from the bound level so the choices carry their text.
const BOUND = withText(CORE);
export const CONTENT = {
  choices: BOUND.play.steps[0].choice.choices,
  build: BOUND.play.steps[1].build,
  messages: MESSAGES,
  ids: { P1, P2, P3, P4, REQ_A, PROC },
};
