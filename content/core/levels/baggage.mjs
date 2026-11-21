// Text of levels/baggage.mjs (docs/CONTENT.md).
// A run(ctx) level: levels/baggage.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). Sort labels must not give the bucket away: the rule is in levels/baggage.mjs (Step 1) and test/sort-tells.test.mjs.
export default {
  "id": "baggage",
  "name": "Baggage",
  "sub": "What travels with the request",
  "rewardTitle": "Light packer",
  "run": {
    "sortIntro": "[[Baggage]] is a set of key/value pairs that travels with a request's [[context]], from service to service. Storefront wants to put a few entries in it so services further down can use them.",
    "sortQuestion": "Pick an entry, then say whether it belongs in baggage.",
    "sort": {
      "id": "bag-sort",
      "buckets": [
        {
          "id": "ok",
          "label": "Fine in baggage"
        },
        {
          "id": "never",
          "label": "Never in baggage"
        }
      ],
      "items": [
        {
          "id": "variant",
          "label": "<code>experiment.variant=redesign-B</code>",
          "why": "An experiment arm is no secret, and every service on the path can use it, for example to tag its own spans with the variant.",
          "whyNot": {
            "never": "An experiment arm identifies nobody and grants no access, so there is nothing to keep out of a header."
          }
        },
        {
          "id": "email",
          "label": "<code>user.email=ana@example.com</code>",
          "why": "An email address identifies a person. Baggage goes out in a plain <code>baggage</code> header to every downstream, third-party APIs included, and anyone inspecting the traffic can read it.",
          "whyNot": {
            "ok": "Think about where the header travels. Every downstream service gets it, and a third-party API could log or keep the address."
          }
        },
        {
          "id": "tier",
          "label": "<code>tenant.tier=gold</code>",
          "why": "A coarse tier says nothing about one person, and downstream services can use it, for example to route or prioritise.",
          "whyNot": {
            "never": "A coarse tier identifies nobody and grants nothing, so there is no harm in sending it on."
          }
        },
        {
          "id": "token",
          "label": "<code>session.token=eyJhbGciOiJIUzI1NiJ9</code>",
          "why": "A session token is a credential. Anyone who reads the <code>baggage</code> header, a third party included, could reuse it.",
          "whyNot": {
            "ok": "Think about who reads the header. Any service that sees it, a third party too, could present the token as its own."
          }
        },
        {
          "id": "last4",
          "label": "<code>card.last4=4242</code>",
          "why": "Even part of a card number is payment data. Baggage can be passed on outside your network by downstream services, so keep it out.",
          "whyNot": {
            "ok": "Four digits of a card are still payment data, and the header can travel beyond your own services."
          }
        }
      ]
    },
    "sortReason": "Sort every item to continue.",
    "onSpansIntro": "Storefront puts <code>tenant.tier=gold</code> in baggage, and the request goes on to recommendations, which runs the usual SDK setup with automatic instrumentation.",
    "onSpansQuestion": "Do recommendations' spans carry <code>tenant.tier</code> from baggage?",
    "onSpans": [
      {
        "key": "yes-auto",
        "label": "Yes: every span in the trace gets baggage as attributes",
        "why": "Baggage travels with the context, but nothing puts it on spans by default. Read the entry and set it as an attribute yourself, or add a baggage span processor."
      },
      {
        "key": "root-only",
        "label": "Only storefront's spans, where it was set",
        "why": "No span gets it by default, not even in storefront. Baggage is a separate key/value store from span attributes until something copies one into the other."
      },
      {
        "key": "only-if-copied",
        "label": "No, only if something copies it, such as a baggage span processor",
        "why": "Baggage is a separate key/value store. An entry reaches span attributes only when your code reads it and sets it, or a baggage span processor copies it as each span starts."
      }
    ],
    "onSpansReason": "Pick the right answer to finish the level.",
    "finish": "You keep personal data and secrets out of baggage, and you know it reaches spans only when something copies it."
  }
};
