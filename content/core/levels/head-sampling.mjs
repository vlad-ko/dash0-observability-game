// Text of levels/head-sampling.mjs (docs/CONTENT.md).
export default {
  "id": "head-sampling",
  "name": "Head sampling",
  "sub": "Decide at the root",
  "rewardTitle": "Root decider",
  "play": {
    "finish": "You know head sampling decides once, at the root, and that every other service must follow the parent's sampled flag (ParentBased): a child that decides on its own leaves traces with holes. It cannot keep the errors, because it never sees the whole trace.",
    "steps": [
      {
        "intro": "<p>Kettle &amp; Co's checkout makes {{traces}} traces a second through three services: <code>storefront</code> is the root, then <code>checkout</code> and <code>payments</code>. A trace is {{whole}} spans ({{s-storefront}} in storefront, {{s-checkout}} in checkout, {{s-payments}} in payments), so keeping everything is {{traces}} × {{whole}} = {{full}} spans a second, and the backend takes {{cap}} spans a second.</p><p>Head sampling decides when the root span starts, from the trace ID and a ratio, and passes the decision to the children in the sampled flag of the <code>traceparent</code> header.</p><p>Storefront is already set to <code>{{sampler}}=parentbased_traceidratio</code> and <code>{{arg}}=0.1</code>: {{ten}} traces a second, {{storefront}} spans, which leaves {{kids-cap}} of the {{cap}} for checkout and payments.</p><p>The numbers on this page are worked out from these figures. The game does not run a real sampler.</p>",
        "question": "Pick the sampler setting of checkout and of payments: keep what the team needs and stay within the budget.",
        "tradeoff": {
          "id": "hs-plan",
          "unit": "spans/s",
          "hint": "The decision is made once, at the root, and the sampled flag travels to the children. Ask what each setting makes a child do with a trace whose root was dropped, and how many spans a second that is.",
          "knobs": [
            {
              "id": "checkout",
              "label": "The sampler setting of <code>checkout</code>",
              "options": [
                {
                  "id": "always-on",
                  "label": "<code>{{sampler}}=always_on</code>, so every trace is sampled: {{traces}} × {{s-checkout}} = {{all-checkout}}"
                },
                {
                  "id": "ratio-5pct",
                  "label": "<code>{{sampler}}=traceidratio</code> and <code>{{arg}}=0.05</code>: {{r05-traces}} traces/s × {{s-checkout}} = {{r05-spans}}"
                },
                {
                  "id": "ratio",
                  "label": "<code>{{sampler}}=traceidratio</code> and <code>{{arg}}=0.25</code>: {{r25-traces}} traces/s × {{s-checkout}} = {{r25-spans}}"
                },
                {
                  "id": "follow",
                  "label": "The default, <code>{{sampler}}=parentbased_always_on</code>: {{ten}} traces/s × {{s-checkout}} = {{ten-checkout}}"
                },
                {
                  "id": "always-off",
                  "label": "<code>{{sampler}}=always_off</code>: no spans"
                }
              ]
            },
            {
              "id": "payments",
              "label": "The sampler setting of <code>payments</code>",
              "options": [
                {
                  "id": "follow",
                  "label": "The default, <code>{{sampler}}=parentbased_always_on</code>: {{ten}} traces/s × {{s-payments}} = {{ten-payments}}"
                },
                {
                  "id": "ratio",
                  "label": "<code>{{sampler}}=traceidratio</code> and <code>{{arg}}=0.5</code>: {{r50-traces}} traces/s × {{s-payments}} = {{r50-spans}}"
                },
                {
                  "id": "always-on",
                  "label": "<code>{{sampler}}=always_on</code>, so every trace is sampled: {{traces}} × {{s-payments}} = {{all-payments}}"
                }
              ]
            }
          ],
          "needs": [
            {
              "id": "checkout-whole",
              "label": "every kept trace has its checkout spans"
            }
          ],
          "whyNot": {
            "checkout:always-on": "Storefront drops {{dropped}} of every {{traces}} traces a second at the root, and checkout, set to <code>always_on</code>, ignores that and samples its spans anyway: {{all-checkout}} spans a second against the {{ten-checkout}} of the traces the root kept, and {{dropped-checkout}} of them belong to traces whose root is gone.",
            "checkout:ratio": "A plain <code>traceidratio</code> must ignore the parent's sampled flag, and a higher ratio samples every trace a lower one does, so checkout keeps the root's {{ten}} traces a second and {{orphan25}} more whose root was dropped: {{r25-spans}} spans, {{orphan25-spans}} of them with no root above them.",
            "checkout:ratio-5pct": "A plain <code>traceidratio</code> must ignore the parent's sampled flag, and a lower ratio samples only some of the traces a higher one does, so checkout at {{r05-traces}} traces a second keeps only half of the root's {{ten}}: {{r05-spans}} spans, and the other half of the root's traces have no checkout spans.",
            "checkout:always-off": "It records nothing, so checkout has no spans in the traces the root kept, and every one of them has a hole where checkout should be.",
            "payments:ratio": "A plain <code>traceidratio</code> must ignore the parent's sampled flag, and a higher ratio samples every trace a lower one does, so payments keeps the root's {{ten}} traces a second and {{orphan50}} more whose root was dropped: {{r50-spans}} spans, {{orphan50-spans}} of them with no root above them.",
            "payments:always-on": "Payments, set to <code>always_on</code>, samples every trace's spans whatever the root decided: {{all-payments}} spans a second against the {{ten-payments}} of the traces the root kept, and {{dropped-payments}} of them belong to traces whose root is gone."
          },
          "explain": "Storefront keeps {{ten}} of {{traces}} traces a second, {{storefront}} spans, and checkout and payments follow it. The default, <code>{{sampler}}=parentbased_always_on</code>, is ParentBased: for a span with a parent it uses the parent's sampled flag, which travels in the <code>traceparent</code> header, so a trace is kept whole or not at all. A ratio on a child would never run under ParentBased, because the ratio belongs to the root sampler, which is used only for a span with no parent. These figures are worked out from the numbers in the lesson, not run by an engine. What head sampling cannot do is look at the trace: it decides at the root, before any error or slow request has happened, so it keeps 1 in 10 of the failures too. Keeping the errors is the job of tail sampling, next."
        }
      },
      {
        "intro": "A teammate sets <code>OTEL_TRACES_SAMPLER=always_on</code> on checkout and payments \"so we never lose a span\", and leaves storefront on <code>parentbased_traceidratio</code>. Now checkout and payments spans turn up in the backend with no storefront span above them.",
        "question": "Why do the traces have holes?",
        "choice": {
          "id": "hs-why",
          "choices": [
            {
              "key": "header-lost",
              "label": "Setting a sampler on a service stops it propagating <code>traceparent</code> to its callees, so the children cannot see the root's decision",
              "why": "The sampler decides whether a span is recorded and exported, and propagation is separate: the sampled flag still travels in <code>traceparent</code> to the children. The children saw the root's decision and did not use it."
            },
            {
              "key": "own-decision",
              "label": "A child set to <code>always_on</code> ignores the parent's sampled flag and samples its spans anyway, so it keeps spans of traces whose root was dropped",
              "why": "Only ParentBased uses the parent's decision: for a span with a parent it follows the sampled flag in <code>traceparent</code>, so a trace is kept whole or not at all. <code>always_on</code> ignores the flag and records every span, so checkout and payments keep spans of traces whose root was dropped, and those traces have holes."
            },
            {
              "key": "ratio-stacks",
              "label": "Each service applies its own ratio on top of the root's, so the chances multiply and the children keep too little",
              "why": "Ratios do not multiply. Under ParentBased the ratio belongs to the root sampler, which never runs for a span that has a parent, so a child follows the flag. A child set to <code>always_on</code> keeps too much, not too little."
            }
          ]
        }
      }
    ]
  }
};
