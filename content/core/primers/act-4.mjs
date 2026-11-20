// Act 4 primer (#389). PLACEHOLDER: drafted from the official OpenTelemetry logs, logs data model and
// context propagation pages and one Dash0 docs page, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-4",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry and Dash0 docs pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Logs: what did it say?",
  "overview": [
    {
      "type": "paragraph",
      "text": "A log is a timestamped record of an event. Most programming languages have built-in logging or a widely used logging library, so you often start with logs that already exist. This act is about making them useful: giving them fields, tying them to traces and getting them collected."
    },
    {
      "type": "list",
      "items": [
        "A structured log has a stable schema (fixed field names, types and meanings), so tools can rely on its fields.",
        "OpenTelemetry can add the trace and span IDs of the running span to your existing logs, through its SDKs and logging bridges (adapters from a logging library to OpenTelemetry).",
        "The Collector (see act 5) can read, parse and export logs from many sources."
      ]
    },
    {
      "type": "callout",
      "tone": "tip",
      "text": "Already know this? Pick \"I am already familiar with the topic\" to skip the reading."
    }
  ],
  "chapters": [
    {
      "id": "structured-logs",
      "title": "Structured logs",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A log is a timestamped text record, either structured (recommended) or unstructured, with optional metadata. OpenTelemetry accepts any log format, but not all formats are equally useful for analysis."
        },
        {
          "type": "paragraph",
          "text": "A structured log has a defined, consistent schema or typed fields that downstream systems can reliably parse. What makes a log structured is a stable schema of field names, types and meanings, not merely valid JSON. A log written as JSON is not automatically structured."
        },
        {
          "type": "paragraph",
          "text": "An OpenTelemetry log record has these fields: Timestamp, ObservedTimestamp, TraceId, SpanId, TraceFlags, SeverityText, SeverityNumber, Body, Resource, InstrumentationScope, Attributes and EventName. The list explains them."
        },
        {
          "type": "list",
          "items": [
            "Timestamp and ObservedTimestamp: when the event occurred, and when the collection system observed it.",
            "Body: the message of the log record.",
            "Attributes: additional information about the event.",
            "Resource: describes the observed entity that generated the log.",
            "SeverityText: the original string for the severity, also known as the log level.",
            "SeverityNumber: a number for the severity, where smaller values are less severe events.",
            "TraceId and SpanId: the request trace and span the log belongs to, when there is one.",
            "TraceFlags: flags carried with the trace context, such as whether the trace was selected to be recorded (sampled).",
            "InstrumentationScope: the library or module that emitted the log.",
            "EventName: a name that identifies the class or type of event the record describes."
          ]
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Logs",
          "url": "https://opentelemetry.io/docs/concepts/signals/logs/",
          "audience": "public"
        },
        {
          "kind": "otel",
          "label": "OpenTelemetry: Logs data model",
          "url": "https://opentelemetry.io/docs/specs/otel/logs/data-model/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "correlating-logs",
      "title": "Correlating logs with traces",
      "blocks": [
        {
          "type": "paragraph",
          "text": "When you add zero-code instrumentation (see act 2) or activate an SDK, OpenTelemetry automatically correlates (links) your existing logs with any active, meaning currently running, trace and span: a log written while a span is active can carry that trace ID and span ID (the fields TraceId and SpanId), which the SDK injects into the log record. OpenTelemetry connects to existing logging frameworks through logging bridges (adapters from a logging library to OpenTelemetry)."
        },
        {
          "type": "paragraph",
          "text": "That lets you see a log in the context of its trace and span, and see logs that belong together across service boundaries."
        },
        {
          "type": "paragraph",
          "text": "In Dash0, the Related Logs tab shows log records from the same resource and the same trace, in time order around the log you selected."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Logs",
          "url": "https://opentelemetry.io/docs/concepts/signals/logs/",
          "audience": "public"
        },
        {
          "kind": "otel",
          "label": "OpenTelemetry: Context propagation",
          "url": "https://opentelemetry.io/docs/concepts/context-propagation/",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: Explore Related Logs",
          "url": "https://www.dash0.com/docs/dash0/telemetry/logging/related-logs",
          "audience": "public"
        }
      ]
    },
    {
      "id": "collecting-logs",
      "title": "Collecting logs",
      "blocks": [
        {
          "type": "paragraph",
          "text": "OpenTelemetry is designed to work with the logs you already produce. The first step in adopting it often is deploying a Collector (see act 5) as a general-purpose logging agent, meaning a Collector run on each node (each machine)."
        },
        {
          "type": "paragraph",
          "text": "The Collector has receivers (components that accept telemetry) that parse logs from known sources, and a receiver named filelog that reads logs from any file and can parse different formats or use a regular expression. Processors (components that modify telemetry on its way through) such as the transform processor, which edits fields in telemetry, can parse nested data and add, remove or update values."
        },
        {
          "type": "paragraph",
          "text": "Applications can also send logs through logging bridges that connect existing logging frameworks. A bridge is built on the Logs Bridge API (the OpenTelemetry docs also call it the Logs API), which exists for logging library authors: as an application developer, you should not call it directly."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Logs",
          "url": "https://opentelemetry.io/docs/concepts/signals/logs/",
          "audience": "public"
        }
      ]
    }
  ]
};
