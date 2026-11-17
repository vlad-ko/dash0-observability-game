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
      "text": "Already know this? Pick \"I am already familiar with the topic\" to skip the reading."
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
            "Counter: a value that accumulates over time, like the odometer of a car. It only ever goes up.",
            "UpDownCounter: a value that accumulates over time but can also go down again.",
            "Gauge: measures a current value at the time it is read, like the fuel gauge in a vehicle.",
            "Histogram: a client-side aggregation of values. A good choice if you are interested in value statistics."
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
      "id": "temporality",
      "title": "Temporality: total or change",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Sums and histograms in OTLP carry an aggregation temporality, which is either delta or cumulative. It is used to understand the context in which the value was calculated."
        },
        {
          "type": "paragraph",
          "text": "With delta temporality, the time windows of a metric stream do not overlap. With cumulative temporality, each point reports the full sum since a start time, which is often close to the start of the process or application."
        },
        {
          "type": "paragraph",
          "text": "There are trade-offs between the two, for example for detecting process restarts, calculating rates, and push or pull based reporting. OTLP supports both models, and lets APIs, SDKs and users choose the best trade-off for their use case."
        },
        {
          "type": "paragraph",
          "text": "A gauge is different: it represents a sampled value at a given time, and does not provide an aggregation semantic."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Metrics data model",
          "url": "https://opentelemetry.io/docs/specs/otel/metrics/data-model/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "histograms-and-percentiles",
      "title": "Histograms and percentiles",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A histogram data point conveys a population of recorded measurements in a compressed format. It bundles a set of events into divided populations with an overall count and a sum. It can also carry a min and a max, and buckets with explicit boundaries and a count of the observations in each."
        },
        {
          "type": "paragraph",
          "text": "A φ-quantile, with φ between 0 and 1, is the observation value that ranks at number φ times N among N observations. The 0.5-quantile is known as the median. The 0.95-quantile is also called the 95th percentile."
        },
        {
          "type": "paragraph",
          "text": "In Prometheus, histograms expose bucketed observation counts, and the quantile is calculated from the buckets on the Prometheus server with the histogram_quantile() function. Summaries instead calculate their quantiles inside the instrumented program, and you cannot aggregate those quantiles."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Metrics data model",
          "url": "https://opentelemetry.io/docs/specs/otel/metrics/data-model/",
          "audience": "public"
        },
        {
          "kind": "article",
          "label": "Prometheus: Histograms and summaries",
          "url": "https://prometheus.io/docs/practices/histograms/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "promql-basics",
      "title": "PromQL basics",
      "blocks": [
        {
          "type": "paragraph",
          "text": "In Dash0, the Metric Explorer sidebar shows a live data preview with the underlying PromQL query of the selected metric. These are three PromQL functions from the Prometheus documentation."
        },
        {
          "type": "list",
          "items": [
            "rate(v range-vector) calculates the per-second average rate of increase of the time series in the range vector.",
            "increase(v range-vector) calculates the increase in the time series in the range vector.",
            "histogram_quantile(φ, b) calculates the φ-quantile from a classic or native histogram."
          ]
        },
        {
          "type": "paragraph",
          "text": "Breaks in monotonicity, such as counter resets due to target restarts, are automatically adjusted for by rate() and increase(). Each bucket sample of a classic histogram carries an le label, whose value is the inclusive upper bound of the bucket."
        }
      ],
      "sources": [
        {
          "kind": "article",
          "label": "Prometheus: Query functions",
          "url": "https://prometheus.io/docs/prometheus/latest/querying/functions/",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: About Metrics",
          "url": "https://www.dash0.com/docs/dash0/telemetry/metrics/about-metrics",
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
      "id": "exemplars",
      "title": "Exemplars",
      "blocks": [
        {
          "type": "paragraph",
          "text": "An exemplar is a recorded value that associates OpenTelemetry context with a metric event. One use case is to link trace signals with metrics."
        },
        {
          "type": "paragraph",
          "text": "An exemplar can carry the trace ID and span ID of the trace associated with a recording, the time of the observation, the recorded value, and a set of filtered attributes. A data point can have a set of exemplars, and they are optional."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Metrics data model",
          "url": "https://opentelemetry.io/docs/specs/otel/metrics/data-model/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "red-and-use",
      "title": "RED and USE",
      "blocks": [
        {
          "type": "paragraph",
          "text": "RED stands for three golden signals of service performance. Rate is requests per second, Errors is the error percentage, and Duration is the latency distribution."
        },
        {
          "type": "paragraph",
          "text": "The USE method is a methodology for analyzing the performance of any system. It directs the construction of a checklist, and begins by posing questions instead of starting from given metrics. The checks are utilization, saturation and errors."
        },
        {
          "type": "paragraph",
          "text": "Utilization is the average time that a resource was busy servicing work. Saturation is the degree to which a resource has extra work that it cannot service."
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: Built-in Service Metrics",
          "url": "https://www.dash0.com/docs/dash0/monitoring/services/built-in-metrics",
          "audience": "public"
        },
        {
          "kind": "article",
          "label": "Brendan Gregg: The USE Method",
          "url": "https://www.brendangregg.com/usemethod.html",
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
