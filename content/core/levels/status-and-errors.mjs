// Text of levels/status-and-errors.mjs (docs/CONTENT.md).
// A run(ctx) level: levels/status-and-errors.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11).
export default {
  "id": "status-and-errors",
  "name": "Status and errors",
  "sub": "Unset, Error, Ok",
  "rewardTitle": "Status checker",
  "run": {
    "sortIntro": "Every span's status starts as Unset. Instrumentation sets Error when an operation fails, following the semantic conventions, and for HTTP the rule depends on the span's kind. Check five spans from this morning.",
    "sortQuestion": "Pick a span, then say whether its status is right.",
    "sort": {
      "id": "status-sort",
      "hint": "Ask which side of the call this span is on. A 4xx can be an error for the caller and fine for the server.",
      "buckets": [
        {
          "id": "ok",
          "label": "Status is right"
        },
        {
          "id": "wrong",
          "label": "Status is wrong"
        }
      ],
      "items": [
        {
          "id": "a",
          "label": "storefront CLIENT span for <code>GET /products/999</code>: 404, status Error",
          "why": "For a 4xx, the HTTP conventions say a CLIENT span SHOULD be Error: the call storefront made did not get what it asked for.",
          "whyNot": {
            "wrong": "Look at which side this span is on. A 404 is a failure for the caller that asked for a missing product, so Error is what its span should show."
          }
        },
        {
          "id": "b",
          "label": "catalog SERVER span for <code>GET /products/999</code>: 404, status Error",
          "why": "For a 4xx, the HTTP conventions say a SERVER span MUST be left Unset. Only the caller's CLIENT span SHOULD be Error.",
          "whyNot": {
            "ok": "Look at which side this span is on. For catalog, a 404 for a missing product is a normal answer, so Error here is too much."
          }
        },
        {
          "id": "c",
          "label": "checkout SERVER span for <code>POST /checkout</code>: 500, status Unset",
          "why": "A 5xx SHOULD be Error, on the SERVER span too: checkout itself failed. Left Unset, the failure is invisible to anything that counts errors by span status.",
          "whyNot": {
            "ok": "The request ended in a 500. Unset tells anything that counts errors by status that checkout did fine."
          }
        },
        {
          "id": "d",
          "label": "inventory SERVER span for <code>GET /stock</code>: 200, status Unset",
          "why": "A 2xx is a success, and instrumentation leaves it Unset. Unset is the normal status of a span that did not fail; nobody needs to set Ok.",
          "whyNot": {
            "wrong": "Nothing failed, so there is no failure to mark. A 200 is an ordinary success."
          }
        },
        {
          "id": "e",
          "label": "payments SERVER span for <code>POST /v1/charge</code>: 503, status Error",
          "why": "A 5xx on a SERVER span SHOULD be Error: the server failed the request.",
          "whyNot": {
            "wrong": "A 503 means the server could not do the job, and this is the server's own span. Error is what it should show."
          }
        }
      ]
    },
    "sortReason": "Sort every item to continue.",
    "okThenErrorIntro": "In checkout, a handler validates the cart and calls <code>span.setStatus({ code: SpanStatusCode.OK })</code>. Later in the same span, a helper calls <code>span.setStatus({ code: SpanStatusCode.ERROR })</code>.",
    "okThenErrorQuestion": "What status does the span end with?",
    "okThenError": [
      {
        "key": "error",
        "label": "Error: the last call wins",
        "why": "Usually only the last call is recorded, but Ok is the exception: once a span is Ok, later attempts to change its status SHOULD be ignored."
      },
      {
        "key": "stays-ok",
        "label": "Ok: it stays Ok",
        "why": "Ok is final. Once a span is Ok, later attempts to change its status SHOULD be ignored, so the Error is dropped. Set Ok only when you mean to override."
      },
      {
        "key": "unset",
        "label": "Unset: the two calls cancel out",
        "why": "Nothing cancels out. The statuses are ordered Ok above Error above Unset, and Ok is final, so the span stays Ok."
      }
    ],
    "okThenErrorReason": "Pick the right answer to finish the level.",
    "finish": "You know when a span should say Error, when it stays Unset, and why Ok is final."
  }
};
