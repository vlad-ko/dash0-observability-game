// Text of levels/correlation.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
export default {
  "id": "correlation",
  "name": "Correlation",
  "sub": "Which trace was this?",
  "rewardTitle": "Log correlator",
  "play": {
    "finish": "You can tell a linked log record from an unlinked one: the ids are fields of the record, set only when the log call ran inside an active span through a bridged logger.",
    "steps": [
      {
        "intro": "From a log, an engineer wants to jump to its trace. That works when the record carries a <code>trace_id</code> and a <code>span_id</code>, and a log call gets them only from the span that is the current span when it runs. Kettle &amp; Co logged these six records while order {{order}} was paid, with order {{other-order}} in flight at checkout. When spans nest, the innermost span that was current is the one the call ran in. Attach each record to the span it was written in, or to none.",
        "build": {
          "id": "cor-build",
          "hint": "A record belongs to a span only if that span was the current one when the log call ran: look at the record's service, its time and its attributes, and at the span's.",
          "explain": "Three records get a span. The cart check was written inside <code>{{cart-span}}</code>, the innermost span of order {{order}}, started as the current span. The neighbour order's record shares checkout and the time with order {{order}}'s spans; its <code>order.id</code> says which trace it is in. The provider warning ran on the charge request's thread. Three stay unlinked: startup ran before any request, the email has no span on the board, and the retry worker's record falls inside the charge span's window but a different thread wrote it, so no span was current."
        }
      },
      {
        "intro": "Checkout is instrumented and runs a bridged logger. Yet three records have no link.",
        "question": "Why do they have no trace link?",
        "choice": {
          "id": "cor-why",
          "choices": [
            {
              "key": "stripped",
              "label": "Something in the pipeline stripped them: OpenTelemetry stamps a trace ID on the log records it exports",
              "why": "It does not. A record carries ids only when it was emitted with a context that holds a span. Outside any span there is nothing to stamp, so there is nothing to strip."
            },
            {
              "key": "no-active-span",
              "label": "The log call ran outside an active span, or through a logger that is not bridged to OpenTelemetry",
              "why": "Correlation is automatic only when the log call happens inside an active span and the logger is bridged: the appender for your logging library hands the current context to the Logs API, which uses the current context when none is passed, and the record gets that span's TraceId and SpanId. Startup code, and a worker that does not carry the request's context over, log outside any span, so the ids stay empty."
            },
            {
              "key": "errors-only",
              "label": "Trace IDs are added by severity: ERROR records get one, and these records are below ERROR",
              "why": "Severity plays no part. The trace IDs come from the context at the moment of the call, so an INFO or DEBUG record written inside a span carries them, and an ERROR written outside one does not."
            }
          ]
        }
      },
      {
        "intro": "The payments retry worker picks failed charges off a queue on its own thread pool and logs through the same bridged logger. Its record is one of the unlinked ones.",
        "question": "How do you get its records linked?",
        "choice": {
          "id": "cor-fix",
          "choices": [
            {
              "key": "zeros",
              "label": "Fill the two fields with zeros in the log appender, to keep them from being empty",
              "why": "All zeros is the invalid value: W3C Trace Context treats an all-zero trace ID and an all-zero span id as invalid. A record of zeros links to nothing, and it hides that the context is missing."
            },
            {
              "key": "run-in-span",
              "label": "Run the retry inside a span, or carry the request's context over to the worker, and keep the bridged logger",
              "why": "The ids come from the context at the moment of the log call. A span the worker starts for each attempt gives its records a span of their own, and carrying the request's context over to the worker thread gives them the request's trace. Either way the appender finds a valid span context and sets the fields."
            },
            {
              "key": "in-message",
              "label": "Write the trace ID and span ID into the message text of the log calls by hand and search the text for them",
              "why": "A backend links records through the TraceId and SpanId fields of the record, or for non-OTLP logs through recognised attribute names. Text inside the Body is neither, so the record stays unlinked."
            }
          ]
        }
      },
      {
        "intro": "You open the trace of order {{order}} in Dash0, select the payments span and open its <b>Related Logs &amp; Events</b> tab, left on its default. The worker's record has blank ids.",
        "question": "Is the worker's record in the list?",
        "choice": {
          "id": "cor-dash0",
          "choices": [
            {
              "key": "by-time",
              "label": "Yes: by default the tab lists every log from the same service around the same time, and the record shows up in the list",
              "why": "By default the tab lists the logs and span events of the same trace as the span. Listing by resource, within 30 minutes of the span, is a mode you switch to."
            },
            {
              "key": "resource-mode",
              "label": "No: the default lists logs of the same trace, and this record has no trace ID. Resource mode can still show it",
              "why": "In the Related Logs &amp; Events tab of a span, the default mode shows every log record and span event in the same trace. A record with blank ids is not in that trace. The Resource mode shows everything on the same resource within 30 minutes of the span, which Dash0 suggests for logs outside the span's trace, such as background jobs. From a log, the Log Sidebar shows the span the record was created in, and an unlinked record has none. Getting the log call inside a span is what makes the link exact."
            },
            {
              "key": "by-text",
              "label": "Yes: Dash0 reads the trace ID out of the message text, and the record joins the span's trace",
              "why": "Dash0 takes the ids from the TraceId and SpanId fields of an OTLP record or, for other paths, from recognised attribute names such as <code>trace_id</code>. Text in the message is not one of them."
            }
          ]
        }
      }
    ]
  }
};
