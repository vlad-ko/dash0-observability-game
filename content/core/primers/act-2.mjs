// Act 2 primer (#389). PLACEHOLDER: drafted from official OpenTelemetry pages and one Dash0 docs
// page only, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-2",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry and Dash0 docs pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Traces: follow the request",
  "overview": [
    {
      "type": "paragraph",
      "text": "A trace is the path of one request through your application. This act teaches you to read that path, to pass it between services, and to decide what to record along the way."
    },
    {
      "type": "list",
      "items": [
        "Spans are the units of work, and together they make a trace.",
        "Span kind and status say what role a span played and how it ended.",
        "Context propagation joins spans from different services into one trace."
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
      "id": "spans-and-traces",
      "title": "Spans and traces",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A span represents a unit of work or operation. Spans are the building blocks of traces. A span has a name, a parent span ID (empty for root spans), start and end timestamps, a trace ID and a span ID with a few more trace details, attributes, events, links and a status."
        },
        {
          "type": "paragraph",
          "text": "Spans that share a trace ID and point to their parents with a parent ID form a trace. The root span has no parent ID. Spans can be nested: child spans represent sub-operations."
        },
        {
          "type": "paragraph",
          "text": "In Dash0, the Trace View shows a single trace with all its spans and their relationships."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Traces",
          "url": "https://opentelemetry.io/docs/concepts/signals/traces/",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: Visualize the Full Trace",
          "url": "https://www.dash0.com/docs/dash0/telemetry/tracing/view",
          "audience": "public"
        }
      ]
    },
    {
      "id": "kind-and-status",
      "title": "Span kind and status",
      "blocks": [
        {
          "type": "paragraph",
          "text": "When a span is created, it is one of CLIENT, SERVER, INTERNAL, PRODUCER or CONSUMER. The span kind is a hint to the tracing backend about how the trace should be assembled. If it is not provided, the kind is assumed to be INTERNAL."
        },
        {
          "type": "list",
          "items": [
            "CLIENT: a synchronous outgoing remote call, such as an outgoing HTTP request or a database call.",
            "SERVER: a synchronous incoming remote call, such as an incoming HTTP request.",
            "INTERNAL: an operation that does not cross a process boundary.",
            "PRODUCER: the creation of a job that may be processed later.",
            "CONSUMER: the processing of a job created by a producer."
          ]
        },
        {
          "type": "paragraph",
          "text": "Each span also has a status: Unset, Error or Ok. The default is Unset, which means the operation completed without an error. Error means some error occurred in the operation. Ok means the developer explicitly marked the span as successful."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Traces",
          "url": "https://opentelemetry.io/docs/concepts/signals/traces/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "context-and-baggage",
      "title": "Context propagation and baggage",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Context propagation is the concept that enables distributed tracing. When Service A calls Service B, Service A includes a trace ID and a span ID as part of the context. Service B uses them to create a span in the same trace, with the span from Service A as its parent."
        },
        {
          "type": "paragraph",
          "text": "Propagation moves the context between services and processes, and is usually handled by instrumentation libraries. The default propagator uses the headers of the W3C TraceContext specification."
        },
        {
          "type": "paragraph",
          "text": "Baggage is contextual information that resides next to context. It is a key-value store that lets you pass data across services. It is a separate store, kept apart from the attributes on spans, metrics and logs."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Context propagation",
          "url": "https://opentelemetry.io/docs/concepts/context-propagation/",
          "audience": "public"
        },
        {
          "kind": "otel",
          "label": "OpenTelemetry: Baggage",
          "url": "https://opentelemetry.io/docs/concepts/signals/baggage/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "events-links-and-instrumentation",
      "title": "Events, links and instrumentation",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A span event is a timestamped note inside a span, used for a meaningful, single point in time. When deciding between an event and an attribute, ask whether a specific timestamp is meaningful."
        },
        {
          "type": "paragraph",
          "text": "Span links associate one span with one or more other spans, implying a causal relationship. They are useful when the next operation is asynchronous and you cannot predict when it will start."
        },
        {
          "type": "paragraph",
          "text": "Zero-code instrumentation adds the OpenTelemetry API and SDK to your application without writing code, typically as an agent. It instruments the libraries you use, such as requests, database calls and message queues. It does not typically instrument your own application code. For that you need code-based instrumentation."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Traces",
          "url": "https://opentelemetry.io/docs/concepts/signals/traces/",
          "audience": "public"
        },
        {
          "kind": "otel",
          "label": "OpenTelemetry: Zero-code instrumentation",
          "url": "https://opentelemetry.io/docs/concepts/instrumentation/zero-code/",
          "audience": "public"
        }
      ]
    }
  ]
};
