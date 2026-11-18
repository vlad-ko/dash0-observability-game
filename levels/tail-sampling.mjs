// Level 6.2: Tail sampling. The player sets up a tail sampler for the memory it can hold (policies that keep the errors, the
// slow traces and a healthy baseline, and a decision wait long enough to see the whole trace but not longer than the memory
// allows), then spots the pipeline where the span_metrics connector is fed after tail_sampling, so the request and error rates
// it computes come from the kept traces only.
// Spec: docs/OUTLINE.md §4 Act 6.
// Spec: https://opentelemetry.io/docs/concepts/sampling/#tail-sampling , https://opentelemetry.io/docs/collector/configuration/#connectors
// Docs (GitHub READMEs at the v0.164.0 tag, the Collector version the repo pins elsewhere; not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/tailsamplingprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/connector/spanmetricsconnector/README.md , https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/connector/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/connector/countconnector/README.md (usable with no settings; counts spans as trace.span.count) , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/probabilisticsamplerprocessor/README.md (samples per request, statelessly)
// (the spanmetrics README's histogram example and metrics_flush_interval are no longer on the board, which shows no component definitions; the config page shows pipelines under service: pipelines: with receivers, processors and exporters lists; the count connector README says it may be used without any configuration settings and counts spans from a traces pipeline as trace.span.count; the probabilistic_sampler README says sampling is per request, considering items statelessly, and points to tail_sampling for whole traces)
// (the connector README shows one connector as the exporter of several pipelines, which then all feed that one connector; the spanmetrics README's "Known Limitation: the Single Writer Principle" warns that several pipelines using one instance, or several instances writing the same streams, can conflict or drop series, so the config here has one pipeline exporting to exactly one span_metrics connector)
//
// Facts used (each read on the page above): tail sampling decides on all or most of the spans of a trace, so it can always keep
// traces with an error or a high latency, and its downsides are that it is hard to implement and to operate, because the component
// is stateful and holds a lot of data (the sampling concepts page). The tail_sampling processor groups spans by trace ID, keeps them in
// memory while it waits for a decision, and needs every span of a trace in the same Collector instance; policies include
// status_code, latency and probabilistic; decision_wait defaults to 30s and num_traces, the number of traces kept in memory,
// to 50000; a trace that arrives when the buffer is full can be dropped before it is sampled, and a span that arrives after its
// trace was decided is late and "can cause different sampling decisions for different parts of the trace" (the processor README).
// The span_metrics connector (renamed from spanmetrics, the old name still works and is deprecated) counts the spans it receives
// into calls and duration metrics; a connector is an exporter at the end of one pipeline and a receiver at the start of another,
// processors run in the order listed, and a receiver may be used in more than one pipeline (the Collector configuration page).
//
// Widgets: Trade-off for the memory and decision-wait cost (an authored table, not a simulation), and Spot it for the placement.
// Spot it does not parse the config or check any wiring: it grades which of ten config lines the player selects against a seeded
// set. The seeded fault is two lines of one pipeline, the processors of the traces pipeline (tail_sampling among them) and its exporters
// (span_metrics among them): each is right alone, and together they count only the spans the sampler kept. A second pipeline,
// traces/archive, lists probabilistic_sampler but exports no connector, so it is no fault. Configure it
// cannot grade this, because its `uses` can only require a component, never forbid one. There is no Configure it step.
// The numbers are one invented table: 400 traces a second, a gateway replica that holds each for the decision wait at 0.05 MiB a trace.
// Error and slow traces are taken as distinct sets, so the kept figures add up.
//
// The words are in content/core/levels/tail-sampling.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
// The ten config lines (the Spot it step's `lines`) are only shown and picked, not parsed by the game, so they are content too;
// test/act-6.test.mjs reads them from the bound level and assembles them into a config.
import CORE from '../content/core/levels/tail-sampling.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const TRACES = 400; // new traces a second reaching the replica
const MIB_PER_TRACE = 0.05;
const SLOWEST = 20; // seconds the slowest checkouts take end to end
const ERROR_RATE = 0.02;
const SLOW_RATE = 0.03;
const BASELINE = 0.05; // of the rest
const CAP = 550; // MiB
const NUM_TRACES = 50000; // the processor's default

const n = (x) => x.toLocaleString('en-US');
const pct = (x) => `${Math.round(x * 100)}%`;
const held = (seconds) => TRACES * seconds;
const mib = (seconds) => Math.round(held(seconds) * MIB_PER_TRACE * 100) / 100;
const ERRORS = TRACES * ERROR_RATE;
const SLOW = TRACES * SLOW_RATE;
const REST = TRACES - ERRORS - SLOW;
const BASE = REST * BASELINE;
const KEPT = ERRORS + SLOW + BASE;
const ERROR_SHARE = Math.round((ERRORS / KEPT) * 100);

// The figures the copy quotes, each filled into the content's {{name}} marks with the same expression and formatting the copy used.
const VARS = {
  traces: n(TRACES),
  'error-pct': pct(ERROR_RATE),
  'slow-pct': pct(SLOW_RATE),
  slowest: SLOWEST,
  'mib-per-trace': MIB_PER_TRACE,
  cap: n(CAP),
  mib10: n(mib(10)),
  mib30: n(mib(30)),
  mib5: n(mib(5)),
  mib25: n(mib(25)),
  mib15: n(mib(15)),
  errors: n(ERRORS),
  slow: n(SLOW),
  base: n(BASE),
  kept: n(KEPT),
  'errors-slow': n(ERRORS + SLOW),
  tenth: n(TRACES * 0.1),
  held30: n(held(30)),
  'mib-extra': n(mib(30) - mib(25)),
  held25: n(held(25)),
  'num-traces': n(NUM_TRACES),
  saving: pct(1 - KEPT / TRACES),
  'error-share': ERROR_SHARE,
};

// Step 1: the trade-off. Two knobs. The wait costs the traces held while it runs (the sampler's memory); what the
// policies keep costs nothing extra, because the processor holds every trace until it decides, whichever policies are
// set, so the policies are decided by the needs. The wait is the deciding cost: it must outlast the slowest trace
// (20 s) to decide on the whole of it, and every second of it is memory, so the 30-second default does not fit. The
// cards show the costs and not what an option keeps until a Check. No blind rule finds the plan
// (test/trade-off-balance.test.mjs probes them); most-keeps rules do not apply here: one need only the wait meets
// and every policy costs 0.
const BUDGET = {
  id: 'ts-budget',
  cap: CAP,
  helps: { hints: true },
  knobs: [
    {
      id: 'wait',
      options: [
        { id: 'wait-10s', cost: mib(10) },
        { id: 'wait-30s', cost: mib(30), keeps: ['whole-traces'] },
        { id: 'wait-5s', cost: mib(5) },
        { id: 'wait-25s', cost: mib(25), keeps: ['whole-traces'] },
        { id: 'wait-15s', cost: mib(15) },
      ],
    },
    {
      id: 'policies',
      options: [
        { id: 'errors-slow-baseline', cost: 0, keeps: ['errors-kept', 'slow-kept', 'baseline-kept'] },
        { id: 'errors-slow', cost: 0, keeps: ['errors-kept', 'slow-kept'] },
        { id: 'probabilistic', cost: 0, keeps: ['baseline-kept'] },
        { id: 'errors', cost: 0, keeps: ['errors-kept'] },
      ],
    },
  ],
  needs: [{ id: 'errors-kept' }, { id: 'slow-kept' }, { id: 'baseline-kept' }, { id: 'whole-traces' }],
  answer: { wait: 'wait-25s', policies: 'errors-slow-baseline' },
};

// Step 2: the placement, on the smallest config that shows it: one span_metrics connector (the spanmetrics README's single writer
// rule: two connectors writing the same metrics conflict). Each pipeline line is one field of one pipeline, written as the YAML
// flow mapping it is under service: pipelines:. The processors line and the exporters line of the traces pipeline are the two
// faults: each is right alone (a processors list with tail_sampling is how a traces pipeline samples what it exports, and a connector
// must be listed as an exporter somewhere), together they count only the spans the sampler kept. The eight other lines are correct,
// and the ten together are part of one config the Collector accepts (the connector is exported by a traces pipeline and received by
// a metrics one; the receivers the lines leave out are otlp, and the exporters they leave out are otlp_grpc/dash0 and otlp_grpc/archive); the fix the explain describes is a valid one-connector config too. test/act-6.test.mjs assembles both and checks that. Ten lines, two answers and the second sampled pipeline are what keep
// test/spot-tells.test.mjs from finding a counting rule that lands within one wrong Check (#193): do not trim the board.
const SPOT = {
  id: 'ts-spot',
  target: 'config',
  helps: { hints: false },
  faults: ['traces-processors', 'traces-exporters'],
};

const SKELETON = {
  id: 'tail-sampling',
  no: '6.2',
  icon: '\u{23F3}',
  cards: ['spanmetrics-before-sampling'],
  lights: ['collector'],
  scoring: { parMs: null },
  play: {
    prefix: 'ts',
    steps: [
      { qid: 'ts-q-budget', tradeoff: BUDGET },
      { qid: 'ts-q-spot', spot: SPOT },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
