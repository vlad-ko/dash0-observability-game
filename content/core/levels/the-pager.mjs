// Text of levels/the-pager.mjs (docs/CONTENT.md). {{step-pct}} is a figure from the level's VARS table; {{label}} is a slot the code fills with a look's label.
// A run(ctx) level: levels/the-pager.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). A reply is what the code calls an answer: "answer" is a logic-only key, so the content says "reply" and the code maps it back. The made-up figures and the sources behind each reply are noted in levels/the-pager.mjs.
export default {
  "id": "the-pager",
  "name": "The pager",
  "sub": "An alert with no context",
  "rewardTitle": "First page",
  "run": {
    "intro": "Your pager goes off. Try the four questions below: you will find you cannot answer them, because nothing sends [[telemetry]] yet. Each try burns error budget. Press Escalate when you give up. If the budget runs out first, the pager escalates for you.",
    "alert": "PAGE: checkout p95 > 2 s (firing)",
    "meterLabel": "Error budget",
    "meterUnit": "percent spent",
    "spentLabel": "Spent on:",
    "spentChip": "{{label}} {{step-pct}} percent",
    "startEscalateButton": "Escalate",
    "startEscalateReason": "Try one question first.",
    "looks": [
      {
        "key": "service",
        "label": "Which service?",
        "reason": "No data. No service sends telemetry yet, so nothing says which one is slow."
      },
      {
        "key": "since",
        "label": "Since when?",
        "reason": "No data. The alert only says it is firing now; nothing was recorded before it."
      },
      {
        "key": "customers",
        "label": "Which customers?",
        "reason": "No data. Requests carry no customer details, so there is nothing to slice by."
      },
      {
        "key": "trace",
        "label": "Show me a trace",
        "reason": "No data. No service records traces, so there is no request to follow."
      }
    ],
    "litIntro": "Same alert, now with telemetry. Ask the same four questions. The data is made up, for illustration. Ask all four to finish.",
    "budgetSpent": "Budget spent: 100 of 100 percent. The last look found no data either, so the pager escalated for you.",
    "asks": [
      {
        "key": "service",
        "label": "Which service?",
        "reply": "payment-api. Its p95 is 4.1 s; cart and storefront stay under 0.3 s."
      },
      {
        "key": "since",
        "label": "Since when?",
        "reply": "Since 14:02, when p95 jumped from 0.2 s to 4.1 s. payment-api v2.31 started at 14:02."
      },
      {
        "key": "customers",
        "label": "Which customers?",
        "reply": "Orders paid with payment.provider=acme-pay. Other providers stay fast."
      },
      {
        "key": "trace",
        "label": "Show me a trace",
        "reply": "Trace 4bf92f3577b34da6a3ce929d0e0e4736: checkout took 4.2 s, 3.9 s of it in payment-api POST /charge."
      }
    ],
    "askReason": "Ask every question to finish.",
    "reward": "Blind, you could not answer one question. With telemetry, all four took seconds. Time to instrument."
  }
};
