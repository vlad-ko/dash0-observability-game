// Text of levels/red-and-use.mjs (docs/CONTENT.md).
export default {
  "id": "red-and-use",
  "name": "RED and USE",
  "sub": "Two checklists",
  "rewardTitle": "Golden-signals reader",
  "play": {
    "finish": "You can read a service with RED and a resource with USE, you know saturation is not utilisation, you can get RED from spans with the span_metrics connector, and Dash0 derives it from your spans.",
    "steps": [
      {
        "intro": "Kettle & Co's on-call wants two short checklists: one for the services, one for the machines under them. Tom Wilkie's <b>RED</b> method reads the requests a service handles. Brendan Gregg's <b>USE</b> method reads a [[resource|system-resource]].",
        "question": "Which pairing is right?",
        "choice": {
          "id": "ru-methods",
          "choices": [
            {
              "key": "red-services-use-resources",
              "label": "RED for each service: Rate, Errors, Duration. USE for each resource, such as a CPU or a disk: Utilisation, Saturation, Errors",
              "why": "[[RED]] asks how many requests a service gets, how many of them fail and how long they take. [[USE]] asks, of a resource, how busy it is, how much work waits for it and how many errors it throws. RED was made for request-driven services, and USE for resources such as CPUs, disks and network interfaces."
            },
            {
              "key": "swapped",
              "label": "USE for each service: Utilisation, Saturation, Errors. RED for each resource, such as a CPU or a disk: Rate, Errors, Duration",
              "why": "Swapped. A CPU or a disk has no request to count the rate or duration of, and a service is not \"busy\" the way a resource is. RED reads requests, USE reads resources."
            },
            {
              "key": "red-everything",
              "label": "RED for everything: Rate, Errors, Duration fit a service, a CPU or a disk alike, as every component takes requests",
              "why": "RED came out of microservices, because the USE method does not fit a service. The reverse holds too: a CPU, disk or interface is checked by how busy it is and how much work queues for it, which RED does not ask."
            },
            {
              "key": "red-requests-use-machines",
              "label": "RED on the requests of every service, taken from its traces or metrics, USE on the CPU, memory and network interfaces under it",
              "why": "[[RED]] reads requests: how many a service gets, how many fail and how long they take. [[USE]] reads a [[resource|system-resource]]: how busy it is, how much work waits for it and how many errors it throws. RED can be worked out from spans or from metrics, and Brendan Gregg's list of resources starts with CPUs, memory and network interfaces."
            },
            {
              "key": "red-count-use-busy",
              "label": "RED covers the errors, rate and duration of a service while USE covers how busy, queued and faulty a resource is",
              "why": "RED is the method for a service: rate, errors and duration of its requests. USE is the method for a resource: utilisation, saturation and errors. Tom Wilkie recommends both together, RED for how happy your users are and USE for how happy your machines are."
            },
            {
              "key": "use-everything",
              "label": "USE for every service and every resource, such as a CPU or a disk: any of them can be busy, queued or failing",
              "why": "USE was written for resources such as CPUs, disks and network interfaces. Brendan Gregg allows only small software parts, such as a lock or a thread pool, and says to leave whole applications to other methods. Tom Wilkie made RED because USE does not really apply to services."
            },
            {
              "key": "same-checklist",
              "label": "RED and USE are one checklist for a service or a resource, with two names: Rate is Utilisation, Duration is Saturation and Errors is Errors",
              "why": "The two ask different questions. RED counts requests, failed requests and the time they take. USE asks how busy a resource is, how much work waits for it and how many errors it throws. Tom Wilkie calls them two different views on the same system."
            },
            {
              "key": "signal-split",
              "label": "RED reads the traces of a service and USE reads its metrics, so the method follows the signal and not the thing being checked",
              "why": "Neither method belongs to a signal. RED can be worked out from spans, as the span metrics connector in this level does, or from metrics, and USE is usually read from metrics. What picks the method is whether you check a service's requests or a resource."
            },
            {
              "key": "user-facing-split",
              "label": "RED for the part customers see, such as the shop front end. USE for the part they never see, such as a disk or a CPU",
              "why": "The split is by what you read, not by who sees it. Tom Wilkie models RED for every single service in an architecture, internal ones too, and USE is for the resources under them."
            },
            {
              "key": "traces-enough",
              "label": "Neither RED nor USE is needed once traces flow, as spans give the rate, errors and duration of every service and resource",
              "why": "Spans describe requests, so they can give RED for a service, as the connector in this level shows. A CPU or a disk takes no requests and writes no spans, so its utilisation, saturation and errors come from resource metrics."
            }
          ]
        }
      },
      {
        "intro": "The machine Redis runs on shows 60% CPU utilisation, as an average over five minutes, and requests to cart wait on it. USE says to check three things for every resource.",
        "question": "Which signal tells you work is waiting for the CPU?",
        "choice": {
          "id": "ru-saturation",
          "choices": [
            {
              "key": "utilisation",
              "label": "Utilisation: 60% busy on average means the CPU has room, so something else is slow",
              "why": "A long average hides bursts. Brendan Gregg's own example is a CPU that sat at 100% for seconds at a time inside a five-minute average that never passed 80%, with latency from CPU saturation all the same."
            },
            {
              "key": "saturation",
              "label": "Saturation: the run queue, the work that wants a CPU and cannot have one yet",
              "why": "Saturation is the degree to which a resource has more work than it can service, often as a queue, and for a CPU it is the run-queue length or the scheduler latency. It can be present while the average [[utilisation]] looks low, because the average smooths out the bursts."
            },
            {
              "key": "errors",
              "label": "Errors: the count of error events on that machine, such as failed disk writes",
              "why": "Errors matter, since a failed and retried operation can slow things down without being noticed. But nothing failed here: the requests wait, and waiting is what saturation measures."
            },
            {
              "key": "scheduler-latency",
              "label": "Scheduler latency: how long runnable work waits before it gets onto any CPU",
              "why": "Brendan Gregg names scheduler latency as a saturation metric of a CPU: the time work spends ready and waiting for a core. That is what the requests to cart are doing."
            },
            {
              "key": "queue-length",
              "label": "Queue length: how many tasks sit ready and waiting for a core",
              "why": "Brendan Gregg names the run-queue length as a saturation metric of a CPU, and saturation is often a queue. It can build up in a burst of full utilisation even when the average over a long interval is low."
            },
            {
              "key": "rate",
              "label": "Rate: how fast work arrives at the service on that host, before any queue",
              "why": "Rate is the R of RED, a count of requests. It says how much work arrives, not whether work is queued at the CPU. Saturation is the signal for work that waits."
            },
            {
              "key": "duration",
              "label": "Duration: how long each request takes, which grows when work queues up",
              "why": "Duration shows that requests are slow, not where the time goes: it could be the CPU, a database or the network. The queue at the CPU is what shows that work is waiting for it."
            },
            {
              "key": "longer-window",
              "label": "Hourly CPU figures: a long window shows the bursts that queue work",
              "why": "A longer window smooths bursts out more, not less. Brendan Gregg's CPU sat at 100% for seconds inside a five-minute average that never passed 80%, and an hour would have hidden it better still."
            },
            {
              "key": "idle",
              "label": "Idle time: the share of the day that the CPU did nothing and no queue formed",
              "why": "Idle time is utilisation seen from the other side: it says how busy the CPU was, not whether work waited. A CPU can be idle for most of a window and still queue work in a burst."
            },
            {
              "key": "memory-free",
              "label": "Memory capacity: how much is still free",
              "why": "That is the utilisation of another resource, memory. The question is about the CPU, and work that waits for a CPU shows as a run queue and not as free memory."
            }
          ]
        }
      },
      {
        "intro": "Cart and checkout send traces but no metrics, and the team wants RED for each service now. Spans have what RED needs: each one is a request with a start, an end and a status. The Collector's <code>span_metrics</code> connector (formerly <code>spanmetrics</code>) is in the contrib [[distribution]].",
        "question": "How do you get RED out of the traces?",
        "choice": {
          "id": "ru-connector",
          "choices": [
            {
              "key": "spanmetrics",
              "label": "Add the <code>span_metrics</code> connector: traces pipeline in, metrics pipeline out, as calls and duration",
              "why": "It counts the spans passing through it into <code>traces.span.metrics.calls</code>, by default for each service.name, span.name, span.kind and status.code, so rate is the calls and errors are the calls with an error status. It records span durations into <code>traces.span.metrics.duration</code>, in milliseconds by default. A feature gate, <code>connector.spanmetrics.legacyMetricNames</code>, brings back the legacy names, and the component is now spelled <code>span_metrics</code>, so check what your version emits."
            },
            {
              "key": "processor",
              "label": "Add the <code>spanmetrics</code> processor that the connector replaced to the traces pipeline: the metrics stay with the spans",
              "why": "The connector replaced that processor. A processor stays inside one pipeline, and turning traces into metrics means crossing from a traces pipeline into a metrics one, which is what a connector does."
            },
            {
              "key": "errors-metric",
              "label": "Read the errors from a separate errors metric that the connector emits beside calls and duration",
              "why": "There is no separate errors metric. An error is a call whose status code dimension is an error: <code>status.code</code> with the value <code>STATUS_CODE_ERROR</code>, or <code>otel.status_code</code> with <code>ERROR</code> when a feature gate is on."
            },
            {
              "key": "raw-url",
              "label": "Use the full URL for every span so that the connector makes a metric series for every request path that users visit",
              "why": "Every distinct span name is a new series in each metric, which is the [[cardinality]] of 3.5. HTTP server span names are the method and <code>http.route</code>, and instrumentation must not default to the URI path. The connector README names raw URIs in span names as the usual cause of exploding span metrics, and offers an <code>aggregation_cardinality_limit</code> as a circuit breaker, not a fix."
            },
            {
              "key": "connector-count",
              "label": "Let a connector count and time everything a service does so that counts and timings become metrics you can query",
              "why": "The span metrics connector counts the spans seen for each set of dimensions, which are the calls, and records how long each span took in a duration histogram. Errors are the calls with an error status. It aggregates request, error and duration metrics from span data."
            },
            {
              "key": "contrib-connector-red",
              "label": "Wire the contrib connector in the Collector across two pipelines with traces going in and the rate and errors taken off what it writes",
              "why": "The connector supports a traces pipeline as the exporter side and a metrics pipeline as the receiver side, and the contrib distribution has it. Calls give the rate, the calls with an error status the errors, and the duration histogram the duration."
            },
            {
              "key": "metrics-only",
              "label": "Put the connector in a metrics pipeline of the Collector alone and keep sending the traces of cart and checkout straight to the backend",
              "why": "A connector joins two pipelines: the spans have to enter it as the exporter of a traces pipeline, and the metrics leave it as the receiver of a metrics pipeline. With no traces pipeline feeding it, no span reaches it and nothing is counted."
            },
            {
              "key": "filter-processor",
              "label": "Add a <code>filter</code> for server spans in the traces pipeline, which counts them and their errors in place of a connector",
              "why": "The filter processor drops spans, span events, metrics, data points or logs that meet its conditions. It makes no metrics. Counting spans into calls and a duration histogram is what the span metrics connector does."
            },
            {
              "key": "exemplars-only",
              "label": "Switch on the exemplars option of the connector: each span lands on a metric in your backend as a data point",
              "why": "An exemplar attaches a span to a metric the connector already writes, at most 5 for each data point by default, and it is off by default. It links a point to a trace. The calls and duration metrics are what make RED, and exemplars add neither."
            },
            {
              "key": "host-metrics",
              "label": "Scrape the hosts of cart and checkout with the host metrics receiver: a busy machine means a busy service",
              "why": "Host metrics describe the machine: its utilisation, saturation and errors, the USE view. They do not count a service's requests or time them, and several services can share one host."
            },
            {
              "key": "drop-service-name",
              "label": "Leave <code>service.name</code> out of the dimensions of the connector, so that the calls metric stays small",
              "why": "RED is read for each service, so <code>service.name</code> has to stay a dimension. Without it the calls of every service land in one series and the rate of each service is gone. Keep cardinality in check by bounding the span names, not by removing the dimension the question needs."
            },
            {
              "key": "second-traces-pipeline",
              "label": "Route the output of the connector into a second traces pipeline of the Collector, so the rate and errors sit next to the spans",
              "why": "The span metrics connector takes a traces pipeline in and puts metrics out, so what it writes can only enter a metrics pipeline. Its output is not spans."
            }
          ]
        }
      },
      {
        "intro": "The [[span metrics]] reach your backend under PromQL names, translated as in 3.4: <code>traces.span.metrics.calls</code> is <code>traces_span_metrics_calls_total</code>, and the dimensions <code>service.name</code>, <code>span.name</code> and <code>span.kind</code> are [[labels]]. <b>Rate</b> is requests per second. A service also makes calls of its own, recorded as CLIENT spans, and the requests it serves are its SERVER spans.",
        "question": "Write a query for the request rate of each service, over the last 5 minutes.",
        "query": {
          "id": "ru-rate",
          "hint": "Count only the requests a service serves, not the calls it makes; the intro says which spans those are.",
          "explain": "Checkout serves 12 requests per second and cart 16. Without the span kind, checkout would read 16: its call to the payment provider is a CLIENT span, a request it makes and not one it serves."
        }
      },
      {
        "intro": "<b>Errors</b> are the share of requests that fail. The connector has no errors metric: an error is a call with an error status, and the status is the label <code>status_code</code>, with the value <code>STATUS_CODE_ERROR</code>. A success is <code>STATUS_CODE_UNSET</code>, not OK, because HTTP instrumentation leaves a server span unset unless the request failed with a 5xx.",
        "question": "Write a query for the error ratio of each service, over the last 5 minutes.",
        "query": {
          "id": "ru-errors",
          "hint": "A ratio is the failing requests over all requests, per service; no series has an OK status, so the denominator is not one status.",
          "explain": "Checkout fails 1 request in 12, about 8.3%, and cart 1 in 240, about 0.4%. Divide by all the calls: no series says OK, so a ratio against the OK calls would match nothing."
        }
      },
      {
        "intro": "<b>Duration</b> comes from the <code>duration</code> histogram, which holds the span durations in buckets. Its default unit is milliseconds, so the translated name ends in <code>_milliseconds</code>: <code>traces_span_metrics_duration_milliseconds_bucket</code>. It is a histogram like the ones in 3.3.",
        "question": "Write the p95 duration of each service, over the last 5 minutes.",
        "query": {
          "id": "ru-duration",
          "hint": "The percentile recipe from 3.3, on the duration histogram, for the requests a service serves.",
          "explain": "Checkout is at 1,450 milliseconds and cart at 238: the p95 of 3.3 again, now in milliseconds and built from spans."
        }
      },
      {
        "intro": "Kettle & Co's traces go to Dash0, and the service pages already show rate, errors and duration for every service. Nobody has configured a connector.",
        "question": "Where do those numbers come from?",
        "choice": {
          "id": "ru-dash0",
          "choices": [
            {
              "key": "derived",
              "label": "Dash0 derives RED metrics from the spans it receives, and nobody has to run a connector or emit them",
              "why": "Dash0 generates a metric, <code>dash0.spans.red</code>, from your spans to power its Service Catalog and Service Map. It is not billed as a custom metric. Rate is its count over time, errors are the spans with the status code ERROR, and duration is its bucket distribution. It is grouped by operation name, which turns <code>GET /users/123</code> into <code>GET /users/{id}</code> to keep the cardinality bounded, and you can group, filter and alert on its attributes."
            },
            {
              "key": "connector-needed",
              "label": "They come from a span_metrics connector that Dash0 asks you to run in your Collector",
              "why": "Dash0 does that derivation itself, from the spans it ingests. A connector in your own Collector is how you would get span metrics into a backend that does not."
            },
            {
              "key": "service-metrics",
              "label": "They come from each service's own metrics, and a service with no metrics instrumentation shows nothing",
              "why": "The service views are built from spans. A service that sends traces and no metrics still gets rate, errors and duration."
            },
            {
              "key": "red-histogram",
              "label": "Each service view draws its rate and errors via a histogram that Dash0 builds using the spans it ingests on arrival",
              "why": "<code>dash0.spans.red</code> is an exponential histogram that Dash0 builds from your spans. It captures all three RED signals for each service and operation, and it is the metric behind every request rate, error rate and latency percentile in the service views."
            },
            {
              "key": "count-spans",
              "label": "They come from the traces the backend gets: the rate and errors for each one with no setup and no code changes",
              "why": "Rate is the histogram's count over time, and errors are the spans whose status code is ERROR. Nobody has to emit these metrics or configure a connector, because Dash0 generates them from the spans it receives."
            },
            {
              "key": "log-lines",
              "label": "Dash0 counts the log lines a service writes for each request, and takes the rate, errors and duration with no spans",
              "why": "The service views are built from spans, not logs. A service that sends traces and no logs still gets rate, errors and duration."
            },
            {
              "key": "custom-metrics",
              "label": "They are custom metrics that Dash0 bills for and somebody must have sent the rate and the errors for each team to the service pages",
              "why": "Dash0 generates them itself from spans, for the Service Catalog and the Service Map, and they are not billed as custom metrics. Nobody has to emit them."
            },
            {
              "key": "client-spans",
              "label": "Dash0 derives the rate and errors from CLIENT spans in the traces: what each app sends out to other systems",
              "why": "The operations of a service are what it serves, taken from SERVER and CONSUMER spans and from root spans. CLIENT and PRODUCER spans, the outbound calls, are not treated as operations of the calling service."
            },
            {
              "key": "raw-span-names",
              "label": "Dash0 groups the numbers by the raw span name in each trace and every URL path that a user visits becomes a series",
              "why": "The histogram is grouped by operation name, which turns <code>GET /users/123</code> into <code>GET /users/{id}</code>. That keeps its cardinality bounded and stable over time, which a series for every URL path would not."
            },
            {
              "key": "synthetic-calls",
              "label": "Synthetic checks in Dash0 measure the rate and errors: each endpoint is probed from outside on a schedule",
              "why": "The service views come from the spans of the requests your services handled, which Dash0 turns into a histogram. A scheduled call from outside would measure one probe, not the traffic your users send."
            }
          ]
        }
      }
    ]
  }
};
