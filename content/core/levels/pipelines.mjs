// Text of levels/pipelines.mjs (docs/CONTENT.md).
export default {
  "id": "pipelines",
  "name": "Pipelines",
  "sub": "Wired or not",
  "rewardTitle": "Pipeline plumber",
  "play": {
    "finish": "You know a component does nothing until it is enabled: listed in a pipeline, or under service.extensions. A defined memory_limiter that no pipeline lists protects nothing.",
    "steps": [
      {
        "intro": "Every service at Kettle &amp; Co sends its telemetry to one [[Collector]]. A Collector config has five kinds of component: <b>receivers</b> take data in, <b>processors</b> change it, <b>exporters</b> send it out, <b>connectors</b> join two pipelines, and <b>extensions</b> add abilities beside the data path, such as a health check. The team wants a metric that counts particular [[span events]] in its traces.",
        "question": "Which component turns the end of the traces pipeline into the start of a metrics pipeline?",
        "choice": {
          "id": "pipe-connector",
          "choices": [
            {
              "key": "processor",
              "label": "A processor, listed in the traces pipeline, that converts its spans for the metrics pipeline and sends them on",
              "why": "A processor changes or filters data inside one pipeline. It cannot hand traces to a different pipeline as metrics."
            },
            {
              "key": "connector",
              "label": "A connector such as <code>count</code>, exporter in the traces pipeline, receiver in the metrics pipeline",
              "why": "A connector is both an exporter and a receiver: it consumes data at the end of one pipeline and emits data at the start of another, of the same signal or a different one. It has to be used in both roles. Defining it under <code>connectors</code> only configures it."
            },
            {
              "key": "extension",
              "label": "An extension, enabled through <code>service.extensions</code>, that links the traces pipeline to the metrics pipeline in the config",
              "why": "Extensions add abilities that are not part of the data path, such as a health check. They do not take part in a pipeline at all."
            },
            {
              "key": "connector-both",
              "label": "Something both the traces pipeline and the metrics pipeline name, sending telemetry out of one and in at the other",
              "why": "A connector acts as an exporter at the end of one pipeline and as a receiver at the start of another, so both pipelines have to name it. Named in only one of them, it has nothing on its other side."
            },
            {
              "key": "joins-two",
              "label": "A component that joins the traces pipeline to the metrics pipeline, taking data in from one and emitting it into the other",
              "why": "Connecting two pipelines is what a connector is for. It may consume and emit data of the same type or of different types, and it may summarise what it consumes, as the count connector does."
            },
            {
              "key": "define-only",
              "label": "A connector defined under <code>connectors</code>, with no traces pipeline or metrics pipeline using it, so it is only configured",
              "why": "Configuring a connector does not enable it. A connector takes part only when pipelines name it, as an exporter in one and as a receiver in the other."
            },
            {
              "key": "forward",
              "label": "The forward connector between the traces pipeline and the metrics pipeline, which passes spans on unchanged",
              "why": "The forward connector merges or forks pipelines of the same type, so spans leave it as spans. It cannot change one signal into another."
            },
            {
              "key": "pipeline-as-receiver",
              "label": "Naming the traces pipeline as a receiver of the metrics pipeline, making the data become the input",
              "why": "A pipeline lists receivers, processors and exporters, never another pipeline. Joining two pipelines takes a connector."
            },
            {
              "key": "prometheus-exporter",
              "label": "The prometheus exporter at the end of the traces pipeline, which feeds the metrics pipeline with a fresh stream",
              "why": "An exporter sends data out of the Collector to a destination. It does not hand data to another pipeline inside the same Collector."
            },
            {
              "key": "named-pipeline",
              "label": "A pipeline named <code>traces/metrics</code>, which the Collector reads as one pipeline for both signals",
              "why": "The part after the slash is only a name, there to tell two pipelines of one type apart, as in <code>traces/2</code>. The type of a pipeline is the part before it."
            },
            {
              "key": "same-receiver",
              "label": "The same otlp receiver in both the traces pipeline and the metrics pipeline, turning each span into a metric as it arrives",
              "why": "A receiver may be listed in more than one pipeline, and then it only delivers what it receives into each of them. Every pipeline has a single data type, and listing a receiver twice does not convert spans into metrics."
            }
          ]
        }
      },
      {
        "intro": "The Collector ran out of memory on Friday and was killed. The platform team added a <code>memory_limiter</code> [[processor]], but the Collector is still unprotected, and today it will not start.",
        "question": "Fix the config so the Collector starts, <code>memory_limiter</code> runs in both the traces and the metrics pipeline, and the <code>health_check</code> extension stays enabled.",
        "configure": {
          "id": "pipe-config",
          "hint": "A component works only when it is both defined in its own section and enabled by a list under <code>service</code>. Compare the two both ways: a name listed but not defined stops the Collector, and a component defined but listed nowhere does nothing. Fix by adding what is missing, not by deleting a name.",
          "explain": "<p>A component takes effect only when it is both defined in its section and enabled. <code>health_check</code> was listed but not defined, so the Collector refuses to start. <code>memory_limiter</code> was defined but not listed, so it does nothing: both [[pipelines]] ran without it.</p><p>Receivers, processors and exporters are enabled by listing them in a pipeline, extensions under <code>service.extensions</code>. Deleting <code>memory_limiter</code>, listing it in only one pipeline, or giving it another name would all leave a pipeline unprotected, so it must be listed in both. Each pipeline gets its own instance of a processor listed in several.</p><p>The order of each list is the next level's question, and this game checks the wiring, not the settings.</p><p>In Collector v0.164.0 the OTLP gRPC exporter is <code>otlp_grpc</code> and the OTLP HTTP exporter is <code>otlp_http</code>; <code>otlp</code> and <code>otlphttp</code> are deprecated aliases that still resolve, and every config in this act uses the new names.</p>"
        }
      },
      {
        "intro": "The Collector runs now. A second one, in the EU [[cluster]], has a <code>health_check</code> extension defined under <code>extensions</code>, so [[Kubernetes]] can probe it. The probe never gets an answer.",
        "question": "What is missing?",
        "choice": {
          "id": "pipe-extension",
          "choices": [
            {
              "key": "in-pipeline",
              "label": "The extension is missing from a pipeline under <code>service.pipelines</code>, among the other components",
              "why": "Extensions are not part of a pipeline: they sit beside the data path. A pipeline lists receivers, processors and exporters (and connectors), not extensions."
            },
            {
              "key": "service-extensions",
              "label": "It is defined in <code>extensions</code>, yet <code>service.extensions</code> skips it, so nothing answers the probe",
              "why": "Configuring an [[extension]] does not enable it. Extensions are enabled by listing them under <code>service.extensions</code>, not in a pipeline. Defined but not listed, <code>health_check</code> is not enabled, so nothing answers."
            },
            {
              "key": "start-order",
              "label": "Extensions start only after the first export, and the service has not finished starting",
              "why": "An extension that is listed under <code>service.extensions</code> starts with the Collector. Nothing about the order of components keeps it from answering."
            },
            {
              "key": "service-line",
              "label": "An <code>extensions: [health_check]</code> line under <code>service</code>, alongside the <code>pipelines</code> section",
              "why": "Extensions are enabled in the <code>extensions</code> list of the <code>service</code> section. A component that is configured but not named there is not enabled."
            },
            {
              "key": "own-list",
              "label": "Its own entry in the service section, where extensions have their own list, apart from pipelines",
              "why": "Receivers, processors and exporters are enabled by the pipelines that list them. An extension has no pipeline, so it is enabled by the <code>service.extensions</code> list."
            },
            {
              "key": "http-receiver",
              "label": "An <code>http</code> receiver in a pipeline, which the extension needs in order to answer the probe",
              "why": "The health check extension publishes an HTTP URL of its own that can be probed. No receiver or pipeline takes part in answering it."
            },
            {
              "key": "health-pipeline",
              "label": "A pipeline dedicated to the extension under <code>service.pipelines</code>, named <code>health_check</code>",
              "why": "Pipelines are of the types traces, metrics and logs, and a health check is an extension, which has no pipeline."
            },
            {
              "key": "health-exporter",
              "label": "An exporter block for the extension, listed in every pipeline of the service, so the probe can read what is sent out",
              "why": "An exporter sends telemetry out of the Collector. A health check reports whether the Collector is running, and it is an extension, not an exporter."
            },
            {
              "key": "needs-receivers",
              "label": "A <code>receivers: []</code> entry under the extension, in the service config, to say which data it watches",
              "why": "Extensions do not need direct access to telemetry data, so they have no receivers list. They are enabled in the <code>service</code> section."
            },
            {
              "key": "otlp-port",
              "label": "The probe should use port 4317, because the OTLP endpoint of the service is shared with the extension",
              "why": "The health check extension publishes its own HTTP URL, at <code>localhost:13133</code> by default. It is not part of the OTLP receiver."
            },
            {
              "key": "telemetry-section",
              "label": "A setting in <code>service.telemetry</code>, where the extension's own status is set up",
              "why": "The telemetry section configures the logs and metrics of the Collector itself. Extensions are enabled in the <code>extensions</code> list of <code>service</code>."
            }
          ]
        }
      }
    ]
  }
};
