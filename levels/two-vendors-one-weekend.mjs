// Level 9.7: Two vendors, one weekend. Act 9 "Live Demo" (docs/LIVE-DEMO.md). A teammate says, with confidence, "add Dash0 and
// the old vendor stops getting data, so we have to pick one" and the player says whether that holds (Choice), then fixes the
// Collector config so both vendors get traces, metrics and logs (Configure it). The claim is wrong: a pipeline that lists two
// exporters sends each of them a copy. The presenter has no name and no affiliation.
// Source: an anonymised call question shape (docs/LIVE-DEMO.md): trying a second backend beside the first. Nothing below
// identifies a customer, a person or a product; the old vendor is a made-up host on the reserved .example domain.
// Spec: https://opentelemetry.io/docs/collector/architecture/ , https://opentelemetry.io/docs/collector/configuration/
// Docs (GitHub, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/config/configgrpc/README.md , https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/exporter/otlpexporter/metadata.yaml , https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/CHANGELOG.md
//
// Facts used (each read on the pages above, 2026-11-08). Architecture page: "This continues until the last processor in the pipeline
// pushes the data to the exporters. Each exporter gets a copy of each data element." Configuration page:
// "Configuring an exporter does not enable it. Exporters are enabled by adding them to the appropriate pipelines within the service section."
// and "The use and expansion of environment variables is supported in the Collector configuration", with `${env:DB_KEY}` as the example.
// gRPC client settings README at v0.164.0: `headers` is "name/value pairs added to the request". The exporter type is otlp_grpc (the names
// since Collector v0.144.0: the CHANGELOG entry "Rename `otlp` exporter to `otlp_grpc` exporter and add deprecated alias `otlp`. (#14403)", and `type: otlp_grpc` in the exporter's metadata.yaml), so the ids are otlp_grpc/oldvendor and otlp_grpc/dash0. Dash0 is claimed only to need an endpoint and a
// token, both read from environment variables here; no real hostname, no product or pricing claim.
//
// Invented for the game: the scenario, the old vendor and its host, and the variable names DASH0_ENDPOINT and DASH0_AUTH_TOKEN.
//
// COLLECTOR_SCHEMA (docs/M1-DESIGN.md §4.8) does not model component settings, so the configure step grades the wiring (`uses`
// requires both exporters in traces, metrics and logs) and says so; the header form is not graded, and the explain shows it.
// Accepted gap (#381): an empty `otlp_grpc/dash0:`, a header without `Bearer` and the token in the URL all pass, so the task does
// not ask for the header (the reference and the explain still show it).
// Accepted gap: pipelines are graded by name, so a separate pipeline (say `traces/dash0`) that sends traces to otlp_grpc/dash0
// is valid in a real Collector, as the architecture page's `traces/2` shows, but fails here. The question says "in the existing
// pipelines" and the explain says why.
//
// The words are in content/core/levels/two-vendors-one-weekend.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/two-vendors-one-weekend.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const VARS = {};

// Step 1: does the teammate's answer hold? `why` follows "Right." or "Not quite."; only the right choice is listed here.
const VERDICT = [{ key: 'copy', right: true }];

// Step 2: the config. The given is the teammate's wrong change: traces lists only otlp_grpc/dash0, which nobody defined (the config
// is invalid, a name with no definition under exporters); metrics and logs go to the old vendor only. Restoring the old vendor
// beside Dash0 is the fan-out move.
const GIVEN = [
  'receivers:',
  '  otlp:',
  '    protocols:',
  '      grpc:',
  '        endpoint: 0.0.0.0:4317',
  '      http:',
  '        endpoint: 0.0.0.0:4318',
  'processors:',
  '  memory_limiter:',
  '    check_interval: 1s',
  '    limit_mib: 400',
  '  batch:',
  'exporters:',
  '  otlp_grpc/oldvendor:',
  '    endpoint: otlp.oldvendor.example:4317',
  'service:',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, batch]',
  '      exporters: [otlp_grpc/dash0]',
  '    metrics:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, batch]',
  '      exporters: [otlp_grpc/oldvendor]',
  '    logs:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, batch]',
  '      exporters: [otlp_grpc/oldvendor]',
  '',
].join('\n');

const REFERENCE = GIVEN.replace(
  '    endpoint: otlp.oldvendor.example:4317\n',
  [
    '    endpoint: otlp.oldvendor.example:4317',
    '  otlp_grpc/dash0:',
    '    endpoint: ${env:DASH0_ENDPOINT}',
    '    headers:',
    '      Authorization: "Bearer ${env:DASH0_AUTH_TOKEN}"',
    '',
  ].join('\n'),
)
  .replace(/exporters: \[otlp_grpc\/oldvendor\]/g, 'exporters: [otlp_grpc/oldvendor, otlp_grpc/dash0]')
  .replace('exporters: [otlp_grpc/dash0]', 'exporters: [otlp_grpc/oldvendor, otlp_grpc/dash0]');

const BOTH = ['otlp_grpc/oldvendor', 'otlp_grpc/dash0'];

const CONFIG = {
  id: 'tvw-config',
  schema: 'collector',
  given: GIVEN,
  reference: REFERENCE,
  uses: { traces: BOTH, metrics: BOTH, logs: BOTH },
  helps: { hints: true },
};

// The level as it was, minus the words.
const SKELETON = {
  id: 'two-vendors-one-weekend',
  no: '9.7',
  icon: '\u{1F91D}',
  cards: [],
  lights: ['collector'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'tvw',
    steps: [
      { qid: 'tvw-q-verdict', choice: { id: 'tvw-verdict', choices: VERDICT } },
      { qid: 'tvw-q-config', configure: CONFIG },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
