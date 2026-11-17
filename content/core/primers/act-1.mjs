// Act 1 primer (#389). PLACEHOLDER: drafted from the official OpenTelemetry resources page and one Dash0
// docs page only, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-1",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry and Dash0 docs pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Resources and identity: who is talking?",
  "overview": [
    {
      "type": "paragraph",
      "text": "Every trace, metric and log needs to say which system it describes. In OpenTelemetry that is the job of a resource. This act is about telling your services apart, so you can find the one that is misbehaving."
    },
    {
      "type": "list",
      "items": [
        "A resource is a set of attributes that describes the thing producing telemetry.",
        "Some attributes have defaults or come from the SDK, and you can set your own.",
        "Detectors can fill in details from the environment, such as the host or the Kubernetes pod."
      ]
    },
    {
      "type": "callout",
      "tone": "tip",
      "text": "Already know this? Skip the reading and go straight to the levels."
    }
  ],
  "chapters": [
    {
      "id": "what-is-a-resource",
      "title": "What a resource is",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A resource represents the entity producing telemetry, described as resource attributes. A process running in a container on Kubernetes might have a process name, a pod name, a namespace and possibly a deployment name."
        },
        {
          "type": "paragraph",
          "text": "In your observability backend, you can use resource information to investigate behavior. If your data shows latency, you can narrow it down to a specific container, pod or Kubernetes deployment."
        },
        {
          "type": "paragraph",
          "text": "A resource is added to the tracer or meter provider when it is created. That association cannot be changed later, and all spans and metrics from that provider carry the resource."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Resources",
          "url": "https://opentelemetry.io/docs/concepts/resources/",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: About Resources",
          "url": "https://www.dash0.com/docs/dash0/monitoring/resources/about-resources",
          "audience": "public"
        }
      ]
    },
    {
      "id": "names-and-defaults",
      "title": "Names, defaults and your own attributes",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The SDK provides some attributes itself. One of them is service.name, the logical name of the service. By default, SDKs assign the value unknown_service, so it is recommended to set it explicitly, in code or with the OTEL_SERVICE_NAME environment variable."
        },
        {
          "type": "paragraph",
          "text": "The SDK also adds attributes that identify itself: telemetry.sdk.name, telemetry.sdk.language and telemetry.sdk.version."
        },
        {
          "type": "paragraph",
          "text": "You can provide your own resource attributes in code or with the OTEL_RESOURCE_ATTRIBUTES environment variable. Where it applies, use the semantic conventions for the names. For example, deployment.environment.name holds the name of your deployment environment."
        },
        {
          "type": "code",
          "text": "env OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=production yourApp",
          "wrap": false
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Resources",
          "url": "https://opentelemetry.io/docs/concepts/resources/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "detectors-and-one-system",
      "title": "Detectors and one observed system",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Most language SDKs provide resource detectors, which find resource information from the environment on their own. Common ones cover the operating system, the host, the process and its runtime, the container, Kubernetes and cloud-provider attributes."
        },
        {
          "type": "paragraph",
          "text": "Different sources that describe the same system rarely carry identical resource attributes. An SDK inside a pod and a log agent on the host can each report a different subset, so they look like two resources. Dash0 calls this resource fragmentation."
        },
        {
          "type": "paragraph",
          "text": "Dash0 merges such resources through resource equality, using attributes such as k8s.pod.uid for Kubernetes. It works without configuration."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Resources",
          "url": "https://opentelemetry.io/docs/concepts/resources/",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: About Resources",
          "url": "https://www.dash0.com/docs/dash0/monitoring/resources/about-resources",
          "audience": "public"
        }
      ]
    }
  ]
};
