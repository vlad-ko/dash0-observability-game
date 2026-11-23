// Text of levels/resources.mjs (docs/CONTENT.md).
// Sort labels must not give the bucket away: see the step 1 note in levels/resources.mjs (test/sort-tells.test.mjs).
export default {
  "id": "resources",
  "name": "Resources",
  "sub": "What is it about?",
  "rewardTitle": "Resource spotter",
  "play": {
    "finish": "You can tell a resource attribute from a signal attribute: what the telemetry is about goes on the Resource once, and what one operation did goes on its span.",
    "steps": [
      {
        "intro": "Every span, metric and log is about something: a service, a pod, a host, a cloud region. OpenTelemetry keeps that in the <b>Resource</b>, attached once. Each signal also carries attributes of its own about one operation. Checkout at Kettle &amp; Co just started sending telemetry with both kinds mixed up.",
        "question": "Pick an attribute, then say where it belongs.",
        "sort": {
          "id": "res-sort",
          "hint": "Ask whether it is the same for everything this process sends, or changes per request.",
          "buckets": [
            {
              "id": "resource",
              "label": "Resource attribute"
            },
            {
              "id": "signal",
              "label": "Signal attribute"
            }
          ],
          "items": [
            {
              "id": "service-name",
              "label": "service.name = checkout",
              "why": "It says which service produced the telemetry, and it is the same on every span, metric and log the process emits. That is what a resource attribute is.",
              "whyNot": {
                "signal": "It describes who is talking, not one operation. The SDK attaches it once, to the Resource, and every signal from the process carries it."
              }
            },
            {
              "id": "http-method",
              "label": "http.request.method = POST",
              "why": "It differs from one request to the next, so it describes one operation. It belongs on that span, as an attribute of the span.",
              "whyNot": {
                "resource": "A process serves GETs and POSTs, so no single value describes the process. Per-request facts go on the span."
              }
            },
            {
              "id": "pod-name",
              "label": "k8s.pod.name = checkout-7d9f6",
              "why": "The pod is part of what produces the telemetry, and it does not change from span to span. It belongs on the Resource, set once.",
              "whyNot": {
                "signal": "The pod is the same for every span the process emits. Repeated on each span as a span attribute, it is the wrong place: it describes the producer, not the operation."
              }
            },
            {
              "id": "http-route",
              "label": "http.route = /checkout/{id}",
              "why": "The matched route says what this one request was. That is a fact about an operation, so it is a span attribute.",
              "whyNot": {
                "resource": "The route changes with the request. A resource describes the thing that produces telemetry, not one request it handled."
              }
            },
            {
              "id": "host-name",
              "label": "host.name = node-eu-3",
              "why": "The host is where the process runs and it stays the same while the process lives, so it describes the producer. That is a resource attribute.",
              "whyNot": {
                "signal": "Every span from this process runs on the same host. It describes where the telemetry comes from, so it goes on the Resource."
              }
            },
            {
              "id": "status-code",
              "label": "http.response.status_code = 200",
              "why": "Each response has its own status code, so it is a fact about one operation: a span attribute.",
              "whyNot": {
                "resource": "A process returns 200s and 500s. One response, not the process, has a status code."
              }
            },
            {
              "id": "cloud-region",
              "label": "cloud.region = eu-central-1",
              "why": "The region the process runs in does not change per request. It says where the producer lives, so it is a resource attribute.",
              "whyNot": {
                "signal": "Every span from this process comes from the same region. Put it on the Resource once."
              }
            },
            {
              "id": "url-path",
              "label": "url.path = /checkout/8841",
              "why": "The path of this one request, with its real id in it. A different request has a different path, so it is a span attribute.",
              "whyNot": {
                "resource": "It changes with every request. A resource attribute stays the same for the life of the producer."
              }
            },
            {
              "id": "service-version",
              "label": "service.version = 2.4.0",
              "why": "The version of the checkout code that is running. Every span, metric and log from this process carries the same version, so it describes the producer: a resource attribute.",
              "whyNot": {
                "signal": "One request has no version of its own. The process runs one version of the code, so the version goes on the Resource, set once."
              }
            },
            {
              "id": "url-query",
              "label": "url.query = q=kettle",
              "why": "The query string of this one request. The next request can carry another query or none, so it is a span attribute.",
              "whyNot": {
                "resource": "The next request can carry another query or none. A query string is a fact about one request, not about the process that served it."
              }
            },
            {
              "id": "namespace",
              "label": "k8s.namespace.name = checkout-prod",
              "why": "The namespace the checkout pod runs in. It is the same for every span the process emits, so it describes where the telemetry comes from: a resource attribute.",
              "whyNot": {
                "signal": "Every request this pod serves is served in the same namespace. The namespace is part of the producer, so it goes on the Resource."
              }
            },
            {
              "id": "user-agent",
              "label": "user_agent.original = curl/8.5.0",
              "why": "The User-Agent header the client sent with this request. Another client sends another value, so it describes one operation: a span attribute.",
              "whyNot": {
                "resource": "Checkout is called by browsers, apps and scripts. The client of one request is not a fact about the process."
              }
            },
            {
              "id": "cloud-provider",
              "label": "cloud.provider = aws",
              "why": "The cloud the process runs in. It does not change from request to request, so it describes the producer: a resource attribute.",
              "whyNot": {
                "signal": "Every span from this process comes from the same cloud. It describes the producer, not one operation."
              }
            },
            {
              "id": "client-address",
              "label": "client.address = 10.1.2.80",
              "why": "The address of the client that made this request. Each request can come from a different client, so it is a span attribute.",
              "whyNot": {
                "resource": "It names who called, not who produced the telemetry. Requests come from many addresses, so the address belongs on each span."
              }
            },
            {
              "id": "host-arch",
              "label": "host.arch = amd64",
              "why": "The CPU architecture of the host the process runs on. It is the same for everything the process sends, so it is a resource attribute.",
              "whyNot": {
                "signal": "No request changes the CPU the process runs on. The architecture describes where the telemetry comes from, so it goes on the Resource."
              }
            },
            {
              "id": "db-collection",
              "label": "db.collection.name = orders",
              "why": "The table one database call worked on. The next call can query another table, so it describes one operation: an attribute of that call's span.",
              "whyNot": {
                "resource": "Checkout can query more than one table. The name says what one call worked on, not who produced the telemetry."
              }
            }
          ]
        }
      },
      {
        "intro": "A teammate wraps the tracer so that every span gets <code>span.setAttribute('k8s.pod.name', podName)</code>, and says it works: the pod name is on every span.",
        "question": "What is wrong with putting the pod name on every span?",
        "choice": {
          "id": "res-pod",
          "choices": [
            {
              "key": "same-thing",
              "label": "A span attribute and a resource attribute are the same thing, so you can set either one",
              "why": "They are not. A Resource is attached to the provider once, and every span, metric and log from it carries the Resource. A span attribute belongs to that one span."
            },
            {
              "key": "set-once",
              "label": "It describes the pod that produces the telemetry, so it belongs on the Resource, set once",
              "why": "The pod does not change from span to span, so it describes the entity producing the telemetry. The SDK attaches a Resource to its provider when the provider is created, and every span, metric and log from that provider carries it. Setting <code>k8s.pod.name</code> as a span attribute repeats one value on every span, and leaves your metrics and logs without it."
            },
            {
              "key": "cardinality",
              "label": "A pod name has too many different values to be an attribute on a span or a Resource",
              "why": "The value is not the problem: <code>k8s.pod.name</code> is a standard attribute with an agreed meaning, and a Resource carries it fine. The problem is where it is set."
            },
            {
              "key": "all-signals",
              "label": "A span attribute reaches only spans, so metrics and logs miss the pod name",
              "why": "A Resource is associated with the tracer, meter and logger providers when they are created, and everything those providers produce carries it. A wrapper that sets an attribute on spans touches spans alone."
            },
            {
              "key": "not-standard",
              "label": "<code>k8s.pod.name</code> is not a standard attribute, so it needs renaming before it is sent",
              "why": "It is a standard attribute: the Kubernetes semantic conventions define <code>k8s.pod.name</code> as the name of the Pod. The problem is where it is set, not what it is called."
            },
            {
              "key": "producer",
              "label": "A name like this is an attribute of what is observed, which a Resource is built to hold",
              "why": "OpenTelemetry defines a resource as the entity producing telemetry, and a Kubernetes pod is one of the entities it names. The pod is the same for every span the process emits, so it describes the producer and not any one operation."
            },
            {
              "key": "personal-data",
              "label": "Pod names are personal data, so they should stay out of telemetry",
              "why": "A pod name is infrastructure metadata, and the Kubernetes attributes processor in the Collector adds it to telemetry by default. A Resource is the usual place for it."
            },
            {
              "key": "replaces-service",
              "label": "It would take the place of <code>service.name</code>, because a Resource holds a single identity",
              "why": "A Resource holds a set of attributes. The usual example is a process name, a pod name, a namespace and a deployment name all together on one Resource."
            },
            {
              "key": "repeats",
              "label": "The value <code>k8s.pod.name</code> is copied onto each span, not put on the Resource",
              "why": "Set on the Resource, the pod name is attached to the provider when it is created, and every span, metric and log from that provider carries it, with no wrapper around the tracer."
            },
            {
              "key": "lookup",
              "label": "Every span makes the SDK query the Kubernetes API for the pod name, which is slow",
              "why": "The wrapper reads the name from a variable, so nothing is queried per span. The trouble is that a pod name describes the producer, and the producer is what the Resource is for."
            },
            {
              "key": "backend-ignores",
              "label": "Backends ignore the Resource and read only span attributes, losing the pod name there",
              "why": "Backends do read the Resource. Dash0, for one, builds its Resources view from the resource attributes that every signal carries."
            },
            {
              "key": "only-traces",
              "label": "A Resource applies to traces only, and metrics and logs need attributes of their own",
              "why": "A Resource can be associated with a TracerProvider, a MeterProvider and a LoggerProvider, so the spans, metrics and logs from them all carry it."
            },
            {
              "key": "env-only",
              "label": "A Resource takes its attributes only from <code>OTEL_RESOURCE_ATTRIBUTES</code>, never from code",
              "why": "Custom resource attributes can be provided in code or through the <code>OTEL_RESOURCE_ATTRIBUTES</code> environment variable. Either way they are set once on the Resource."
            },
            {
              "key": "sdk-default",
              "label": "The SDK already puts the pod name on every Resource by default, so the wrapper is redundant",
              "why": "The SDK provides only a few default attributes, such as <code>service.name</code> (as <code>unknown_service</code> unless you set it) and the <code>telemetry.sdk.*</code> ones. A pod name has to come from a detector or from you."
            }
          ]
        }
      },
      {
        "intro": "Dash0 lists the things your telemetry is about, such as services, pods and hosts, without you registering them.",
        "question": "Where does Dash0 get the identity of a pod or a service?",
        "choice": {
          "id": "res-dash0",
          "choices": [
            {
              "key": "by-hand",
              "label": "From a list you register in Dash0 by hand, one entry per <code>k8s.pod.uid</code> and <code>host.id</code>, kept up to date as pods change",
              "why": "Nothing to register: what Dash0 lists comes from the telemetry itself, and the names and types in its Resources table are derived from OpenTelemetry attributes."
            },
            {
              "key": "resource-attributes",
              "label": "From the resource attributes on your telemetry, such as <code>service.name</code> and <code>k8s.pod.uid</code>",
              "why": "Every signal carries resource metadata that identifies the system it describes, and Dash0 builds its Resources view from those resource attributes. For a pod, that identity is <code>k8s.pod.uid</code>."
            },
            {
              "key": "span-attributes",
              "label": "From whichever span attribute, such as <code>k8s.pod.name</code> or <code>host.name</code>, happens to hold a pod or host name on the spans you send",
              "why": "A span attribute describes one span. The identity of the thing that produced the telemetry is what the Resource is for, and that is what Dash0 reads."
            },
            {
              "key": "derived",
              "label": "Straight from the signals, with nothing extra to send to Dash0",
              "why": "Dash0 lists what the telemetry describes. The names and types in its Resources table are derived automatically from OpenTelemetry attributes, and nobody registers them by hand."
            },
            {
              "key": "registry-ahead",
              "label": "From a registry that the Collector sends ahead of the signals",
              "why": "There is no such registry. Every signal carries resource metadata that identifies the system it describes, and Dash0 builds its view from that."
            },
            {
              "key": "signal-metadata",
              "label": "From the metadata that each signal carries about its system",
              "why": "In OpenTelemetry each signal carries resource metadata identifying the observed system, whether that is a process, a container or a Kubernetes pod. That is what Dash0 reads."
            },
            {
              "key": "ip-lookup",
              "label": "Through the IP address of the sender, matched to a pod in a table that Dash0 keeps",
              "why": "Matching an incoming IP address to a pod is what the Collector's Kubernetes attributes processor does by default, inside your cluster. Dash0 reads the resource attributes that arrive with the telemetry."
            },
            {
              "key": "endpoint",
              "label": "Through the OTLP endpoint URL the SDK is set up to send to",
              "why": "An endpoint says where to send telemetry. What the telemetry describes is carried in its resource attributes."
            },
            {
              "key": "equality",
              "label": "By matching pod identifiers across sources, so a log agent and an SDK count as one pod",
              "why": "Sources that describe the same pod rarely carry identical attributes. Dash0 applies resource equality rules, based on attributes such as <code>k8s.pod.uid</code> for Kubernetes, to merge them into one resource without any configuration."
            },
            {
              "key": "service-only",
              "label": "From <code>service.name</code> alone, the only attribute it reads for any resource",
              "why": "Dash0's equality rules use other attributes too: <code>k8s.pod.uid</code> for a Kubernetes pod and <code>faas.instance</code> for an AWS Lambda function."
            },
            {
              "key": "collector-name",
              "label": "From the name of the Collector that forwarded the signals",
              "why": "A resource describes the observed system, not whatever collected or forwarded the telemetry. Metrics that CloudWatch provides about an RDS instance describe the instance, not CloudWatch."
            },
            {
              "key": "per-signal",
              "label": "Separately for each signal type, so the pod's logs and traces are listed apart",
              "why": "Dash0 merges them: its resource equality rules recognise that different signals describe the same observed system, which avoids splitting one pod's telemetry across several resources."
            },
            {
              "key": "hostname",
              "label": "By the name of the machine, whatever kind of resource it is",
              "why": "Resources are not only hosts. They include Kubernetes pods and AWS Lambda functions, and each platform has its own equality rules, such as <code>k8s.pod.uid</code> for pods and <code>faas.instance</code> for Lambda."
            }
          ]
        }
      }
    ]
  }
};
