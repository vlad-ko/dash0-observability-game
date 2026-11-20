// Act 3 primer (#389). PLACEHOLDER: drafted from official OpenTelemetry, Prometheus and Dash0 docs pages
// and the USE method's own page by its originator, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-3",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry, Prometheus and Dash0 docs pages and the USE method's own page; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Metrics: how much, how often",
  "overview": [
    {
      "type": "paragraph",
      "text": "A metric is a measurement of a service captured at runtime. Metrics give you statistics in aggregate, where traces show single requests. This act covers choosing the right [[instrument]] (the thing that records a metric, explained below), reading metrics and keeping them manageable."
    },
    {
      "type": "list",
      "items": [
        "Each metric instrument has a kind, and the kind decides what the numbers mean.",
        "[[Attributes]] make a metric useful, and too many unique combinations make it costly to keep.",
        "In Dash0 you explore metrics in the [[Metric Explorer]] and query them with [[PromQL]] (the query language of Prometheus, the open-source metrics system)."
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
          "text": "In OpenTelemetry, measurements are captured by metric [[instruments]]. An instrument has a name, a kind, and an optional unit and description."
        },
        {
          "type": "list",
          "items": [
            "Counter: a value that accumulates over time, like the odometer of a car. It only ever goes up.",
            "UpDownCounter: a value that accumulates over time but can also go down again.",
            "Gauge: measures a current value at the time it is read, like the fuel gauge in a vehicle.",
            "[[Histogram]]: combines many values into bucket counts in the SDK, before export. A good choice if you are interested in value statistics."
          ]
        },
        {
          "type": "paragraph",
          "text": "Counter, UpDownCounter and Gauge also have observable (asynchronous) forms, which are read once for each export. An [[aggregation]] combines many measurements into statistics about a [[time window]]. Each instrument has a default aggregation."
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
          "text": "Sums (running totals) and histograms in OTLP (the OpenTelemetry Protocol, see act 5) carry an [[aggregation temporality]], which is either delta or cumulative. It tells you how the value was calculated."
        },
        {
          "type": "paragraph",
          "text": "With delta temporality, the [[time windows]] of a [[time series]] (the points reported for one metric and one attribute combination) do not overlap. With cumulative temporality, each point reports the full sum since a start time, which is often close to the start of the process or application."
        },
        {
          "type": "paragraph",
          "text": "There are trade-offs between the two, for example for detecting process restarts, calculating rates, and reporting by push (the app sends the data) or pull (a server fetches it). OTLP supports both models, and lets APIs, SDKs and users choose the trade-off that fits their use case."
        },
        {
          "type": "paragraph",
          "text": "A gauge is different: it has no aggregation temporality."
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
          "text": "A [[histogram]] [[data point]] (one reported value for a metric and one attribute combination, over one time window) sums up many recorded measurements in a compact form. It groups them into buckets and carries an overall count and a sum. It can also carry the smallest and the largest value. In an explicit histogram, each bucket has boundaries and a count of the observations that fell into it."
        },
        {
          "type": "paragraph",
          "text": "An exponential histogram is an alternative form. It works out its bucket boundaries from a scale with an exponential formula, and a larger scale gives more precision."
        },
        {
          "type": "paragraph",
          "text": "A [[quantile]] is a value from the observations, picked by rank after sorting them from smallest to largest. You name it with a number between 0 and 1. The 0.5-quantile is known as the median. The 0.95-quantile is also called the 95th percentile."
        },
        {
          "type": "paragraph",
          "text": "In [[Prometheus]], histograms expose bucketed observation counts, and the quantile is calculated from the buckets on the Prometheus server with the [[histogram_quantile()]] function (a [[PromQL]] function that works out a quantile from the buckets). [[Summaries]] (a Prometheus metric type) instead calculate their quantiles inside the instrumented program, and you cannot aggregate those quantiles."
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
          "text": "In Dash0, the [[Metric Explorer]] sidebar shows a live data preview with the underlying [[PromQL]] query of the selected metric. These are three PromQL functions from the Prometheus documentation."
        },
        {
          "type": "list",
          "items": [
            "[[rate()]]: the average increase per second of a [[time series]], over the time range you give it.",
            "[[increase()]]: how much a time series grew over the time range you give it.",
            "[[histogram_quantile()]]: works out a quantile from a classic histogram, which uses fixed buckets, or a native histogram, which normally uses exponential buckets."
          ]
        },
        {
          "type": "paragraph",
          "text": "When a counter starts over, for example because its [[scrape target]] (the endpoint Prometheus reads) restarted, rate() and increase() adjust for it. Each bucket series of a classic histogram has a [[label]] (Prometheus's word for an attribute) called [[le]], which holds the bucket's upper bound. The bound itself is included in the bucket."
        },
        {
          "type": "paragraph",
          "text": "For Prometheus-style backends, OpenTelemetry metric names are translated. Characters Prometheus discourages are replaced with an underscore, and a unit word and a type-specific suffix can be added."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Prometheus and OpenMetrics compatibility",
          "url": "https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/",
          "audience": "public"
        },
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
          "text": "The [[cardinality]] of a metric is the number of [[time series]] (unique attribute combinations) reported for it. The SDK keeps a separate [[data point]] in memory for each combination, so cardinality drives the memory cost of metrics."
        },
        {
          "type": "paragraph",
          "text": "High-cardinality attributes, such as user IDs or raw URL paths, can cause unbounded memory growth. To protect applications, the metrics SDK enforces a cardinality limit per metric."
        },
        {
          "type": "paragraph",
          "text": "When the limit is reached, further combinations are folded into a single [[overflow data point]] marked otel.metric.overflow=true. The overall total stays correct, but a query that filters or groups by an attribute on that metric can undercount."
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
          "text": "An [[exemplar]] is a recorded value that associates OpenTelemetry context with one recorded measurement. One use case is to link traces with metrics."
        },
        {
          "type": "paragraph",
          "text": "An exemplar can carry the trace ID and span ID of the trace associated with a recording, the time of the observation, the recorded value, and the attributes that were filtered out of the metric. A data point can have a set of exemplars, and they are optional."
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
          "text": "[[RED]] stands for the three core measures of a request-driven service. Rate is requests per second, Errors is the error percentage, and Duration is the latency distribution."
        },
        {
          "type": "paragraph",
          "text": "The [[USE]] method is a way to analyse the performance of any system. It gives you a checklist, and it starts from questions instead of from the metrics you happen to have. The checks are [[utilisation]], [[saturation]] and errors."
        },
        {
          "type": "paragraph",
          "text": "Utilisation is the average time that a system resource (such as CPU, disk, memory or network) was busy servicing work. Saturation is how much extra work a system resource has that it cannot service."
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
          "text": "The [[Metric Explorer]] lets you browse, filter and investigate the metrics across your services and infrastructure. It is the starting point for deeper analysis in the [[Query Builder]]."
        },
        {
          "type": "paragraph",
          "text": "Dash0 supports all OpenTelemetry [[metric data model]] types (the kinds of metric OpenTelemetry defines): Sum, Gauge, Histogram and Exponential Histogram, plus the [[legacy Summary]] type from Prometheus. A Sum can be [[monotonic]] (it only goes up), produced by a Counter, or non-monotonic, produced by an UpDownCounter."
        },
        {
          "type": "paragraph",
          "text": "Selecting a metric opens a sidebar with a description, a live data preview with the underlying [[PromQL]] query, and its attributes and associated resources."
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
