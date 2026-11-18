// Act 5 primer (#389). PLACEHOLDER: drafted from the official OpenTelemetry Collector and OTLP pages,
// pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-5",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "The Collector: the plumbing",
  "overview": [
    {
      "type": "paragraph",
      "text": "The OpenTelemetry Collector receives telemetry, works on it and sends it on to one or more backends. This act is about running it: how its parts fit together, how it speaks OTLP, where it runs and which build of it you use."
    },
    {
      "type": "list",
      "items": [
        "A Collector is built from components, and pipelines decide which ones handle which signal.",
        "OTLP is the protocol that carries telemetry between SDKs, Collectors and backends.",
        "The Collector can run in different deployment patterns, and comes in several pre-built distributions."
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
      "id": "components-and-pipelines",
      "title": "Components and pipelines",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A Collector configuration is made of components. Each kind has its own job."
        },
        {
          "type": "list",
          "items": [
            "Receivers collect telemetry from one or more sources.",
            "Processors take the data collected by receivers and modify or transform it before sending it to the exporters.",
            "Exporters send data to one or more backends or destinations.",
            "Connectors join two pipelines.",
            "Extensions are optional components that expand the capabilities of the Collector. They do not need direct access to telemetry data."
          ]
        },
        {
          "type": "paragraph",
          "text": "The pipelines subsection of the service section is where the pipelines are configured. A pipeline is of one of these types: traces, metrics or logs."
        },
        {
          "type": "paragraph",
          "text": "A pipeline consists of a set of receivers, processors and exporters. You can use the same receiver, processor or exporter in more than one pipeline."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Collector configuration",
          "url": "https://opentelemetry.io/docs/collector/configuration/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "processor-order",
      "title": "Processor order",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Processors run in the order they are listed in a pipeline. Processors are optional, although some are recommended."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Collector configuration",
          "url": "https://opentelemetry.io/docs/collector/configuration/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "otlp",
      "title": "OTLP",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The OpenTelemetry Protocol (OTLP) describes the encoding, transport and delivery of telemetry between telemetry sources, intermediate nodes such as Collectors, and telemetry backends. It is a request and response protocol: clients send requests, and the server replies."
        },
        {
          "type": "paragraph",
          "text": "OTLP is implemented over two transports, gRPC and HTTP."
        },
        {
          "type": "paragraph",
          "text": "An SDK's OTLP exporter is set up with environment variables. OTEL_EXPORTER_OTLP_PROTOCOL picks the protocol, one of grpc, http/protobuf or http/json. The endpoint can be set once for all signals with OTEL_EXPORTER_OTLP_ENDPOINT, or per signal with variables such as OTEL_EXPORTER_OTLP_TRACES_ENDPOINT."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: OTLP specification",
          "url": "https://opentelemetry.io/docs/specs/otlp/",
          "audience": "public"
        },
        {
          "kind": "otel",
          "label": "OpenTelemetry: OTLP exporter configuration",
          "url": "https://opentelemetry.io/docs/specs/otel/protocol/exporter/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "deployment-patterns",
      "title": "Agent and gateway",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The Collector documentation describes deployment patterns, among them the agent pattern and the gateway pattern. Each comes with pros and cons."
        },
        {
          "type": "list",
          "items": [
            "Agent, pros: straightforward to get started, and a clear one-to-one mapping between application and Collector.",
            "Agent, cons: limited scalability for teams and infrastructure resources, and inflexible for complex or evolving deployments.",
            "Gateway, pros: separation of concerns such as centrally managed credentials, and centralized policy management.",
            "Gateway, cons: one more thing to maintain that can fail, added latency with cascaded Collectors, and higher overall resource usage."
          ]
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Agent deployment pattern",
          "url": "https://opentelemetry.io/docs/collector/deploy/agent/",
          "audience": "public"
        },
        {
          "kind": "otel",
          "label": "OpenTelemetry: Gateway deployment pattern",
          "url": "https://opentelemetry.io/docs/collector/deploy/gateway/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "transforming",
      "title": "Transforming telemetry",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The OpenTelemetry Transformation Language (OTTL) is the language the transform processor uses for its transformations."
        },
        {
          "type": "list",
          "items": [
            "The transform processor lets you specify transformations on metrics, logs and traces, written in OTTL.",
            "The attributes processor can update, insert, delete or replace existing attributes on metrics or traces.",
            "The resource processor works the same way, but only on resource attributes."
          ]
        },
        {
          "type": "paragraph",
          "text": "Transformations may have a significant impact on Collector performance."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Transforming telemetry",
          "url": "https://opentelemetry.io/docs/collector/transforming-telemetry/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "distributions",
      "title": "Distributions",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The OpenTelemetry project offers pre-built distributions of the Collector."
        },
        {
          "type": "list",
          "items": [
            "OpenTelemetry Collector Core",
            "OpenTelemetry Collector Contrib",
            "OpenTelemetry Collector Kubernetes",
            "OpenTelemetry Collector OTLP",
            "OpenTelemetry Collector eBPF Profiling"
          ]
        },
        {
          "type": "paragraph",
          "text": "The components a distribution includes are listed in its manifest.yaml file."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Collector distributions",
          "url": "https://opentelemetry.io/docs/collector/distributions/",
          "audience": "public"
        }
      ]
    }
  ]
};
