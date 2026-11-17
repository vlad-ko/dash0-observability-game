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
      "text": "You are the new on-call engineer. Before the first page, this act gives you the words the rest of the game uses: what observability is, what the four signals are, and why OpenTelemetry exists."
    },
    {
      "type": "list",
      "items": [
        "Monitoring watches for problems you already know about. Observability lets you ask new questions about a system you did not plan for.",
        "The signals are metrics, logs, traces and profiles. Each answers a different kind of question.",
        "OpenTelemetry is the shared, vendor neutral way to produce and send that telemetry."
      ]
    },
    {
      "type": "callout",
      "tone": "tip",
      "text": "Already know this? Choose the familiar option and go straight to the levels. You can reopen this primer from the act at any time."
    }
  ],
  "chapters": [
    {
      "id": "monitoring-vs-observability",
      "title": "Monitoring and observability",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Monitoring means collecting data and checking it against questions you thought of in advance, such as whether the CPU is busy or the error rate is above a line."
        },
        {
          "type": "paragraph",
          "text": "Observability is about how well you can understand what is happening inside a system from the data it gives out. With good telemetry you can ask a question nobody planned for, and still get an answer."
        },
        {
          "type": "callout",
          "tone": "note",
          "text": "The first level asks you to sort questions into the ones a dashboard was built for and the ones that need to be asked fresh."
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
    },
    {
      "id": "the-signals",
      "title": "The signals",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A signal is a kind of telemetry. OpenTelemetry describes metrics, logs, traces and profiles, and each one answers a different question."
        },
        {
          "type": "list",
          "items": [
            "Metrics: numbers over time, such as requests per second.",
            "Logs: timestamped records of something that happened.",
            "Traces: the path of one request through the services it touched.",
            "Profiles: where a program spends its CPU time and memory."
          ]
        },
        {
          "type": "paragraph",
          "text": "The signals are most useful together. A metric tells you something is wrong, a trace shows where, and a log tells you why."
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
          "kind": "docs",
          "label": "Dash0 docs: Viewing traces",
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
          "text": "OpenTelemetry is an open source project with one set of APIs, SDKs, tools and conventions for generating, collecting and exporting telemetry. It is not a place to store or look at the data."
        },
        {
          "type": "paragraph",
          "text": "Because it is vendor neutral, you instrument your code once and can send the data to any backend that understands it, including Dash0."
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
