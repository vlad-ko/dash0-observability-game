// Level 4.3: Collecting logs. The player says how a service they own should send its logs (an OTLP
// appender, not a tailed file), fixes a Collector config so the `file_log/shipping` receiver is defined
// and feeds the logs pipeline, says how to keep a stack trace in one record (`multiline`), says where
// to parse a plain text line into a severity (a `regex_parser` operator in the Collector), and says
// what Dash0 does for unstructured logs nobody parsed (Log AI).
// Spec: docs/OUTLINE.md §4 Act 4.
// Spec: https://opentelemetry.io/docs/specs/otel/logs/ , https://opentelemetry.io/docs/specs/otel/logs/data-model/
// Spec: https://opentelemetry.io/docs/collector/components/receiver/ , https://opentelemetry.io/docs/collector/configuration/#receivers
// Spec: https://opentelemetry.io/docs/specs/otel/compatibility/logging_trace_context/
// Collector contrib docs (not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/receiver/filelogreceiver/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/receiver/filelogreceiver/metadata.yaml , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/CHANGELOG.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/pkg/stanza/docs/operators/regex_parser.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/pkg/stanza/docs/operators/json_parser.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/pkg/stanza/docs/types/parsers.md , https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/processor/batchprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/processor/filterprocessor/README.md
// RE2 syntax (not an allowed Spec host): https://github.com/google/re2/wiki/Syntax
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/logging/log-ai-processing , https://www.dash0.com/docs/dash0/telemetry/logging/log-severities , https://www.dash0.com/docs/dash0/telemetry/logging/patterns , https://www.dash0.com/docs/dash0/telemetry/logging/json-log-processing , https://www.dash0.com/docs/dash0/telemetry/logging/use-ai-in-logs/pattern-hover
//
// Facts used, each from the pages above. The logs spec describes two ways to collect the logs of an
// application: via files or standard output, and direct to the Collector over OTLP. The first needs
// no change to the app but needs file reading, tailing, rotation and parsing, which "may also be not
// reliable if the output format is not well-defined", and application logs read that way "often lack
// request context" and can be enriched with resource context; the second emits "well-defined, formal,
// highly structured" records, removes "all complexity associated with file logs, such as parsers, log
// tailing and rotation", at the cost of changing the app and of the local file. Correlation by time is
// "the most basic form"; by trace context needs TraceId and SpanId in the record. A non-OTLP format
// records them as trace_id and span_id fields. The receiver's metadata.yaml at v0.164.0: `type: file_log`,
// `deprecated_type: filelog`; the contrib CHANGELOG (v0.149.0): "Rename `filelog` receiver to `file_log`
// with deprecated alias `filelog`" (read 2026-11-22). The file_log receiver README: `include` is required,
// `start_at` is `end` or `beginning` (default `end`), `multiline` holds exactly one of
// `line_start_pattern` or `line_end_pattern` and "instructs the file_input operator to split log
// entries on a pattern other than newlines", `operators` chain parsers such as `json_parser` and
// `regex_parser` (named capture groups become attributes; an embedded `severity` block sets the
// severity), it is in the contrib and Kubernetes distributions, and its stability is beta for logs;
// without a storage extension offsets are kept in memory only. Go (RE2) regular expressions: the `s`
// flag lets `.` match a newline, and it is off by default. The Collector configuration page names
// components `type` or `type/name`. Dash0: Log AI infers a severity for unstructured messages and
// extracts patterns with named attributes, does not override a severity already set, does not modify
// structured JSON logs, and depends on resource attributes (the k8s_attributes processor for Kubernetes
// workloads); records collected without a severity number get the UNSPECIFIED range, which is common
// for pod logs read with the receiver (the Dash0 page calls it filelogreceiver).
//
// The configure step grades the config through COLLECTOR_SCHEMA (docs/M1-DESIGN.md §4.8), which does not
// model component settings. A schema that knew file_log's settings would need per-component-type schemas,
// keyed by the type part of an id such as `file_log/shipping`, which is a change to the schema format and
// the checker for one level, so the step grades the wiring (defined, the Collector would start, and
// `uses` requires the logs pipeline to list `file_log/shipping` and `otlp_grpc/dash0`) and the settings
// (`multiline`, `operators`) are taught in the Choice steps, as level 1.3 does for k8s_attributes.
//
// The words are in content/core/levels/collecting-logs.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/collecting-logs.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 2: the config. The logs pipeline lists `file_log`, but the receiver is defined as `file_log/shipping`:
// the Collector would refuse to start. The reference lists the defined id and nothing more: the settings
// the next steps ask about (`multiline`, `operators`) stay out, so the tier 3 apply answers none of them (#381).
const GIVEN = [
  'receivers:',
  '  otlp:',
  '    protocols:',
  '      grpc:',
  '  file_log/shipping:',
  '    include: [/var/log/shipping/agent.log]',
  'processors:',
  '  batch:',
  'exporters:',
  '  otlp_grpc/dash0:',
  '    endpoint: ${env:DASH0_ENDPOINT}',
  'service:',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [batch]',
  '      exporters: [otlp_grpc/dash0]',
  '    logs:',
  '      receivers: [file_log]',
  '      processors: [batch]',
  '      exporters: [otlp_grpc/dash0]',
  '',
].join('\n');

const REFERENCE = [
  'receivers:',
  '  otlp:',
  '    protocols:',
  '      grpc:',
  '  file_log/shipping:',
  '    include: [/var/log/shipping/agent.log]',
  'processors:',
  '  batch:',
  'exporters:',
  '  otlp_grpc/dash0:',
  '    endpoint: ${env:DASH0_ENDPOINT}',
  'service:',
  '  pipelines:',
  '    traces:',
  '      receivers: [otlp]',
  '      processors: [batch]',
  '      exporters: [otlp_grpc/dash0]',
  '    logs:',
  '      receivers: [file_log/shipping]',
  '      processors: [batch]',
  '      exporters: [otlp_grpc/dash0]',
  '',
].join('\n');

const CONFIG = {
  id: 'col-config',
  schema: 'collector',
  given: GIVEN,
  reference: REFERENCE,
  uses: { logs: ['file_log/shipping', 'otlp_grpc/dash0'] },
  withhold: [['start_at', 'beginning'], ['regex_parser', 'operator'], ['line_start_pattern', 'multiline'], ['line_start_pattern', 'timestamp'], ['multiline', 'timestamp'], ['regex_parser'], ['^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}']], // settings left out of the reference that the Guide must not give (#381)
  helps: { hints: true },
};

// The level as it was, minus the words. Only the answers are marked: every choice's text is in the content file.
// The stack trace sample of step 3 is shown, not graded, so it is in the content file too.
const SKELETON = {
  id: 'collecting-logs',
  no: '4.3',
  icon: '\u{1F4C4}',
  cards: ['filelog-tails-files'],
  lights: ['shipping'],
  scoring: { parMs: null },
  play: {
    prefix: 'col',
    steps: [
      {
        qid: 'col-q-route',
        choice: {
          id: 'col-route',
          draw: 3,
          choices: [{ key: 'otlp-appender', right: true }, { key: 'sdk-and-appender', right: true }, { key: 'otlp-target', right: true }, { key: 'structured-over-otlp', right: true }],
        },
      },
      {
        qid: 'col-q-config',
        configure: CONFIG,
      },
      {
        qid: 'col-q-multiline',
        choice: {
          id: 'col-multiline',
          draw: 3,
          choices: [{ key: 'line-start', right: true }, { key: 'start-on-timestamp', right: true }, { key: 'frames-join-above', right: true }, { key: 'split-while-reading', right: true }],
        },
      },
      {
        qid: 'col-q-parse',
        choice: {
          id: 'col-parse',
          draw: 3,
          choices: [{ key: 'collector-regex', right: true }, { key: 'receiver-operators', right: true }, { key: 'regex-to-number', right: true }, { key: 'where-it-is-read', right: true }],
        },
      },
      {
        qid: 'col-q-dash0',
        choice: {
          id: 'col-dash0',
          draw: 3,
          choices: [{ key: 'log-ai', right: true }, { key: 'severity-and-one-pattern', right: true }, { key: 'finds-the-pattern', right: true }, { key: 'fills-the-gap', right: true }],
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
