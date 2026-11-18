// Level 5.1: Pipelines. The player says which component type joins two pipelines (a connector),
// fixes a Collector config so the `memory_limiter` processor, defined but listed in no pipeline,
// is wired into the traces and metrics pipelines and the Collector starts, and says where an
// extension is enabled (under `service.extensions`, not in a pipeline).
// Spec: docs/OUTLINE.md §4 Act 5.
// Spec: https://opentelemetry.io/docs/collector/configuration/#service , https://opentelemetry.io/docs/collector/configuration/#connectors , https://opentelemetry.io/docs/collector/configuration/#extensions
// Spec: https://opentelemetry.io/docs/collector/configuration/#processors , https://opentelemetry.io/docs/collector/components/
// Docs (GitHub READMEs, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector/blob/main/connector/README.md , https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/memorylimiterprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/extension/healthcheckextension/README.md
// Docs (exporter type names, Collector v0.164.0; the one place Act 5 says the old names are deprecated aliases): https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/otlpexporter/metadata.yaml , https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/otlpexporter/factory.go , https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/otlphttpexporter/metadata.yaml , https://github.com/open-telemetry/opentelemetry-collector/blob/main/CHANGELOG.md (v0.144.0: #14403, #14396)
//
// The configure step grades the config through COLLECTOR_SCHEMA (docs/M1-DESIGN.md §4.8), which does
// not model component settings, so the step grades the wiring (defined, the Collector would start,
// `uses` requires the traces and the metrics pipeline to list memory_limiter, and `extensions` requires health_check enabled under service.extensions) and says so. The
// given's own error is the extension (enabled in `service.extensions` but not defined), so the
// level shows both directions of the same rule: listed but not defined stops the Collector,
// defined but not listed does nothing. Where memory_limiter sits in each list is level 5.2.
//
// The words are in content/core/levels/pipelines.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/pipelines.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 2: the config. The given enables health_check without defining it (the Collector would
// refuse to start) and defines memory_limiter without listing it. The reference does both jobs.
const GIVEN = [
  'receivers:',
  '  otlp:',
  '    protocols:',
  '      grpc:',
  'processors:',
  '  memory_limiter:',
  '    check_interval: 1s',
  '    limit_mib: 400',
  '    spike_limit_mib: 100',
  '  batch:',
  'exporters:',
  '  otlp_grpc/dash0:',
  '    endpoint: ${env:DASH0_ENDPOINT}',
  'service:',
  '  extensions: [health_check]',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [batch]',
  '      exporters: [otlp_grpc/dash0]',
  '    metrics:',
  '      receivers: [otlp]',
  '      processors: [batch]',
  '      exporters: [otlp_grpc/dash0]',
  '',
].join('\n');

const REFERENCE = [
  'extensions:',
  '  health_check:',
  'receivers:',
  '  otlp:',
  '    protocols:',
  '      grpc:',
  'processors:',
  '  memory_limiter:',
  '    check_interval: 1s',
  '    limit_mib: 400',
  '    spike_limit_mib: 100',
  '  batch:',
  'exporters:',
  '  otlp_grpc/dash0:',
  '    endpoint: ${env:DASH0_ENDPOINT}',
  'service:',
  '  extensions: [health_check]',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, batch]',
  '      exporters: [otlp_grpc/dash0]',
  '    metrics:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, batch]',
  '      exporters: [otlp_grpc/dash0]',
  '',
].join('\n');

const CONFIG = {
  id: 'pipe-config',
  schema: 'collector',
  given: GIVEN,
  reference: REFERENCE,
  uses: { traces: ['memory_limiter'], metrics: ['memory_limiter'] },
  extensions: ['health_check'],
  helps: { hints: true },
};

// The level as it was, minus the words. Only the answers are marked: every choice's text is in the content file.
const SKELETON = {
  id: 'pipelines',
  no: '5.1',
  icon: '\u{1F527}',
  cards: ['configured-not-enabled'],
  lights: ['collector'],
  scoring: { parMs: null },
  play: {
    prefix: 'pipe',
    steps: [
      {
        qid: 'pipe-q-connector',
        choice: { id: 'pipe-connector', choices: [{ key: 'connector', right: true }] },
      },
      {
        qid: 'pipe-q-config',
        configure: CONFIG,
      },
      {
        qid: 'pipe-q-extension',
        choice: { id: 'pipe-extension', choices: [{ key: 'service-extensions', right: true }] },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
