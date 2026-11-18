// Level 5.3: OTLP endpoints. The player says which port an OTLP/HTTP client uses (4318, not the gRPC 4317),
// where a per-signal endpoint variable sends traces (as is, with no /v1/traces added, unlike the general
// OTEL_EXPORTER_OTLP_ENDPOINT), wires the Collector's otlp_grpc/dash0 exporter into the traces and metrics
// pipelines so the Collector starts, and says where the Dash0 auth token goes (an Authorization: Bearer header).
// Spec: docs/OUTLINE.md §4 Act 5.
// Spec: https://opentelemetry.io/docs/specs/otel/protocol/exporter/ , https://opentelemetry.io/docs/specs/otlp/
// Docs (GitHub READMEs, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/otlpexporter/README.md , https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/otlphttpexporter/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/extension/headerssetterextension/README.md
// Docs (exporter type names, Collector v0.164.0): https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/otlpexporter/metadata.yaml , https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/otlphttpexporter/metadata.yaml (`type` is the current name, `deprecated_type` the old one) , https://github.com/open-telemetry/opentelemetry-collector/blob/main/CHANGELOG.md (v0.144.0: #14403, #14396)
// Dash0 docs: https://www.dash0.com/docs/dash0/monitoring/websites/proxying-the-ingestion-endpoint , https://www.dash0.com/docs/dash0/monitoring/kubernetes/dash0-operator/configuration , https://www.dash0.com/docs/dash0/opentelemetry/distributions/python/configuration , https://www.dash0.com/docs/dash0/miscellaneous/glossary/endpoints , https://www.dash0.com/docs/dash0/opentelemetry/distributions/python/exporters
//
// Facts used: OTLP/gRPC defaults to port 4317 and OTLP/HTTP to 4318 (the OTLP spec). With OTEL_EXPORTER_OTLP_ENDPOINT
// an OTLP/HTTP exporter adds /v1/traces, /v1/metrics or /v1/logs to the base URL; the per-signal variables
// (OTEL_EXPORTER_OTLP_TRACES_ENDPOINT and the others) are used without any change, and a URL with no path means the
// root path (the exporter spec, Example 2). A gRPC endpoint is a host and port with no path. Dash0 documents an
// OTLP/gRPC ingress endpoint per organization (the host shows the region) and the token in an Authorization: Bearer
// header, read from an environment variable in its Collector example. The only token shown is the made-up auth_token_example.
//
// COLLECTOR_SCHEMA (docs/M1-DESIGN.md §4.8) does not model component settings, so the configure step grades the wiring
// (`uses` requires otlp_grpc/dash0 in the traces and the metrics pipeline) and says so. A minimal schema extension to also
// grade `endpoint`, `auth` or `headers` was not worth it: those are free-form per component, so grading one key would
// special-case one component in the shared schema. The port and path nuances are graded by the Choice steps instead.
//
// The words are in content/core/levels/otlp-endpoints.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/otlp-endpoints.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 3: the config. The given sends traces to the debug exporter only and names an exporter nobody defined in
// metrics (the Collector would refuse to start); otlp_grpc/dash0 is defined, with its auth, and listed nowhere.
const GIVEN = [
  'extensions:',
  '  headers_setter:',
  '    headers:',
  '      - action: insert',
  '        key: Authorization',
  '        value: "Bearer ${env:DASH0_TOKEN}"',
  'receivers:',
  '  otlp:',
  '    protocols:',
  '      grpc:',
  '        endpoint: 0.0.0.0:4317',
  '      http:',
  '        endpoint: 0.0.0.0:4318',
  'processors:',
  '  batch:',
  'exporters:',
  '  debug:',
  '  otlp_grpc/dash0:',
  '    endpoint: ${env:DASH0_ENDPOINT}',
  '    auth:',
  '      authenticator: headers_setter',
  'service:',
  '  extensions: [headers_setter]',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [batch]',
  '      exporters: [debug]',
  '    metrics:',
  '      receivers: [otlp]',
  '      processors: [batch]',
  '      exporters: [otlp_http/dash0]',
  '',
].join('\n');

const REFERENCE = GIVEN.replace('exporters: [debug]', 'exporters: [debug, otlp_grpc/dash0]').replace('exporters: [otlp_http/dash0]', 'exporters: [otlp_grpc/dash0]');

const CONFIG = {
  id: 'otlp-config',
  schema: 'collector',
  given: GIVEN,
  reference: REFERENCE,
  uses: { traces: ['otlp_grpc/dash0'], metrics: ['otlp_grpc/dash0'] },
  helps: { hints: true },
};

// The level as it was, minus the words. Only the answers are marked: every choice's text is in the content file.
const SKELETON = {
  id: 'otlp-endpoints',
  no: '5.3',
  icon: '\u{1F50C}',
  cards: ['otlp-ports-and-paths'],
  lights: ['collector'],
  scoring: { parMs: null },
  play: {
    prefix: 'otlp',
    steps: [
      {
        qid: 'otlp-q-port',
        choice: { id: 'otlp-port', choices: [{ key: 'http-port', right: true }] },
      },
      {
        qid: 'otlp-q-signal',
        choice: { id: 'otlp-signal', choices: [{ key: 'as-is', right: true }] },
      },
      {
        qid: 'otlp-q-config',
        configure: CONFIG,
      },
      {
        qid: 'otlp-q-token',
        choice: { id: 'otlp-token', choices: [{ key: 'header', right: true }] },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
