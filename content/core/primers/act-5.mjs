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
      "text": "The OpenTelemetry Collector receives telemetry, works on it and sends it on to one or more backends. This act is about running it: how its parts fit together, how it speaks OTLP (the OpenTelemetry Protocol, see item 2 below), where it runs and which distribution (a packaged Collector build) of it you use."
    },
    {
      "type": "list",
      "items": [
        "A Collector is built from components (receivers, processors, exporters and more), and pipelines decide which ones handle which signal.",
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
          "text": "The pipelines subsection of the service section (the service: key in the configuration file) is where the pipelines are configured. A pipeline is of one of these types: traces, metrics or logs."
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
          "text": "OTLP is implemented over two transports (ways of carrying the data): gRPC (a binary remote-call protocol over HTTP/2) and HTTP."
        },
        {
          "type": "paragraph",
          "text": "An SDK's OTLP exporter is set up with environment variables. OTEL_EXPORTER_OTLP_PROTOCOL picks the protocol, one of grpc, http/protobuf (HTTP with the data encoded as protobuf, short for Protocol Buffers, a binary encoding) or http/json. The endpoint (the address and port the exporter sends to) can be set once for all signals with OTEL_EXPORTER_OTLP_ENDPOINT, or per signal with variables such as OTEL_EXPORTER_OTLP_TRACES_ENDPOINT."
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
          "text": "The Collector documentation describes deployment patterns, among them the agent pattern (a Collector run on each node, next to the applications) and the gateway pattern (a central tier of Collectors that receives telemetry from the rest). Each comes with pros and cons."
        },
        {
          "type": "list",
          "items": [
            "Agent, pros: straightforward to get started, and a clear one-to-one mapping between application and Collector.",
            "Agent, cons: limited scalability for teams and infrastructure resources, and inflexible for complex or evolving deployments.",
            "Gateway, pros: separation of concerns such as centrally managed credentials, and centralized policy management.",
            "Gateway, cons: one more thing to maintain that can fail, added latency with chained Collectors, and higher overall resource usage."
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
          "text": "The transform processor edits telemetry using the OpenTelemetry Transformation Language (OTTL), the language its transformations are written in."
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
          "text": "The OpenTelemetry project offers pre-built distributions of the Collector. A distribution is a packaged Collector build: a chosen set of components bundled into one ready-to-run program."
        },
        {
          "type": "list",
          "items": [
            "OpenTelemetry Collector Core (the basic set of components)",
            "OpenTelemetry Collector Contrib (a large set of components contributed by the community)",
            "OpenTelemetry Collector Kubernetes",
            "OpenTelemetry Collector OTLP",
            "OpenTelemetry Collector eBPF Profiling (uses eBPF, a Linux kernel technology for observing running programs, to profile them)"
          ]
        },
        {
          "type": "paragraph",
          "text": "The components a distribution includes are listed in its manifest file (manifest.yaml)."
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
