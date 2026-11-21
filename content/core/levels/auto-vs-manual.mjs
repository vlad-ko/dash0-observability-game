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
            },
            {
              "id": "postgres",
              "label": "A span per <code>client.query()</code> call",
              "why": "The <code>pg</code> instrumentation creates a span whenever your code calls <code>client.query()</code>, so you write no tracing code for it.",
              "whyNot": {
                "manual": "You never call a tracer around a query. The <code>pg</code> instrumentation starts the span when your code calls <code>client.query()</code>."
              }
            },
            {
              "id": "coupon-event",
              "label": "<code>span.addEvent()</code> for each coupon that is rejected",
              "why": "A span event is added with <code>span.addEvent()</code>, and only your code knows the moment a coupon is rejected.",
              "whyNot": {
                "auto": "No library knows your coupon rules. Only your code can tell when a coupon is rejected and add the event."
              }
            },
            {
              "id": "kafka",
              "label": "PRODUCER spans on messages that kafkajs sends",
              "why": "The <code>kafkajs</code> instrumentation starts a PRODUCER span each time a producer sends a message, named after the topic.",
              "whyNot": {
                "manual": "Your code only calls <code>send</code>. The <code>kafkajs</code> instrumentation starts the PRODUCER span around it."
              }
            },
            {
              "id": "orders-counter",
              "label": "An <code>orders_placed</code> counter",
              "why": "A counter comes from the meter through <code>createCounter()</code>, and your code adds to it each time an order is placed.",
              "whyNot": {
                "auto": "Instrumentation does not know what an order is. Your code has to create the counter and add to it."
              }
            },
            {
              "id": "pino",
              "label": "The <code>trace_id</code> on each pino log line",
              "why": "The <code>pino</code> instrumentation injects the trace context, such as <code>trace_id</code>, into every pino log record, with no change to your logging calls.",
              "whyNot": {
                "manual": "Your code only writes the log line. The <code>pino</code> instrumentation adds the trace context to the record."
              }
            },
            {
              "id": "basket-histogram",
              "label": "A <code>histogram</code> of every basket value",
              "why": "A histogram is created through the meter, and your code records each value into it. Only your code knows what a basket is worth.",
              "whyNot": {
                "auto": "Instrumentation cannot see the value of a basket. Your code has to create the histogram and record each value."
              }
            },
            {
              "id": "runtime",
              "label": "Event loop delay and heap use of the Node.js process",
              "why": "The Node.js runtime instrumentation exposes event loop delay and heap use as metrics, with no code of yours.",
              "whyNot": {
                "manual": "Nothing in your code reads the event loop or the heap. The runtime instrumentation reports them itself."
              }
            },
            {
              "id": "job-link",
              "label": "A <code>link</code> from the CONSUMER span to the one that queued it",
              "why": "A link is passed when the span is created, in the <code>links</code> option, with the context of the other span.",
              "whyNot": {
                "auto": "Instrumentation cannot tell which earlier span caused this work. Your code holds that context and passes it in as a link."
              }
            },
            {
              "id": "mongodb",
              "label": "<code>db.collection.name</code> on every MongoDB command span",
              "why": "The MongoDB instrumentation creates a span for the commands your code runs and sets <code>db.collection.name</code> on it.",
              "whyNot": {
                "manual": "Your code only calls the driver. The MongoDB instrumentation starts the span and sets the collection name."
              }
            },
            {
              "id": "payment-error",
              "label": "A caught payment error, noted on a span with <code>recordException</code>",
              "why": "Recording an exception is a call on the span, made in your own <code>catch</code> block. The docs suggest setting the span status as well.",
              "whyNot": {
                "auto": "That call sits in your own <code>catch</code> block. Nothing makes it for you, so your code has to record the error."
              }
            },
            {
              "id": "s3",
              "label": "A <code>PutObject</code> call to S3 through the AWS SDK gets its own span",
              "why": "The AWS SDK instrumentation sets <code>rpc.service</code> and <code>rpc.method</code> on the span, for example S3 and <code>PutObject</code>.",
              "whyNot": {
                "manual": "Your code only calls the SDK client. The AWS SDK instrumentation adds the service and method to the span."
              }
            },
            {
              "id": "open-baskets",
              "label": "Baskets open now, going up and down",
              "why": "An up-down counter can go up and down. Your code adds 1 when a basket opens and -1 when it closes.",
              "whyNot": {
                "auto": "Instrumentation does not know what a basket is. Your code has to create the counter and add and subtract."
              }
            },
            {
              "id": "graphql",
              "label": "Each GraphQL resolver gets a span",
              "why": "By default, the GraphQL instrumentation creates a span for each invocation of a resolver, with no code of yours.",
              "whyNot": {
                "manual": "Your resolvers are plain functions. The GraphQL instrumentation starts a span around each one that runs."
              }
            },
            {
              "id": "declined-status",
              "label": "An ERROR status set on a span for a declined card",
              "why": "A span's status is set through the span at any time before it ends, and by default it is Unset. Only your code knows a declined card is a failure.",
              "whyNot": {
                "auto": "A declined card is a business outcome, and the status stays Unset unless something sets Error. Your code has to decide that."
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
              "label": "Cart retries every fetch call once, and each attempt is its own span",
              "why": "A retry would show two spans with different start times, and cart does not retry. Here each call has a twin, and the twins start together."
            },
            {
              "key": "two-setups",
              "label": "The injected agent and <code>tracing.js</code> each make a CLIENT span for every fetch call",
              "why": "The operator's <code>NODE_OPTIONS</code> loads the auto-instrumentation agent, and <code>tracing.js</code> starts a second NodeSDK with the same instrumentations. Fetch instrumentation subscribes to a diagnostics channel, so a second setup subscribes again, and in this scenario each call gets a CLIENT span from each setup."
            },
            {
              "key": "collector",
              "label": "The Collector copies each span on its way to Dash0, and its <code>otlp_grpc</code> exporter sends both copies",
              "why": "A Collector forwards the spans it receives. Both copies were already in what cart exported."
            },
            {
              "key": "agent-and-sdk",
              "label": "The operator and cart's own code both switch telemetry on, giving each fetch call two CLIENT spans",
              "why": "The operator loads the agent through <code>NODE_OPTIONS</code> and <code>tracing.js</code> starts a NodeSDK of its own. Each registers the fetch instrumentation, and in this scenario each call gets a CLIENT span from both."
            },
            {
              "key": "server-twin",
              "label": "The downstream service's SERVER span for a fetch call is drawn as a second CLIENT span",
              "why": "A CLIENT span is the outgoing side of a call and a SERVER span is the incoming side, and they are different kinds. Each call would show one of each, not two CLIENT spans."
            },
            {
              "key": "two-fetch-hooks",
              "label": "The fetch instrumentation is registered twice, and every registration starts its own span",
              "why": "Fetch instrumentation subscribes to a diagnostics channel, so loading it a second time subscribes a second time. In this scenario that is what the two setups do, and each call gets two CLIENT spans."
            },
            {
              "key": "express-out",
              "label": "The Express instrumentation traces cart's outgoing fetch calls too, and starts a span for each",
              "why": "The Express instrumentation covers the app's routers, middleware and request handlers, which are on the incoming side. The instrumentation for undici and fetch traces the outgoing call."
            },
            {
              "key": "traceparent-twice",
              "label": "The <code>traceparent</code> header of a fetch call is sent twice, and the receiver starts a second span",
              "why": "Propagation moves the trace ID and span ID in a header so the receiving service can continue the trace. It makes no span, and the receiver's span is usually a SERVER span."
            },
            {
              "key": "http-and-undici",
              "label": "The <code>http</code> and <code>undici</code> instrumentations both start a span for each fetch call",
              "why": "The HTTP instrumentation covers the http and https modules, and the undici instrumentation covers undici and the global fetch. A fetch call goes through undici, so one of them traces it, and a second CLIENT span needs a second registration of that one."
            },
            {
              "key": "exporters-both",
              "label": "The SDK exports every span over gRPC and over HTTP because both exporter variables are set",
              "why": "An exporter sends each span once, over the protocol it is set to, and <code>OTEL_EXPORTER_OTLP_PROTOCOL</code> names one protocol. Two exports of one span would carry the same span ID, and the twins here are two CLIENT spans."
            },
            {
              "key": "two-replicas",
              "label": "Cart runs as two replicas, and each replica starts a span for the fetch call",
              "why": "One call is handled by one replica, and each replica makes its spans in its own process. The twins here belong to a single call."
            },
            {
              "key": "diagnostics-twice",
              "label": "The diagnostics channel publishes every fetch twice, and even one setup starts two spans",
              "why": "Fetch instrumentation subscribes to a diagnostics channel and starts a span when a message arrives. A call publishes one message to each subscriber, so a second span needs a second subscriber."
            },
            {
              "key": "two-service-names",
              "label": "The agent and <code>tracing.js</code> use different service names, and a fetch span is stored under both",
              "why": "A span carries one resource, so it belongs to one service. Two service names would not make one span appear twice."
            },
            {
              "key": "manual-wrap",
              "label": "Cart wraps each fetch in a CLIENT span of its own, and the instrumentation adds another span",
              "why": "The scenario names only the operator's injected agent and the NodeSDK in <code>tracing.js</code>, and each registers the fetch instrumentation. Nothing in it wraps <code>fetch</code> by hand."
            },
            {
              "key": "proxy-span",
              "label": "A proxy between cart and the downstream service adds its own span for each fetch call",
              "why": "A proxy that is instrumented reports its spans in its own telemetry. The two CLIENT spans in question both come from cart's call."
            },
            {
              "key": "two-processors",
              "label": "Two span processors, a batch and a simple one, are both set, so each fetch span is exported twice",
              "why": "A span processor hands each finished span to the exporter once. Two exports of one span would carry the same span ID, and the twins here are two CLIENT spans."
            },
            {
              "key": "tracing-repeats-agent",
              "label": "A second layer of setup runs in cart, and both start a span per fetch",
              "why": "The agent the operator injects and the NodeSDK in <code>tracing.js</code> both switch on the Node.js auto-instrumentations. Run twice, the fetch instrumentation traces each call twice."
            },
            {
              "key": "request-response",
              "label": "One CLIENT span covers the fetch request and a second span covers the response",
              "why": "A CLIENT span represents one synchronous outgoing remote call, such as an HTTP request."
            },
            {
              "key": "incoming-client",
              "label": "Cart's own incoming request is also recorded as a CLIENT span next to the fetch span",
              "why": "An incoming call is a SERVER span, and a CLIENT span is for an outgoing call. Cart's incoming requests are not its outgoing fetch calls."
            },
            {
              "key": "fetch-twice",
              "label": "Cart's code calls fetch twice for every request, so each call has its own span",
              "why": "Then there would be two fetch calls with one span each. The question is about one call that has two spans."
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
              "label": "Sample 50% of traces and keep fewer duplicates, then add the business spans with the API",
              "why": "Sampling drops whole traces. In the traces you keep, each fetch call still has two CLIENT spans."
            },
            {
              "key": "keep-one",
              "label": "Keep one setup, then add the business spans with the API",
              "why": "Run the agent or your own SDK, not both. Then add spans such as <code>applyLoyaltyDiscount()</code> and attributes such as <code>app.coupon.code</code> with the API, which the one setup exports."
            },
            {
              "key": "dedupe",
              "label": "Dedupe the agent's twin spans in the Collector, then add the business spans with the API",
              "why": "That hides the symptom and keeps both setups running, with twice the instrumentation work in every cart request."
            },
            {
              "key": "disable-fetch",
              "label": "Switch the <code>fetch</code> instrumentation off in every setup, then add the business spans with the API",
              "why": "That removes the twins by removing the CLIENT spans as well. An instrumentation can be switched off by name, but cart still needs to see its outgoing calls."
            },
            {
              "key": "agent-only",
              "label": "Leave only the agent injected in the pod, with nothing else running in cart, then add the business spans with the API",
              "why": "One setup means one CLIENT span for each call. The API calls add the business spans, which the one setup exports."
            },
            {
              "key": "hand-write-all",
              "label": "Remove both setups and write every span by hand with the API, business spans included",
              "why": "Zero-code instrumentation covers the libraries you use, such as HTTP clients and databases, so removing it means writing all of those spans by hand. The cause was two setups, not having one."
            },
            {
              "key": "tail-sample",
              "label": "Tail-sample in the Collector and keep only slow traces, then add the business spans with the API",
              "why": "Sampling chooses which traces are exported and which are not. In the traces it keeps, each fetch call still has two CLIENT spans."
            },
            {
              "key": "either-not-both",
              "label": "Choose the agent or the SDK and never run both of them, then add the business spans with the API",
              "why": "Run the agent or your own SDK, not both. The spans for <code>applyLoyaltyDiscount()</code> and the coupon come from the API, and the one setup exports them."
            },
            {
              "key": "filter-client",
              "label": "Drop every CLIENT span in the Collector with a filter processor, then add the business spans with the API",
              "why": "The filter processor can drop spans, and dropping every CLIENT span loses the outgoing calls you wanted to see. Both setups would still be running."
            },
            {
              "key": "kind-internal",
              "label": "Make the spans of one setup INTERNAL, then add the business spans with the API",
              "why": "Span kind says how a span relates to others, and an INTERNAL span is one that does not cross a process boundary. Relabelling a span leaves both setups running."
            },
            {
              "key": "remove-exporter",
              "label": "Remove the OTLP exporter from the second setup, then add the business spans with the API",
              "why": "The exporter only sends spans. Both setups still register the fetch instrumentation, so each call still has two CLIENT spans."
            },
            {
              "key": "drop-second-sdk",
              "label": "Remove the <code>NodeSDK</code> setup from <code>tracing.js</code>, then add the business spans with the API",
              "why": "With the second NodeSDK gone, only the agent instruments fetch, so each call has one CLIENT span. The business spans and attributes come from the API, and the agent's setup exports them."
            },
            {
              "key": "service-name",
              "label": "Give each setup its own service name, then add the business spans with the API",
              "why": "A service name labels the telemetry a setup sends. Two names would let you tell the twins apart, and each call would still have two CLIENT spans."
            },
            {
              "key": "disable-http",
              "label": "Disable the <code>http</code> module tracing in <code>tracing.js</code>, then add the business spans with the API",
              "why": "The HTTP instrumentation covers the http and https modules. Fetch goes through undici, whose instrumentation is separate, so both setups still trace each call."
            },
            {
              "key": "load-order",
              "label": "Load <code>tracing.js</code> before the agent, then add the business spans with the API",
              "why": "Which one loads first does not matter here: both still register the fetch instrumentation, so each call gets a CLIENT span from each."
            },
            {
              "key": "enabled-undici",
              "label": "Set <code>OTEL_NODE_ENABLED_INSTRUMENTATIONS=undici</code> in the agent, then add the business spans with the API",
              "why": "That variable picks which instrumentations the agent loads. Keeping only undici in the agent leaves the fetch instrumentation in both setups."
            },
            {
              "key": "wrap-fetch",
              "label": "Wrap each of cart's fetch calls in a CLIENT span of your own, then add the business spans with the API",
              "why": "A third span adds to the twins and does not remove them. Both setups would still make theirs."
            },
            {
              "key": "to-collector",
              "label": "Send the agent's spans through a gateway instead of straight to Dash0, then add the business spans with the API",
              "why": "Where the spans are sent does not change how many cart makes: both are made in its process before anything is exported."
            },
            {
              "key": "require-parent",
              "label": "Set <code>requireParentforSpans</code> on the undici instrumentation, then add the business spans with the API",
              "why": "That option only requires a parent span before a span is created for an outgoing request. Both setups still start one for each call."
            },
            {
              "key": "upgrade",
              "label": "Upgrade the packages to their latest versions, then add the business spans with the API",
              "why": "The twins come from two registrations of the same instrumentation, and a newer version of it does not remove one of them."
            }
          ]
        }
      }
    ]
  }
};
