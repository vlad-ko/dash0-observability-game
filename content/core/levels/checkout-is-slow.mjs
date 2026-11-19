// Text of levels/checkout-is-slow.mjs (docs/CONTENT.md). {{...}} names are slots the code fills with the triage tables and an attribute name.
// A run(ctx) level: levels/checkout-is-slow.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). The scenario entry holds the incident board's words; the ids, costs, kinds and answers are in the level file.
export default {
  "id": "checkout-is-slow",
  "name": "Checkout is slow",
  "sub": "Find the cause before the budget runs out",
  "rewardTitle": "On-call hero",
  "run": {
    "intro": "Find where the time goes and what changed.",
    "scenario": {
      "id": "checkout-is-slow",
      "alert": {
        "title": "Checkout is slow",
        "html": "<p>PAGE: checkout p95 is 2.6 s (it was 400 ms). The alert names no cause. Find it before the error budget runs out.</p>"
      },
      "views": [
        {
          "id": "trace-slow",
          "label": "A slow trace",
          "html": "<p>One slow <code>GET /checkout</code> trace, 2.6 s. Nearly all of it is inside inventory: its <code>GET /stock</code> SERVER span lasts 2.1 s.</p><p>Under that span sit 40 <code>SELECT stock</code> CLIENT spans, about 50 ms each, one after another with none overlapping.</p>"
        },
        {
          "id": "triage",
          "label": "Compare slow with normal",
          "html": "<p>Which attribute separates the slow checkouts from the normal ones?</p>{{version-table}}{{region-table}}"
        },
        {
          "id": "deploys",
          "label": "Deploys",
          "html": "<p>Today: inventory 2.4.0 deployed at 14:03. No other service changed.</p>"
        },
        {
          "id": "checkout-logs",
          "label": "Checkout logs",
          "html": "<p>Requests complete with status 200. There are no errors and no timeouts, only long durations.</p>"
        },
        {
          "id": "db-metrics",
          "label": "Database metrics",
          "html": "<p>Database CPU is 30%, connections are steady and replica lag is near 0. Nothing is saturated.</p>"
        },
        {
          "id": "gateway-latency",
          "label": "Gateway latency",
          "html": "<p>The gateway adds 3 ms at p95, as usual. The time is spent behind it.</p>"
        },
        {
          "id": "payments-errors",
          "label": "Payments errors",
          "html": "<p>The payment provider error rate is 0.4%, the same as every day this week. Slow checkouts do not wait on payments.</p>"
        },
        {
          "id": "redis-cpu",
          "label": "Redis CPU",
          "html": "<p>Redis CPU is 12% and flat all day. Cart and session lookups are fast.</p>"
        }
      ],
      "hypotheses": [
        {
          "id": "n-plus-one",
          "label": "An N+1 query in the inventory service that runs one query per item",
          "why": "One request makes a query per item instead of one query for all items: 40 sequential SELECT stock CLIENT spans under one GET /stock. It started with inventory 2.4.0, which every slow request runs."
        },
        {
          "id": "provider",
          "label": "The payment provider is slow at p95 and drags every checkout request down with it",
          "why": "The slow traces spend their time in inventory, not in the call to the provider."
        },
        {
          "id": "redis",
          "label": "Redis is overloaded by the cart and session lookups that checkout makes",
          "why": "Redis shows no sign of load, and the slow time sits in database spans under inventory."
        },
        {
          "id": "replicas",
          "label": "The database needs more read replicas to keep up with the load at p95",
          "why": "The database is not saturated (30% CPU, replica lag near 0). More replicas would not shorten 40 queries that run one after another."
        }
      ],
      "hint": "<p>Find where one slow request spends its time, then ask what the slow ones have in common that the fast ones do not.</p>"
    },
    "triageCaption": "<code>{{attr}}</code> on the inventory span",
    "triageValue": "Value",
    "triageSlow": "Slow requests",
    "triageNormal": "Normal requests",
    "triageNoData": "no data",
    "finish": "The cause was an N+1 query: inventory 2.4.0 runs one query per item, 40 sequential database CLIENT spans under one request. A trace shows where one request spends its time, and comparing slow with normal requests shows what changed.",
    "startReason": "Name the cause to finish the level."
  }
};
