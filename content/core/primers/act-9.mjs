// Act 9 primer (#389). PLACEHOLDER: drafted from the official OpenTelemetry observability primer and Dash0
// docs pages, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-9",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry and Dash0 docs pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Live Demo: does that answer hold?",
  "overview": [
    {
      "type": "paragraph",
      "text": "In this act you hear confident answers from customer calls and check each one against the telemetry. Then you connect the game to [[Dash0]] and find its incident in the [[Trace View]]."
    },
    {
      "type": "list",
      "items": [
        "[[Observability]] lets you ask questions about a system from the outside, once the application is [[instrumented|instrumentation]].",
        "To send to Dash0 you need an [[auth token]] (a key that lets a user or service call Dash0's APIs).",
        "[[Datasets]], which are parts of one organisation with their own data, keep data apart.",
        "In Dash0 you find [[telemetry]] with [[attribute filters]] (a key, an operator such as equals, and values) and read a single trace in the Trace View."
      ]
    },
    {
      "type": "callout",
      "tone": "note",
      "text": "The In Dash0 step uses the game's own Dash0 organisation. To do that step, sign in with your dash0.com account."
    },
    {
      "type": "callout",
      "tone": "tip",
      "text": "Already know this? Pick \"I am already familiar with the topic\" to skip the reading."
    }
  ],
  "chapters": [
    {
      "id": "asking-questions",
      "title": "Asking questions of a system",
      "blocks": [
        {
          "type": "paragraph",
          "text": "[[Observability]] lets you understand a system from the outside, by letting you ask questions about that system without knowing its inner workings."
        },
        {
          "type": "paragraph",
          "text": "To ask those questions about your system, your application must be properly [[instrumented|instrumentation]]."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Observability primer",
          "url": "https://opentelemetry.io/docs/concepts/observability-primer/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "sending-to-dash0",
      "title": "Sending to Dash0",
      "blocks": [
        {
          "type": "paragraph",
          "text": "[[Auth tokens]] authenticate and authorise users and services when they access Dash0's APIs. You use them to send [[telemetry]] to Dash0, and to integrate Dash0 with other solutions, for example Grafana or Terraform (a tool that manages infrastructure as code)."
        },
        {
          "type": "paragraph",
          "text": "[[Datasets]] separate observability data within one organisation, while organisation data such as users and billing stays shared. Common uses are environments, such as datasets called production and test, audit logging, and local development and experiments."
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: Auth tokens",
          "url": "https://www.dash0.com/docs/dash0/miscellaneous/glossary/auth-tokens",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: Datasets",
          "url": "https://www.dash0.com/docs/dash0/miscellaneous/glossary/datasets",
          "audience": "public"
        }
      ]
    },
    {
      "id": "finding-telemetry",
      "title": "Finding telemetry in Dash0",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Dash0 uses [[attribute filters]] to get to the telemetry you need. You build a filter in three parts: first the key to filter on, then an [[operator|filter-operator]] (a comparison such as equals), then one or more values. While you type, Dash0 suggests the keys and values that match."
        },
        {
          "type": "paragraph",
          "text": "Many Dash0 pages have a [[filter bar]], the bar that holds the page's filters. [[Pinned filters]] work across all of those pages: they stay on screen as you move between them."
        },
        {
          "type": "paragraph",
          "text": "The pages with a filter bar include the [[Trace Explorer]], the page for finding traces, and the [[Log Explorer]], the page for finding logs. The Services page and the Resources page have one too."
        },
        {
          "type": "paragraph",
          "text": "In the Trace Explorer, the filter narrows the span data shown across all views. The [[Trace View]] gives a detailed look at a single trace in three visualisations: a waterfall, a flame graph and a trace graph. Selecting a span opens the [[Span Sidebar]], a detail panel for that span."
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: Filtering",
          "url": "https://www.dash0.com/docs/dash0/miscellaneous/glossary/filtering",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: About tracing",
          "url": "https://www.dash0.com/docs/dash0/telemetry/tracing/about-tracing",
          "audience": "public"
        }
      ]
    }
  ]
};
