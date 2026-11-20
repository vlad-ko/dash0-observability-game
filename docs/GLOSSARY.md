# Glossary

This file is generated from the files in `content/core/glossary/` by `node tools/build-glossary-doc.mjs`. Do not edit it by hand: edit a file there, then run the tool. `test/glossary.test.mjs` fails when this file differs from the tool's output.

Terms the game teaches, grouped by topic. Each entry is one or two lines. "(Act N)" is where it is taught; a term with no act belongs to the game itself.

## Foundations

- **Hint**: Help a board gives for a cost. Each hint counts as one penalty, and the Hint button shows what the next one costs.
- **50/50**: On a multiple-choice question with four or more answers, removes two wrong answers. It counts as one hint, so it costs one penalty.
- **Guide**: The on-call mentor you can ask a question on some steps. It never gives the answer away. Each answer you get counts as one hint; a reply it holds back, or an error, is free.
- **Clue**: An evidence view on an incident board that helps explain the alert. Finding enough of them unlocks the causes.
- **Misleading view**: An evidence view that does not explain the alert (a red herring). Opening one counts as one penalty.
- **MTTD**: Mean time to detect an incident.
- **MTTR**: Mean time to resolve an incident.
- **Par time**: The time a level sets as its target. Finishing slower costs one penalty.
- **Act primer**: A short reading you can open before an act: an overview, then a few chapters, each with links to the pages it came from.
- **Dash0 team only**: The mark on an act primer link that only Dash0 staff can open (a Claap recording). The link is still shown, so outside players know it exists and that it is not for them.
- **Chapter**: One short section of an act primer. The game remembers which chapters you have read.
- **Save code**: A short text code for your progress. Copy it from the hub and paste it into the game in another browser to import it; the import merges, so nothing you already have is lowered.
- **Observability**: Being able to answer new questions about a system's behaviour from its outputs, without shipping new code. (Act 0)
- **Monitoring**: Watching known indicators for known failure modes. (Act 0)
- **Telemetry**: The data a system emits about itself. (Act 0)
- **Signal**: A kind of telemetry. OpenTelemetry defines traces, metrics, logs and (newer) profiles. (Act 0)
- **Profile**: A recording of resource use at the code level. The newest, still emerging signal. (Act 0)
- **Backend**: The tool that stores and shows telemetry. (Act 0)
- **Cardinality**: The number of unique values (or label combinations) a field has; for metrics, the number of time series. (Act 3)

## OpenTelemetry

- **OpenTelemetry (OTel)**: A CNCF project defining vendor-neutral APIs, SDKs, a wire protocol and a Collector for telemetry. (Act 0)
- **API**: The interfaces libraries call to emit telemetry; a no-op without an SDK. (Act 0)
- **SDK**: The implementation an application installs to process and export telemetry. (Act 1)
- **Resource**: The entity producing telemetry, described by resource attributes. (Act 1)
- **Resource detector**: An SDK component that fills in resource attributes from the environment (host, container, cloud, Kubernetes). (Act 1)
- **Attribute**: A key/value pair on a span, metric point, log record or resource. (Act 1)
- **service.name**: The attribute that holds the logical name of your service. (Act 1)
- **Kubernetes**: A system that runs and manages containers. (Act 1)
- **Pod**: One or more containers that Kubernetes runs together; the smallest unit it runs. (Act 1)
- **Namespace**: A way to group resources inside one Kubernetes cluster. (Act 1)
- **Deployment**: A Kubernetes object that keeps a set of pods running. (Act 1)
- **Cluster**: The group of machines that Kubernetes manages together. (Act 1)
- **Instrumentation**: Code that emits telemetry. Zero-code instrumentation is injected by instrumentation agents or an operator; manual instrumentation is written by you. (Act 2)
- **Instrumentation agent**: A library attached to the application at startup that adds instrumentation without code changes, such as the OpenTelemetry Java agent. Not a Collector agent. (Act 2)
- **Instrumentation scope**: The library or module that produced a piece of telemetry. (Act 4)
- **OTLP**: The OpenTelemetry Protocol; gRPC (port 4317) or HTTP/protobuf (port 4318). (Act 5)
- **gRPC**: A binary remote-call protocol over HTTP/2. One of the transports OTLP supports, on port 4317. (Act 5)
- **HTTP/protobuf**: OTLP sent over HTTP with the data encoded as protobuf (Protocol Buffers, a binary encoding), on port 4318. (Act 5)
- **HTTP/JSON**: OTLP sent over HTTP with the data encoded as JSON. (Act 5)
- **Endpoint**: The address and port an exporter sends telemetry to. (Act 5)
- **Exporter**: A component that sends telemetry onward (in the SDK or the Collector). (Act 5)
- **Processor**: A component that transforms telemetry (in the SDK or the Collector). (Act 5)
- **Receiver**: A component that accepts telemetry (in the SDK or the Collector). (Act 5)
- **Semantic conventions**: Standard attribute names and meanings, such as http.request.method, db.system.name and service.name. They are versioned. (Act 8)
- **Stability opt-in**: The setting OTEL_SEMCONV_STABILITY_OPT_IN. The value http/dup sends the old and the stable names; http sends only the stable names. (Act 8)
- **Stable**: Released with no breaking changes. (Act 8)
- **Opt-in**: A setting you turn on to get the new names. (Act 8)

## Traces

- **Trace**: All spans sharing one trace ID; one request's path through the system. (Act 2)
- **Span**: One timed operation with a name, kind, start and end, attributes, status, events and links. (Act 2)
- **Trace ID**: The ID that every span in one request shares. (Act 2)
- **Span ID**: The ID of one span. A child span records its parent's span ID. (Act 2)
- **Root span**: A span with no parent. (Act 2)
- **Span kind**: SERVER, CLIENT, PRODUCER, CONSUMER or INTERNAL. (Act 2)
- **Span status**: Unset, Error or Ok. (Act 2)
- **Span event**: A timestamped note inside a span, for example an exception. (Act 2)
- **Span link**: A reference to another span that is related but not a parent, used for batches and fan-in. (Act 2)
- **Context**: The active trace/span (and baggage) carried through a process. (Act 2)
- **Span context**: The part of a span that travels with the context: its trace ID, its span ID, trace flags and trace state. (Act 2)
- **Trace flags**: A span context field whose flags say whether the trace is sampled. (Act 2)
- **Trace state**: A span context field that holds vendor-specific data. (Act 2)
- **Context propagation**: Passing context between processes, usually via the W3C traceparent and tracestate headers. (Act 2)
- **Propagator**: The code that writes and reads trace headers between services. (Act 2)
- **W3C Trace Context**: The standard headers (traceparent and tracestate) for context propagation. (Act 2)
- **Synchronous**: A call that waits for its reply before going on. (Act 2)
- **Asynchronous**: A call that does not wait for its reply; the next operation runs later. (Act 2)
- **Symptom hunt**: A level shape where an alert and a view show the symptom and the player opens the spans to find its cause (level 2.2, the pilot, #364). (Act 2)
- **Flag**: In a symptom hunt, naming a span as the cause. A miss rules that span out and costs one penalty. Once the culprit is found, it reads Flagged and the other spans read Hunt over. (Act 2)
- **Baggage**: User-defined key/values propagated with the context. (Act 2)
- **Sampling**: Keeping a subset of traces. Head sampling decides at the start; tail sampling decides after the trace completes. (Act 6)
- **Representativeness**: The idea that a small sample can stand for the whole. (Act 6)
- **Orphan span**: A span whose parent ID names a span that was never received, so the trace shows it as a root although it has a parent. (Act 9)
- **Mesh sidecar**: A proxy that a service mesh runs next to each service and that forwards its calls; not the same thing as a Collector run as a sidecar (see Agent). (Act 9)

## Metrics

- **Instrument**: Counter, UpDownCounter, Gauge, Histogram (sync) and their observable (async) forms. (Act 3)
- **Data point**: One reported value of a metric for one attribute combination over one time window: the sum of its measurements, or for a gauge the last one. (Act 3)
- **Metric**: A named set of streams of data points, one per attribute combination, that describes how something changes over time, such as request count or memory in use. (Act 3)
- **Bucket**: A range of values in a histogram, with a count of the observations that fell inside it; upper bounds are inclusive and lower bounds exclusive. (Act 3)
- **Sum**: The OpenTelemetry metric type that adds up measurements. It is either monotonic or not, and either cumulative or delta. (Act 3)
- **System resource**: A physical part of a server that does work: CPU, memory, network or disk. Not the OpenTelemetry Resource. (Act 3)
- **Time series**: The stream of points for one metric and attribute combination. (Act 3)
- **Temporality**: Cumulative (total since start) or delta (change since last report). (Act 3)
- **Histogram**: Counts of values in buckets; exponential histograms pick buckets automatically. (Act 3)
- **Quantile / percentile**: A value picked by rank from sorted observations, named by a number between 0 and 1; the 0.95-quantile is the 95th percentile. (Act 3)
- **Monotonic**: A sum that only goes up, as a Counter produces; an UpDownCounter gives a non-monotonic sum. (Act 3)
- **Exemplar**: A sample point on a metric linked to a trace/span ID. (Act 3)
- **Metric event**: One measurement recorded for a metric. (Act 3)
- **View**: SDK configuration that renames, filters or re-buckets a metric. (Act 3)
- **Aggregation**: Combining many measurements into statistics over a time window. (Act 3)
- **Time window**: A fixed stretch of time that a statistic covers. (Act 3)
- **Summary**: A Prometheus (legacy) metric type that works out its quantiles inside the app. (Act 3)
- **Overflow data point**: The data point that absorbs new attribute combinations after a cardinality limit is reached. (Act 3)
- **Metric data model**: The OpenTelemetry shapes for metric data: Sum, Gauge, Histogram, Exponential Histogram and Summary. (Act 3)
- **PromQL**: The Prometheus query language. (Act 3)
- **Prometheus**: The open-source metrics system whose query language is PromQL. (Act 3)
- **rate()**: A PromQL function: the average increase per second of a time series. (Act 3)
- **increase()**: A PromQL function: the total increase of a time series over a time range. (Act 3)
- **histogram_quantile()**: A PromQL function that works out a quantile from a histogram. (Act 3)
- **Label**: Prometheus's word for an attribute. (Act 3)
- **Label set**: One combination of label values. (Act 3)
- **le**: The label that holds the upper bound of a histogram bucket. (Act 3)
- **Scrape target**: The endpoint Prometheus reads metrics from. (Act 3)
- **RED**: Rate, Errors, Duration, for request-driven services. (Act 3)
- **USE**: Utilisation, Saturation, Errors, checked for every system resource, such as CPU, memory, network or disk. (Act 3)
- **Utilisation**: How busy a system resource was: the average time it spent servicing work. (Act 3)
- **Saturation**: How much work a system resource could not serve, so it had to wait. (Act 3)
- **Span metrics**: RED metrics derived from spans (the span_metrics connector; spanmetrics is its deprecated alias). (Act 3)

## Logs

- **Log record**: Timestamp, severity, body, attributes, and optional trace/span IDs. (Act 4)
- **Severity number / text**: OpenTelemetry's 1 to 24 severity scale and its label. (Act 4)
- **Log body**: The main content of a log record, such as its message. (Act 4)
- **ObservedTimestamp**: When the system observed the log record. (Act 4)
- **EventName**: A name that says what kind of event a log record describes. (Act 4)
- **Structured logging**: Logs as key/value data instead of free text. (Act 4)
- **Logs Bridge API**: The API logging-library appenders use to emit OpenTelemetry logs. (Act 4)
- **Logging bridge**: The piece that connects an existing logging framework to OpenTelemetry. (Act 4)
- **Correlation**: Linking logs, metrics and traces through shared IDs and resources. (Act 4)

## Collector

- **Collector**: A standalone service that receives, processes and exports telemetry. (Act 5)
- **Component id**: The type, then an optional slash and name (type/name). (Act 5)
- **Pipeline**: Receivers, then processors, then exporters, per signal, declared under service.pipelines. (Act 5)
- **service section**: The top-level key in a Collector config that lists the pipelines. (Act 5)
- **Connector**: A component that is an exporter in one pipeline and a receiver in another (for example span_metrics, whose deprecated alias is spanmetrics). (Act 5)
- **Extension**: A non-pipeline capability (health check, auth, storage). (Act 5)
- **Agent**: A Collector run alongside the application or on the same host, for example as a sidecar or DaemonSet. (Act 5)
- **Gateway**: A central tier of Collectors that receives telemetry from the rest. (Act 5)
- **OTTL**: The OpenTelemetry Transformation Language, used in transform and filter processors. (Act 5)
- **Distribution**: A packaged Collector build (core, contrib, vendor, or custom via the OpenTelemetry Collector Builder, OCB). (Act 5)
- **OpAMP**: A protocol for remotely managing agents and Collectors. (Act 5)

## Reliability

- **SLI**: A measured indicator of service quality (for example, the share of requests under 300 ms). (Act 7)
- **SLO**: A target for an SLI over a window (99.9% over a rolling 28-day window). (Act 7)
- **Error budget**: The allowed failure under an SLO (0.1%). In the game's incident boards, the minutes of investigation you can spend before the budget runs out. (Act 7)
- **Burn rate**: How fast the error budget is being used relative to plan. (Act 7)
- **Synthetic check**: A scripted probe from outside the system. (Act 7)
- **Private location**: A place inside your own network where synthetic checks run. (Act 7)
- **Alert fatigue**: Ignoring alerts because too many are noise. (Act 7)
- **Alerting rule**: A Prometheus rule that raises an alert when a PromQL expression is true. (Act 7)
- **Labels clause**: The part of an alerting rule that adds extra labels (Prometheus's word for an attribute) to the alert. (Act 7)
- **Annotations clause**: The part of an alerting rule that adds longer annotations (notes) to the alert, such as descriptions or runbook links. (Act 7)
- **Runbook**: The team's written steps for handling an alert. (Act 7)
- **Alertmanager**: The Prometheus component that groups, silences and routes alerts. (Act 7)
- **Silencing**: Muting the notifications for matching alerts for a set time. (Act 7)
- **Alert dependencies**: Rules that hold back one alert's notifications while a related alert is already firing. (Act 7)

## Dash0

- **Dash0**: An OpenTelemetry-native observability platform for traces, metrics, logs and more. (Act 0)
- **Trace View**: The Dash0 view of one trace with all its spans and their relationships. (Act 0)
- **Dash0 operator**: A Kubernetes operator that auto-instruments workloads and ships telemetry to Dash0. (Act 1)
- **Triage**: Comparing attribute distributions between a selection and a baseline to find what is different. (Act 2)
- **Metric Explorer**: The Dash0 place to browse, filter and investigate metrics; the start of deeper analysis in the Query Builder. (Act 3)
- **Query Builder**: Dash0's editor for building metric queries. (Act 3)
- **Related Logs**: The Dash0 tab that shows logs from the same resource and the same trace around a selected log. (Act 4)
- **Log AI**: Pattern and severity extraction for unstructured logs. (Act 4)
- **Spam filter**: A rule that drops unwanted telemetry at ingest. (Act 6)
- **Check rule**: A Dash0 rule that evaluates a PromQL expression against your telemetry and triggers an alert when values cross a threshold. (Act 7)
- **Notification channel**: Where Dash0 delivers alerts from check rules and synthetic checks, such as Slack, PagerDuty or email. (Act 7)
- **Perses**: The open dashboard format that Dash0 dashboards follow; they can be managed as code. (Act 8)
- **Infrastructure as code**: Managing setup, such as dashboards, as code files in version control. (Act 8)
- **Panel**: One chart on a dashboard. (Act 8)
- **Dashboard variable**: A value that every panel on a dashboard can reuse. (Act 8)
- **Migrator**: The Dash0 tool that converts Grafana dashboards. (Act 8)
- **Websites Explorer**: The Dash0 view of your frontend health: traffic, sessions and the events in each session. (Act 8)
- **Web Vitals**: Performance metrics defined by Google for what real users experience on a web page: LCP, INP and CLS. (Act 8)
- **MCP**: Model Context Protocol: a standard for AI tools to call data sources. (Act 8)
- **MCP Server**: Dash0's MCP Server lets AI assistants read Dash0 data: AI access to your telemetry. (Act 8)
- **MCP tool**: One named action an AI assistant can take through an MCP server. (Act 8)
- **runTask**: The MCP tool that hands an open-ended question to Agent0. (Act 8)
- **Agent0**: Dash0's AI agent, which takes an open-ended question about your telemetry. (Act 8)
- **Agent0 thread**: One conversation with Agent0. (Act 8)
- **Sandbox**: An isolated environment where code runs with limited access. (Act 8)
- **DART**: Dashboards, Alerts & Rules to Terraform; migrates assets from other vendors into Dash0. (Act 8)
- **Trace Explorer**: The Dash0 page for finding traces: you filter the spans by attribute, then open a trace. (Act 9)
- **Span Sidebar**: The Dash0 detail panel that opens when you select a span. (Act 9)
- **Log Explorer**: Dash0's page for finding logs. (Act 9)
- **Auth token**: The key a user or a service presents to Dash0's APIs, for example to send telemetry to Dash0. (Act 9)
- **Dataset**: A part of one organisation in Dash0 that keeps its own observability data apart, for example one for production and one for test. (Act 9)
- **Pinned filters**: Filters that stay on screen across pages that have a filter bar. (Act 9)
- **Filter bar**: The bar on a Dash0 page that holds its filters. (Act 9)
- **Filter operator**: The comparison in a filter that relates a key to its values, for example equals. (Act 9)
- **Attribute filter**: A filter on one attribute: a key, an operator and one or more values. (Act 9)
- **Simulated Dash0**: The game's practice mode, with a simulated Dash0 instead of an account. (Act 9)

Dash0 product names and descriptions to be checked with the product team before release.
