// Level 5.4: Agent vs gateway. The player tells the gateway pattern from the agent, says why tail sampling in a
// gateway with several replicas needs the same Collector to see every span of a trace, wires the `load_balancing`
// exporter into an agent's traces pipeline so the Collector starts, and says what the exporter routes by (traceID).
// Spec: docs/OUTLINE.md §4 Act 5.
// Spec: https://opentelemetry.io/docs/collector/deploy/agent/ , https://opentelemetry.io/docs/collector/deploy/gateway/
// Docs (GitHub READMEs, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/exporter/loadbalancingexporter/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/tailsamplingprocessor/README.md
//
// Facts used: an agent runs close to the application or on the same host, as a sidecar or a DaemonSet; a gateway is one or
// more Collector instances running as a standalone service, such as a Deployment, with typically one endpoint per cluster,
// data center or region (the deployment pages). The tail_sampling processor needs all spans of a trace in the same Collector
// instance; the way to scale is two tiers, the first with the load balancing exporter (the processor README and the gateway
// page). The exporter picks a backend by hashing its routing_key: traceID is the default for traces, service keeps a service
// together, and traceID is not valid for metrics. The exporter type is now load_balancing; loadbalancing is a deprecated alias.
//
// COLLECTOR_SCHEMA (docs/M1-DESIGN.md §4.8) does not model component settings, so the configure step grades the wiring
// (`uses` requires load_balancing in the traces pipeline and otlp_grpc/gateway in the metrics one, `forbids` keeps otlp_grpc/gateway out of the traces list and load_balancing out of the metrics one) and says so; `routing_key` is graded by the last Choice step.
// Extending the schema to grade one key of one exporter was not worth it. Listing load_balancing in the metrics pipeline is
// wrong twice over: metrics must keep otlp_grpc/gateway (`uses`) and `forbids` rejects load_balancing there; the explain says metrics are not routed by trace ID.
// Accepted gap: pipelines are graded by name, so a second pipeline (say `traces/direct`) that sends traces to otlp_grpc/gateway
// is not caught by `forbids`; only the `traces` list is read. Not worth modelling for this level.
// Accepted gap (#381): the settings are not graded, so an empty `load_balancing:`, one without `resolver` and `routing_key: service`
// all pass. The task therefore promises only the wiring ("every name its pipelines list is defined", never "starts"), and the
// reference leaves `routing_key` out (traceID is the default for traces) so the tier 3 apply does not answer the next question.
//
// The three Choice steps are answer pools (#390, docs/CONTENT.md section 10): the content lists 9, 9 and 9 answers (3 right, 6 wrong) and a showing
// draws 3. Their extra answers rest on pages read 2026-11-21: the agent and gateway pages (https://opentelemetry.io/docs/collector/deploy/agent/ and
// .../gateway/: sidecar or DaemonSet beside the workload, a standalone service with one OTLP endpoint per cluster, data center or region, centrally
// managed credentials and policies, one or more instances behind a load balancer), the load balancing exporter README
// (.../opentelemetry-collector-contrib/blob/v0.164.0/exporter/loadbalancingexporter/README.md: the default routing key for traces is traceID, service
// keeps a service together, metric and streamID route metrics, consistent hashing, not round robin) and the tail sampling processor README
// (.../processor/tailsamplingprocessor/README.md: all spans of a trace must reach one instance, stateful, num_traces 50000 and decision_wait 30s by
// default, groups spans by trace ID itself).
//
// The words are in content/core/levels/agent-vs-gateway.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/agent-vs-gateway.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 3: the config. The given is an agent whose traces pipeline names load_balancing, which nobody defined
// (the Collector would refuse to start); metrics go straight to the gateway Service.
const GIVEN = [
  'receivers:',
  '  otlp:',
  '    protocols:',
  '      grpc:',
  '        endpoint: 0.0.0.0:4317',
  'processors:',
  '  memory_limiter:',
  '    check_interval: 1s',
  '    limit_mib: 400',
  '  batch:',
  'exporters:',
  '  otlp_grpc/gateway:',
  '    endpoint: gateway-collector:4317',
  'service:',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, batch]',
  '      exporters: [load_balancing]',
  '    metrics:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, batch]',
  '      exporters: [otlp_grpc/gateway]',
  '',
].join('\n');

const REFERENCE = GIVEN.replace(
  '  otlp_grpc/gateway:\n    endpoint: gateway-collector:4317\n',
  [
    '  otlp_grpc/gateway:',
    '    endpoint: gateway-collector:4317',
    '  load_balancing:',
    '    protocol:',
    '      otlp:',
    '        tls:',
    '          insecure: true',
    '    resolver:',
    '      dns:',
    '        hostname: gateway-collector-headless',
    '',
  ].join('\n'),
);

const CONFIG = {
  id: 'agw-config',
  schema: 'collector',
  given: GIVEN,
  reference: REFERENCE,
  uses: { traces: ['load_balancing'], metrics: ['otlp_grpc/gateway'] },
  forbids: { traces: ['otlp_grpc/gateway'], metrics: ['load_balancing'] },
  withhold: [['routing_key', 'traceID'], ['routing_key', 'service'], ['routing_key', 'trace ID'], ['traceID']], // settings left out of the reference that the Guide must not give (agw-key's answer, #381)
  helps: { hints: true },
};

// The level as it was, minus the words. Only the answers are marked: every choice's text is in the content file.
const SKELETON = {
  id: 'agent-vs-gateway',
  no: '5.4',
  icon: '\u{1F500}',
  cards: ['tail-sampling-needs-one-collector'],
  lights: ['collector'],
  scoring: { parMs: null },
  play: {
    prefix: 'agw',
    steps: [
      {
        qid: 'agw-q-pattern',
        choice: {
          id: 'agw-pattern',
          draw: 3,
          choices: [
            { key: 'gateway', right: true },
            { key: 'single-endpoint', right: true },
            { key: 'central-policy', right: true },
            { key: 'agent' },
            { key: 'embedded' },
            { key: 'sdk-direct' },
            { key: 'plain-balancer' },
            { key: 'one-replica' },
            { key: 'receiver-name' },
          ],
        },
      },
      {
        qid: 'agw-q-why',
        choice: {
          id: 'agw-why',
          draw: 3,
          choices: [
            { key: 'same-instance', right: true },
            { key: 'partial-view', right: true },
            { key: 'requests-not-traces', right: true },
            { key: 'wait' },
            { key: 'unsupported' },
            { key: 'num-traces' },
            { key: 'stateless' },
            { key: 'out-of-order' },
            { key: 'clock-drift' },
          ],
        },
      },
      {
        qid: 'agw-q-config',
        configure: CONFIG,
      },
      {
        qid: 'agw-q-key',
        choice: {
          id: 'agw-key',
          draw: 3,
          choices: [
            { key: 'trace-id', right: true },
            { key: 'default-key', right: true },
            { key: 'hash-trace', right: true },
            { key: 'service' },
            { key: 'round-robin' },
            { key: 'metric-key' },
            { key: 'span-id' },
            { key: 'sending-node' },
            { key: 'session-affinity' },
          ],
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
