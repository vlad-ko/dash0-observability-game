// Level 1.3: Detectors and Kubernetes. The player says when an SDK's resource detectors run and
// where pod metadata is better added (the Collector), fixes a Collector config so the
// `k8s_attributes` processor is defined and listed in the traces pipeline, says what the processor
// needs to look pods up, and says what the Dash0 operator adds for a workload.
// Spec: docs/OUTLINE.md §4 Act 1.
// Spec: https://opentelemetry.io/docs/concepts/resources/#resource-detectors , https://opentelemetry.io/docs/specs/otel/resource/sdk/#resource-detector
// Spec: https://opentelemetry.io/docs/platforms/kubernetes/collector/components/#kubernetes-attributes-processor , https://opentelemetry.io/docs/collector/components/processor/ , https://opentelemetry.io/docs/collector/configuration/#processors
// Spec: https://opentelemetry.io/docs/specs/semconv/resource/k8s/#pod
// Spec: https://opentelemetry.io/docs/concepts/resources/ , https://opentelemetry.io/docs/platforms/kubernetes/collector/components/
// Docs (GitHub, component READMEs pinned to v0.164.0): https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.164.0/processor/k8sattributesprocessor , https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.164.0/processor/transformprocessor , https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.164.0/processor/attributesprocessor , https://github.com/open-telemetry/opentelemetry-collector/tree/v0.164.0/processor/batchprocessor , https://github.com/open-telemetry/opentelemetry-collector/tree/v0.164.0/processor/memorylimiterprocessor , https://github.com/open-telemetry/opentelemetry-collector/tree/v0.164.0/receiver/otlpreceiver , https://github.com/open-telemetry/opentelemetry-collector/tree/v0.164.0/exporter/otlpexporter
// Dash0 docs: https://www.dash0.com/docs/dash0/monitoring/kubernetes/dash0-operator/auto-instrumentation
// Docs (GitHub, the processor's type name, pinned to v0.164.0): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/k8sattributesprocessor/metadata.yaml , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/CHANGELOG.md
// Facts used (read 2026-11-22): the processor's metadata.yaml at v0.164.0 has `type: k8s_attributes` and
// `deprecated_type: k8sattributes`; the contrib CHANGELOG (v0.146.0): "Rename `k8sattributes` processor to
// `k8s_attributes` processor and add deprecated alias `k8sattributes`." The level teaches `k8s_attributes`
// and names the old spelling once, in the config step's explain; the README path and the processor's Go
// package keep the directory name `k8sattributesprocessor`.
//
// The configure step grades the config through COLLECTOR_SCHEMA (docs/M1-DESIGN.md §4.8), which
// does not model component settings, so the step grades the wiring (defined, the Collector would
// start, and `uses` requires the traces pipeline to list k8s_attributes) and the settings are taught
// in the choice steps. `uses` implies the traces pipeline must flow, so there is no `target`.
//
// The words are in content/core/levels/detectors-and-kubernetes.mjs (docs/CONTENT.md); this file keeps the answers, the configs and the wiring.
import CORE from '../content/core/levels/detectors-and-kubernetes.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// The choice steps (1, 2, 4 and 5) are answer pools (docs/CONTENT.md section 10). Each content file lists 13 to 15 answers
// and a showing draws 3 (one of the 4 right, 2 of the wrong ones). Only the right answers are marked here, so a right
// answer added in the content file without `right: true` would be graded wrong. No 50/50 (it needs 4 shown), so no `keep`.

// Step 1: when detectors run. `why` follows "Right." or "Not quite.".
const WHEN = [
  { key: 'at-start', right: true },
  { key: 'init', right: true },
  { key: 'setup', right: true },
  { key: 'one-time', right: true },
];

// Step 2: where pod metadata is better added.
const WHERE = [
  { key: 'collector', right: true },
  { key: 'daemonset', right: true },
  { key: 'gateway', right: true },
  { key: 'once-for-all', right: true },
];

// Step 3: the config. The pipeline lists `k8s_attributes`, but it is not defined: the Collector
// would refuse to start. The reference defines it, with the default metadata.
const GIVEN = [
  'receivers:',
  '  otlp:',
  '    protocols:',
  '      grpc:',
  'processors:',
  '  batch:',
  'exporters:',
  '  otlp_grpc/dash0:',
  '    endpoint: ${env:DASH0_ENDPOINT}',
  'service:',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [k8s_attributes, batch]',
  '      exporters: [otlp_grpc/dash0]',
  '',
].join('\n');

const REFERENCE = [
  'receivers:',
  '  otlp:',
  '    protocols:',
  '      grpc:',
  'processors:',
  '  k8s_attributes:',
  '    extract:',
  '      metadata:',
  '        - k8s.namespace.name',
  '        - k8s.pod.name',
  '        - k8s.pod.uid',
  '        - k8s.deployment.name',
  '        - k8s.node.name',
  '  batch:',
  'exporters:',
  '  otlp_grpc/dash0:',
  '    endpoint: ${env:DASH0_ENDPOINT}',
  'service:',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [k8s_attributes, batch]',
  '      exporters: [otlp_grpc/dash0]',
  '',
].join('\n');

const CONFIG = {
  id: 'det-config',
  schema: 'collector',
  given: GIVEN,
  reference: REFERENCE,
  uses: { traces: ['k8s_attributes'] },
  helps: { hints: true },
};

// Step 4: what the processor needs.
const RBAC = [
  { key: 'pods-namespaces', right: true },
  { key: 'read-only', right: true },
  { key: 'cluster-wide', right: true },
  { key: 'binding', right: true },
];

// Step 5: the Dash0 tie-in.
const DASH0 = [
  { key: 'operator-adds', right: true },
  { key: 'tracing', right: true },
  { key: 'attributes', right: true },
  { key: 'hassle', right: true },
];

// The level as it was, minus the words.
const SKELETON = {
  id: 'detectors-and-kubernetes',
  no: '1.3',
  icon: '\u{2638}\u{FE0F}',
  cards: ['k8sattributes-in-collector'],
  lights: ['redis'],
  scoring: { parMs: null },
  play: {
    prefix: 'det',
    steps: [
      { qid: 'det-q-when', choice: { id: 'det-when', draw: 3, choices: WHEN } },
      { qid: 'det-q-where', choice: { id: 'det-where', draw: 3, choices: WHERE } },
      { qid: 'det-q-config', configure: CONFIG },
      { qid: 'det-q-rbac', choice: { id: 'det-rbac', draw: 3, choices: RBAC } },
      { qid: 'det-q-dash0', choice: { id: 'det-dash0', draw: 3, choices: DASH0 } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
