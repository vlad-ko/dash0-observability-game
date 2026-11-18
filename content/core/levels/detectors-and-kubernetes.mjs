// Text of levels/detectors-and-kubernetes.mjs (docs/CONTENT.md).
export default {
  "id": "detectors-and-kubernetes",
  "name": "Detectors and Kubernetes",
  "sub": "Which pod is this?",
  "rewardTitle": "Pod identifier",
  "play": {
    "finish": "You know detectors run once at SDK start, and that pod metadata is better added in the Collector with k8sattributes, defined and listed in the pipeline.",
    "steps": [
      {
        "intro": "Recommendations now sets <code>service.name</code>, but its telemetry still does not say which pod or node it came from. SDKs ship <b>resource detectors</b> that fill in some of that from the environment.",
        "question": "When do an SDK's resource detectors run?",
        "choice": {
          "id": "det-when",
          "choices": [
            {
              "key": "per-span",
              "label": "On the spans, in a span processor, to keep the values fresh",
              "why": "A Resource is attached to the tracer provider when the provider is created, and that association cannot be changed later. Detection is expected to finish quickly because it runs while the application starts, not per span."
            },
            {
              "key": "at-start",
              "label": "Once, when the SDK starts: the Resource is detected then and stays as it is",
              "why": "Resource detectors read what the environment shows, such as the host, the operating system, the process and the container, while the application initializes. The result is the Resource, and it is attached to the providers when they are created and cannot be changed later."
            },
            {
              "key": "in-backend",
              "label": "In the backend, from the IP address that the telemetry arrives from",
              "why": "A backend can only read the resource attributes that arrive with the telemetry. Detection happens before that, in the SDK when it starts."
            }
          ]
        }
      },
      {
        "intro": "Kettle &amp; Co runs dozens of services on Kubernetes, in several languages. Every one of them should carry its pod, namespace and node.",
        "question": "Where is it better to add that metadata?",
        "choice": {
          "id": "det-where",
          "choices": [
            {
              "key": "collector",
              "label": "In the Collector, with the <code>k8sattributes</code> processor",
              "why": "The processor discovers the pods in the cluster through the Kubernetes API, looks up the pod each piece of telemetry came from, and adds the pod, namespace, deployment and node, and optionally pod labels and annotations, as resource attributes. One processor covers every service in every language, and the Collector can ask the Kubernetes API for things a process does not know on its own. It is a contrib component: it ships in the contrib and Kubernetes Collector distributions, not in the core one."
            },
            {
              "key": "per-service",
              "label": "In the service code, with a hand-written SDK setup and <code>OTEL_RESOURCE_ATTRIBUTES</code>",
              "why": "It can work, but every service and every language needs the same setup, and a process only knows what it is told about its pod. Adding it once in the Collector is simpler and covers them all."
            },
            {
              "key": "span-processor",
              "label": "On the spans, as a <code>k8s.pod.name</code> attribute from a custom span processor in the service",
              "why": "Pod metadata describes the producer, so it belongs on the Resource, not on each span (level 1.1). It also leaves metrics and logs without it."
            }
          ]
        }
      },
      {
        "intro": "The platform team started the Collector config, and its traces pipeline already lists the processor. The Collector would not start.",
        "question": "Fix the config so the <code>k8sattributes</code> processor is defined and the traces pipeline flows.",
        "configure": {
          "id": "det-config",
          "hint": "A pipeline list holds only names, and the Collector refuses a name with no definition in its section. The task wants the traces enriched, not left alone.",
          "explain": "A processor takes effect only when it is both defined under <code>processors</code> and listed in a pipeline. Defined but not listed, it does nothing and the Collector starts without it; listed but not defined, the Collector refuses to start. Removing it from the pipeline would start the Collector too, but then the traces carry no pod metadata, so the task needs it listed. The settings are what make it useful: <code>extract.metadata</code> picks the attributes it adds, and by default the processor matches telemetry to a pod by the IP address of the incoming connection. This game checks the wiring, not the settings."
        }
      },
      {
        "intro": "The config is right and the Collector runs inside the cluster, yet the processor can only add metadata if it can find the pods.",
        "question": "What does the processor need to look pods up?",
        "choice": {
          "id": "det-rbac",
          "choices": [
            {
              "key": "pods-namespaces",
              "label": "Permission to <code>get</code>, <code>watch</code> and <code>list</code> pods and namespaces, through a ClusterRole on its service account",
              "why": "The processor reads pod metadata from the Kubernetes API, so the service account the Collector runs as needs those permissions (some attributes need more). Without them the processor cannot discover pods and adds nothing."
            },
            {
              "key": "api-key",
              "label": "A Dash0 auth token in the processor settings, the same one the <code>otlp_grpc/dash0</code> exporter uses to send to Dash0, for looking pods up in Dash0",
              "why": "The processor talks to the Kubernetes API of the cluster, not to Dash0. Its access is Kubernetes access, granted with RBAC. A Dash0 token belongs to the exporter."
            },
            {
              "key": "nothing",
              "label": "It reads <code>k8s.pod.name</code> and <code>k8s.namespace.name</code> off the telemetry that arrives, with no lookup against the cluster or its API",
              "why": "The processor looks the pod up: it keeps a record of the cluster's pods, and matches telemetry to one, by default through the IP address of the incoming connection. That lookup uses the Kubernetes API, which needs permissions."
            }
          ]
        }
      },
      {
        "intro": "Another team runs on the Dash0 operator instead of a Collector of their own. Their namespace is enabled for Dash0 monitoring.",
        "question": "What does the operator do for their workloads?",
        "choice": {
          "id": "det-dash0",
          "choices": [
            {
              "key": "operator-adds",
              "label": "It instruments supported runtimes without code changes and adds Kubernetes attributes such as <code>k8s.pod.name</code>",
              "why": "In namespaces enabled for Dash0 monitoring, the operator instruments supported workloads for tracing, and improves the OpenTelemetry resource attributes: <code>k8s.namespace.name</code>, <code>k8s.pod.name</code>, <code>k8s.pod.uid</code> and <code>k8s.container.name</code> are added to the workload's resource attributes, so you do not set them by hand. Resource attributes are detected for every runtime, with a few exceptions such as libc-free binaries."
            },
            {
              "key": "nothing",
              "label": "It adds no Kubernetes attributes: you add an SDK to the app and set <code>k8s.pod.name</code> and <code>k8s.namespace.name</code> yourself in its configuration",
              "why": "That is the work the operator takes off you: it instruments supported runtimes and sets the Kubernetes resource attributes for the workload."
            },
            {
              "key": "logs-only",
              "label": "It collects pod logs and metrics; the <code>k8s.*</code> resource attributes stay yours to set by hand in the app's environment",
              "why": "The operator does collect pod logs, and metrics too, but it also instruments workloads and adds Kubernetes resource attributes to them."
            }
          ]
        }
      }
    ]
  }
};
