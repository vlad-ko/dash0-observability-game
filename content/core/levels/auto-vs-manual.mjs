// Text of levels/auto-vs-manual.mjs (docs/CONTENT.md).
// Sort labels must not give the bucket away: the rule is in levels/auto-vs-manual.mjs and test/sort-tells.test.mjs.
export default {
  "id": "auto-vs-manual",
  "name": "Auto vs manual",
  "sub": "What the agent covers",
  "rewardTitle": "Hands-on instrumenter",
  "play": {
    "finish": "You know what zero-code instrumentation covers, and that a second setup can double some spans. Run one and add business spans through the API.",
    "steps": [
      {
        "intro": "Cart runs with zero-code instrumentation, so it already emits spans. Some of what you want to see in them comes with that, and some only your own code can add.",
        "question": "Pick an item, then say whether it comes automatically or needs your code.",
        "sort": {
          "id": "avm-sort",
          "buckets": [
            {
              "id": "auto",
              "label": "Automatic"
            },
            {
              "id": "manual",
              "label": "Manual"
            }
          ],
          "items": [
            {
              "id": "server",
              "label": "The HTTP SERVER spans, one per <code>express</code> route",
              "why": "The HTTP server instrumentation starts a span for every request that reaches an Express route, with no code of yours.",
              "whyNot": {
                "manual": "Nothing here needs your own code: the instrumentation sees each Express request arrive and starts the span itself."
              }
            },
            {
              "id": "loyalty",
              "label": "INTERNAL spans around <code>applyLoyaltyDiscount()</code> calls",
              "why": "Instrumentation knows nothing about your business functions. You start that span yourself with the API. Its span kind defaults to INTERNAL, though instrumentation libraries may emit INTERNAL spans too.",
              "whyNot": {
                "auto": "No library has heard of <code>applyLoyaltyDiscount()</code>. It is your own function, so nothing wraps it unless you do."
              }
            },
            {
              "id": "redis",
              "label": "A span for each Redis command",
              "why": "The Redis instrumentation wraps the client and starts a span for each command.",
              "whyNot": {
                "manual": "You never call a tracer for Redis. The instrumentation wraps the client and does it."
              }
            },
            {
              "id": "coupon",
              "label": "<code>app.coupon.code</code> on the checkout span",
              "why": "Only your code knows which coupon the customer used, so you set that attribute on the span yourself.",
              "whyNot": {
                "auto": "A library cannot see which coupon the customer used. Only your code holds that value."
              }
            },
            {
              "id": "client",
              "label": "Outgoing <code>fetch</code> CLIENT spans",
              "why": "The HTTP client instrumentation starts a CLIENT span for each outgoing call, with no code of yours.",
              "whyNot": {
                "manual": "Your code only calls <code>fetch</code>. The HTTP client instrumentation starts the CLIENT span around it."
              }
            },
            {
              "id": "item-count",
              "label": "<code>app.cart.item_count</code>",
              "why": "That is a business number only your code can read, so you add it as an attribute yourself.",
              "whyNot": {
                "auto": "A library cannot see your cart. The count is a business value, so your code has to read it and set it."
              }
            }
          ]
        }
      },
      {
        "intro": "Now cart's traces look wrong: each outgoing <code>fetch</code> call shows two CLIENT spans. The operator injects <code>NODE_OPTIONS=--require @opentelemetry/auto-instrumentations-node/register</code> into the pod, and cart's own <code>tracing.js</code> starts a NodeSDK with <code>getNodeAutoInstrumentations()</code>.",
        "question": "Why does each fetch call show two CLIENT spans?",
        "choice": {
          "id": "avm-why",
          "choices": [
            {
              "key": "retries",
              "label": "Cart retries every <code>fetch</code> call once, and each attempt is recorded as its own span",
              "why": "A retry would show two spans with different start times, and cart does not retry. Here each call has a twin, and the twins start together."
            },
            {
              "key": "two-setups",
              "label": "Two setups: the injected agent and <code>tracing.js</code> each instrument fetch",
              "why": "The operator's <code>NODE_OPTIONS</code> loads the auto-instrumentation agent, and <code>tracing.js</code> starts a second NodeSDK with the same instrumentations. Fetch instrumentation subscribes to a diagnostics channel, so a second setup subscribes again, and in this scenario each call gets a CLIENT span from each setup."
            },
            {
              "key": "collector",
              "label": "The Collector copies each span on its way to Dash0, and its <code>otlp_grpc</code> exporter sends both copies",
              "why": "A Collector forwards the spans it receives. Both copies were already in what cart exported."
            }
          ]
        }
      },
      {
        "intro": "Cart still needs spans for <code>applyLoyaltyDiscount()</code> and the coupon, which no agent can add for you.",
        "question": "What is the fix?",
        "choice": {
          "id": "avm-fix",
          "choices": [
            {
              "key": "sample",
              "label": "Sample 50% of traces, to keep fewer duplicate spans",
              "why": "Sampling drops whole traces. In the traces you keep, each fetch call still has two CLIENT spans."
            },
            {
              "key": "keep-one",
              "label": "Keep one setup and add the business spans through the API",
              "why": "Run the agent or your own SDK, not both. Then add spans such as <code>applyLoyaltyDiscount()</code> and attributes such as <code>app.coupon.code</code> with the API, which the one setup exports."
            },
            {
              "key": "dedupe",
              "label": "Dedupe the twin spans in the Collector",
              "why": "That hides the symptom and keeps both setups running, with twice the instrumentation work in every cart request."
            }
          ]
        }
      }
    ]
  }
};
