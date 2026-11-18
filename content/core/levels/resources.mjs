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
            }
          ]
        }
      }
    ]
  }
};
