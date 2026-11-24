// Text of levels/order-matters.mjs (docs/CONTENT.md).
// The spot lines follow the format set in the Step 1 comment of levels/order-matters.mjs.
export default {
  "id": "order-matters",
  "name": "Order matters",
  "sub": "First and last",
  "rewardTitle": "Order keeper",
  "play": {
    "finish": "You know the order in a pipeline is the processing order, per pipeline: memory_limiter first, drops and context readers before batch, batch late.",
    "steps": [
      {
        "intro": "The [[Collector]] now has a [[pipeline]] for every team. The [[processors]] in a pipeline run in the order they are listed, and every pipeline has its own list. The infra team pasted the same processors into eight of them, and the Collector still runs out of memory on some.",
        "question": "Spot the pipelines whose processors are in the wrong order.",
        "spot": {
          "id": "order-spot",
          "lines": [
            {
              "id": "traces",
              "text": "traces: processors: [memory_limiter, k8s_attributes, transform/redact, batch]"
            },
            {
              "id": "metrics",
              "text": "metrics: processors: [batch, memory_limiter]"
            },
            {
              "id": "logs",
              "text": "logs: processors: [memory_limiter, filter/health-checks, batch]"
            },
            {
              "id": "traces-checkout",
              "text": "traces/checkout: processors: [memory_limiter, transform/redact, batch, k8s_attributes]"
            },
            {
              "id": "logs-audit",
              "text": "logs/audit: processors: [k8s_attributes, memory_limiter, batch]"
            },
            {
              "id": "metrics-infra",
              "text": "metrics/infra: processors: [memory_limiter, batch]"
            },
            {
              "id": "logs-noisy",
              "text": "logs/noisy: processors: [memory_limiter, batch, filter/health-checks]"
            },
            {
              "id": "traces-edge",
              "text": "traces/edge: processors: [memory_limiter]"
            }
          ],
          "whyNot": {
            "traces": "memory_limiter is first, k8s_attributes (which reads the request context) and the transform run before batch, and batch comes last.",
            "logs": "memory_limiter is first, the filter that drops health-check logs runs before batch, so batch only collects what is kept.",
            "metrics-infra": "The same two processors as the faulty metrics pipeline, in the right order for this pipeline: memory_limiter first, batch last.",
            "traces-edge": "memory_limiter is first and there is nothing after it. batch is recommended, not required, and an exporter can batch on its own."
          },
          "explain": "Four pipelines are misordered, and each has its own list: the Collector gives every pipeline its own processor instances, so <code>metrics</code> is wrong while <code>metrics/infra</code> lists the same two processors correctly. In <code>metrics</code> and <code>logs/audit</code>, <code>memory_limiter</code> is not first, so something else handles data before the limiter can refuse it. In <code>traces/checkout</code>, <code>k8s_attributes</code> comes after <code>batch</code>, and batching clears the request context it reads. In <code>logs/noisy</code>, <code>batch</code> comes before the filter, so it batches logs that are discarded straight afterwards."
        }
      },
      {
        "intro": "<code>memory_limiter</code> measures the Collector's memory use and, above its limit, refuses data. The usual advice is to list it first in every pipeline.",
        "question": "Why first?",
        "choice": {
          "id": "order-why",
          "choices": [
            {
              "key": "cleans-data",
              "label": "So it can clean up the data before the other processors see it, and free memory early",
              "why": "The memory limiter does not change telemetry. It checks the Collector's memory use at intervals and, when it is too high, refuses data."
            },
            {
              "key": "refuse-early",
              "label": "So it can refuse data before other processors spend memory on it, and receivers can retry",
              "why": "When memory is over the soft limit, the processor returns a non-permanent error to the component before it, so receivers can retry the data and can apply [[backpressure]] to their senders. The best practice is to make it the first processor in a pipeline, so backpressure reaches the receivers and fewer data are dropped when the limiter triggers."
            },
            {
              "key": "any-position",
              "label": "It does not matter: it only watches memory, and works anywhere in the processor list",
              "why": "It watches memory, but it can only refuse what passes through it. Placed after other processors, those handle and may hold the data first, which makes it likelier that data is dropped when the limiter triggers."
            },
            {
              "key": "backpressure",
              "label": "A refusal reaches the senders as backpressure, so less is lost when the limit is hit",
              "why": "The best practice is to make it the first processor in a pipeline. That way a refusal can reach the receivers, which may apply [[backpressure]] to their own data sources, and fewer data are dropped when the limiter triggers."
            },
            {
              "key": "only-sees",
              "label": "Anything listed before it can already be holding data that the limiter cannot refuse",
              "why": "The limiter refuses data by returning an error to the component before it in the pipeline, so it can only refuse what that component hands it. Processors listed ahead of it handle the data first and may hold on to it."
            },
            {
              "key": "sizes-batches",
              "label": "It sets the batch size for what follows, so downstream steps know their budget in advance",
              "why": "The memory limiter does not configure other processors. It checks the Collector's memory use at intervals and refuses data when the limits are exceeded."
            },
            {
              "key": "gc-each",
              "label": "It forces garbage collection after every processor, which only works if it is first in the list",
              "why": "The limiter checks memory use periodically and forces garbage collection only when usage is above the hard limit. It does not run after each processor."
            },
            {
              "key": "drops-oldest",
              "label": "When space runs short it discards the oldest items before the newest ones arrive",
              "why": "In memory limited mode the processor refuses incoming data by returning errors to the component before it. It does not choose old data to drop."
            },
            {
              "key": "scales-up",
              "label": "Above its soft limit it asks Kubernetes for another replica, so it needs the first slot",
              "why": "The limiter does not scale anything. Above its limits it refuses data, and the receivers retry it."
            }
          ]
        }
      },
      {
        "intro": "The other half of the advice is about <code>batch</code>, which groups telemetry into batches before it is sent.",
        "question": "Where does <code>batch</code> go, and is the processor the only way to batch?",
        "choice": {
          "id": "order-batch",
          "choices": [
            {
              "key": "early",
              "label": "Early in the list, and it groups what the other processors then receive",
              "why": "Batching before the processors that drop or change data batches telemetry that may be discarded or changed straight afterwards. It also clears the request context, which a processor like k8s_attributes reads."
            },
            {
              "key": "late",
              "label": "Late, after the processors that drop, change or enrich data, and the exporter can batch too",
              "why": "Batching helps compress data and reduces the number of outgoing connections, and it belongs after memory_limiter and after anything that drops or changes data, so it never batches what is discarded afterwards. Processors that read the request context, such as k8s_attributes, go before it. The processor docs also say to prefer an exporter's own batching where it has one, for example the <code>batch</code> setting of an exporter's <code>sending_queue</code>, which is off unless you turn it on."
            },
            {
              "key": "removed",
              "label": "Nowhere: the batch processor was removed from the Collector, and exporters do all the batching now",
              "why": "The batch processor is still there: it is part of the core, contrib and Kubernetes [[distributions]]. What changed is the advice to prefer batching in the exporter where the exporter supports it."
            },
            {
              "key": "after-filters",
              "label": "After the filters and transforms, and after <code>k8s_attributes</code>, as batching clears the request context it reads",
              "why": "Processors that rely on the request context, such as k8s_attributes, must run before batching, because batching clears the context. Filtering and transforming come first so the processor batches only data that will be exported."
            },
            {
              "key": "last-in-list",
              "label": "Down at the tail of the list, past sampling and enrichment, so earlier work is never batched in vain",
              "why": "Batching after filtering and transformation means you are not batching data that will be discarded or mutated further. The Collector docs also say to prefer the exporter's batching capabilities when available."
            },
            {
              "key": "ahead-of-limiter",
              "label": "At the very top, ahead of <code>memory_limiter</code>, to let the limiter measure whole batches, not single items",
              "why": "The batch processor should be defined after the memory limiter. The limiter measures the Collector's memory use, not the size of batches, and it works best in first position."
            },
            {
              "key": "exporter-cannot",
              "label": "Anywhere in the list, as no exporter can batch by itself and the processor is the only way to get it",
              "why": "Position matters for the processor. An exporter's sending queue can also batch, and the docs prefer that where the exporter supports it."
            },
            {
              "key": "send-size-max",
              "label": "Late, and <code>send_batch_size</code> is the largest batch it will ever send, whatever the timeout or the data rate says",
              "why": "The position is right, but <code>send_batch_size</code> is only a trigger: a batch is sent when it is reached or at the timeout. The upper limit is <code>send_batch_max_size</code>."
            },
            {
              "key": "shared-instance",
              "label": "In one shared place for every pipeline, because a single instance serves traces, metrics and logs together",
              "why": "When a processor is referenced in several pipelines, each pipeline gets a separate instance of it, and each pipeline has its own list."
            }
          ]
        }
      }
    ]
  }
};
