// Act 3 primer (#389). PLACEHOLDER: drafted from the official OpenTelemetry metrics page and one Dash0
// docs page only, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-3",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry and Dash0 docs pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Metrics: how much, how often",
  "overview": [
    {
      "type": "paragraph",
      "text": "A metric is a measurement of a service captured at runtime. Metrics give you statistics in aggregate, where traces show single requests. This act covers choosing the right instrument, reading metrics and keeping them manageable."
    },
    {
      "type": "list",
      "items": [
        "Each metric instrument has a kind, and the kind decides what the numbers mean.",
        "Attributes make a metric useful, and too many unique combinations make it costly to keep.",
        "In Dash0 you explore metrics in the Metric Explorer and query them with PromQL."
      ]
    },
    {
      "type": "callout",
      "tone": "tip",
      "text": "Already know this? Skip the reading and go straight to the levels."
    }
  ],
  "chapters": [
    {
      "id": "instruments",
      "title": "Metric instruments",
      "blocks": [
        {
          "type": "paragraph",
          "text": "In OpenTelemetry, measurements are captured by metric instruments. An instrument has a name, a kind, and an optional unit and description."
        },
        {
          "type": "list",
          "items": [
            "Counter: a value that accumulates over time and only ever goes up.",
            "UpDownCounter: a value that accumulates but can also go down, such as a queue length.",
            "Gauge: measures a current value at the time it is read.",
            "Histogram: a client-side aggregation of values, such as request latencies."
          ]
        },
        {
          "type": "paragraph",
          "text": "Counter, UpDownCounter and Gauge also have asynchronous forms, collected once for each export. An aggregation combines many measurements into statistics about a time window. Each instrument has a default aggregation."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Metrics",
          "url": "https://opentelemetry.io/docs/concepts/signals/metrics/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "cardinality",
      "title": "Cardinality",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The cardinality of a metric is the number of unique attribute combinations reported for it. The SDK keeps a separate data point in memory for each combination, so cardinality drives the memory cost of metrics."
        },
        {
          "type": "paragraph",
          "text": "High-cardinality attributes, such as user IDs or raw URL paths, can cause unbounded memory growth. To protect applications, the metrics SDK enforces a cardinality limit per metric stream."
        },
        {
          "type": "paragraph",
          "text": "When the limit is reached, further combinations are folded into a single overflow data point marked otel.metric.overflow=true. The overall total stays correct, but a query that filters or groups by an attribute on that metric can undercount."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Metrics",
          "url": "https://opentelemetry.io/docs/concepts/signals/metrics/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "metrics-in-dash0",
      "title": "Metrics in Dash0",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The Metric Explorer lets you browse, filter and investigate the metrics across your services and infrastructure. It is the starting point for deeper analysis in the Query Builder."
        },
        {
          "type": "paragraph",
          "text": "Dash0 supports all OpenTelemetry metric data model types: Sum, Gauge, Histogram and Exponential Histogram, plus the legacy Summary. A Sum can be monotonic, produced by a Counter, or non-monotonic, produced by an UpDownCounter."
        },
        {
          "type": "paragraph",
          "text": "Selecting a metric opens a sidebar with a description, a live data preview with the underlying PromQL query, and its attributes and associated resources."
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: About Metrics",
          "url": "https://www.dash0.com/docs/dash0/telemetry/metrics/about-metrics",
          "audience": "public"
        }
      ]
    }
  ]
};
