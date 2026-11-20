// Text of levels/agent-vs-gateway.mjs (docs/CONTENT.md).
export default {
  "id": "agent-vs-gateway",
  "name": "Agent vs gateway",
  "sub": "Where it runs",
  "rewardTitle": "Trace router",
  "play": {
    "finish": "You know an agent runs beside the workload and a gateway is a standalone service, and that tail sampling needs every span of a trace in one Collector: a load_balancing exporter routing by traceID in front of the gateways.",
    "steps": [
      {
        "intro": "Kettle &amp; Co now runs a Collector on every node, and the platform team wants a central place for heavier work such as [[sampling]]. The Collector docs call the two shapes agent and gateway.",
        "question": "Which of these is the gateway pattern?",
        "choice": {
          "id": "agw-pattern",
          "choices": [
            {
              "key": "agent",
              "label": "A Collector next to the workload: a sidecar in the pod, or a <code>DaemonSet</code> pod per node that the apps on that node send to",
              "why": "That is the agent pattern. An agent runs close to the application or on the same host, takes its telemetry and forwards it to a backend or to a gateway."
            },
            {
              "key": "gateway",
              "label": "A standalone Collector service, such as a <code>Deployment</code>, that apps or agents send OTLP to: one endpoint per cluster, data center or region",
              "why": "The gateway pattern: one or more Collector instances run as a standalone service and give apps and agents a single OTLP endpoint, typically per cluster, data center or region. Work that should not be repeated on every node, such as sampling, can live there."
            },
            {
              "key": "embedded",
              "label": "A Collector built into the application's process as a library, with no separate Collector process to run, upgrade or scale",
              "why": "Neither deployment pattern is a Collector inside the application. The application's SDK sends OTLP to a Collector that runs beside it (an agent) or to a central one (a gateway)."
            }
          ]
        }
      },
      {
        "intro": "The gateway is a <code>Deployment</code> with three replicas behind a [[Kubernetes]] Service that spreads requests across them. The team turns on the <code>tail_sampling</code> [[processor]] there to keep slow and failed traces. Then the replicas disagree: one keeps its half of a trace and another drops its half.",
        "question": "Why?",
        "choice": {
          "id": "agw-why",
          "choices": [
            {
              "key": "same-instance",
              "label": "Tail sampling decides per trace, so all spans of a trace must reach one Collector, and the Service splits them",
              "why": "The <code>tail_sampling</code> processor keeps spans in memory until it can decide on the whole trace, so all spans of a trace must reach the same Collector instance. An ordinary load balancer, or a Service that spreads requests, sends the spans of one trace to different replicas, and each replica decides on the part it has."
            },
            {
              "key": "wait",
              "label": "<code>decision_wait</code> is too short for slow requests, so each replica decides before the late spans of a trace arrive",
              "why": "<code>decision_wait</code> is how long the processor waits before it decides on a trace, and a longer wait helps with late spans. It does not help when the spans are not at that Collector at all because they went to another replica."
            },
            {
              "key": "unsupported",
              "label": "<code>tail_sampling</code> cannot run in a gateway Collector, because only agent Collectors can hold spans in memory for a time",
              "why": "The processor runs in any Collector that includes it, such as the contrib and Kubernetes distributions. An agent only sees the spans of the pods on its own node, which does not help."
            }
          ]
        }
      },
      {
        "intro": "The platform team's answer is two tiers: the [[agents]] route, and the [[gateway]] replicas, behind a headless Service, sample. This is an agent's config. Its traces [[pipeline]] names a <code>load_balancing</code> [[exporter]] that nobody defined, so it will not start.",
        "question": "Fix the agent config so every name its pipelines list is defined, and traces go through the <code>load_balancing</code> exporter. Metrics keep going straight to the gateway.",
        "configure": {
          "id": "agw-config",
          "hint": "Every span of one trace has to reach the same gateway replica; metrics have no such need. That is why the traces list names an exporter of its own: give that name a definition rather than pointing traces where metrics already go.",
          "explain": "A pipeline can only list an exporter that is defined, and one that is defined but not listed does nothing. Pointing traces at <code>otlp_grpc/gateway</code>, the Service in front of the replicas, would start the Collector and still split traces between them. <code>load_balancing</code> picks a replica by hashing a routing key, which the next question is about. The resolver, DNS on a headless Service here, lists the replicas. Metrics keep their own exporter. The exporter's type was renamed from <code>loadbalancing</code>; the old name still works in the Collector as a deprecated alias, but this task asks for the current name, so a different id is a different component here. This game checks the wiring, not the settings: the routing key is the next question."
        }
      },
      {
        "intro": "The agents send traces through <code>load_balancing</code> now. A teammate asks what the exporter should route by so that the gateway's [[tail sampling]] sees whole traces.",
        "question": "Which routing key?",
        "choice": {
          "id": "agw-key",
          "choices": [
            {
              "key": "trace-id",
              "label": "<code>routing_key: traceID</code>: every span of a trace goes to the same gateway replica",
              "why": "The exporter picks a replica by hashing the routing_key, so every span with the same trace ID goes to the same one and the <code>tail_sampling</code> processor there sees the whole trace. For traces, traceID is also the default routing key, so setting it makes the intent explicit."
            },
            {
              "key": "service",
              "label": "<code>routing_key: service</code>: every span of one service goes to the same gateway replica",
              "why": "That keeps a service together, which suits something like the span metrics connector. A trace crosses services, so its spans still land on different replicas and the trace is split."
            },
            {
              "key": "round-robin",
              "label": "Round robin: send each batch to the next replica in turn",
              "why": "The exporter does not round-robin batches: it hashes a routing key to choose the replica, so the same key always goes to the same one. Spreading batches evenly would split traces."
            }
          ]
        }
      }
    ]
  }
};
