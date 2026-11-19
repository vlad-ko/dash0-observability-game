// Text of levels/spans-and-traces.mjs (docs/CONTENT.md).
// A run(ctx) level: levels/spans-and-traces.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). {{reason}} in treeReason is a slot: the Build it widget's own reason, filled by the code.
export default {
  "id": "spans-and-traces",
  "name": "Spans and traces",
  "sub": "One request, many spans",
  "rewardTitle": "Trace reader",
  "run": {
    "oneTraceIntro": "A customer pays. The request passes through storefront and api-gateway, and each service records spans for its part of the work: one span per operation.",
    "oneTraceQuestion": "What makes these spans one trace?",
    "oneTrace": [
      {
        "key": "trace-id",
        "label": "They share one trace ID",
        "why": "Every span carries the trace ID of the request it belongs to, and a backend groups the spans that share one. There is nothing else to group by."
      },
      {
        "key": "trace-object",
        "label": "The SDK sends a trace object at the end",
        "why": "There is no trace object. The SDK hands each span on when that span ends, and spans from different services arrive separately."
      }
    ],
    "oneTraceReason": "Pick the right answer to continue.",
    "treeIntro": "The spans of trace <code>4bf92f35</code> reach the backend one by one, as each one ends. The first is already placed. Give each new span its parent as it arrives, so the request reads top to bottom. A trace ID is the request's id: every span of one request carries it, so spans with different trace IDs are never parent and child.",
    "treeQuestion": "Rebuild the request's span tree.",
    "tree": {
      "id": "sat-tree",
      "closing": "<code>GET /products</code> stays a root. The next step asks why."
    },
    "treeReason": "{{reason}} to continue.",
    "otherIntro": "<code>GET /products</code> on storefront ran while api-gateway handled the checkout, yet it stays a root.",
    "otherQuestion": "What is <code>GET /products</code>?",
    "other": [
      {
        "key": "late-child",
        "label": "A child of api-gateway's <code>POST /checkout</code>, because it runs inside that span's time",
        "why": "Running at the same time says nothing about parents. Only a parent ID makes a child, and a parent always shares its child's trace ID."
      },
      {
        "key": "lost-parent",
        "label": "A child of this request whose parent ID was lost",
        "why": "A span that lost its parent ID would still carry this request's trace ID. This one carries a different trace ID."
      },
      {
        "key": "other-request",
        "label": "A span from another request, in a trace of its own",
        "why": "Its trace ID is <code>0af76519</code>, not <code>4bf92f35</code>. It ran at the same time on the same service, but it belongs to another request, so no span of this trace can be its parent."
      }
    ],
    "otherReason": "Pick the right answer to finish the level.",
    "finish": "You can read a trace: its spans share a trace ID, and each one points at its parent."
  }
};
