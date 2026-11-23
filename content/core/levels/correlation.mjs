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
        "intro": "From a log, an engineer wants to jump to its [[trace]]. That works when the record carries a <code>trace_id</code> and a <code>span_id</code>, and a log call gets them only from the [[span]] that is the current span when it runs. Kettle &amp; Co logged these six records while order {{order}} was paid, with order {{other-order}} in flight at checkout. When spans nest, the innermost span that was current is the one the call ran in. Attach each record to the span it was written in, or to none.",
        "build": {
          "id": "cor-build",
          "hint": "A record belongs to a span only if that span was the current one when the log call ran: look at the record's service, its time and its attributes, and at the span's.",
          "explain": "Three records get a span. The cart check was written inside <code>{{cart-span}}</code>, the innermost span of order {{order}}, started as the current span. The neighbour order's record shares checkout and the time with order {{order}}'s spans; its <code>order.id</code> says which trace it is in. The provider warning ran on the charge request's thread. Three stay unlinked: startup ran before any request, the email has no span on the board, and the retry worker's record falls inside the charge span's window but a different thread wrote it, so no span was current."
        }
      },
      {
        "intro": "Checkout is instrumented and runs a [[bridged logger|logging-bridge]]. Yet three records have no link.",
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
              "why": "[[Correlation]] is automatic only when the log call happens inside an active span and the logger is bridged: the appender for your logging library hands the current context to the [[Logs API]], which uses the current context when none is passed, and the record gets that span's TraceId and SpanId. Startup code, and a worker that does not carry the request's context over, log outside any span, so the ids stay empty."
            },
            {
              "key": "errors-only",
              "label": "Trace IDs are added by severity: ERROR records get one, and these records are below ERROR",
              "why": "Severity plays no part. The trace IDs come from the context at the moment of the call, so an INFO or DEBUG record written inside a span carries them, and an ERROR written outside one does not."
            },
            {
              "key": "no-span-current",
              "label": "Nothing was current when the appender was called so there was no trace to copy at all",
              "why": "The appender passes the current context to the Logs API, and the record gets the TraceId and SpanId of the span in that context. With no span current there is nothing to copy, and the fields stay empty."
            },
            {
              "key": "start-up-and-workers",
              "label": "These calls ran with no span current, such as at start-up or on a worker without context",
              "why": "Start-up code runs before any request, so there is no span. A worker thread that was not handed the request's context has none either. In both cases the ids stay empty."
            },
            {
              "key": "read-at-the-call",
              "label": "The ids are taken from the moment of logging and these records carried none at that point",
              "why": "Correlation is decided by the call, not by anything done to the record afterwards. A record logged inside an active span through a bridged logger carries the ids, and one logged outside any span does not."
            },
            {
              "key": "otlp-drops-ids",
              "label": "The appender drops the ids on the way out over OTLP so only a Collector can add them back",
              "why": "OTLP records carry TraceId and SpanId as fields of their own, so an appender that has the ids sends them. A Collector cannot tell which span a call ran in."
            },
            {
              "key": "match-by-time",
              "label": "The Collector matches each record's time to a span, and these three fell between spans",
              "why": "Matching by time is the most basic form of correlation, and it sets no ids. The ids on a record come from the span that was current when the call was made."
            },
            {
              "key": "starter-only",
              "label": "Only the service that started the request is correlated and the other services are not",
              "why": "Every component that took part in a request can have its records linked, because the ids in a log record let a backend correlate the logs of the different components of one distributed system."
            },
            {
              "key": "trace-id-attribute",
              "label": "The application has to add a <code>trace_id</code> attribute by hand to every line it logs",
              "why": "The ids are the TraceId and SpanId fields of the record, which a bridged logger fills from the current context. Fields named trace_id are for formats that have no such fields, and a bridged logger does not need them."
            },
            {
              "key": "ids-on-resource",
              "label": "The correlation sits in the Resource, which was configured without it for these services",
              "why": "The Resource describes the source and is the same for every record from it. A trace ID changes with every request, so it is a field of the record and cannot be on the Resource."
            },
            {
              "key": "zero-ids-mark-unlinked",
              "label": "All-zero ids are how a backend marks a call with nothing behind it as unlinked",
              "why": "An all-zero trace ID and an all-zero span ID are invalid in W3C Trace Context. A record logged outside a span leaves the fields empty, and zeros are not a marker."
            },
            {
              "key": "logs-cannot-carry-ids",
              "label": "A log entry cannot carry a link at all, because a link belongs to spans alone and never to entries",
              "why": "TraceId and SpanId are fields of a log record, set for logs that are part of request processing. Records inside an active span carry them, so records can."
            },
            {
              "key": "explicit-context",
              "label": "The Logs API call needs the context passed in each time and the appender never sets it",
              "why": "When implicit context is supported, the context parameter is optional, and if it is not given the API must use the current context. An appender can rely on the current span without being handed one."
            },
            {
              "key": "set-at-export",
              "label": "The ids are filled in when the data is exported and the spans of these three records had already closed by then",
              "why": "The ids are set at the moment of the log call, from the context at that moment. Whether the span has ended, or the trace has been exported, does not change a record that is already written."
            },
            {
              "key": "email-uninstrumented",
              "label": "The payments retry worker is not instrumented, so the whole system lost its link to the trace",
              "why": "A record is linked or unlinked on its own: it depends on whether its own call ran inside an active span through a bridged logger. Records from other services are still linked."
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
              "why": "The ids come from the context at the moment of the log call. A span the worker starts for each attempt gives its records a span of their own, and carrying the request's context over to the worker thread gives them the request's trace. Either way the appender finds a valid [[span context]] and sets the fields."
            },
            {
              "key": "in-message",
              "label": "Write the trace ID and span ID into the message text of the log calls by hand and search the text for them",
              "why": "A backend links records through the TraceId and SpanId fields of the record, or for non-OTLP logs through recognised attribute names. Text inside the Body is neither, so the record stays unlinked."
            },
            {
              "key": "span-per-attempt",
              "label": "Open a fresh <code>span</code> for every failed charge off the queue, so each entry links to it",
              "why": "A span the worker starts for each attempt gives the records written inside it a span context of their own. The appender then finds a valid span context and sets TraceId and SpanId."
            },
            {
              "key": "carry-context-over",
              "label": "Pass the original trace ID along with the queued job and make it current where it executes",
              "why": "The ids come from the context at the moment of the log call. With the request's trace context carried to the worker and made current, its records join the trace of the request."
            },
            {
              "key": "bring-back-context",
              "label": "Restore the request's trace context on the worker before the first log call of each job",
              "why": "The request's trace context holds the span that was current. Restored on the worker before the first log call, it lets the bridged logger read that span and set the ids, so the log calls themselves do not change."
            },
            {
              "key": "raise-to-error",
              "label": "Raise the retry logging to ERROR, so that its lines are given ids by the logger when they are written",
              "why": "Severity plays no part in where ids come from. They come from the span that is current at the call, and an ERROR logged outside a span still has none."
            },
            {
              "key": "write-to-file",
              "label": "Send the output to a file and let the file_log receiver tie it back to the right trace",
              "why": "A line in a file has no execution context of its own. The Collector can add resource attributes such as the pod, but a trace context is there only if the application wrote it into the line."
            },
            {
              "key": "same-thread-name",
              "label": "Give the output the same <code>thread.name</code> as the request that issued it, to tie the two together",
              "why": "A thread name is an attribute, and an attribute does not link a record to a trace. The ids are the TraceId and SpanId fields, which come from the context at the call."
            },
            {
              "key": "same-service-name",
              "label": "Make the retry log under the same <code>service.name</code> as the charge span, so that it joins the trace",
              "why": "Records and spans are linked by trace and span ids, not by service name. A record from the same service as a span can still have no link to it."
            },
            {
              "key": "delay-the-call",
              "label": "Delay the log call until the charge span's window begins, to make the times overlap",
              "why": "Overlapping in time does not make a span current. A record gets ids only if a span is current on the thread that makes the call, whatever the clock says."
            },
            {
              "key": "resource-mode-link",
              "label": "Switch the span's Related Logs &amp; Events tab to Resource mode, which links the logs",
              "why": "Resource mode lists the records of the same resource within 30 minutes of the span, so it shows the record. It does not link it: the record still has no ids, and the Log Sidebar still has no span to show."
            },
            {
              "key": "logs-api-instead",
              "label": "Call the Logs API directly instead of the bridged logger, as it links itself outside any span",
              "why": "The Logs API uses the context it is given, or the current context. With no span current there is no span context to copy, whichever way the call is made."
            },
            {
              "key": "random-trace-id",
              "label": "Generate a new trace ID inside the retry for the entries it produces and set it on the entries",
              "why": "A trace ID must be the ID of a real trace. Records with an invented one point at a trace that has no spans, and they link to nothing the worker did."
            },
            {
              "key": "order-id-attribute",
              "label": "Add the order ID as an attribute on each line, so that the trace of the order claims the lines",
              "why": "A trace does not claim records by an attribute. The link is the TraceId and SpanId on the record, and an order ID is a business fact to filter on, not a trace context."
            },
            {
              "key": "flags-only",
              "label": "Set <code>trace_flags</code> to <code>01</code> on every entry, as <code>01</code> marks it as sampled and therefore linked",
              "why": "TraceFlags carries the W3C trace flags, and the only flag defined is the sampled flag. A record with flags and no TraceId or SpanId is still linked to nothing."
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
              "why": "In the Related Logs &amp; Events tab of a span, the default mode shows every log record and span event in the same trace. A record with blank ids is not in that trace. The Resource mode shows everything on the same resource within 30 minutes of the span, which Dash0 suggests for logs outside the span's trace, such as background jobs. From a log, the [[Log Sidebar]] shows the span the record was created in, and an unlinked record has none. Getting the log call inside a span is what makes the link exact."
            },
            {
              "key": "by-text",
              "label": "Yes: Dash0 reads the trace ID out of the message text, and the record joins the span's trace",
              "why": "Dash0 takes the ids from the TraceId and SpanId fields of an OTLP record or, for other paths, from recognised attribute names such as <code>trace_id</code>. Text in the message is not one of them."
            },
            {
              "key": "trace-mode-default",
              "label": "Not at first: the Dash0 tab follows one request, so a record with blank ids belongs to none",
              "why": "Trace is the default mode of the tab, and it lists every log record and span event in the same trace as the selected span. A record with no ids belongs to no trace."
            },
            {
              "key": "switch-to-resource",
              "label": "No, not by default: it appears once you switch the dropdown to Resource mode",
              "why": "Resource mode lists everything on the same resource within 30 minutes of the span, which suits logs outside the span's own trace, such as background jobs. The default mode goes by trace."
            },
            {
              "key": "nothing-ties-it",
              "label": "No tie to the span exists, so the record only appears in a mode that goes by resource",
              "why": "Without a trace ID the record cannot be matched to the trace, and the default mode lists only the trace. The Resource mode and the Resource &amp; Trace mode can list it, because they go by the resource as well."
            },
            {
              "key": "starts-in-resource",
              "label": "The default is Resource mode, so every record of the payments service in the last half hour is included",
              "why": "Trace is the default mode of the tab. Resource mode lists everything on the same resource within 30 minutes of the span, and it is a mode you switch to."
            },
            {
              "key": "span-is-default",
              "label": "The default is Span mode, which includes everything the service logged during the span",
              "why": "Trace is the default mode. Span mode lists only the log records and span events attached directly to the span, and a record with blank ids is attached to no span."
            },
            {
              "key": "never-in-any-mode",
              "label": "No: a record without ids cannot be listed by the tab, whichever mode you pick from the dropdown",
              "why": "Resource mode lists everything on the same resource within 30 minutes of the span, whether or not it has ids. It is meant for logs outside the span's own trace, such as background jobs."
            },
            {
              "key": "thread-name-match",
              "label": "Matching the <code>thread.name</code> attribute of the record to the one on the span's resource lists it under that span",
              "why": "Dash0 attaches a record to a span through the TraceId and SpanId of an OTLP record, or through recognised attribute names such as <code>trace_id</code> on other paths. A thread name is not one of them."
            },
            {
              "key": "span-events-only",
              "label": "No: the tab holds span events only, so a log record never shows up at all",
              "why": "The tab shows log records and span events together, in one time-ordered list. A record with blank ids is missing from the default list because of its ids, not because it is a log."
            },
            {
              "key": "sidebar-span",
              "label": "The Log Sidebar shows the span the record was created in, and that is why the tab shows it",
              "why": "The Log Sidebar can show the span a log was created in only when the record carries ids that Dash0 recognises. A record with blank ids has no span context there, so it gives the tab nothing to list."
            },
            {
              "key": "dropped-at-ingest",
              "label": "No: Dash0 drops records without ids when they arrive, so the record is not in Dash0 at all",
              "why": "Dash0 keeps records that have no trace context. The Related Logs tab of such a record goes by resource, because it has no trace to go by."
            },
            {
              "key": "service-has-span",
              "label": "A record joins a trace when its resource has a span there, so the span lists it too",
              "why": "A record is attached to a trace by its TraceId and SpanId, not by the resource that has spans in it. A record with blank ids is not in the trace."
            },
            {
              "key": "ids-only-in-attributes",
              "label": "Dash0 reads the ids only from attributes, so the record needs <code>trace_id</code> there to be listed",
              "why": "Dash0 reads the ids first from the TraceId and SpanId fields of an OTLP record, and from recognised attribute names only for other paths."
            },
            {
              "key": "starts-in-union",
              "label": "The default is Resource &amp; Trace mode, which also includes records that have no ids",
              "why": "Trace is the default mode, and it lists only the logs and span events of the same trace. Resource &amp; Trace is the union of the Trace and Resource modes, and you have to choose it."
            }
          ]
        }
      }
    ]
  }
};
