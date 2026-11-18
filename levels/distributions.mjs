// Level 5.6: Distributions. The player says what happens when a config names a component the
// Collector binary does not contain, sorts nine components into the pre-built distributions that ship
// them (core, contrib and k8s; contrib and k8s but not core; contrib only; none), and says how to get a
// component nobody ships: build a custom distribution with OCB, the OpenTelemetry Collector Builder.
// Spec: docs/OUTLINE.md §4 Act 5.
// Spec: https://opentelemetry.io/docs/collector/distributions/ , https://opentelemetry.io/docs/collector/extend/ocb/ , https://opentelemetry.io/docs/collector/components/processor/
// Docs (GitHub, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector-releases/blob/main/distributions/otelcol/manifest.yaml , https://github.com/open-telemetry/opentelemetry-collector-releases/blob/main/distributions/otelcol-contrib/manifest.yaml , https://github.com/open-telemetry/opentelemetry-collector-releases/blob/main/distributions/otelcol-k8s/manifest.yaml , https://github.com/open-telemetry/opentelemetry-collector-releases/blob/main/distributions/otelcol-k8s/README.md , https://github.com/open-telemetry/opentelemetry-collector-releases/blob/main/distributions/otelcol-contrib/README.md
//
// Docs (exporter type names, Collector v0.164.0): https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/otlpexporter/metadata.yaml , https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/otlphttpexporter/metadata.yaml
//
// What is taught is the part that does not change: a distribution is a fixed set of components
// compiled into one binary, and a config can only use what is in it. The items are components whose
// distribution list is the same on their README, on the processors, receivers and exporters pages of
// the docs and in the manifests (v0.164.0): batch, memory_limiter and the otlp_grpc exporter (core,
// contrib, k8s); k8sattributes, redaction and tail_sampling (contrib, k8s); the awss3 and awsxray
// exporters (contrib only). The core distribution has been gaining components (transform, filter and
// attributes are in its manifest while some component pages still list contrib and k8s), and the
// otlp and eBPF profiling distributions ship little, so no item depends on those, and the copy tells the
// player to read the manifest.
//
// The words are in content/core/levels/distributions.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/distributions.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 2: nine components, interleaved. `whyNot` has one line for each of the other three buckets.
// The buckets (ids and labels) and every item's text are in the content file.
const SORT = {
  id: 'dist-sort',
  helps: { hints: false },
  buckets: [{ id: 'all-three' }, { id: 'contrib-k8s' }, { id: 'contrib-only' }, { id: 'none' }],
  items: [
    { id: 'k8sattributes', bucket: 'contrib-k8s' },
    { id: 'batch', bucket: 'all-three' },
    { id: 'awss3-exporter', bucket: 'contrib-only' },
    { id: 'memory-limiter', bucket: 'all-three' },
    { id: 'redaction', bucket: 'contrib-k8s' },
    { id: 'acme-scrubber', bucket: 'none' },
    { id: 'tail-sampling', bucket: 'contrib-k8s' },
    { id: 'otlp-exporter', bucket: 'all-three' },
    { id: 'awsxray-exporter', bucket: 'contrib-only' },
  ],
};

// The level as it was, minus the words. Only the answers are marked: every choice's text is in the content file.
const SKELETON = {
  id: 'distributions',
  no: '5.6',
  icon: '\u{1F4E6}',
  cards: ['not-every-component'],
  lights: ['collector'],
  scoring: { parMs: null },
  play: {
    prefix: 'dist',
    steps: [
      {
        qid: 'dist-q-unknown',
        choice: { id: 'dist-unknown', choices: [{ key: 'refuses-to-start', right: true }] },
      },
      { qid: 'dist-q-sort', sort: SORT },
      {
        qid: 'dist-q-build',
        choice: { id: 'dist-build', choices: [{ key: 'ocb', right: true }] },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
