// Text of levels/context-propagation.mjs (docs/CONTENT.md). {{valid-traceparent}} is a figure from the level's VARS table.
// A run(ctx) level: levels/context-propagation.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). The slots {{from}}, {{to}}, {{header}}, {{name}}, {{service}} and {{trace}} are values of the hop and root data, filled by the code.
export default {
  "id": "context-propagation",
  "name": "Context propagation",
  "sub": "Pass it on",
  "rewardTitle": "Header hunter",
  "run": {
    "whereIntro": "One checkout request went storefront → nginx → checkout, but the backend shows it as two traces. Each hop should pass the trace context on in the <code>traceparent</code> header.",
    "whereHopsTitle": "<p>Headers on each hop:</p>",
    "hopWith": "{{from}} → {{to}}: <code data-token>traceparent: {{header}}</code>",
    "hopWithout": "{{from}} → {{to}}: no <code>traceparent</code> header",
    "whereRootsTitle": "<p>Root spans for the request:</p>",
    "rootLine": "<code>{{name}}</code> on {{service}}, trace <code>{{trace}}</code>, no parent",
    "whereQuestion": "Where did the trace break?",
    "where": [
      {
        "key": "storefront",
        "label": "storefront: it never sent the trace context",
        "why": "storefront did send it: the first hop carries a valid <code>traceparent</code>. The header goes missing after that."
      },
      {
        "key": "proxy",
        "label": "The nginx proxy: it did not forward <code>traceparent</code>",
        "why": "The header reaches nginx and never leaves it. With no <code>traceparent</code> to continue, checkout starts a new trace, so one request shows up as two root spans."
      },
      {
        "key": "checkout",
        "label": "checkout: its SDK ignored a valid header",
        "why": "checkout never saw a header to ignore: the hop from nginx carries no <code>traceparent</code>, so it had to start a new trace."
      }
    ],
    "whereReason": "Pick the right answer to continue.",
    "validIntro": "The fix is one line of nginx config that forwards the header. Before you ship it, check the format: <code>version-traceid-parentid-flags</code>, and a receiver ignores a header that breaks the rules.",
    "validQuestion": "Which traceparent would checkout accept?",
    "valid": [
      {
        "key": "zero-trace",
        "label": "<code data-token>00-00000000000000000000000000000000-00f067aa0ba902b7-01</code>",
        "why": "A trace ID of all zeros is invalid, and a receiver MUST ignore a <code>traceparent</code> with an invalid trace ID."
      },
      {
        "key": "uppercase",
        "label": "<code data-token>00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01</code>",
        "why": "The IDs are lowercase hex. A receiver MUST ignore a parent-id with non-lowercase hex characters."
      },
      {
        "key": "valid",
        "label": "<code data-token>{{valid-traceparent}}</code>",
        "why": "Version <code>00</code>, a 32-digit lowercase hex trace ID, a 16-digit lowercase hex parent-id (the caller's span ID), neither all zeros, and the flags <code>01</code>: sampled."
      },
      {
        "key": "short-parent",
        "label": "<code data-token>00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b-01</code>",
        "why": "The parent-id has 15 hex digits. It must have exactly 16, so a receiver ignores the header."
      }
    ],
    "validReason": "Pick the right answer to continue.",
    "treeIntro": "nginx now forwards <code data-token>traceparent: {{header}}</code>, so checkout's spans join trace <code>4bf92f35</code>. Its SERVER span still shows as a root here: give it the parent that the header's parent-id names.",
    "treeQuestion": "Join checkout to the request.",
    "treeReason": "Solve the board and press Check to finish the level.",
    "finish": "You can follow the trace context from hop to hop, and spot the hop that drops it."
  }
};
