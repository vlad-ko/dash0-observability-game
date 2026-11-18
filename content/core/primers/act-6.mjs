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
      "text": "Sampling is one of the most effective ways to reduce the costs of observability without losing visibility. This act is about deciding what to keep, and about what drives the cost."
    },
    {
      "type": "list",
      "items": [
        "Head sampling decides as early as possible.",
        "Tail sampling decides based on specific criteria, and is harder to run.",
        "The number of label sets of a metric is a cost of its own."
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
          "text": "Sampling relies on representativeness: the principle that a smaller group can accurately represent a larger group."
        },
        {
          "type": "list",
          "items": [
            "Sampled: a trace or span is processed and exported.",
            "Not sampled: a trace or span is not processed or exported."
          ]
        },
        {
          "type": "paragraph",
          "text": "Sampling is worth it when you generate a lot of data, for example 1000 or more traces per second. It is not when you generate very little data, such as tens of small traces per second or fewer."
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
          "text": "Head sampling makes a sampling decision as early as possible. It is easy to understand, easy to configure and efficient, and it can be done at any point in the trace collection pipeline."
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
          "text": "Tail sampling gives you the option to sample your traces based on specific criteria."
        },
        {
          "type": "list",
          "items": [
            "It can be difficult to implement.",
            "It can be difficult to operate.",
            "The components that implement it must be stateful systems that can accept and store a large amount of data.",
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
          "text": "Each label set of a metric is an additional time series, with RAM, CPU, disk and network costs. Usually the overhead is negligible, but with lots of metrics and hundreds of label sets across hundreds of servers it can add up quickly."
        },
        {
          "type": "paragraph",
          "text": "The Prometheus guideline is that the vast majority of your metrics should have no labels. If you are unsure, start with no labels and add more over time as concrete use cases arise."
        },
        {
          "type": "paragraph",
          "text": "In Dash0, you can install pre-built dashboards that rank services by telemetry volume and forecast volume trends across any resource attribute."
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
          "url": "https://www.dash0.com/docs/dash0/cost-control",
          "audience": "public"
        }
      ]
    }
  ]
};
