// Act 5 boss: Silence. One cluster's telemetry stops arriving, all three signals at the same minute. The
// player follows it from the data-arrival view (eu-west is flat at zero, the other clusters are normal), to
// the Collector pods in that cluster (restarting, never ready), to the Collector's own log (the config is
// invalid: a pipeline lists an exporter that is not configured), to the config diff and the rollout time
// (the rollout renamed the exporter `otlp_grpc/dash0` to `otlp_grpc/dash0-eu` in `exporters` and left the three
// pipelines listing `otlp_grpc/dash0`). Four views hold the chain (clues); two are red herrings; three are
// neutral. Scored. A plain-data Scenario for the incident engine, played through one declarative
// `incident` step (lib/widgets/incident.mjs, docs/M1-DESIGN.md §4.3, docs/DECLARATIVE-LEVELS.md §2),
// then one closing Choice on the rule that was broken.
// The scenario is designed for this game: docs/OUTLINE.md §4 defines no boss for Act 5 (decided on #16).
// Spec: docs/OUTLINE.md §4 Act 5.
// Spec: https://opentelemetry.io/docs/collector/configuration/#service , https://opentelemetry.io/docs/collector/configuration/#pipelines
// Spec: https://opentelemetry.io/docs/collector/configuration/#configuration-structure
// Spec: https://opentelemetry.io/docs/specs/semconv/registry/attributes/k8s/ , https://opentelemetry.io/docs/specs/semconv/system/k8s-metrics/
// Docs (GitHub, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/otelcol/config.go , https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/otelcol/collector.go
// Docs (GitHub, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/confmap/README.md , https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/processor/memorylimiterprocessor/README.md
// Docs (GitHub, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/processor/memorylimiterprocessor/documentation.md , https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/exporter/otlpexporter/README.md
// Dash0 tie-in: n/a. No Dash0 docs page was found that says what a Collector does with a config whose pipeline
// lists an exporter that is not defined, and OUTLINE §4 gives the Act 5 levels 5.1, 5.2, 5.4 and 5.6 no
// Dash0 tie-in either; nothing below names a Dash0 feature.
//
// Facts used, each from the sources above:
// - Component ids follow `type[/name]`; the same type can be defined more than once as long as the ids are
//   unique, so `otlp_grpc/dash0` and `otlp_grpc/dash0-eu` are two different exporters (configuration docs).
// - Before a receiver, processor or exporter goes into a pipeline its configuration must be defined in its
//   own section, and a component that is configured but not listed under `service` is not enabled
//   (configuration docs, Service section; the same rules 5.1 teaches).
// - A pipeline that lists an id nothing defines makes the whole configuration invalid. otelcol/config.go
//   returns `service::pipelines::<pipeline>: references exporter "<id>" which is not configured` (the same
//   form for a receiver or a processor), and otelcol/collector.go validates the configuration in
//   setupConfigurationComponents, before it creates or starts the service (so before any pipeline runs).
//   confmap/README.md quotes the form the player sees:
//   `Error: invalid configuration: service::pipelines::traces: references processor "nop" which is not configured`
//   and then `collector server run finished with error: invalid configuration: ...`.
// - memory_limiter refuses data by returning a non-permanent error to the component before it, and
//   receivers are expected to retry (memory limiter README); its refusals are counted by
//   `otelcol_processor_memory_limiter_refused_spans` (its documentation.md).
// - `k8s.cluster.name` is a resource attribute, `k8s.container.restart.count` is a metric, and
//   `k8s.container.status.last_terminated_reason` has `Error` among its example values (Kubernetes semconv).
// - The gRPC exporter takes a `host:port` endpoint; a wrong port is not a config validation error, so it
//   would show up while the Collector runs (otlp_grpc exporter README). Not used as a fact beyond that.
//
// Invented for the game: the clusters, pod names, counts, times, the PR title and the Helm-style rollout; the
// timestamps on the two log lines (the lines themselves use the forms quoted above, with `exporter` and
// `otlp_grpc/dash0` in place of the README's processor and `nop`); that the rollout starts the new pods only after
// stopping the old ones (a Deployment can be set to do that), which is why eu-west goes to zero and not to half.
// The Collector's error names one pipeline, not all three: the validation returns at the first error it finds, and
// it walks the pipelines in a Go map, whose iteration order is random, so Go map iteration order picks which of
// the three (traces, metrics or logs) is named. The shown line, with traces, is one valid instance.
//
// The words are in content/core/levels/silence.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/silence.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const POD_A = 'otel-collector-7c8d9b6f5-4xk2p';
const POD_B = 'otel-collector-7c8d9b6f5-q8w7n';

// What each {{name}} in the content file is replaced with: the two Collector pod names the views quote.
const VARS = {
  'pod-a': POD_A,
  'pod-b': POD_B,
};

// The incident: the ids, the cost and kind of each view, and which hypothesis is right. The alert, every label,
// view and explanation, and the hint are in the content file.
const SCENARIO = {
  id: 'silence',
  budget: { startPct: 100, burnPctPerMin: 5 },
  views: [
    { id: 'arrival-by-cluster', costMin: 3, kind: 'clue' },
    { id: 'collector-pods', costMin: 3, kind: 'clue' },
    { id: 'collector-log', costMin: 3, kind: 'clue' },
    { id: 'config-diff', costMin: 3, kind: 'clue' },
    { id: 'app-pods', costMin: 2, kind: 'neutral' },
    { id: 'nodes', costMin: 2, kind: 'neutral' },
    { id: 'backend-ingest', costMin: 3, kind: 'neutral' },
    { id: 'network-blip', costMin: 4, kind: 'herring' },
    { id: 'memory-limiter-refusals', costMin: 3, kind: 'herring' },
  ],
  hypotheses: [
    { id: 'exporter-renamed', right: true },
    { id: 'memory-limiter', right: false },
    { id: 'wrong-port', right: false },
    { id: 'apps-stopped', right: false },
  ],
  answerAfterViews: 3,
};

// Step 2: the rule that was broken. `why` follows "Right." or "Not quite.".
const RULE = [{ key: 'listed-must-be-defined', right: true }];

// The level as it was, minus the words.
const SKELETON = {
  id: 'silence',
  no: null,
  icon: '\u{1F507}',
  cards: [],
  lights: ['collector'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'sil',
    steps: [
      { incident: SCENARIO },
      { qid: 'sil-q-rule', choice: { id: 'sil-rule', choices: RULE } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
