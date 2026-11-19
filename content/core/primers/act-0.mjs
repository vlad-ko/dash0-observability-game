// Act 0 primer (#389). PLACEHOLDER: drafted from the official OpenTelemetry pages and one Dash0
// docs page only, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-0",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry and Dash0 docs pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Orientation: day one",
  "overview": [
    {
      "type": "paragraph",
      "text": "You are the new on-call engineer. Before the first page, this act gives you the words the rest of the game uses: what observability is, what the main signals (kinds of telemetry, the data a system emits about itself) are, and why OpenTelemetry (the shared, vendor-neutral telemetry toolkit) exists. Dash0 is the observability platform this game teaches alongside OpenTelemetry."
    },
    {
      "type": "list",
      "items": [
        "Observability is the ability to understand what is going on inside a system from its outputs, so you can ask questions about problems nobody predicted.",
        "The main signals are traces, metrics and logs, with profiles emerging as a fourth. Each answers a different kind of question.",
        "OpenTelemetry is the shared, vendor-neutral way to generate, collect and export that telemetry."
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
      "id": "monitoring-vs-observability",
      "title": "Monitoring and observability",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Observability is the ability to understand the internal state of a system by examining its outputs. In software, that usually means analyzing telemetry data such as traces, metrics and logs."
        },
        {
          "type": "paragraph",
          "text": "It lets you ask questions about a system without knowing its inner workings. It also helps you handle new problems, the \"unknown unknowns\", and answer the question \"Why is this happening?\""
        },
        {
          "type": "callout",
          "tone": "note",
          "text": "The first level asks you to sort questions into known ones and new ones."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Observability primer",
          "url": "https://opentelemetry.io/docs/concepts/observability-primer/",
          "audience": "public"
        },
        {
          "kind": "otel",
          "label": "OpenTelemetry: What is OpenTelemetry?",
          "url": "https://opentelemetry.io/docs/what-is-opentelemetry/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "the-signals",
      "title": "The signals",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A signal is a kind of telemetry: a system output that describes what the operating system and applications are doing. Traces, metrics and logs are the main ones. Profiles are emerging as a fourth, and are still experimental in OpenTelemetry (it calls this stage Alpha)."
        },
        {
          "type": "list",
          "items": [
            "Traces: the path of a request through your application.",
            "Metrics: a measurement captured at runtime.",
            "Logs: a recording of an event.",
            "Profiles: a recording of resource usage at the code level."
          ]
        },
        {
          "type": "paragraph",
          "text": "Each signal answers a different question. Traces: how does a request travel through a distributed system? Metrics: what is happening at the system level? Logs: what events happened? Profiles: which code is consuming resources?"
        },
        {
          "type": "paragraph",
          "text": "In Dash0, the Trace View shows a single trace with all its spans (the timed steps of the request) and their relationships."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Signals",
          "url": "https://opentelemetry.io/docs/concepts/signals/",
          "audience": "public"
        },
        {
          "kind": "otel",
          "label": "OpenTelemetry: Profiles",
          "url": "https://opentelemetry.io/docs/concepts/signals/profiles/",
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
      "id": "why-opentelemetry",
      "title": "Why OpenTelemetry",
      "blocks": [
        {
          "type": "paragraph",
          "text": "OpenTelemetry is an open source observability framework and toolkit for generating, collecting and exporting telemetry data such as traces, metrics and logs. Storing and visualizing that data is intentionally left to other tools."
        },
        {
          "type": "paragraph",
          "text": "It is vendor-neutral and tool-agnostic, so it can be used with a broad variety of observability backends. It follows two principles: you own the data that you generate, and there is no vendor lock-in. You only have to learn a single set of APIs (the calls your code makes to record telemetry) and conventions (the agreed attribute names)."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: What is OpenTelemetry?",
          "url": "https://opentelemetry.io/docs/what-is-opentelemetry/",
          "audience": "public"
        }
      ]
    }
  ]
};
