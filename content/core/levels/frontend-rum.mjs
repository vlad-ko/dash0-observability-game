// Text of levels/frontend-rum.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
export default {
  "id": "frontend-rum",
  "name": "Frontend / RUM",
  "sub": "The trace starts in the browser",
  "rewardTitle": "Browser tracer",
  "play": {
    "finish": "A trace can start in the browser: the traceparent header names the browser span that made the call, and the backend span becomes its child. Across origins, the browser decides what may be sent: the telemetry endpoint must allow the page's origin, and the API must allow the traceparent header.",
    "steps": [
      {
        "intro": "<p>A browser can produce spans too, so a trace can start at the click. In Kettle &amp; Co's shop, the instrumentation records a span for the click on Pay and one for each fetch call the click makes.</p><p>In the lab, the shop and the checkout service share an origin, and the SDK adds <code data-token>traceparent: 00-{{trace-id}}-{{pay-span}}-01</code> to the call.</p><p>The code that sends the checkout call ran twice, so two identical calls left together.</p><p>The board tells them apart by the end of their span id. The twin rows show it.</p><p>Another visitor clicked Pay at the same moment, in trace <code>9d8c7b6a</code>. Checkout's server span for one of the two calls arrived as a root.</p>",
        "question": "Give checkout's server span its parent.",
        "build": {
          "id": "frum-tree"
        }
      },
      {
        "intro": "In production the shop is served from <code>https://shop.kettle.example</code>, the checkout API from <code>https://api.kettle.example</code> and the telemetry endpoint from <code>https://otlp.kettle.example</code>: three origins. The SDK is set to send trace context to the API's origin; by default it sends it only to the page's own origin. The API already allows the shop's origin, <code>https://shop.kettle.example</code>. Since then, two requests fail. The SDK's export <code>POST https://otlp.kettle.example/v1/traces</code> is blocked: the reply has no <code>Access-Control-Allow-Origin</code> header, and no browser spans reach Dash0. Before the checkout call to <code>https://api.kettle.example</code>, the browser asks whether it may send the header <code>traceparent</code>. The reply lists <code>Access-Control-Allow-Headers: Content-Type, Authorization</code>, so the browser does not send the call, and the payment fails.",
        "question": "Which change makes both work?",
        "choice": {
          "id": "frum-cors",
          "choices": [
            {
              "key": "page-origin-api-header",
              "label": "Allow <code>https://shop.kettle.example</code> on the OTLP endpoint, and <code>traceparent</code> in the API's allowed headers",
              "why": "The export request is sent by the page, so its origin is <code>https://shop.kettle.example</code> and the endpoint has to allow that origin: on a Collector that is <code>allowed_origins</code> under <code>cors</code> on the HTTP receiver, or the same headers set by a reverse proxy in front of it. The trace context travels on the call to the API, so the reply that blocks it is the API's, and it is the API that has to list <code>traceparent</code>. Dash0's website monitoring then shows the sessions and their Core Web Vitals (LCP, INP and CLS, at p75), and a request links to its backend trace through the header you just followed."
            },
            {
              "key": "page-origin-otlp-header",
              "label": "Allow <code>https://shop.kettle.example</code> on the OTLP endpoint, and <code>traceparent</code> in that endpoint's allowed headers",
              "why": "The origin is right. The header is not: <code>traceparent</code> is sent on the call to the checkout API, and the reply that blocks that call is the API's, which lists Content-Type and Authorization only. A longer list on the telemetry endpoint leaves that reply as it is, and payments keep failing."
            },
            {
              "key": "api-origin-api-header",
              "label": "Allow <code>https://api.kettle.example</code> on the OTLP endpoint, and <code>traceparent</code> in the API's allowed headers",
              "why": "The header is right. The origin is not: the export request is sent by the page, so it carries the shop's origin, not the API's. The endpoint would still not allow the origin that sent it, the browser would keep blocking the export, and no browser spans would arrive."
            },
            {
              "key": "api-origin-otlp-header",
              "label": "Allow <code>https://api.kettle.example</code> on the OTLP endpoint, and <code>traceparent</code> in that endpoint's allowed headers",
              "why": "Both changes land in the wrong place. The origin that has to be allowed is the page's, and the header has to be allowed by the API, whose reply to the preflight is the one that lacks it. Payments still fail and no browser spans arrive."
            }
          ]
        }
      }
    ]
  }
};
