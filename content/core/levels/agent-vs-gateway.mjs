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
              "label": "A Collector next to the workload: a sidecar in the pod, or a <code>DaemonSet</code> pod per node that the apps on that node talk to",
              "why": "That is the agent pattern. An agent runs close to the application or on the same host, takes its telemetry and forwards it to a backend or to a gateway."
            },
            {
              "key": "gateway",
              "label": "A standalone Collector service, such as a <code>Deployment</code>, that apps and agents send OTLP to through one endpoint",
              "why": "The gateway pattern: one or more Collector instances run as a standalone service and give apps and agents a single OTLP endpoint, typically per cluster, data center or region. Work that should not be repeated on every node, such as sampling, can live there."
            },
            {
              "key": "embedded",
              "label": "A Collector built into the application itself as a library, with no separate Collector to run, upgrade, scale",
              "why": "Neither deployment pattern is a Collector inside the application. The application's SDK sends OTLP to a Collector that runs beside it (an agent) or to a central one (a gateway)."
            },
            {
              "key": "single-endpoint",
              "label": "Collector instances that run behind a shared address, so every client delivers telemetry",
              "why": "In the gateway pattern the applications or other Collectors send telemetry to a single OTLP endpoint. One or more Collector instances run as a standalone service behind it, for example in a Kubernetes Deployment."
            },
            {
              "key": "central-policy",
              "label": "A central Collector tier where credentials and filtering are managed in a lone spot, away from the nodes",
              "why": "Two advantages of a gateway are the separation of concerns, such as centrally managed credentials, and centralised policy management, for example filtering certain logs or sampling."
            },
            {
              "key": "sdk-direct",
              "label": "The SDK exporting straight to the backend, without a Collector in between to handle anything",
              "why": "Both patterns are made of Collector instances. Without a Collector there is no gateway, and nothing in the path can sample, filter or hold credentials for the applications."
            },
            {
              "key": "plain-balancer",
              "label": "A standalone load balancer that spreads the requests of the apps but runs a Collector nowhere",
              "why": "A load balancer only distributes requests. In a gateway the Collectors behind the endpoint are what receive, process and export the telemetry."
            },
            {
              "key": "one-replica",
              "label": "A Collector <code>Deployment</code> with a single replica, because a gateway doing sampling cannot be scaled out",
              "why": "A gateway is one or more Collector instances. A load balancer can distribute the load among them, which is how a single-tier gateway scales."
            },
            {
              "key": "receiver-name",
              "label": "The name for any Collector whose OTLP receiver listens on port 4317, whatever else is in its config",
              "why": "The two patterns are defined by where the Collector runs, beside the workload or as a standalone service. Having an OTLP receiver does not make a Collector either of them."
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
              "label": "<code>tail_sampling</code> decides per trace, so the spans of a trace must reach one replica, and the Service splits them",
              "why": "The <code>tail_sampling</code> processor keeps spans in memory until it can decide on the whole trace, so all spans of a trace must reach the same Collector instance. An ordinary load balancer, or a Service that spreads requests, sends the spans of one trace to different replicas, and each replica decides on the part it has."
            },
            {
              "key": "wait",
              "label": "decision_wait is set short for lengthy requests, so a replica decides before the late spans of a trace arrive",
              "why": "<code>decision_wait</code> is how long the processor waits before it decides on a trace, and a longer wait helps with late spans. It does not help when the spans are not at that Collector at all because they went to another replica."
            },
            {
              "key": "unsupported",
              "label": "<code>tail_sampling</code> cannot run in a gateway replica, because only agents can hold the spans of a trace for long enough",
              "why": "The processor runs in any Collector that includes it, such as the contrib and Kubernetes distributions. An agent only sees the spans of the pods on its own node, which does not help."
            },
            {
              "key": "partial-view",
              "label": "Spread across replicas, each gets a share of the spans of the traces and rules on fragments",
              "why": "The tail sampling processor needs all the spans of a trace at one Collector instance. A Service that spreads requests gives every replica a share of each trace, and every replica decides on its own share."
            },
            {
              "key": "requests-not-traces",
              "label": "Balancing hands the spans of a trace to different replicas, while the sampler wants the spans together, whatever the load",
              "why": "An ordinary load balancer sends the spans of one trace to different replicas. The routing has to be done by trace, which is what the load-balancing exporter is for."
            },
            {
              "key": "num-traces",
              "label": "<code>num_traces</code> is too low, and a replica evicts the spans of a trace from memory ahead of the verdict",
              "why": "The setting limits the number of traces kept in memory, 50000 by default. A replica that evicts traces too early loses them, but that comes from load on one replica and does not make two replicas hold different halves of a trace."
            },
            {
              "key": "stateless",
              "label": "The processor is stateless, and a replica acts on the first span of a trace it receives",
              "why": "The processor is stateful: it keeps spans in memory while it waits to make a decision. That is why every span of a trace has to reach the same instance."
            },
            {
              "key": "out-of-order",
              "label": "Spans of a trace reach a replica out of order, and the filter works just on spans in time order",
              "why": "The processor groups spans by trace ID and waits before it decides, so the order in which they arrive does not matter. What matters is that they all arrive at the same instance."
            },
            {
              "key": "clock-drift",
              "label": "The clocks of the replicas drift, and a replica judges the duration of a trace using its spans differently",
              "why": "A latency policy uses the earliest start and the latest end among the spans it holds. Replicas judge differently because they hold different spans, not because of their clocks."
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
          "explain": "A pipeline can only list an exporter that is defined, and one that is defined but not listed does nothing. Pointing traces at <code>otlp_grpc/gateway</code>, the Service in front of the replicas, would start the Collector and still split traces between them. <code>load_balancing</code> picks a replica by hashing a routing key, which the next question is about. The resolver, DNS on a [[headless Service]] here, lists the replicas. Metrics keep their own exporter. The exporter's type was renamed from <code>loadbalancing</code>; the old name still works in the Collector as a deprecated alias, but this task asks for the current name, so a different id is a different component here. This game checks the wiring, not the settings: the routing key is the next question."
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
              "label": "<code>routing_key: traceID</code>: every span belonging to a trace goes to the same gateway replica",
              "why": "The exporter picks a replica by hashing the [[routing_key]], so every span with the same trace ID goes to the same one and the <code>tail_sampling</code> processor there sees the whole trace. For traces, traceID is also the default routing key, so setting it makes the intent explicit."
            },
            {
              "key": "service",
              "label": "<code>routing_key: service</code>: every span of a single service goes to the same gateway replica and splits the trace",
              "why": "That keeps a service together, which suits something like the span metrics connector. A trace crosses services, so its spans still land on different replicas and the trace is split."
            },
            {
              "key": "round-robin",
              "label": "Round robin: send the next batch of spans to the next replica in turn and spreads each trace evenly",
              "why": "The exporter does not round-robin batches: it hashes a routing key to choose the replica, so the same key always goes to the same one. Spreading batches evenly would split traces."
            },
            {
              "key": "default-key",
              "label": "Unset works: the exporter already hashes the trace ID for traces, and keeps the spans on one replica anyway",
              "why": "If no routing key is configured, the default for traces is <code>traceID</code>. Spans with the same trace ID go to the same backend, which is what tail-based sampling needs."
            },
            {
              "key": "hash-trace",
              "label": "A hash of the trace identifier picks the replica and the spans making up a trace always meet at a shared place",
              "why": "A trace ID is shared by every span of the trace, so hashing it sends all of them to the same replica. The exporter does not look at the load of the replicas, but the spread stays close to even."
            },
            {
              "key": "metric-key",
              "label": "<code>routing_key: metric</code> groups spans by metric name, so a trace breaks up and a name gets a replica of its own",
              "why": "That key routes metrics by metric name and is invalid for spans. Traces are routed by trace ID."
            },
            {
              "key": "span-id",
              "label": "The span ID is unique and every trace is scattered perfectly over the replicas however many exist",
              "why": "Every span has its own span ID, so each span is sent to a replica of its own choosing, and a trace's spans are scattered. The key has to be the one every span of a trace shares."
            },
            {
              "key": "sending-node",
              "label": "The node that sent the span and an agent uses the same gateway replica for whichever trace those spans belong to",
              "why": "A trace crosses services that run on different nodes, so its spans reach the gateway from several agents and would land on different replicas."
            },
            {
              "key": "session-affinity",
              "label": "Sticky sessions with <code>sessionAffinity: ClientIP</code> keep a sender on one replica regardless of any trace involved",
              "why": "It keeps each client address on one replica. The spans of a trace come from several clients, so they still reach different replicas."
            }
          ]
        }
      }
    ]
  }
};
