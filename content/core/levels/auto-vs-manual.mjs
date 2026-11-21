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
              "label": "<code>express.js</code> request handler run times",
              "why": "The HTTP server instrumentation starts a span for every request that reaches an Express route, with no code of yours.",
              "whyNot": {
                "manual": "Nothing here needs your own code: the instrumentation sees each Express request arrive and starts the span itself."
              }
            },
            {
              "id": "loyalty",
              "label": "<code>applyLoyaltyDiscount()</code> loyalty spans",
              "why": "Instrumentation knows nothing about your business functions. You start that span yourself with the API. Its span kind defaults to INTERNAL, though instrumentation libraries may emit INTERNAL spans too.",
              "whyNot": {
                "auto": "No library has heard of <code>applyLoyaltyDiscount()</code>. It is your own function, so nothing wraps it unless you do."
              }
            },
            {
              "id": "redis",
              "label": "<code>redis</code> command round trip timing data",
              "why": "The Redis instrumentation wraps the client and starts a span for each command.",
              "whyNot": {
                "manual": "You never call a tracer for Redis. The instrumentation wraps the client and does it."
              }
            },
            {
              "id": "coupon",
              "label": "<code>app.coupon.code</code> attribute for orders",
              "why": "Only your code knows which coupon the customer used, so you set that attribute on the span yourself.",
              "whyNot": {
                "auto": "A library cannot see which coupon the customer used. Only your code holds that value."
              }
            },
            {
              "id": "client",
              "label": "<code>fetch</code> outgoing calls latency to cart",
              "why": "The HTTP client instrumentation starts a CLIENT span for each outgoing call, with no code of yours.",
              "whyNot": {
                "manual": "Your code only calls <code>fetch</code>. The HTTP client instrumentation starts the CLIENT span around it."
              }
            },
            {
              "id": "item-count",
              "label": "<code>app.cart.item_count</code> number in basket",
              "why": "That is a business number only your code can read, so you add it as an attribute yourself.",
              "whyNot": {
                "auto": "A library cannot see your cart. The count is a business value, so your code has to read it and set it."
              }
            },
            {
              "id": "postgres",
              "label": "<code>pg</code> postgresql query processing steps",
              "why": "The <code>pg</code> instrumentation creates a span whenever your code calls <code>client.query()</code>, so you write no tracing code for it.",
              "whyNot": {
                "manual": "You never call a tracer around a query. The <code>pg</code> instrumentation starts the span when your code calls <code>client.query()</code>."
              }
            },
            {
              "id": "coupon-event",
              "label": "<code>addEvent</code> rejected promo code message",
              "why": "A span event is added with <code>span.addEvent()</code>, and only your code knows the moment a coupon is rejected.",
              "whyNot": {
                "auto": "No library knows your coupon rules. Only your code can tell when a coupon is rejected and add the event."
              }
            },
            {
              "id": "kafka",
              "label": "<code>kafkajs</code> producer topic message spans",
              "why": "The <code>kafkajs</code> instrumentation starts a PRODUCER span each time a producer sends a message, named after the topic.",
              "whyNot": {
                "manual": "Your code only calls <code>send</code>. The <code>kafkajs</code> instrumentation starts the PRODUCER span around it."
              }
            },
            {
              "id": "orders-counter",
              "label": "<code>orders_placed</code> running total per hour",
              "why": "A counter comes from the meter through <code>createCounter()</code>, and your code adds to it each time an order is placed.",
              "whyNot": {
                "auto": "Instrumentation does not know what an order is. Your code has to create the counter and add to it."
              }
            },
            {
              "id": "pino",
              "label": "<code>pino</code> log record trace context fields",
              "why": "The <code>pino</code> instrumentation injects the trace context into every pino log record, with no change to your logging calls.",
              "whyNot": {
                "manual": "Your code only writes the log line. The <code>pino</code> instrumentation adds the trace context to the record."
              }
            },
            {
              "id": "basket-histogram",
              "label": "<code>basket_value</code> distribution of amounts",
              "why": "A histogram is created through the meter, and your code records each value into it. Only your code knows what a basket is worth.",
              "whyNot": {
                "auto": "Instrumentation cannot see the value of a basket. Your code has to create the histogram and record each value."
              }
            },
            {
              "id": "runtime",
              "label": "<code>node.js</code> event loop lag and heap size",
              "why": "The Node.js runtime instrumentation exposes event loop delay and heap use as metrics, with no code of yours.",
              "whyNot": {
                "manual": "Nothing in your code reads the event loop or the heap. The runtime instrumentation reports them itself."
              }
            },
            {
              "id": "job-link",
              "label": "<code>links</code> back to the job that queued it",
              "why": "A link is passed when the span is created, in the <code>links</code> option, with the context of the other span.",
              "whyNot": {
                "auto": "Instrumentation cannot tell which earlier span caused this work. Your code holds that context and passes it in as a link."
              }
            },
            {
              "id": "mongodb",
              "label": "<code>mongodb</code> collection names for actions",
              "why": "The MongoDB instrumentation creates a span for the commands your code runs and sets <code>db.collection.name</code> on it.",
              "whyNot": {
                "manual": "Your code only calls the driver. The MongoDB instrumentation starts the span and sets the collection name."
              }
            },
            {
              "id": "payment-error",
              "label": "<code>recordException</code> card failures caught",
              "why": "Recording an exception is a call on the span, made in your own <code>catch</code> block. The docs suggest setting the span status as well.",
              "whyNot": {
                "auto": "That call sits in your own <code>catch</code> block. Nothing makes it for you, so your code has to record the error."
              }
            },
            {
              "id": "s3",
              "label": "<code>aws</code> sdk operation service attributes",
              "why": "The AWS SDK instrumentation sets <code>rpc.service</code> and <code>rpc.method</code> on the span, for example S3 and <code>PutObject</code>.",
              "whyNot": {
                "manual": "Your code only calls the SDK client. The AWS SDK instrumentation adds the service and method to the span."
              }
            },
            {
              "id": "open-baskets",
              "label": "<code>baskets_open</code> level rising or falling",
              "why": "An up-down counter can go up and down. Your code adds 1 when a basket opens and -1 when it closes.",
              "whyNot": {
                "auto": "Instrumentation does not know what a basket is. Your code has to create the counter and add and subtract."
              }
            },
            {
              "id": "graphql",
              "label": "<code>graphql</code> resolver invocation duration",
              "why": "By default, the GraphQL instrumentation creates a span for each invocation of a resolver, with no code of yours.",
              "whyNot": {
                "manual": "Your resolvers are plain functions. The GraphQL instrumentation starts a span around each one that runs."
              }
            },
            {
              "id": "declined-status",
              "label": "<code>setStatus</code> declined payments as error",
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
              "label": "Cart retries every outgoing request once and keeps both attempts, so each call gets a second span",
              "why": "A retry would show two spans with different start times, and cart does not retry. Here each call has a twin, and the twins start together."
            },
            {
              "key": "two-setups",
              "label": "The injected agent and the SDK of the app both instrument the fetch calls that cart makes, so each call gets a second span",
              "why": "The operator's <code>NODE_OPTIONS</code> loads the auto-instrumentation agent, and <code>tracing.js</code> starts a second NodeSDK with the same instrumentations. Fetch instrumentation subscribes to a diagnostics channel, so a second setup subscribes again, and in this scenario each call gets a CLIENT span from each setup."
            },
            {
              "key": "collector",
              "label": "The Collector copies the telemetry received on its way to Dash0, so each call gets a second span",
              "why": "A Collector forwards the spans it receives. Both copies were already in what cart exported."
            },
            {
              "key": "agent-and-sdk",
              "label": "<code>NODE_OPTIONS</code> loads one tracer, a startup script loads another tracer, so each call gets a second span",
              "why": "The operator loads the agent through <code>NODE_OPTIONS</code> and <code>tracing.js</code> starts a NodeSDK of its own. Each has the fetch instrumentation, and in this scenario each call gets a CLIENT span from both."
            },
            {
              "key": "server-twin",
              "label": "The downstream service sends a SERVER span that the display shows with the CLIENT kind, so each call gets a second span",
              "why": "A CLIENT span is the outgoing side of a call and a SERVER span is the incoming side, and they are different kinds. Each call would show one of each, not two CLIENT spans."
            },
            {
              "key": "two-fetch-hooks",
              "label": "Cart is hooked twice on each request, so each call gets a second span",
              "why": "Fetch instrumentation subscribes to a diagnostics channel, so loading it a second time subscribes a second time. In this scenario that is what the two setups do, and each call gets two CLIENT spans."
            },
            {
              "key": "express-out",
              "label": "The Express instrumentation traces outgoing requests and incoming ones, so each call gets a second span",
              "why": "The Express instrumentation covers the app's routers, middleware and request handlers, which are on the incoming side. The instrumentation for undici and fetch traces the outgoing call."
            },
            {
              "key": "traceparent-twice",
              "label": "The <code>traceparent</code> header is sent twice and the receiver starts a new trace, so each call gets a second span",
              "why": "Propagation moves the trace ID and span ID in a header so the receiving service can continue the trace. It makes no span, and the receiver's span is usually a SERVER span."
            },
            {
              "key": "baggage-spans",
              "label": "Each <code>baggage</code> entry that cart sets is exported on its own, so each call gets a second span",
              "why": "Baggage is a key-value store that travels beside the context. It carries data and not spans."
            },
            {
              "key": "span-event",
              "label": "Every call adds an event, which the backend turns into one more call, so each call gets a second span",
              "why": "A span event is an annotation at one point in time on a span. It is part of that span and is not a span of its own."
            },
            {
              "key": "span-link",
              "label": "A link joins each call to the one before, so each call gets a second span",
              "why": "A link associates one span with another to show cause. It points at a span and does not create one."
            },
            {
              "key": "sampler-twice",
              "label": "The sampler exports everything kept twice, so each call gets a second span",
              "why": "Sampling decides which traces or spans are processed and exported. It removes data and does not add spans."
            },
            {
              "key": "resource-detectors",
              "label": "Each resource detector adds an entry for the host or pod found, so each call gets a second span",
              "why": "A resource describes the entity that produces the telemetry, as attributes. The detectors fill in those attributes and make no spans."
            },
            {
              "key": "metric-recording",
              "label": "A request duration metric turns each recording into a new item, so each call gets a second span",
              "why": "A metric is a measurement captured at runtime, a signal apart from traces. A recording is a metric event and not a span."
            },
            {
              "key": "log-lines",
              "label": "Each log line cart writes about a call is exported as another row, so each call gets a second span",
              "why": "A log is a timestamped text record and a signal of its own. It can carry the trace context to be correlated with a span, and it does not become one."
            },
            {
              "key": "batch-split",
              "label": "The <code>batch</code> processor in the Collector splits each message when a batch fills up, so each call gets a second span",
              "why": "The batch processor places the spans it receives into batches, so they compress better and need fewer connections. The spans in a batch were already made by cart."
            },
            {
              "key": "tracing-repeats-agent",
              "label": "The operator and some code each trace the traffic to services, so each call gets a second span",
              "why": "The agent the operator injects and the NodeSDK in <code>tracing.js</code> both switch on the Node.js auto-instrumentations. Run twice, the fetch instrumentation traces each call twice."
            },
            {
              "key": "request-response",
              "label": "One CLIENT kind covers the request and another covers the response, so each call gets a second span",
              "why": "A CLIENT span represents one synchronous outgoing remote call, such as an HTTP request."
            },
            {
              "key": "incoming-client",
              "label": "The incoming request to cart is also logged outgoing, so each call gets a second span",
              "why": "An incoming call is a SERVER span, and a CLIENT span is for an outgoing call. Cart's incoming requests are not its outgoing fetch calls."
            },
            {
              "key": "fetch-twice",
              "label": "Cart code calls <code>fetch</code> twice for every request, so each call gets a second span",
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
              "label": "Keep one setup in cart, then add the business spans with the API",
              "why": "Run the agent or your own SDK, not both. Then add spans such as <code>applyLoyaltyDiscount()</code> and attributes such as <code>app.coupon.code</code> with the API, which the one setup exports."
            },
            {
              "key": "dedupe",
              "label": "Dedupe the twin spans in the Collector, then add the business spans with the API",
              "why": "That hides the symptom and keeps both setups running, with twice the instrumentation work in every cart request."
            },
            {
              "key": "disable-fetch",
              "label": "Switch the <code>fetch</code> instrumentation off in every setup, then add the business spans with the API",
              "why": "That removes the twins by removing the CLIENT spans as well. An instrumentation can be switched off by name, but cart still needs to see its outgoing calls."
            },
            {
              "key": "agent-only",
              "label": "Run only the agent that the operator injects in the pod, with none of the other tracers running, then add the business spans with the API",
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
              "label": "Choose the agent or the SDK to use and never both, then add the business spans with the API",
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
              "key": "otlp-http",
              "label": "Switch the OTLP exporter of the agent from <code>gRPC</code> to HTTP, then add the business spans with the API",
              "why": "The OTLP protocol decides how spans are sent, not how many are made. Both setups would still make them."
            },
            {
              "key": "drop-second-sdk",
              "label": "Drop the <code>NodeSDK</code> from the startup script for a single setup, then add the business spans with the API",
              "why": "With the second NodeSDK gone, only the agent instruments fetch, so each call has one CLIENT span. The business spans and attributes come from the API, and the agent's setup exports them."
            },
            {
              "key": "service-name",
              "label": "Give each setup its own service name, then add the business spans with the API",
              "why": "A service name labels the telemetry a setup sends. Two names would let you tell the twins apart, and each call would still have two CLIENT spans."
            },
            {
              "key": "detectors-none",
              "label": "Set the resource detectors variable to none in the agent, then add the business spans with the API",
              "why": "That variable chooses which resource detectors run, and the detectors fill in resource attributes. It does not change which libraries are instrumented."
            },
            {
              "key": "propagator",
              "label": "Use another format for the trace context headers of each setup, then add the business spans with the API",
              "why": "The propagation format decides which headers carry the trace context between services. It does not decide how many spans a call makes."
            },
            {
              "key": "more-instrumentations",
              "label": "Turn on more instrumentations in the agent to cover your own functions, then add the business spans with the API",
              "why": "Zero-code instrumentation covers the libraries you use, not your own code, so no setting makes the agent trace your own functions."
            },
            {
              "key": "wrap-fetch",
              "label": "Wrap each fetch call of the agent in a CLIENT span of your own, then add the business spans with the API",
              "why": "A third span adds to the twins and does not remove them. Both setups would still make theirs."
            },
            {
              "key": "other-backend",
              "label": "Use a backend that does not double spans, then add the business spans with the API",
              "why": "The two spans are made in cart's process, before anything is exported, so a backend does not decide how many exist."
            },
            {
              "key": "more-memory",
              "label": "Give cart more memory and CPU for the agent to keep up, then add the business spans with the API",
              "why": "The spans double because two setups each instrument fetch, and more memory or CPU changes neither of them."
            },
            {
              "key": "log-level",
              "label": "Set the log level to <code>debug</code> in the injected setup, then add the business spans with the API",
              "why": "<code>OTEL_LOG_LEVEL</code> sets how much the SDK logs. It does not turn a setup off."
            }
          ]
        }
      }
    ]
  }
};
