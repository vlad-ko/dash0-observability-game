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
              "label": "A processor, listed in the traces pipeline, that converts its spans into metrics",
              "why": "A processor changes or filters data inside one pipeline. It cannot hand traces to a different pipeline as metrics."
            },
            {
              "key": "connector",
              "label": "A connector, such as <code>count</code>: an exporter in the traces pipeline, a receiver in the metrics one",
              "why": "A connector is both an exporter and a receiver: it consumes data at the end of one pipeline and emits data at the start of another, of the same signal or a different one. It has to be used in both roles. Defining it under <code>connectors</code> only configures it."
            },
            {
              "key": "extension",
              "label": "An extension, enabled under <code>service.extensions</code> and wired to the metrics pipeline",
              "why": "Extensions add abilities that are not part of the data path, such as a health check. They do not take part in a pipeline at all."
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
          "explain": "<p>A component takes effect only when it is both defined in its section and enabled. <code>health_check</code> was listed but not defined, so the Collector refuses to start. <code>memory_limiter</code> was defined but not listed, so it does nothing: both pipelines ran without it.</p><p>Receivers, processors and exporters are enabled by listing them in a pipeline, extensions under <code>service.extensions</code>. Deleting <code>memory_limiter</code>, listing it in only one pipeline, or giving it another name would all leave a pipeline unprotected, so it must be listed in both. Each pipeline gets its own instance of a processor listed in several.</p><p>The order of each list is the next level's question, and this game checks the wiring, not the settings.</p><p>In Collector v0.164.0 the OTLP gRPC exporter is <code>otlp_grpc</code> and the OTLP HTTP exporter is <code>otlp_http</code>; <code>otlp</code> and <code>otlphttp</code> are deprecated aliases that still resolve, and every config in this act uses the new names.</p>"
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
              "label": "It is not listed in a pipeline under <code>service.pipelines</code>, next to the receivers",
              "why": "Extensions are not part of a pipeline: they sit beside the data path. A pipeline lists receivers, processors and exporters (and connectors), not extensions."
            },
            {
              "key": "service-extensions",
              "label": "It is defined under <code>extensions</code> but not listed under <code>service.extensions</code>",
              "why": "Configuring an extension does not enable it. Extensions are enabled by listing them under <code>service.extensions</code>, not in a pipeline. Defined but not listed, <code>health_check</code> is not enabled, so nothing answers."
            },
            {
              "key": "start-order",
              "label": "Extensions start only after the <code>otlp_grpc</code> exporter, and the Collector has not finished starting",
              "why": "An extension that is listed under <code>service.extensions</code> starts with the Collector. Nothing about the order of components keeps it from answering."
            }
          ]
        }
      }
    ]
  }
};
