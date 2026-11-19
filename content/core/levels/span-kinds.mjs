// Text of levels/span-kinds.mjs (docs/CONTENT.md). {{watch}}, {{expected}}, {{hourly}}, {{per-min}}, {{refund-one-in}} and the {{rate-...}} names are figures from the level's VARS table.
// A run(ctx) level: levels/span-kinds.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). The slots {{service}}, {{count}}, {{rate}}, {{edges}}, {{start}}, {{end}}, {{parent}} and {{name}} are values of the view and the spans, filled by the code. A fill-in value is bounded at 80 characters in the word check, so the verdict on a wrong flag is two entries (flagWrongHead, flagWrongTail) with the span's own explanation (flagWhy) between them, and the finance sentence is written in both alert texts.
export default {
  "id": "span-kinds",
  "name": "Span kinds",
  "sub": "Which side of the call?",
  "rewardTitle": "Map maker",
  "run": {
    "huntIntro": "You're on call. The payments alert below says payments handled far fewer requests than usual, yet finance says the card provider billed a charge for every checkout. Payments did the work, so the view is miscounting it. The view counts a service's requests from its SERVER spans and draws service edges from span kinds. Open the spans, compare each span's kind with what it does, and flag the span recorded with the wrong kind. Opening a span is free; a wrong flag costs one penalty.",
    "alertEyebrowFiring": "Firing",
    "alertEyebrowResolved": "Resolved",
    "alertTitle": "{{service}}: {{count}} requests/min",
    "alertTitleNoData": "{{service}}: no data requests/min",
    "alertFiringText": "By this view's count, {{service}} handled {{count}} requests/min over the last 60 minutes, below the {{expected}} it usually handles. Finance: the card provider billed {{hourly}} charges in the same hour, one for every checkout. Payments did the work, so the count is wrong, not the service.",
    "alertResolvedText": "By this view's count, {{service}} is back at the {{expected}} requests/min it usually handles. Finance: the card provider billed {{hourly}} charges in the same hour, one for every checkout. The count now matches the work.",
    "viewChip": "Simulated Dash0 view",
    "viewNote": "This simulated view counts a service's requests from its SERVER spans. Each trace stands for a flow at its own rate: checkouts at {{per-min}} a minute, refunds at one in {{refund-one-in}} of those. It draws an edge from a CLIENT span to its SERVER child in another service. Backends can derive both from span kind.",
    "ratesValue": "{{rate}} requests/min",
    "edgesLine": "Map edges: {{edges}}.",
    "edgesNone": "none",
    "huntBoardTitle": "Open the spans",
    "huntSpanTimes": "{{start}} to {{end}} ms",
    "huntSpanUnder": "under {{parent}}",
    "huntDetailNote": "Open a span to see its fields. Flag the span whose kind makes the view miscount payments. A wrong flag rules that span out and costs one penalty.",
    "huntSideTitle": "Find the culprit",
    "huntReason": "Flag the span behind the alert to continue.",
    "huntRuleCosts": "a wrong flag, a hint",
    "huntRuleFree": "Opening a span is free.",
    "huntWrongOne": "wrong flag",
    "huntWrongMany": "wrong flags",
    "hints": [
      "A span with an <code>http.route</code> is serving a request. Which spans carry one?",
      "Check the kind of each span that has a route. A span that serves a call should be SERVER, whether its caller is in this trace or outside it. Does one of them have the wrong kind?",
      "Flag <code>POST /charge</code> in payments: it has a route and sits under checkout's CLIENT span, but it is INTERNAL."
    ],
    "sidebarFlag": "Flag this span",
    "sidebarRuledOut": "Ruled out",
    "sidebarFlagged": "Flagged",
    "sidebarHuntOver": "Hunt over",
    "sidebarService": "Service",
    "sidebarKind": "Kind",
    "sidebarStatus": "Status",
    "sidebarParent": "Parent",
    "sidebarNoParent": "none (root)",
    "sidebarTraceId": "Trace ID",
    "sidebarAttrCaption": "Attributes",
    "sidebarAttrName": "Attribute",
    "sidebarAttrValue": "Value",
    "sidebarNoAttrs": "No attributes.",
    "flagWrongHead": "Not quite. <strong>{{name}}</strong> ({{service}}) is not the cause.",
    "flagWrongTail": "That counts as one penalty.",
    "flagWhy": [
      {
        "id": "4f8a2c6e0b3d7915",
        "why": "Work inside payments, not a call between services, so INTERNAL is the right kind."
      },
      {
        "id": "8e2b6f0a4c9d1357",
        "why": "It handles an incoming request and is recorded SERVER, so payments counts it. A webhook started it, not this checkout, so no edge is expected."
      },
      {
        "id": "9c8b7a6f5e4d3c2b",
        "why": "It handles the incoming request and is recorded SERVER, so storefront is counted correctly. The alert is about payments."
      },
      {
        "id": "1a2b3c4d5e6f7a8b",
        "why": "It is the caller's side of the call into checkout, recorded CLIENT, and it pairs with checkout's SERVER span."
      },
      {
        "id": "3a7f5c9e1b2d4f60",
        "why": "It handles storefront's call and is recorded SERVER, so checkout is counted and the storefront to checkout edge draws."
      },
      {
        "id": "e8b14d2c6a9f0357",
        "why": "Work inside checkout, not a call between services, so INTERNAL is the right kind."
      },
      {
        "id": "6c2d8e0f4a1b3957",
        "why": "It is checkout's call out to payments, recorded CLIENT, which is right for the caller."
      },
      {
        "id": "0d9e7c5b3a1f8264",
        "why": "It is payments' call out to the card provider, recorded CLIENT, which is right. The provider sends no spans of its own, so no edge is expected there."
      }
    ],
    "flagRight": "Right. <strong>{{name}}</strong> handles checkout's call. It was recorded INTERNAL, so nothing counts it as a request {{service}} handled, and nothing pairs it with checkout's CLIENT span.",
    "huntWinTitle": "Culprit found",
    "fixIntro": "Checkout calls payments, so the map should draw checkout → payments, and payments should be back at its usual rate. Each option shows payments' rate after the change; the map shows once you pick.",
    "fixQuestion": "Which change fixes the alert and the map?",
    "fix": [
      {
        "key": "server",
        "label": "Set <code>POST /charge</code> to SERVER<br>Preview: {{watch}} {{rate-server}} requests/min.",
        "why": "SERVER marks the span that handles an incoming call, and spans are INTERNAL unless the code gives a kind, which <code>POST /charge</code> never did. With SERVER the view counts the request payments handled and pairs the span with checkout's CLIENT span, so the edge draws."
      },
      {
        "key": "provider",
        "label": "Set <code>POST provider/charges</code> to SERVER<br>Preview: {{watch}} {{rate-provider}} requests/min.",
        "why": "That clears the alert but fixes the wrong span. It is payments' own call out to the card provider, a CLIENT call, and its parent is a payments span, so it pairs with nothing and the checkout → payments edge stays missing. With that change the map edges would be: {{edges}}."
      },
      {
        "key": "client",
        "label": "Set <code>POST /charge</code> to CLIENT<br>Preview: {{watch}} {{rate-client}} requests/min.",
        "why": "CLIENT marks the caller's side, but payments receives this call. The alert still fires, and an edge needs a CLIENT span with a SERVER child, so none draws. With that change the map edges would be: {{edges}}."
      },
      {
        "key": "rename",
        "label": "Rename <code>POST /charge</code> to <code>payments.charge</code><br>Preview: {{watch}} {{rate-rename}} requests/min.",
        "why": "The view reads the kind, not the name. Renamed, the span is still INTERNAL and nothing changes. With that change the map edges would be: {{edges}}."
      }
    ],
    "fixReason": "Pick the fix to finish the level.",
    "finish": "POST /charge now says it handles the call: the view counts payments' requests and draws the checkout → payments edge. Backends can derive both from span kind."
  }
};
