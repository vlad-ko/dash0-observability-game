// Text of levels/its-us.mjs (docs/CONTENT.md). A play level: a spot step, then an In Dash0 step. The spot lines use made-up attempt ids and span names taken from the game's own save path; the In Dash0 step's own fields and filter hint come from the task server and content/core/ui/dash0-task.mjs. The finish text says the same whether or not the In Dash0 step ran, so it never mentions it.
export default {
  "id": "its-us",
  "name": "It's us",
  "sub": "Find your own incident in Dash0",
  "rewardTitle": "On-call",
  "play": {
    "finish": "You picked your own failed span out of other attempts' telemetry by the attempt id and the span status. That is how you find one request among everyone's: filter on an attribute that names it, then read the status.",
    "steps": [
      {
        "intro": "The game ran into a problem of its own: a step of its save path failed while you played. Several attempts saved their progress at about the same time, and each span below carries the id of the attempt that made it. In this made-up list your attempt is <code>att-4d27</code>.",
        "question": "Which span is yours and ended in error?",
        "spot": {
          "id": "its-spot",
          "lines": [
            { "id": "other-error-storage", "text": "operation=storage.write status=Error game.attempt.id=att-9b13" },
            { "id": "mine-unset", "text": "operation=progress.serialize status=Unset game.attempt.id=att-4d27" },
            { "id": "other-ok-sync", "text": "operation=progress.sync status=Ok game.attempt.id=att-9b13" },
            { "id": "lookalike-error", "text": "operation=globe.ignite status=Error game.attempt.id=att-4d72" },
            { "id": "mine-error", "text": "operation=cards.award status=Error game.attempt.id=att-4d27" },
            { "id": "other-ok-storage", "text": "operation=storage.write status=Ok game.attempt.id=att-71f0" },
            { "id": "other-error-globe", "text": "operation=globe.ignite status=Error game.attempt.id=att-e60a" },
            { "id": "mine-ok", "text": "operation=cards.award status=Ok game.attempt.id=att-4d27" },
            { "id": "other-ok-globe", "text": "operation=globe.ignite status=Ok game.attempt.id=att-e60a" }
          ],
          "whyNot": {
            "mine-unset": "It is yours, but its status is Unset, the default. Nothing marked this span as failed, so it is not the one in error.",
            "mine-ok": "It is yours, but its status is Ok, which a developer or operator sets to say the work was validated as successful. A span in error has the status Error.",
            "other-error-storage": "Its status is Error, but its attempt id is att-9b13, not yours. Another attempt's failure is not your failure.",
            "other-error-globe": "Its status is Error, but it belongs to another attempt, att-e60a. It failed for someone else, not for you.",
            "lookalike-error": "Its status is Error, but its attempt id is att-4d72, and yours is att-4d27. A filter that says the id is att-4d27 would not match it.",
            "other-ok-sync": "It belongs to another attempt, att-9b13, and its status is Ok. It fails on both counts.",
            "other-ok-storage": "It belongs to another attempt, att-71f0, and its status is Ok. It fails on both counts.",
            "other-ok-globe": "It belongs to another attempt, att-e60a, and its status is Ok. It fails on both counts."
          },
          "explain": "Two things told yours apart: the attempt id is an attribute, so it says whose span this is, and the status says whether it failed. A span's status is Unset by default, Ok when a developer or operator marks it as validated successful, and Error when the work it covers contains an error. The attempt id alone or the status alone would have left other spans in the list."
        }
      },
      {
        "intro": "Now do it on real data. The game has sent a failed save of its own to your Dash0, as one trace. Start the task, then open Dash0 from this step. The step shows the attempt id to filter on.<ol><li>Open the [[Trace Explorer]] and add a filter: the key <code>game.attempt.id</code>, the operator <b>is</b>, and the attempt id this step shows. The link opens the explorer without that filter, and your trace can take a little while to arrive, so check the time range if the list is empty.</li><li>Select a span of your trace. The [[Span Sidebar]] opens, and <b>View full trace</b> on its Overview tab opens the [[Trace View]]. In the Waterfall, the Errors tag shows only the failed spans.</li><li>Select the failing span. Its Attributes tab lists the fault code, in <code>game.fault.code</code>. Its Related Logs &amp; Events tab lists its [[span events|span-event]]; the retries are the events named <code>retry</code>.</li><li>The Source tab shows the span as it was sent to Dash0, and the trace ID is its <code>traceId</code>.</li></ol>",
        "dash0": {
          "id": "its-find",
          "fields": [
            { "key": "operation", "label": "Which operation failed?", "hint": "The name of the failing span." },
            { "key": "faultCode", "label": "What is its fault code?", "hint": "Read it from that span's attributes, exactly as shown. Case does not matter." },
            { "key": "retryCount", "label": "How many times was it retried?", "hint": "Count the events named <code>retry</code> on that span. Type a whole number." },
            { "key": "traceId", "label": "What is the trace ID?", "hint": "The ID of the whole trace: 32 hexadecimal characters." }
          ]
        }
      }
    ]
  }
};
