// Act 6 primer (#389). PLACEHOLDER: drafted from the official OpenTelemetry sampling page, the Prometheus
// instrumentation practices page and one Dash0 docs page, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-6",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry, Prometheus and Dash0 docs pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Sampling and cost: you can't keep everything",
  "overview": [
    {
      "type": "paragraph",
      "text": "[[Sampling]] decides which [[traces]] and [[spans]] are processed and exported, and relies on a smaller group representing a larger one. This act is about deciding what to keep, and about what drives the cost."
    },
    {
      "type": "list",
      "items": [
        "Head sampling decides as early as possible, without looking at the whole trace.",
        "Tail sampling decides once all or most of the spans in the trace are in, based on specific criteria. It is harder to run.",
        "Each unique combination of [[attribute]] values on a [[metric]] is a separate [[time series]] (one stream of points), and that count is a cost of its own."
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
      "id": "why-sample",
      "title": "Why sample",
      "blocks": [
        {
          "type": "paragraph",
          "text": "[[Sampling]] relies on [[representativeness]]: the principle that a smaller group can accurately represent a larger group."
        },
        {
          "type": "list",
          "items": [
            "Sampled: a [[trace]] or [[span]] is processed and exported.",
            "Not sampled: a trace or span is not processed or exported."
          ]
        },
        {
          "type": "paragraph",
          "text": "Consider sampling if you generate a lot of data, for example 1000 or more traces per second. It might not be right for you if you generate very little data, such as tens of small traces per second or fewer."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Sampling",
          "url": "https://opentelemetry.io/docs/concepts/sampling/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "head-sampling",
      "title": "Head sampling",
      "blocks": [
        {
          "type": "paragraph",
          "text": "[[Head sampling]] makes a sampling decision as early as possible. It is easy to understand, easy to configure and efficient, and it can be done at any point in the trace collection pipeline."
        },
        {
          "type": "paragraph",
          "text": "Its downside is that it is not possible to make a sampling decision based on data in the entire trace."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Sampling",
          "url": "https://opentelemetry.io/docs/concepts/sampling/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "tail-sampling",
      "title": "Tail sampling",
      "blocks": [
        {
          "type": "paragraph",
          "text": "[[Tail sampling]] gives you the option to sample your traces based on specific criteria."
        },
        {
          "type": "list",
          "items": [
            "It can be difficult to implement.",
            "It can be difficult to operate.",
            "The components that implement it must keep state, for example by holding spans while they wait to decide.",
        "They must also be able to accept and store a large amount of data.",
            "Tail samplers often end up vendor-specific."
          ]
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Sampling",
          "url": "https://opentelemetry.io/docs/concepts/sampling/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "what-drives-cost",
      "title": "What drives cost",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Each unique combination of [[attribute]] values on a [[metric]] is an additional [[time series]], with RAM, CPU, disk and network costs. Usually the overhead is negligible, but with lots of metrics and hundreds of combinations across hundreds of servers it can add up quickly."
        },
        {
          "type": "paragraph",
          "text": "The [[Prometheus]] guideline is that the vast majority of your metrics should have no [[labels]] (Prometheus's word for an attribute). If you are unsure, start with no labels and add more over time as concrete use cases arise."
        },
        {
          "type": "paragraph",
          "text": "In [[Dash0]], you can install pre-built dashboards that rank services by telemetry volume and forecast volume trends across any resource attribute."
        }
      ],
      "sources": [
        {
          "kind": "article",
          "label": "Prometheus: Instrumentation",
          "url": "https://prometheus.io/docs/practices/instrumentation/",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: Cost control",
          "url": "https://www.dash0.com/docs/dash0/cost-control/overview",
          "audience": "public"
        }
      ]
    }
  ]
};
