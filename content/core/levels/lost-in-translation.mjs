// Text of levels/lost-in-translation.mjs (docs/CONTENT.md).
// The spot lines follow the format set in the Step 2 comment of levels/lost-in-translation.mjs.
export default {
  "id": "lost-in-translation",
  "name": "Lost in translation",
  "sub": "Does that answer hold?",
  "rewardTitle": "Delta decoder",
  "play": {
    "finish": "You did not take the \"nothing changes\" on trust: with the preference at delta, counters and histograms export the change since the last report, UpDownCounters stay running totals and a gauge has no temporality. A service that did not change the setting still sends cumulative, so ask which instrument and which service before you say what arrives.",
    "steps": [
      {
        "intro": "On a call, a customer asks: \"We set <code>OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta</code> on two of our services. Does that change what our Prometheus-style backend receives?\" The presenter answers: \"No. Delta only changes how the SDK keeps its state inside. Nothing changes downstream.\"",
        "question": "Does the presenter's answer hold?",
        "choice": {
          "id": "lit-verdict",
          "choices": [
            {
              "key": "all-delta",
              "label": "Metrics are now delta, UpDownCounters and gauges included",
              "why": "Not every instrument turns delta. UpDownCounters stay cumulative, and a gauge has no temporality, so it is not converted either."
            },
            {
              "key": "holds",
              "label": "Delta changes how the SDK keeps state, not its output",
              "why": "The setting changes what the SDK exports, not only what it keeps. A delta point is the change since the last report, and a cumulative-only backend cannot store it as it is."
            },
            {
              "key": "wrong",
              "label": "Counters and histograms now come through as delta points",
              "why": "With the preference set to delta, Counter, [[Asynchronous Counter|asynchronous-instrument]] and Histogram instruments export delta, and UpDownCounter and Asynchronous UpDownCounter instruments stay cumulative. A backend that stores cumulative totals cannot use the delta ones as they are."
            }
          ]
        }
      },
      {
        "intro": "Only <b>orders</b> and <b>checkout</b> changed the preference to delta. <b>payments</b> did not. A debug view lists seven series with the instrument that makes each, and the backend stores cumulative totals only. The board uses SDK class names: ObservableCounter, ObservableUpDownCounter and ObservableGauge are the spec's Asynchronous Counter, Asynchronous UpDownCounter and Asynchronous Gauge. With the preference at delta, Counter, ObservableCounter and Histogram export delta; UpDownCounter and ObservableUpDownCounter stay cumulative; a gauge has no temporality.",
        "question": "Spot the series that now arrive as delta.",
        "spot": {
          "id": "lit-spot",
          "lines": [
            {
              "id": "queue-depth",
              "text": "queue_depth{instrument=\"ObservableGauge\", service=\"orders\"}"
            },
            {
              "id": "orders-placed",
              "text": "orders_placed{instrument=\"Counter\", service=\"orders\"}"
            },
            {
              "id": "payments-declined",
              "text": "payments_declined{instrument=\"Counter\", service=\"payments\"}"
            },
            {
              "id": "cpu-time",
              "text": "cpu_time_seconds{instrument=\"ObservableCounter\", service=\"orders\"}"
            },
            {
              "id": "orders-in-flight",
              "text": "orders_in_flight{instrument=\"UpDownCounter\", service=\"orders\"}"
            },
            {
              "id": "db-pool",
              "text": "db_pool_connections{instrument=\"ObservableUpDownCounter\", service=\"checkout\"}"
            },
            {
              "id": "checkout-duration",
              "text": "checkout_duration_seconds{instrument=\"Histogram\", service=\"checkout\"}"
            }
          ],
          "whyNot": {
            "orders-in-flight": "An UpDownCounter stays cumulative even when the preference is delta, so this one arrives as a running total.",
            "db-pool": "An Asynchronous UpDownCounter stays cumulative with the delta preference, like its synchronous twin.",
            "queue-depth": "A gauge has no aggregation temporality: each point is the last sampled value, so there is nothing to translate.",
            "payments-declined": "A Counter, but payments did not change its preference. The default is cumulative, so this series still arrives as a running total."
          },
          "explain": "Those three arrive as delta: the Counter and the Histogram are synchronous instruments the delta preference turns, and so is the Asynchronous Counter, the one that is easy to miss (the LowMemory value would have kept it cumulative). The UpDownCounters stay cumulative and the gauge has no temporality. Payments is a Counter too, but it did not change its preference. The OpenTelemetry mapping to Prometheus lets a delta sum be converted to cumulative, or not, and the remote write exporter in the Collector contrib at v0.164.0 drops non-cumulative monotonic sums and histograms. How to convert the delta series for a cumulative-only backend, for example with a Collector processor, is not part of this level."
        }
      }
    ]
  }
};
