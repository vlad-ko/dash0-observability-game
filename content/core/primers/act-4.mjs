// Act 4 primer (#389). PLACEHOLDER: drafted from the official OpenTelemetry pages and one Dash0 docs
// page only, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
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
        "A structured log has a stable schema, so tools can rely on its fields.",
        "OpenTelemetry can add the trace and span IDs of the active span to your existing logs, through its SDKs and logging bridges.",
        "The Collector can read, parse and export logs from many sources."
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
          "text": "An OpenTelemetry log record has these fields: Timestamp, ObservedTimestamp, TraceId, SpanId, TraceFlags, SeverityText, SeverityNumber, Body, Resource, InstrumentationScope, Attributes and EventName."
        },
        {
          "type": "list",
          "items": [
            "Body: the body of the log record.",
            "Attributes: additional information about the event.",
            "Resource: describes the observed entity that generated the log.",
            "SeverityText: the original string for the severity, also known as the log level.",
            "SeverityNumber: a number for the severity, where smaller values are less severe events.",
            "TraceId and SpanId: the request trace and span the log belongs to, when there is one."
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
          "text": "When you add auto-instrumentation or activate an SDK, OpenTelemetry automatically correlates your existing logs with any active trace and span. The SDK can inject the trace ID and span ID into a log record. OpenTelemetry reaches existing logging frameworks through logging bridges."
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
          "text": "OpenTelemetry is designed to work with the logs you already produce. The first step in adopting it often is deploying a Collector as a general-purpose logging agent."
        },
        {
          "type": "paragraph",
          "text": "The Collector has receivers that parse logs from known sources, and a filelog receiver that reads logs from any file and can parse different formats or use a regular expression. Processors such as the transform processor can parse nested data and add, remove or update values."
        },
        {
          "type": "paragraph",
          "text": "Applications can also send logs through the Logs API or through logging bridges that connect existing logging frameworks."
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
