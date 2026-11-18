// Text of levels/distributions.mjs (docs/CONTENT.md).
// The sort items' `whyNot` follow the rule in the Step 2 comment of levels/distributions.mjs.
export default {
  "id": "distributions",
  "name": "Distributions",
  "sub": "What ships where",
  "rewardTitle": "Distro whisperer",
  "play": {
    "finish": "You know a Collector can only run what is compiled into it: check the manifest, and when no distribution has your component, build your own with OCB.",
    "steps": [
      {
        "intro": "The project publishes pre-built Collector <b>distributions</b>: core, contrib, k8s, otlp and one for eBPF profiling. A distribution is a fixed set of components compiled into one binary, listed in its <code>manifest.yaml</code>. The platform team copied a config that uses <code>k8sattributes</code> from a cluster running contrib and deployed it on a laptop with the core distribution.",
        "question": "What happens?",
        "choice": {
          "id": "dist-unknown",
          "choices": [
            {
              "key": "ignored",
              "label": "It starts, and the pipeline that lists <code>k8sattributes</code> just passes the data through unchanged",
              "why": "The Collector checks every component id in the config against the components compiled into the binary. A component it does not have is an error, not something to skip."
            },
            {
              "key": "refuses-to-start",
              "label": "The Collector refuses to start with an unknown type error: <code>k8sattributes</code> is not compiled into the core distribution",
              "why": "A distribution is a set of components compiled into one binary. <code>k8sattributes</code> is in the contrib and k8s distributions, not in core, so the core binary has no processor of that type and the config is rejected at startup."
            },
            {
              "key": "loads-on-demand",
              "label": "It starts, and downloads the processor from the contrib repository the first time a pipeline needs it",
              "why": "The Collector does not fetch components at run time. Everything it can run is compiled in, so a missing one means a different distribution or a custom build."
            }
          ]
        }
      },
      {
        "intro": "Not every component is in every distribution. The Distributions row on a component's page, and the manifests, say where it ships. Sort these into the pre-built distributions that ship them. (The core list has grown over time, so the manifest is the thing to read, not a copy.)",
        "question": "Which distributions ship each component?",
        "sort": {
          "id": "dist-sort",
          "buckets": [
            {
              "id": "all-three",
              "label": "Core, contrib and k8s"
            },
            {
              "id": "contrib-k8s",
              "label": "Contrib and k8s, not core"
            },
            {
              "id": "contrib-only",
              "label": "Contrib only"
            },
            {
              "id": "none",
              "label": "None of them"
            }
          ],
          "items": [
            {
              "id": "k8sattributes",
              "label": "k8sattributes (processor)",
              "why": "It is in the contrib distribution and in k8s, which is made for running in a cluster, but not core.",
              "whyNot": {
                "all-three": "One of the three does not ship it. Its Distributions row lists only the other two.",
                "contrib-only": "The k8s distribution is for monitoring Kubernetes, and enriching telemetry with pod metadata is what it is for, so it ships it too.",
                "none": "Two of the pre-built distributions ship it, so no custom build is needed."
              }
            },
            {
              "id": "batch",
              "label": "batch (processor)",
              "why": "It is part of the core distribution, so it is in contrib and k8s as well.",
              "whyNot": {
                "contrib-k8s": "A third distribution ships it too, so the pair is not the whole list.",
                "contrib-only": "More than one distribution ships it, so it is not exclusive to a single one.",
                "none": "The pre-built distributions ship it, so no custom build is needed."
              }
            },
            {
              "id": "awss3-exporter",
              "label": "awss3 (exporter)",
              "why": "A vendor exporter: only the contrib distribution ships it.",
              "whyNot": {
                "all-three": "The core distribution has a short exporter list (otlp_grpc, debug, file and a few more), and this is not on it.",
                "contrib-k8s": "The k8s distribution ships a short list of exporters (otlp_grpc, otlp_http, otelarrow, load_balancing, nop, debug and file), so a vendor exporter is not in it.",
                "none": "A pre-built distribution ships it, so it is not a custom build."
              }
            },
            {
              "id": "memory-limiter",
              "label": "memory_limiter (processor)",
              "why": "It is part of the core distribution, so it is in contrib and k8s as well.",
              "whyNot": {
                "contrib-k8s": "A third distribution ships it too, so the pair is not the whole list.",
                "contrib-only": "More than one distribution ships it, so it is not exclusive to a single one.",
                "none": "The pre-built distributions ship it, so no custom build is needed."
              }
            },
            {
              "id": "redaction",
              "label": "redaction (processor)",
              "why": "It is in contrib and k8s, but not core: the processor that masks PII is not in the core distribution.",
              "whyNot": {
                "all-three": "One of the three does not ship it. Its Distributions row lists only the other two.",
                "contrib-only": "The k8s distribution ships it too, so it is not exclusive to a single distribution.",
                "none": "Two of the pre-built distributions ship it, so no custom build is needed."
              }
            },
            {
              "id": "acme-scrubber",
              "label": "acme_scrubber (a processor your team wrote in Go)",
              "why": "No pre-built distribution can contain a component the project has never heard of. To run it, build a distribution with OCB that includes it.",
              "whyNot": {
                "all-three": "The project builds these distributions from its own repositories. A component your team wrote is never part of those builds.",
                "contrib-k8s": "The k8s distribution only includes components from core and contrib, and this is in neither.",
                "contrib-only": "The contrib distribution only includes components from the Collector repositories, and this is in neither."
              }
            },
            {
              "id": "tail-sampling",
              "label": "tail_sampling (processor)",
              "why": "It is in contrib and k8s, but not core.",
              "whyNot": {
                "all-three": "One of the three does not ship it. Its Distributions row lists only the other two.",
                "contrib-only": "The k8s distribution ships it too, so it is not exclusive to a single distribution.",
                "none": "Two of the pre-built distributions ship it, so no custom build is needed."
              }
            },
            {
              "id": "otlp-exporter",
              "label": "otlp_grpc (exporter)",
              "why": "The OTLP exporter is in core, so contrib and k8s have it too (the otlp distribution ships it as well).",
              "whyNot": {
                "contrib-k8s": "A third distribution ships it too, so the pair is not the whole list.",
                "contrib-only": "More than one distribution ships it, so it is not exclusive to a single one.",
                "none": "The pre-built distributions ship it, so no custom build is needed."
              }
            },
            {
              "id": "awsxray-exporter",
              "label": "awsxray (exporter)",
              "why": "A vendor exporter: only the contrib distribution ships it.",
              "whyNot": {
                "all-three": "The core distribution has a short exporter list (otlp_grpc, debug, file and a few more), and this is not on it.",
                "contrib-k8s": "The k8s distribution ships a short list of exporters (otlp_grpc, otlp_http, otelarrow, load_balancing, nop, debug and file), so a vendor exporter is not in it.",
                "none": "A pre-built distribution ships it, so it is not a custom build."
              }
            }
          ]
        }
      },
      {
        "intro": "Your team also wrote <code>acme_scrubber</code>, a processor that masks card numbers, and wants it in the Collector.",
        "question": "How do you get a Collector that contains it?",
        "choice": {
          "id": "dist-build",
          "choices": [
            {
              "key": "contrib-config",
              "label": "Run the contrib distribution and list <code>acme_scrubber</code> in the config: contrib ships every component, and it is already there",
              "why": "The contrib distribution holds the components of the Collector repositories, not every component that exists. A config can only enable what is compiled in, and your processor is not."
            },
            {
              "key": "ocb",
              "label": "Build a custom distribution with OCB, the OpenTelemetry Collector Builder: list your processor in a manifest",
              "why": "ocb takes a manifest that lists the components to include, yours among them, and builds a Collector binary with exactly those. The same tool gives you a smaller binary and a smaller attack surface than contrib, which the contrib README suggests for production."
            },
            {
              "key": "otlp-distro",
              "label": "Use the otlp distribution: it is made for custom processors, and loads them by name at startup",
              "why": "The otlp distribution is a minimal one, with the OTLP receiver and exporters. It has no way to load your processor either: you need a build that compiles it in."
            }
          ]
        }
      }
    ]
  }
};
