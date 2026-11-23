// Level 5.6: Distributions. The player says what happens when a config names a component the
// Collector binary does not contain, sorts ten components (drawn from a pool of sixteen) into the pre-built distributions that ship
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
// The two Choice steps are answer pools (#390, docs/CONTENT.md section 10): the content lists 9 answers each (3 right, 6 wrong) and a showing draws 3.
// Their extra answers rest on pages read 2026-11-21: the distribution manifests of Collector v0.164.0
// (https://github.com/open-telemetry/opentelemetry-collector-releases/blob/v0.164.0/distributions/otelcol/manifest.yaml and the contrib and k8s ones:
// k8sattributes is in contrib and k8s and not in core), the distributions page (https://opentelemetry.io/docs/collector/distributions/: a manifest.yaml
// per distribution, ocb for custom ones) and the OCB guide (https://opentelemetry.io/docs/collector/extend/ocb/: a manifest with a dist section and
// lists of modules, needs Go), plus the contrib distribution README (limit a production Collector to the components it needs).
//
// The sort pool (#390) adds components read 2026-11-22, each with the same distribution list in its README's Distributions row, on the
// receivers or extensions page of the docs and in the v0.164.0 manifests: host_metrics and health_check (core, contrib, k8s), kubelet_stats and
// k8s_cluster (contrib, k8s), postgresql (contrib only; it queries PostgreSQL's statistics). Their type names are the `type` in each
// metadata.yaml at v0.164.0 (host_metrics and kubelet_stats list hostmetrics and kubeletstats as deprecated types). spanmetrics is left out:
// its README says contrib only while the k8s manifest lists it. ledger_queue and orders_archive, like acme_scrubber, are invented in-house components.
// Spec: https://opentelemetry.io/docs/collector/components/receiver/ , https://opentelemetry.io/docs/collector/components/extension/
// Docs (GitHub READMEs and metadata at v0.164.0): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/receiver/hostmetricsreceiver/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/extension/healthcheckextension/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/receiver/kubeletstatsreceiver/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/receiver/k8sclusterreceiver/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/receiver/postgresqlreceiver/README.md , https://github.com/open-telemetry/opentelemetry-collector-releases/blob/v0.164.0/distributions/otelcol-contrib/manifest.yaml , https://github.com/open-telemetry/opentelemetry-collector-releases/blob/v0.164.0/distributions/otelcol-k8s/manifest.yaml
//
// The words are in content/core/levels/distributions.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/distributions.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 2: an answer pool (#390, docs/CONTENT.md section 10) of sixteen components, interleaved: 5 in all three, 5 in contrib
// and k8s, 3 in contrib only and 3 in none, and a showing draws 3, 3, 2 and 2 (ten, about the nine it showed before the pool).
// `whyNot` has one line for each of the other three buckets. The buckets (ids and labels) and every item's text are in the content file.
const SORT = {
  id: 'dist-sort',
  helps: { hints: false },
  draw: { 'all-three': 3, 'contrib-k8s': 3, 'contrib-only': 2, none: 2 },
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
    { id: 'host-metrics', bucket: 'all-three' },
    { id: 'kubelet-stats', bucket: 'contrib-k8s' },
    { id: 'ledger-queue', bucket: 'none' },
    { id: 'postgresql', bucket: 'contrib-only' },
    { id: 'health-check', bucket: 'all-three' },
    { id: 'k8s-cluster', bucket: 'contrib-k8s' },
    { id: 'orders-archive', bucket: 'none' },
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
        choice: {
          id: 'dist-unknown',
          draw: 3,
          choices: [
            { key: 'refuses-to-start', right: true },
            { key: 'rejected-at-startup', right: true },
            { key: 'fails-before-data', right: true },
            { key: 'ignored' },
            { key: 'loads-on-demand' },
            { key: 'drops-data' },
            { key: 'core-has-all' },
            { key: 'no-cluster' },
            { key: 'reduced-mode' },
          ],
        },
      },
      { qid: 'dist-q-sort', sort: SORT },
      {
        qid: 'dist-q-build',
        choice: {
          id: 'dist-build',
          draw: 3,
          choices: [
            { key: 'ocb', right: true },
            { key: 'ocb-manifest', right: true },
            { key: 'ocb-chosen', right: true },
            { key: 'contrib-config' },
            { key: 'otlp-distro' },
            { key: 'plugin-dir' },
            { key: 'core-module-path' },
            { key: 'edit-manifest' },
            { key: 'set-flag' },
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
