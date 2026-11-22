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
        "intro": "The project publishes pre-built [[Collector]] <b>distributions</b>: core, contrib, k8s, otlp and one for eBPF profiling. A distribution is a fixed set of components compiled into one binary, listed in its <code>manifest.yaml</code>. The platform team copied a config that uses <code>k8sattributes</code> from a [[cluster]] running contrib and deployed it on a laptop with the core distribution.",
        "question": "What happens?",
        "choice": {
          "id": "dist-unknown",
          "choices": [
            {
              "key": "ignored",
              "label": "It starts anyway on core itself, and the pipeline that lists <code>k8sattributes</code> just passes the data through unchanged",
              "why": "The Collector checks every component id in the config against the components compiled into the binary. A component it does not have is an error, not something to skip."
            },
            {
              "key": "refuses-to-start",
              "label": "It refuses to start with an unknown component error, as <code>k8sattributes</code> is never part of core",
              "why": "A distribution is a set of components compiled into one binary. <code>k8sattributes</code> is in the [[contrib]] and k8s distributions and is not compiled into core, so the core binary has no processor of that type. The Collector stops with an unknown type error and the config is rejected at startup."
            },
            {
              "key": "loads-on-demand",
              "label": "It starts normally, and the core distribution downloads <code>k8sattributes</code> from the contrib repository the first time it is needed",
              "why": "The Collector does not fetch components at run time. Everything it can run is compiled in, so a missing one means a different distribution or a custom build."
            },
            {
              "key": "rejected-at-startup",
              "label": "The config is rejected when the Collector starts, since the core binary has no processor of the type <code>k8sattributes</code>",
              "why": "The Collector can only run the components compiled into its binary, and the core manifest does not list <code>k8sattributes</code>. The contrib and k8s manifests do."
            },
            {
              "key": "fails-before-data",
              "label": "It fails to start before any data flows, as the core build holds only what was compiled in and <code>k8sattributes</code> is not among it",
              "why": "A distribution is a fixed set of components in one binary, listed in its <code>manifest.yaml</code>. A config that names a component outside that set cannot be started."
            },
            {
              "key": "drops-data",
              "label": "It starts happily with core alone, so the data of anything using <code>k8sattributes</code> is dropped",
              "why": "The Collector does not start with a component it does not have. The config is rejected, so no pipeline runs and nothing is dropped."
            },
            {
              "key": "core-has-all",
              "label": "It starts, because core ships every processor, <code>k8sattributes</code> included, and only receivers differ",
              "why": "The core manifest does not list <code>k8sattributes</code>, and the contrib and k8s manifests do. The distributions differ in processors too."
            },
            {
              "key": "no-cluster",
              "label": "It cannot start, but only because the laptop has no Kubernetes cluster for <code>k8sattributes</code> in the core build to read",
              "why": "The config fails because the core binary does not contain the processor. It would fail the same way on a machine inside a cluster."
            },
            {
              "key": "reduced-mode",
              "label": "It starts fine on the core build, and <code>k8sattributes</code> runs in a reduced mode that adds nothing",
              "why": "A component is either compiled into the binary or not. There is no reduced mode for a processor the binary does not have."
            }
          ]
        }
      },
      {
        "intro": "Not every component is in every [[distribution]]. The Distributions row on a component's page, and the manifests, say where it ships. Sort these into the pre-built distributions that ship them. (The core list has grown over time, so the manifest is the thing to read, not a copy.)",
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
        "intro": "Your team also wrote <code>acme_scrubber</code>, a [[processor]] that masks card numbers, and wants it in the Collector.",
        "question": "How do you get a Collector that contains it?",
        "choice": {
          "id": "dist-build",
          "choices": [
            {
              "key": "contrib-config",
              "label": "Run the contrib distribution and add your processor to its config, since contrib ships every component already",
              "why": "The contrib distribution holds the components of the Collector repositories, not every component that exists. A config can only enable what is compiled in, and your processor is not."
            },
            {
              "key": "ocb",
              "label": "Run the Collector Builder (OCB) with a manifest that lists your processor as a component to include",
              "why": "ocb, the OpenTelemetry Collector Builder, takes a manifest that lists the components to include, yours among them, and builds a custom Collector binary with exactly those. The same tool gives you a smaller binary and a smaller attack surface than contrib, which the contrib README suggests for production."
            },
            {
              "key": "otlp-distro",
              "label": "Use the otlp distribution (made for custom processors) which loads your processor by name when the Collector boots",
              "why": "The otlp distribution is a minimal one, with the OTLP receiver and exporters. It has no way to load your processor either: you need a build that compiles it in."
            },
            {
              "key": "ocb-manifest",
              "label": "Run OCB with a manifest that lists <code>acme_scrubber</code>, and compile a custom Collector from it",
              "why": "OCB configures a build from a YAML manifest with a <code>dist</code> section and lists of modules by type, such as processors. It needs Go to compile the result."
            },
            {
              "key": "ocb-chosen",
              "label": "Generate a tailored Collector distribution holding only the components you choose, your processor among them, ready for deployment",
              "why": "The builder exists for custom distributions with custom components, upstream components and other publicly available ones."
            },
            {
              "key": "plugin-dir",
              "label": "Put the compiled file of your processor in a plugin directory and point the Collector at it",
              "why": "Everything the Collector can run is compiled in, so a file added later is not something it loads."
            },
            {
              "key": "core-module-path",
              "label": "Run the core distribution and give the Go module path of your processor as the type in the Collector config",
              "why": "A config can only enable what the binary contains. A module path in the config does not download or compile anything."
            },
            {
              "key": "edit-manifest",
              "label": "Take the shipped binary and edit its <code>manifest.yaml</code> to add your processor as a component of the Collector build",
              "why": "The manifest describes what a distribution was built from. It is an input to the build, and changing the text does not change the compiled binary."
            },
            {
              "key": "set-flag",
              "label": "Start the stock Collector with a flag that enables your processor as an extra component",
              "why": "A config can only enable what is compiled in, and a flag does not add a component to a binary."
            }
          ]
        }
      }
    ]
  }
};
