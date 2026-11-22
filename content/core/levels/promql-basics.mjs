// Text of levels/promql-basics.mjs (docs/CONTENT.md).
export default {
  "id": "promql-basics",
  "name": "PromQL basics",
  "sub": "Say it in PromQL",
  "rewardTitle": "PromQL speaker",
  "play": {
    "finish": "You can read an OpenTelemetry name as PromQL sees it, write rate with sum by and increase over a range, and you know Dash0 speaks PromQL for metrics and for logs and spans.",
    "steps": [
      {
        "intro": "Kettle & Co's services record <code>http.server.request.duration</code>, a Histogram with the unit <code>s</code>. Before you can query it with [[PromQL]], you need the name PromQL sees. OpenTelemetry's compatibility rules translate names for [[Prometheus]]-style backends: invalid characters, a unit word, a type suffix.",
        "question": "Which series holds the buckets of that histogram, with the classic translation?",
        "choice": {
          "id": "pql-unit",
          "choices": [
            {
              "key": "dotted",
              "label": "<code>http.server.request.duration_bucket</code>",
              "why": "A bare PromQL metric name cannot contain dots. With the classic translation each one becomes an underscore."
            },
            {
              "key": "wrong-unit",
              "label": "<code>http_server_request_duration_milliseconds_bucket</code>",
              "why": "The unit is wrong. The metric's unit is <code>s</code>, so the translation adds <code>_seconds</code>, not <code>_milliseconds</code>, before any suffix for the type."
            },
            {
              "key": "seconds-bucket",
              "label": "<code>http_server_request_duration_seconds_bucket</code>",
              "why": "Dots become underscores, the unit <code>s</code> becomes <code>_seconds</code>, and the histogram adds <code>_bucket</code>, <code>_sum</code> and <code>_count</code> series. That is the classic translation. A backend can be set to keep UTF-8 names or to skip the suffixes, so check what yours does."
            },
            {
              "key": "bare",
              "label": "<code>http_server_request_duration_seconds</code>",
              "why": "A classic histogram has no series under its bare name: its series are <code>_bucket</code>, <code>_sum</code> and <code>_count</code>."
            }
          ]
        }
      },
      {
        "intro": "Counting requests is a Counter named <code>http.server.requests</code>, with the unit <code>{request}</code>.",
        "question": "What is its name in PromQL?",
        "choice": {
          "id": "pql-total",
          "choices": [
            {
              "key": "double-total",
              "label": "<code>http_server_requests_total_total</code>",
              "why": "A [[monotonic]] [[Sum]] becomes a Prometheus counter, and the translation adds <code>_total</code> only once: not if the name already ends with it."
            },
            {
              "key": "total",
              "label": "<code>http_server_requests_total</code>",
              "why": "Dots become underscores and a [[monotonic]] [[Sum]] gets <code>_total</code>. The unit <code>{request}</code> is in braces, and a unit in braces is dropped, so it adds no suffix."
            },
            {
              "key": "brace-unit",
              "label": "<code>http_server_requests_request_total</code>",
              "why": "A unit in braces such as <code>{request}</code> is only an annotation, and the translation drops it."
            }
          ]
        }
      },
      {
        "intro": "A counter only goes up, so its raw value is rarely useful. <code>rate(x[5m])</code> gives the per-second increase over the last 5 minutes, and <code>sum by (label)</code> adds the series up, keeping one per [[label]] value. Checkout has been returning 500s since its deploy. The label names in this data (<code>service</code>, <code>route</code>, <code>status</code>) are Kettle &amp; Co's own; in Dash0 they arrive as <code>service_name</code>, <code>http_route</code> and <code>http_response_status_code</code>.",
        "question": "Write a query for the 500s per second of each checkout route, over the last 5 minutes.",
        "query": {
          "id": "pql-rate",
          "hint": "Narrow the counter to the requests you mean, turn it into a per-second figure, then keep one series for each thing the question says \"each\" of.",
          "explain": "/pay returns 1 error per second and /quote none. [[Rate|promql-rate]] turns the counter into a per-second figure, and sum by keeps one series per route."
        }
      },
      {
        "intro": "A manager wants a count, not a speed. <code>increase(x[10m])</code> is the growth over a window, and it copes with counter resets. Checkout restarted at t=2400, so every checkout counter went back to zero, and the window ending at t=2700 contains the restart.",
        "question": "Write a query for the number of /pay requests in the 10 minutes up to now.",
        "query": {
          "id": "pql-increase",
          "hint": "The right function already copes with the counter reset, and the question wants one number, however the requests differ.",
          "explain": "About 2,338 requests: [[increase|promql-increase]] adjusts for the reset and extrapolates to the whole window, which is why it is not a whole number. It equals the rate times the 600 seconds of the window."
        }
      },
      {
        "intro": "Dash0 is where Kettle & Co writes this PromQL. An OpenTelemetry metric arrives under its original name, and Dash0 adds <code>otel_metric_name</code>, <code>otel_metric_type</code> and <code>otel_metric_unit</code> labels. Selecting by the original name looks like this:",
        "question": "What else is true of PromQL in Dash0?",
        "code": "increase({otel_metric_name=\"http.server.requests\", otel_metric_type=\"sum\"}[10m])",
        "choice": {
          "id": "pql-dash0",
          "choices": [
            {
              "key": "translated-only",
              "label": "Dash0 renames metrics and drops the original name, so you have to learn how <code>_total</code> and the unit suffixes are added first",
              "why": "Dash0 keeps the original name too. Every metric carries an <code>otel_metric_name</code> label, so you can select it without knowing how it was translated."
            },
            {
              "key": "both-names",
              "label": "The OpenTelemetry name works through <code>otel_metric_name</code>, and logs and spans are queryable as metrics",
              "why": "Dash0 exposes each metric under both names, and <code>otel_metric_name</code> keeps a query stable whatever the translation does. It also derives metrics such as <code>dash0.logs</code> and <code>dash0.spans</code> from logs and spans on demand, so the same PromQL reaches them."
            },
            {
              "key": "metrics-only",
              "label": "PromQL cannot query logs or spans: they need a different query language, learned separately, and <code>otel_metric_name</code> does not apply to them",
              "why": "Dash0 turns logs and spans into synthetic metrics such as <code>dash0.logs</code> and <code>dash0.spans</code>, and you query those with the same PromQL."
            },
            {
              "key": "stable-selector",
              "label": "A selector on <code>otel_metric_name</code> stays valid whatever the translation does to the name or unit",
              "why": "The label holds the original OpenTelemetry name, so the query does not depend on how Dash0 translated it for Prometheus. The Dash0 docs recommend it for most queries, and for long-term stability."
            },
            {
              "key": "type-label",
              "label": "The <code>otel_metric_type</code> label tells a sum from a gauge or a histogram, which helps when two metrics share a name",
              "why": "The label holds the OTLP type: <code>sum</code>, <code>gauge</code>, <code>histogram</code>, <code>exponential_histogram</code> or <code>summary</code>. A selector can add it to tell apart metrics that share a name but differ in type."
            },
            {
              "key": "type-is-unit",
              "label": "The <code>otel_metric_type</code> label holds the unit of the metric, such as <code>s</code> or <code>By</code>",
              "why": "That label holds the OTLP type: <code>sum</code>, <code>gauge</code>, <code>histogram</code>, <code>exponential_histogram</code> or <code>summary</code>. The unit is in <code>otel_metric_unit</code>."
            },
            {
              "key": "wrapped-increase",
              "label": "In the visual query tabs, a counter-shaped metric such as <code>dash0.logs</code> or <code>dash0.spans</code> is wrapped in <code>increase()</code> for you",
              "why": "Raw values of a counter only go up, so Dash0 applies <code>increase()</code> to counter-shaped synthetic metrics in the visual Query Builder tabs and in data previews. In PromQL mode you write it yourself."
            },
            {
              "key": "stored-counters",
              "label": "Logs and spans are stored as ready-made counters when they arrive, which is why <code>dash0.logs</code> can be queried",
              "why": "Dash0 does not read a stored counter for them. A synthetic metric is derived on demand from the raw records."
            },
            {
              "key": "label-from-sdk",
              "label": "The <code>otel_metric_name</code> label has to be set by your instrumentation, or Dash0 cannot find the metric by its original name",
              "why": "Your instrumentation does not send it. Dash0 derives the label from the metric's own name, type and unit, and adds it to every metric."
            },
            {
              "key": "echo-hist",
              "label": "The OpenTelemetry name works through <code>otel_metric_name</code> only for one metric type, histograms, not for sums or gauges",
              "why": "Every metric carries the <code>otel_metric_name</code> label, whatever its type. The <code>otel_metric_type</code> label tells a sum from a gauge or a histogram when two metrics share a name."
            },
            {
              "key": "echo-register",
              "label": "Logs and spans are queryable as metrics, but each one needs an <code>otel_metric_name</code> that you register first",
              "why": "Nothing has to be registered. Dash0 derives synthetic metrics such as <code>dash0.logs</code> and <code>dash0.spans</code> from the raw records when you query them."
            },
            {
              "key": "unit-is-type",
              "label": "The <code>otel_metric_unit</code> label says whether a metric is a sum or a gauge",
              "why": "That label holds the unit declared in the metric definition, such as <code>s</code> or <code>By</code>. The type is in <code>otel_metric_type</code>."
            },
            {
              "key": "synthetic-gauge",
              "label": "Synthetic metrics such as <code>dash0.logs</code> are gauge-shaped, so you wrap them in <code>avg_over_time()</code> to read them",
              "why": "Most synthetic metrics are counters, and the visual tabs wrap those in <code>increase()</code>. Only the gauge-shaped ones, such as <code>dash0.metrics.timeseries</code>, are aggregated directly."
            }
          ]
        }
      }
    ]
  }
};
