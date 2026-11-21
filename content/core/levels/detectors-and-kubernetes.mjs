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
            },
            {
              "key": "init",
              "label": "During initialisation, before a single event",
              "why": "Detection runs as the application starts, and its result becomes the Resource that is attached to the tracer, meter and logger providers when they are created. That is why detection is expected to complete quickly."
            },
            {
              "key": "per-request",
              "label": "Each time a request arrives: the Resource always matches the request being handled right now",
              "why": "A Resource describes the producer, not one request, and it is immutable once the provider has it. Facts about one request are span attributes."
            },
            {
              "key": "setup",
              "label": "When setup runs, with the environment read in that very moment",
              "why": "The SDK builds the Resource by running its detectors and merging what they return, then associates it with the providers. After that the association cannot be changed."
            },
            {
              "key": "timer",
              "label": "On a timer, about once a minute: changes of the environment get picked up again",
              "why": "A Resource is immutable and its association with a provider cannot be changed later, so there is nothing for a timer to refresh."
            },
            {
              "key": "one-time",
              "label": "One time per process: on start without a repeat for a span or a metric",
              "why": "Resources are immutable, and a provider keeps the one it was given. Nothing runs detection a second time for each signal."
            },
            {
              "key": "at-export",
              "label": "Whenever a batch of telemetry is exported",
              "why": "Detection finishes long before export: the Resource is attached to the providers when they are created, and an exporter only sends what already carries it."
            },
            {
              "key": "no-detectors",
              "label": "Never in an SDK, because only Collectors have resource detectors",
              "why": "Most language-specific SDKs provide resource detectors for the operating system, the host, the process, the container, Kubernetes and cloud providers, to detect resource information from the environment."
            },
            {
              "key": "at-shutdown",
              "label": "When the process shuts down, from everything it saw while it was running",
              "why": "A Resource has to exist from the start. It is attached to the providers when they are created, and every span from them carries it."
            },
            {
              "key": "at-build",
              "label": "When a container image is built, before any code has run",
              "why": "Detectors read the environment the application runs in, such as the host, the process and the container, so they run where the application runs, as it starts."
            },
            {
              "key": "lazily",
              "label": "Lazily: when a span first asks for its Resource",
              "why": "The Resource is associated with the provider when the provider is created, so every span from that provider has it already."
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
            },
            {
              "key": "daemonset",
              "label": "In a DaemonSet agent on each node, where the Kubernetes attributes processor adds pod metadata",
              "why": "The processor is usable in a DaemonSet Collector. It looks up the pod each piece of telemetry came from through the Kubernetes API and adds the pod metadata as resource attributes, for services in any language."
            },
            {
              "key": "sidecar",
              "label": "In a sidecar Collector next to each pod, using the <code>k8sattributes</code> processor",
              "why": "The processor is not usable in a sidecar Collector. It works by discovering all the pods in a cluster through the Kubernetes API, from a DaemonSet or a gateway."
            },
            {
              "key": "gateway",
              "label": "On a gateway in the cluster, set up to tag what passes using the pod's details",
              "why": "A Collector deployed as a gateway can use the Kubernetes attributes processor too. It associates each datapoint with a pod and adds the metadata to spans, metrics and logs, so the services need no change."
            },
            {
              "key": "log-library",
              "label": "In the logging library, by adding the pod name to every log line",
              "why": "That covers logs only. The Kubernetes attributes processor adds pod metadata to spans, metrics and logs as resource attributes."
            },
            {
              "key": "once-for-all",
              "label": "In the Collector's pipeline, once for all the pods, instead of in every service",
              "why": "A processor in the pipeline sees the spans, metrics and logs of every service, whatever its language, and the Collector can ask the Kubernetes API for what no single process knows."
            },
            {
              "key": "batch",
              "label": "In the Collector's batch processor, which adds Kubernetes metadata while grouping telemetry",
              "why": "The batch processor places spans, metrics and logs into batches, which helps compression and reduces the number of outgoing connections. It adds no metadata."
            },
            {
              "key": "transform",
              "label": "In the Collector's <code>transform</code> processor, asking the Kubernetes API about each record",
              "why": "The transform processor modifies telemetry by running OTTL statements against it. It does not query the Kubernetes API, which is what the <code>k8sattributes</code> processor does."
            },
            {
              "key": "receiver",
              "label": "In the Collector's OTLP receiver, stamping the pod onto data on arrival",
              "why": "The OTLP receiver receives data via gRPC or HTTP in the OTLP format. Adding pod metadata is a processor's job."
            },
            {
              "key": "memory-limiter",
              "label": "In the <code>memory_limiter</code> processor, as the limiter already tracks every pod's usage",
              "why": "The memory limiter processor prevents out-of-memory situations in the Collector itself. It neither tracks pods nor adds metadata."
            },
            {
              "key": "attributes-processor",
              "label": "In the attributes processor, which fills in the pod for each record from the cluster",
              "why": "The attributes processor modifies the attributes of a span, log or metric by the actions in its config, such as insert and update. It does not discover pods, and the transform processor has superseded it."
            },
            {
              "key": "exporter",
              "label": "On the way out, in the OTLP exporter that adds the pod to a batch",
              "why": "An exporter only sends data out: the OTLP gRPC exporter exports it over gRPC in the OTLP format. Pod metadata has to be there before the data reaches it."
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
            },
            {
              "key": "read-only",
              "label": "Read access over the Kubernetes API, because that is where it discovers each pod",
              "why": "The processor uses the Kubernetes API to discover the pods running in a cluster, so its service account needs permission to read them there. Without it the processor finds no pods."
            },
            {
              "key": "ssh",
              "label": "Shell access to each node, to read the container runtime's files for pod names",
              "why": "The processor discovers pods through the Kubernetes API. It does not open shells or read files on the nodes."
            },
            {
              "key": "cluster-wide",
              "label": "Reach across the whole cluster, so pods in any namespace can be seen",
              "why": "To receive telemetry from across namespaces, the processor needs <code>get</code>, <code>watch</code> and <code>list</code> on pods and namespaces for all of them, and a ClusterRole grants exactly that."
            },
            {
              "key": "packets",
              "label": "To capture the traffic between pods and read their names out of the packets",
              "why": "By default the processor matches telemetry to a pod through the IP address of the incoming connection, then reads that pod's metadata from its record of the cluster's pods. It never inspects packets."
            },
            {
              "key": "binding",
              "label": "A binding tying those read rights to the identity the Collector uses for pod lookups",
              "why": "The permissions are given to the service account the Collector runs as, through a ClusterRole and its binding. Some attributes need a little more, such as access to nodes when it extracts node metadata."
            },
            {
              "key": "sidecar-needed",
              "label": "A sidecar in every pod, since the processor can only describe the pod it sits in",
              "why": "The processor is not usable in a sidecar. It discovers all the pods in a cluster through the Kubernetes API, from a DaemonSet or a gateway Collector."
            },
            {
              "key": "admin",
              "label": "The <code>cluster-admin</code> ClusterRole, because narrower roles cannot list pods",
              "why": "A narrow ClusterRole is enough: <code>get</code>, <code>watch</code> and <code>list</code> on pods and namespaces, with a little more for some attributes. Full admin rights are far wider than the processor needs."
            },
            {
              "key": "write",
              "label": "Permission to create and delete pods, so it can tag them with their metadata",
              "why": "The processor only reads: the verbs it needs are <code>get</code>, <code>watch</code> and <code>list</code>. It adds metadata to the telemetry, not to the pods."
            },
            {
              "key": "kubelet",
              "label": "A credential for each node's kubelet, which it queries for pod data",
              "why": "The processor uses the Kubernetes API to discover pods, so its service account needs permissions there. Pulling pod and container metrics from a kubelet is the job of the kubeletstats receiver."
            },
            {
              "key": "namespaces-only",
              "label": "Permission to read namespaces only, because the pod name is in the telemetry already",
              "why": "It needs pods as well as namespaces. By default it matches telemetry to a pod by IP address, then reads that pod's metadata, instead of trusting a name in the telemetry."
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
            },
            {
              "key": "tracing",
              "label": "It enables tracing out of the box where it has support, with no SDK in any app",
              "why": "In namespaces enabled for Dash0 monitoring, supported workloads are instrumented automatically, so tracing works out of the box for supported runtimes without adding an SDK."
            },
            {
              "key": "go",
              "label": "It adds the Kubernetes attributes to every workload, even libc-free binaries such as most Go programs",
              "why": "Attribute detection relies on the process using dynamic linking at startup. Libc-free binaries, for example most binaries built with Go, are a notable exception."
            },
            {
              "key": "attributes",
              "label": "It adds the namespace plus the container to resource attributes on the workload",
              "why": "The operator improves the auto-detection of OpenTelemetry resource attributes: namespace, pod name, pod UID and container name are added to the workload's resource attributes."
            },
            {
              "key": "in-place",
              "label": "It instruments pods and jobs that are already running, without restarting them",
              "why": "Pods and jobs are instrumented only at deploy time, because existing ones cannot be restarted. Other workload types can be instrumented in place."
            },
            {
              "key": "hassle",
              "label": "It saves the team from instrumenting apps by hand, or having to supply all Kubernetes details themselves",
              "why": "Those are the two jobs Dash0 says the operator takes off you: adding the OpenTelemetry SDK to the application, and setting the Kubernetes-related resource attributes manually."
            },
            {
              "key": "any-runtime",
              "label": "It adds tracing to every runtime, whatever language the application is written in",
              "why": "Automatic tracing only works for supported runtimes. For other runtimes you add an OpenTelemetry SDK by other means."
            },
            {
              "key": "all-namespaces",
              "label": "It instruments each namespace in the cluster as soon as it is installed",
              "why": "It acts in the namespaces that are enabled for Dash0 monitoring, and in no others."
            },
            {
              "key": "rewrite",
              "label": "It rewrites the application's source code to call the OpenTelemetry API",
              "why": "It modifies the Pod spec template, or the Pod spec itself for a standalone pod, and the source code stays as it was."
            },
            {
              "key": "needs-sdk",
              "label": "It waits for the team to add an SDK, and only then sets the Kubernetes attributes",
              "why": "Tracing for supported runtimes needs no SDK, and attribute detection works both for the runtimes the operator instruments and for workloads that got an SDK some other way."
            },
            {
              "key": "new-only",
              "label": "It touches only workloads deployed after it was installed, never existing deployments",
              "why": "For workload types other than jobs and pods, the operator can instrument existing workloads as well as new ones, depending on the <code>spec.instrumentWorkloads.mode</code> setting."
            }
          ]
        }
      }
    ]
  }
};
