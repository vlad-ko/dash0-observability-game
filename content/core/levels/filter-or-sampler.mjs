// Text of levels/filter-or-sampler.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
// Sort labels must not give the bucket away: the rule is in the Step 2 comment of levels/filter-or-sampler.mjs, enforced by test/sort-tells.test.mjs.
export default {
  "id": "filter-or-sampler",
  "name": "Filter, sampler, or both?",
  "sub": "Does that answer hold?",
  "rewardTitle": "Trace keeper",
  "play": {
    "finish": "You did not accept the yes without checking: a filter judges one span or record at a time, so it can drop the probe, the debug logs and the load test, but it cannot keep a trace because one of its spans failed. That takes a tail sampler. Dropping spans inside a kept trace takes both a filter and a tail sampler.\n\nDash0 has both kinds of tool: spam filters drop matching telemetry at ingestion, record by record, and SignalControl's sampling stage samples traces before they are stored.",
    "steps": [
      {
        "intro": "On a call, a customer asks: \"We only want to keep the traces that have an error. Can a filter in our Collector do that?\" The presenter answers: \"Yes. Add a filter processor that drops every span whose status is not Error. What reaches the backend is exactly your traces with errors.\"",
        "question": "Does the presenter's answer hold?",
        "show": "<p>Here is one failed checkout [[trace]] as it reaches the Collector, before the filter:</p><table><caption>One failed checkout trace, {{spans}} spans</caption><thead><tr><th scope=\"col\">Span</th><th scope=\"col\">Service</th><th scope=\"col\">Status</th></tr></thead><tbody>{{rows}}</tbody></table>",
        "choice": {
          "id": "fos-verdict",
          "choices": [
            {
              "key": "holds",
              "label": "The error traces are kept in full: the filter keeps the spans with status Error, so the trace stays whole",
              "why": "The filter does keep every span with status Error, but only those spans. It judges one span at a time, so it drops the {{dropped}} healthy spans of the same trace: {{healthy-list}}, which show what led up to the failure."
            },
            {
              "key": "wrong",
              "label": "The error traces are cut: the filter judges each span alone, so it keeps the failed spans, not whole traces",
              "why": "A filter processor checks each span against its condition on its own and never sees the rest of the trace. Of the {{spans}} spans in this failed checkout it keeps the {{errors}} with status Error and drops the other {{dropped}}, so the backend gets pieces of the trace, not the trace. Keeping whole traces that contain an error takes a sampler that waits for the trace and decides on all of it: a tail sampler."
            },
            {
              "key": "follow-up",
              "label": "The filter keeps whole traces when the spans of one trace reach the same Collector before the filter processor runs",
              "why": "Where the spans go does not change what a filter keeps. It matters for a tail sampler, which needs every span of a trace in one Collector to decide. A filter judges each span alone, so where the other spans go changes nothing: it still drops the {{dropped}} healthy spans of the failed trace."
            }
          ]
        }
      },
      {
        "intro": "The customer has more goals for the same Collector. A <b>filter processor</b> judges each span, log record or data point on its own and drops the ones its condition matches. A <b>tail sampler</b> holds the spans of each trace for its decision wait, then keeps or drops the whole trace; it samples traces only. Where a goal says <i>only</i>, everything else may go. Use the least that does the job: a tail sampler is stateful and holds every trace in memory while it waits.",
        "question": "Pick a goal, then say what it takes.",
        "sort": {
          "id": "fos-sort",
          "buckets": [
            {
              "id": "filter",
              "label": "A filter processor"
            },
            {
              "id": "tail",
              "label": "A tail sampler"
            },
            {
              "id": "both",
              "label": "Both: a filter and a tail sampler"
            }
          ],
          "items": [
            {
              "id": "errors-whole",
              "label": "Keep only the traces with an error in them, every span intact",
              "why": "Whether a trace has an error is known only once its spans are in. A <code>status_code</code> policy decides on the whole trace and keeps every span of it.",
              "whyNot": {
                "filter": "A filter keeps the spans with status Error and drops the healthy spans of the same trace, as in step 1.",
                "both": "Every span of a kept trace stays, so there is no span to drop."
              }
            },
            {
              "id": "healthz",
              "label": "Drop the probe traces that hit <code>/healthz</code> (one span each)",
              "why": "The probe answers from the service itself, so each probe is a one-span trace that carries the <code>/healthz</code> path. That span can be judged and dropped alone.",
              "whyNot": {
                "tail": "A tail sampler could drop those traces, but it would hold each one for the whole decision wait to learn what any one of its spans already says.",
                "both": "Nothing here keeps a trace by what the rest of it holds, so there is no work for a sampler."
              }
            },
            {
              "id": "slow-no-cache",
              "label": "Keep only the slow traces, minus the cache-lookup spans",
              "why": "Which traces are slow is the sampler's decision, made on whole traces. Dropping the cache-lookup spans inside the kept ones is the filter's: a tail sampler keeps or drops a trace whole, never part of it.",
              "whyNot": {
                "filter": "A filter can drop the cache-lookup spans, but it cannot tell which traces are slow.",
                "tail": "A tail sampler keeps or drops a whole trace. It cannot keep a trace and drop some of its spans."
              }
            },
            {
              "id": "slow",
              "label": "Keep only the traces that take over 2 seconds end to end",
              "why": "End to end runs from the first span's start to the last span's end, so only the whole trace knows it. A <code>latency</code> policy decides on that.",
              "whyNot": {
                "filter": "A filter sees one span's duration, not the trace's, and it cannot keep the fast spans of a slow trace.",
                "both": "Every span of a slow trace is kept, so there is nothing for a filter to drop."
              }
            },
            {
              "id": "debug-logs",
              "label": "Keep every checkout log record except the debug-level ones",
              "why": "Each log record carries its own severity, so a filter can drop it alone.",
              "whyNot": {
                "tail": "Tail sampling works on traces. Log records never pass through it.",
                "both": "Log records never pass through a tail sampler, so there is no sampling to do."
              }
            },
            {
              "id": "many-spans",
              "label": "Keep only the traces with more than 50 spans",
              "why": "How many spans a trace has is a fact about the trace, not about any one span. A <code>span_count</code> policy counts them before it decides.",
              "whyNot": {
                "filter": "One span does not know how many other spans its trace has.",
                "both": "Every span of the kept traces stays, so a filter has nothing to do."
              }
            },
            {
              "id": "production-only",
              "label": "Keep only the traces from production, none from the load test",
              "why": "The environment (<code>deployment.environment.name</code>) is a resource attribute, so every span from the load test carries it. Dropping span by span drops those traces whole anyway.",
              "whyNot": {
                "tail": "It would work, but every span already says where it came from, so holding each trace for the decision wait buys nothing.",
                "both": "One attribute on every span decides it, so a sampler adds nothing."
              }
            },
            {
              "id": "via-payments",
              "label": "Of all traffic, only traces that touch payments, each arriving complete",
              "why": "Only the payments spans name payments, so the decision needs the whole trace: a <code>string_attribute</code> policy on <code>service.name</code> keeps the whole trace when one of its spans matches.",
              "whyNot": {
                "filter": "A filter on <code>service.name</code> keeps the payments spans and drops the storefront and checkout spans of the same trace.",
                "both": "Every span of a kept trace stays, so there is no span to drop."
              }
            },
            {
              "id": "errors-no-keepalive",
              "label": "Keep only the failed traces, and strip the keep-alive <code>SELECT 1</code> spans that ride along",
              "why": "Keeping only the failed traces is a decision on the whole trace, the sampler's. Dropping the <code>SELECT 1</code> spans is one span at a time, the filter's.",
              "whyNot": {
                "filter": "A filter drops the <code>SELECT 1</code> spans, but it cannot keep a trace because another span in it failed.",
                "tail": "The sampler keeps each failed trace with every span in it, <code>SELECT 1</code> included."
              }
            }
          ]
        }
      }
    ]
  }
};
