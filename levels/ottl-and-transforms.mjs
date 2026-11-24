// Level 5.5: OTTL and transforms. The player says how a rename is written in OTTL (a set then a
// delete_key; the transform README's "Rename attribute" section lists a second way, replace_all_patterns(..., "key", ...)), spots the statements that would still let a customer email leave on a span, wires a
// transform processor that redacts it into the traces and the logs pipeline so the Collector starts,
// and says why a Dash0 spam filter is not the way to redact: it drops whole points at ingestion.
// Spec: docs/OUTLINE.md §4 Act 5.
// Spec: https://opentelemetry.io/docs/collector/transforming-telemetry/ , https://opentelemetry.io/docs/collector/components/processor/
// Docs (GitHub READMEs, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/transformprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/attributesprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/redactionprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/pkg/ottl/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/pkg/ottl/ottlfuncs/README.md
// Docs (filter processor, the Collector-side drop checked in step 4): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/filterprocessor/README.md
// Dash0 docs: https://www.dash0.com/docs/dash0/cost-control/spam-filters , https://www.dash0.com/docs/dash0/miscellaneous/glossary/auth-tokens
//
// What is graded. The configure step grades the wiring through COLLECTOR_SCHEMA (docs/M1-DESIGN.md
// §4.8), which does not model component settings: an OTTL statement list is `any` to it. A schema
// extension that parsed OTTL would be a second language for one level, so the statement shapes are
// taught in the choice and the spot steps instead, and the configure step requires the transform
// processor in the traces and the logs pipeline (`uses`). A processor sits between receivers and
// exporters, so listed in a pipeline it runs before the exporter sends. Where it sits among the other
// processors is level 5.2. The statements are written with the context-prefixed paths of the
// transform processor README (span.attributes, log.attributes, resource.attributes).
//
// Distribution: the transform and redaction processors are shipped in the contrib distribution (and
// k8s); the level does not say more, because the core list has grown and the pages differ.
//
// The two Choice steps are answer pools (#390, docs/CONTENT.md section 10): the rename step lists 9 statements (3 right, 6 wrong) and shows 3, the
// spam filter step lists 12 answers (3 right, 9 wrong) and shows 4, the filter processor being the near-miss the 50/50 keeps. Their extra answers rest
// on pages read 2026-11-21 (Collector v0.164.0): the OTTL functions README (.../pkg/ottl/ottlfuncs/README.md: set, delete_key,
// delete_matching_keys, replace_all_patterns with the modes key and value, no rename function), the transform processor README (the "key" mode example
// that renames a resource attribute, statements run in order, per-signal contexts), the attributes processor README (the delete action) and
// Dash0's spam filter page (https://www.dash0.com/docs/dash0/cost-control/spam-filters: filters drop spans, logs, metrics and web events during
// ingestion, filtered telemetry still carries the Ingest charge) and its auth tokens page (they authenticate and authorise senders).
//
// The words are in content/core/levels/ottl-and-transforms.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/ottl-and-transforms.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 2: spot the statements that leave the email on the exported span. `user.email` is a span attribute.
// The statements and the `whyNot` notes are in the content file.
const SPOT = {
  id: 'ottl-spot',
  target: 'config',
  helps: { hints: false },
  faults: ['resource-map', 'copy-only', 'admin-only', 'typo-key'],
};

// Step 3: the processor is listed in both pipelines. The given's error is the logs list naming
// `transform/redact` while the processor is defined as `transform/pii`: the Collector would not start.
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
  '  transform/pii:',
  '    error_mode: ignore',
  '    trace_statements:',
  '      - delete_key(span.attributes, "user.email")',
  '    log_statements:',
  '      - delete_key(log.attributes, "user.email")',
  '  batch:',
  'exporters:',
  '  otlp_grpc/dash0:',
  '    endpoint: ${env:DASH0_ENDPOINT}',
  'service:',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, batch]',
  '      exporters: [otlp_grpc/dash0]',
  '    logs:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, transform/redact, batch]',
  '      exporters: [otlp_grpc/dash0]',
  '',
].join('\n');

const REFERENCE = [
  'receivers:',
  '  otlp:',
  '    protocols:',
  '      grpc:',
  'processors:',
  '  memory_limiter:',
  '    check_interval: 1s',
  '    limit_mib: 400',
  '    spike_limit_mib: 100',
  '  transform/pii:',
  '    error_mode: ignore',
  '    trace_statements:',
  '      - delete_key(span.attributes, "user.email")',
  '    log_statements:',
  '      - delete_key(log.attributes, "user.email")',
  '  batch:',
  'exporters:',
  '  otlp_grpc/dash0:',
  '    endpoint: ${env:DASH0_ENDPOINT}',
  'service:',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, transform/pii, batch]',
  '      exporters: [otlp_grpc/dash0]',
  '    logs:',
  '      receivers: [otlp]',
  '      processors: [memory_limiter, transform/pii, batch]',
  '      exporters: [otlp_grpc/dash0]',
  '',
].join('\n');

const CONFIG = {
  id: 'ottl-config',
  schema: 'collector',
  given: GIVEN,
  reference: REFERENCE,
  uses: { traces: ['transform/pii'], logs: ['transform/pii'] },
  helps: { hints: true },
};

// The level as it was, minus the words. Only the answers are marked: every choice's text is in the content file.
const SKELETON = {
  id: 'ottl-and-transforms',
  no: '5.5',
  icon: '\u{1F9FD}',
  cards: ['redact-in-the-pipeline'],
  lights: ['collector'],
  scoring: { parMs: null },
  play: {
    prefix: 'ottl',
    steps: [
      {
        qid: 'ottl-q-rename',
        choice: {
          id: 'ottl-rename',
          draw: 3,
          choices: [
            { key: 'set-then-delete', right: true },
            { key: 'replace-key', right: true },
            { key: 'set-delete-matching', right: true },
            { key: 'set-only' },
            { key: 'delete-then-set' },
            { key: 'value-mode' },
            { key: 'rename-function' },
            { key: 'delete-wrong-case' },
            { key: 'delete-new' },
          ],
        },
      },
      {
        qid: 'ottl-q-spot',
        spot: SPOT,
      },
      {
        qid: 'ottl-q-config',
        configure: CONFIG,
      },
      {
        qid: 'ottl-q-backend',
        choice: {
          id: 'ottl-backend',
          draw: 4,
          choices: [
            { key: 'pipeline', right: true },
            { key: 'transform-first', right: true },
            { key: 'attributes-delete', right: true },
            { key: 'spam-strip' },
            { key: 'filter-processor', keep: true }, // the tempting near-miss: the 50/50 never removes it (#371)
            { key: 'spam-drop-all' },
            { key: 'spam-mask' },
            { key: 'spam-cleans-stored' },
            { key: 'view-hide' },
            { key: 'dash0-runs-processors' },
            { key: 'exporter-exclude' },
            { key: 'rotate-token' },
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
