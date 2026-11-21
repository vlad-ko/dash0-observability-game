// Text of levels/edge-of-the-platform.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
// The step 1 labels are of one length and each names its own mechanism: the rule is in the Step 1 comment of levels/edge-of-the-platform.mjs.
export default {
  "id": "edge-of-the-platform",
  "name": "Edge of the platform",
  "sub": "Before the function freezes",
  "rewardTitle": "Flush keeper",
  "play": {
    "finish": "A function can be suspended before a timer fires, so a handler on such a platform exports its spans itself: ForceFlush on the tracer provider before it returns, not a shorter delay, and not Shutdown, which a provider gets once. A consumer span that handles a batch links to the creation context of each message it accounts for.",
    "steps": [
      {
        "intro": "Kettle &amp; Co's order function runs on a serverless platform, with a batch span processor. In the trace backend, almost no span from the function ever shows up. Each request takes {{handler-ms}} ms, and the platform suspends the environment right after the handler returns, as some FaaS platforms do. A later request may land on the same environment.",
        "question": "Which change gets the spans of every request out?",
        "show": "<table><caption>One request, in time</caption><thead><tr><th scope=\"col\">Time</th><th scope=\"col\">What happens</th></tr></thead><tbody><tr><td>0 ms</td><td>The request arrives; the first span starts</td></tr><tr><td>{{handler-ms}} ms</td><td>The handler returns; the platform suspends the environment</td></tr><tr><td>{{delay-ms}} ms</td><td>The default delay of the batch span processor</td></tr></tbody></table>",
        "choice": {
          "id": "eop-fix",
          "choices": [
            {
              "key": "lower-delay",
              "label": "Set <code>OTEL_BSP_SCHEDULE_DELAY</code> to {{lower-ms}} ms in the function's environment",
              "why": "A shorter delay is still a timer. The invocation takes {{handler-ms}} ms and the root span ends as the handler returns, so the timer cannot fire before the last span exists, and from then on the environment is suspended. {{lower-ms}} ms is longer than the whole invocation, and no value of the delay changes the order: span ends, handler returns, environment suspended, timer due. (This is reasoning from the numbers, not a quote.)"
            },
            {
              "key": "shutdown",
              "label": "Call <code>Shutdown</code> on the tracer provider at the end of each request",
              "why": "Shutdown does export what is pending (a SpanProcessor's Shutdown \"MUST include the effects of ForceFlush\"), but the SDK spec says it \"MUST be called only once for each TracerProvider instance\" and that after it \"subsequent attempts to get a Tracer are not allowed\". The same environment serves the next request, and a shut-down provider can no longer give it a tracer. (The last part is reasoning from the scenario, not a quote.)"
            },
            {
              "key": "force-flush",
              "label": "Call <code>ForceFlush</code> on the tracer provider before each handler returns",
              "why": "ForceFlush on the provider exports every span that has not been exported yet, so the spans are out before the handler returns and before the platform suspends the environment, and the provider stays usable for the next request. The SDK spec names this case: ForceFlush \"SHOULD only be called in cases where it is absolutely necessary, such as when using some FaaS providers that may suspend the process after an invocation, but before the SpanProcessor exports the completed spans\". Without it the batch processor waits for its {{delay-ms}} ms delay (the default) or a full batch."
            }
          ]
        }
      },
      {
        "intro": "The spans arrive now. At {{start}} ms the platform hands the worker a batch of three messages, and <code>orders process</code> handles all three in one invocation. Each message was published by a different request. The worker's span starts a trace of its own.",
        "question": "Connect <code>orders process</code> to the messages of this batch, and only those.",
        "show": "<table><caption>Messages in this batch</caption><thead><tr><th scope=\"col\">Message</th><th scope=\"col\">In trace</th></tr></thead><tbody>{{message-rows}}</tbody></table>",
        "build": {
          "id": "eop-batch"
        }
      }
    ]
  }
};
