// Text of levels/temporality.mjs (docs/CONTENT.md).
export default {
  "id": "temporality",
  "name": "Temporality",
  "sub": "Total or change",
  "rewardTitle": "Temporality translator",
  "play": {
    "finish": "You can tell delta from cumulative, you know Prometheus-style backends need cumulative and a restart resets a counter, and that Dash0 can query both.",
    "steps": [
      {
        "intro": "Every [[Sum]] and [[Histogram]] point comes in one of two temporalities: <b>cumulative</b>, the total since the process started, or <b>delta</b>, only the change since the last report. The infra team wants Kettle & Co's metrics in their [[Prometheus]]-style backend too, and it stores cumulative totals. A debug view lists seven series, with the temporality of each.",
        "question": "Spot the series that need converting before that backend can use them.",
        "spot": {
          "id": "temp-spot",
          "hint": "Ask of each series whether it is a running total, a change since the last report, or has no temporality at all.",
          "lines": [
            {
              "id": "orders-placed",
              "text": "orders_placed_total{service=\"orders\", temporality=\"cumulative\"}"
            },
            {
              "id": "emails-sent",
              "text": "emails_sent_total{service=\"notifications\", temporality=\"delta\"}"
            },
            {
              "id": "queue-length",
              "text": "orders_queue_length{service=\"orders\", temporality=\"cumulative\"}"
            },
            {
              "id": "warehouse-temp",
              "text": "warehouse_temperature_celsius{site=\"rotterdam\"}"
            },
            {
              "id": "checkout-duration",
              "text": "checkout_duration_seconds{service=\"checkout\", region=\"eu-west-1\", temporality=\"delta\"}"
            },
            {
              "id": "payments-declined",
              "text": "payments_declined_total{service=\"payments\", temporality=\"delta\"}"
            },
            {
              "id": "request-duration",
              "text": "http_server_request_duration_seconds{service=\"storefront\", temporality=\"cumulative\"}"
            }
          ],
          "whyNot": {
            "orders-placed": "Already cumulative: the total since the process started, which is what a Prometheus-style backend stores.",
            "queue-length": "An UpDownCounter stays cumulative even when the OTLP exporter is set to delta, so it needs no conversion.",
            "warehouse-temp": "A Gauge has no aggregation temporality: each point is the last sampled value, so there is nothing to convert.",
            "request-duration": "A cumulative histogram maps straight onto a Prometheus histogram."
          },
          "explain": "Those three are delta: each point is only the change since the last report. A Prometheus-style backend stores cumulative totals, and OpenTelemetry's data model notes that the time series model it targets has no delta counters. So something has to convert them first, and an exporter either converts a delta histogram or drops it."
        }
      },
      {
        "intro": "The delta series come from a vendor agent, and its temporality is not yours to change this quarter. The Collector sits between the services and the backend.",
        "question": "How do you get them into the backend?",
        "choice": {
          "id": "temp-convert",
          "choices": [
            {
              "key": "gauge",
              "label": "Turn them into gauges, to report a plain value each time",
              "why": "A gauge has no aggregation semantic, so you would swap the temporality problem for lost rate math. Counts and durations should stay Sums and Histograms."
            },
            {
              "key": "deltatocumulative",
              "label": "Add the <code>deltatocumulative</code> processor to the Collector's metrics pipeline",
              "why": "It adds each delta onto a running total and exports a cumulative series. It keeps each series' running total in the memory of one Collector, so that instance has to see every point of the series. It ships in Collector contrib."
            },
            {
              "key": "suffix",
              "label": "Rename them with a <code>_total</code> suffix, to make the backend treat them as counters",
              "why": "A name is only a name. The points are still the change since the last report."
            },
            {
              "key": "nothing",
              "label": "Nothing: the backend adds the deltas up as they arrive",
              "why": "A Prometheus-style backend stores the samples it is sent and, by default, does not accumulate deltas, so something upstream has to."
            },
            {
              "key": "accumulate",
              "label": "Let the Collector accumulate the deltas in memory, and send cumulative series to the backend",
              "why": "That is what the <code>deltatocumulative</code> processor does: it converts metrics from delta to cumulative by accumulating samples in memory, and a Prometheus-style backend can store what the Collector then exports. It keeps each series' running total in the memory of one Collector, so that instance has to see every point of the series."
            },
            {
              "key": "running-total-processor",
              "label": "Insert a processor between the receiver and the exporter, which holds a running total for every series",
              "why": "That is the Collector's <code>deltatocumulative</code> processor: it adds every delta onto the total of its series and exports a cumulative one. It keeps each series' running total in the memory of one Collector, so that instance has to see every point of the series."
            },
            {
              "key": "after-exporter",
              "label": "Add the delta-to-cumulative processor after the exporter, so every series is converted once it has left the Collector",
              "why": "Processors work on data inside the Collector, between the receiver and the exporter. After the exporter, the processor would never see the series, so the conversion has to sit in the metrics pipeline before it."
            },
            {
              "key": "batch-total",
              "label": "Insert a <code>batch</code> processor between the receiver and the exporter, keeping a running total of each batch",
              "why": "The batch processor only places data into batches, to compress it better and use fewer connections. It does not add points together, so every value is still a change."
            },
            {
              "key": "relabel",
              "label": "Relabel the series as cumulative in a transform step, to mark each point as a running total",
              "why": "Relabelling changes a flag, not the values. Each point is still the change since the last report, so no total ever builds up, and a rate computed from them would be wrong."
            },
            {
              "key": "accumulate-gauges",
              "label": "Let the Collector accumulate the deltas in memory and send gauges to the backend instead",
              "why": "A gauge has no aggregation semantic, so the totals would lose the rate math that a cumulative Sum keeps. The accumulated series has to stay a Sum."
            },
            {
              "key": "logs-pipeline",
              "label": "Add the delta-to-cumulative processor to the Collector's logs pipeline",
              "why": "The processor converts metrics, so on a logs pipeline it would never see these series. It has to sit on the pipeline that carries the metrics."
            },
            {
              "key": "filter-out",
              "label": "Leave the delta series out with a <code>filter</code> processor and send only the cumulative ones",
              "why": "That loses the emails, the durations and the declines the infra team wants to see. The aim is to get these series into the backend, not to drop them."
            },
            {
              "key": "e-hourly",
              "label": "Let the Collector accumulate the deltas in memory and send them in one batch every hour",
              "why": "Holding the deltas back only delays them. Each one is still the change since the previous report, so nothing adds them up into a total."
            },
            {
              "key": "e-last",
              "label": "Insert a processor between the receiver and the exporter that keeps the last delta per series and exports that",
              "why": "The last delta is only the change since the previous report, not a total. Keeping it per series reports a recent change, and nothing adds the deltas up."
            },
            {
              "key": "e-backend",
              "label": "Export the series through the Collector's metrics pipeline and let the backend keep a running total per series",
              "why": "In this scenario the backend stores only cumulative totals, so the running total has to be built before the series reach it."
            },
            {
              "key": "cumulativetodelta",
              "label": "Add the <code>cumulativetodelta</code> processor to the Collector's metrics pipeline",
              "why": "It converts the other way, from cumulative to delta. These series are already deltas, and the backend needs cumulative ones."
            },
            {
              "key": "traces-pipeline",
              "label": "Add the delta-to-cumulative processor to a traces pipeline that the services share",
              "why": "The processor converts metrics. A traces pipeline carries spans, so it would never see these series, which are on the metrics pipeline."
            },
            {
              "key": "on-agent",
              "label": "Install the delta-to-cumulative processor on the vendor agent, since its metrics pipeline is where the series start",
              "why": "The agent is the vendor's, and its settings are not yours to change this quarter. The processor belongs in the Collector, between the agent and the backend."
            },
            {
              "key": "memory-limiter",
              "label": "Add the <code>memory_limiter</code> processor, so that the Collector can accumulate the deltas safely",
              "why": "The memory limiter only guards the Collector against running out of memory: when a limit is exceeded it refuses data and forces garbage collection. It does not add points together."
            },
            {
              "key": "label-processor",
              "label": "Insert a processor between the receiver and the exporter that adds a cumulative label to every series",
              "why": "A label is only a name for a value. Each point is still the change since the last report, so nothing has added the deltas into a total."
            }
          ]
        }
      },
      {
        "intro": "Orders runs on a node that restarts at 14:02. Until then, its cumulative <code>orders_placed_total</code> read 8,400. The first point after the restart reads 35.",
        "question": "What does a backend make of 8,400 followed by 35?",
        "choice": {
          "id": "temp-restart",
          "choices": [
            {
              "key": "negative",
              "label": "A drop of 8,365 orders, as that many orders were lost in the restart",
              "why": "A monotonic sum never goes down, so a drop is a restart, not lost orders. A backend that read it as negative would get the rate wrong."
            },
            {
              "key": "reset",
              "label": "A reset: the cumulative sum started over from zero, and the new start time marks it",
              "why": "A cumulative sum lives in the process, so after a restart it begins again from zero, with a new start time. A backend that reads start times treats that as a reset and counts the rate from zero, not as a drop."
            },
            {
              "key": "survives",
              "label": "Nothing: a cumulative counter survives a restart and keeps counting from 8,400",
              "why": "The running total lives in the process's memory, so a restart ends it. The new process starts again from zero."
            }
          ]
        }
      },
      {
        "intro": "Dash0 is where Kettle & Co looks at metrics day to day, and notifications sends delta counters such as <code>emails_sent_total</code>.",
        "question": "Do you have to convert them to cumulative before Dash0 can use them?",
        "choice": {
          "id": "temp-dash0",
          "choices": [
            {
              "key": "convert-all",
              "label": "Yes: every backend needs cumulative sums",
              "why": "That is the Prometheus-style rule, not a universal one. OTLP supports both temporalities, and Dash0 can query both."
            },
            {
              "key": "both",
              "label": "No: Dash0 can query both temporalities, and you query with PromQL",
              "why": "Dash0 can query delta and cumulative series, and you query metrics with [[PromQL]]. The conversion matters for Prometheus-style backends. On a cumulative counter, use <code>rate()</code> or <code>increase()</code> in PromQL. The Dash0 docs name one catch, a delta histogram: you cannot query it through <code>_bucket</code>, <code>_sum</code> and <code>_count</code>, you query it as a native histogram."
            },
            {
              "key": "processor",
              "label": "Yes: put the <code>deltatocumulative</code> processor in front of Dash0 in the Collector",
              "why": "Dash0 can query both, so you would add a stateful component that keeps every series in memory for no gain. Add it where a backend needs it."
            },
            {
              "key": "send-as-is",
              "label": "Send the delta counters as they are, and use <code>rate()</code> or <code>increase()</code> in PromQL on the cumulative ones",
              "why": "Dash0 can query both temporalities, so nothing has to be converted for it. A raw cumulative counter only goes up, so in PromQL mode you apply <code>rate()</code> or <code>increase()</code> yourself."
            },
            {
              "key": "histogram-catch",
              "label": "A delta histogram calls for care, because Dash0 expects it to be queried as a native histogram",
              "why": "Dash0 can query both temporalities. The Dash0 docs name one catch: a delta histogram cannot be queried through <code>_bucket</code>, <code>_sum</code> and <code>_count</code>, so you query it as a native histogram."
            },
            {
              "key": "not-every",
              "label": "Not every backend needs it: Dash0 can query delta and cumulative series alike",
              "why": "Prometheus-style backends store cumulative totals, so they need the conversion. OTLP supports both temporalities, and Dash0 can query both, so its delta and cumulative series need nothing done first."
            },
            {
              "key": "every-delta",
              "label": "Every delta series has to be converted, since PromQL reads cumulative counters only",
              "why": "PromQL reads whatever series a backend stores, and Dash0 can query both temporalities. What changes by temporality is how you query: you apply <code>rate()</code> or <code>increase()</code> to a cumulative counter."
            },
            {
              "key": "histograms-only",
              "label": "Only the delta histograms: Dash0 queries delta counters but refuses delta histograms",
              "why": "Dash0 can query both temporalities: a delta histogram is queried as a native histogram, which is a different way to query it, not a refusal."
            },
            {
              "key": "cumulativetodelta",
              "label": "Add the <code>cumulativetodelta</code> processor to the Collector in front of Dash0, which wants cumulative rather than delta data",
              "why": "Dash0 can query both temporalities, so no conversion is needed, and that processor converts the other way, from cumulative to delta."
            },
            {
              "key": "own-language",
              "label": "No: Dash0 can query both temporalities, though PromQL is not the language you use for it",
              "why": "Dash0 can query both temporalities, and you query metrics there with [[PromQL]], the same language as for Prometheus-style backends."
            },
            {
              "key": "no-start-time",
              "label": "A delta point has no start time, so Dash0 cannot place it on a chart",
              "why": "Dash0 can query both temporalities. A delta point covers a window of time with a start and an end, so it can be placed on a chart like any other."
            },
            {
              "key": "auto-increase",
              "label": "Dash0 wraps every cumulative counter in <code>increase()</code> for you, in PromQL mode too",
              "why": "Dash0 can query both temporalities, and it applies <code>increase()</code> by itself only in the visual query tabs and data previews. In PromQL mode you apply <code>rate()</code> or <code>increase()</code> to a cumulative counter explicitly."
            },
            {
              "key": "rate-delta-only",
              "label": "No: Dash0 can query both temporalities, but <code>rate()</code> and <code>increase()</code> work only on delta series",
              "why": "Dash0 can query both temporalities. A raw cumulative counter only goes up, which is why you apply <code>rate()</code> or <code>increase()</code> to it in PromQL mode."
            }
          ]
        }
      }
    ]
  }
};
