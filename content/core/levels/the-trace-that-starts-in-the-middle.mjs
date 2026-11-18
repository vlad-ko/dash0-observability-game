// Text of levels/the-trace-that-starts-in-the-middle.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
export default {
  "id": "the-trace-that-starts-in-the-middle",
  "name": "The trace that starts in the middle",
  "sub": "Does that answer hold?",
  "rewardTitle": "Parent finder",
  "play": {
    "finish": "A parent ID is a pointer to a span. Here the sidecars wrote an ID for a span they never export, so the child pointed at nothing; passing the header through unchanged keeps the pointer to the caller's own span. The parent a header names is the CLIENT span of the call that carried it, not the SERVER span around it and not a parallel call.",
    "steps": [
      {
        "intro": "On a call, a customer shows a checkout trace in which cart and payments float loose, each with a parent no one can open. The presenter answers without a pause: \"Cart's SDK ignores the header web sends, so it starts over. That is why its span has no parent.\"",
        "question": "Does the presenter's answer hold?",
        "show": "<p>The three services run behind a mesh: a sidecar sits between each caller and callee, forwards the call and writes a <code>traceparent</code> header on it. Sidecar settings: <code>tracing export: none</code>. Here is the trace as received, and the header on each hop before and after its sidecar:</p><table><caption>Spans received, one trace ({{trace-short}})</caption><thead><tr><th scope=\"col\">Service</th><th scope=\"col\">Name</th><th scope=\"col\">Kind</th><th scope=\"col\">Span ID</th><th scope=\"col\">Parent ID</th></tr></thead><tbody>{{received-rows}}</tbody></table><table><caption>The traceparent on each hop</caption><thead><tr><th scope=\"col\">Hop</th><th scope=\"col\">Left the caller</th><th scope=\"col\">Reached the callee</th></tr></thead><tbody>{{hop-rows}}</tbody></table>",
        "choice": {
          "id": "ttsm-verdict",
          "choices": [
            {
              "key": "holds",
              "label": "Cart's SDK ignored the header and left its span an orphan",
              "why": "Cart's spans carry trace {{trace-short}}, web's trace ID, so its SDK continued the trace and did not start one. The orphan is a parent-ID problem, not a trace-ID problem."
            },
            {
              "key": "never-sent",
              "label": "Web sent no traceparent, so cart had nothing to continue",
              "why": "Web did send one: the \"Left the caller\" column shows {{web-c-header}}, and cart's spans share its trace ID. The trace ID arrived. What changed on the way is the parent-ID."
            },
            {
              "key": "rewritten",
              "label": "The sidecar replaced the parent-id with a span it never exports",
              "why": "The header left web naming web's client span, {{web-c}}, and reached cart naming {{mesh1}}, which is no received span: the sidecar wrote it. The sidecars show tracing export: none, so no one ever sends that span. Cart's SDK did what the header said (same trace, parent {{mesh1}}), and the hole is the parent that does not exist. The same happens between cart and payments."
            },
            {
              "key": "dropped",
              "label": "The sidecar's span was dropped on export, so cart's parent is missing",
              "why": "The sidecars show tracing export: none, so they never produced an export to drop. A parent-id that no span carries is not a lost span, it is an id nothing ever sent, written into the header by the sidecar."
            }
          ]
        }
      },
      {
        "intro": "You change the sidecars to pass <code>traceparent</code> through unchanged. The W3C text allows it. A vendor must send the header on and may change it first, so sending it on unchanged is allowed too. The board shows the old trace. Cart's and payments' server spans still point at the IDs the sidecars wrote, which no received span carries; with the fix, each takes the parent the header it receives names. Web and cart also made parallel calls while the call ran, some of them POSTs; their server spans are not in this capture. Calls with the same name are told apart by the end of their span ID.",
        "question": "Rebuild the tree the fix gives: join cart's and payments' server spans to their parents.",
        "show": "<table><caption>The traceparent on each hop after the fix</caption><thead><tr><th scope=\"col\">Hop</th><th scope=\"col\">Header</th></tr></thead><tbody>{{pass-rows}}</tbody></table><table><caption>CLIENT spans of web and cart, by ID</caption><thead><tr><th scope=\"col\">Service</th><th scope=\"col\">Name</th><th scope=\"col\">Span ID</th></tr></thead><tbody>{{client-rows}}</tbody></table>",
        "build": {
          "id": "ttsm-tree"
        }
      }
    ]
  }
};
