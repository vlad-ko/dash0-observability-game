// Text of levels/events-and-links.mjs (docs/CONTENT.md).
// A run(ctx) level: levels/events-and-links.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). Each entry of "stories" is what the code shows after one span's name and service, in the span order of the board.
export default {
  "id": "events-and-links",
  "name": "Events and links",
  "sub": "Errors and batches",
  "rewardTitle": "Link keeper",
  "run": {
    "recordedIntro": "In payments, a handler catches the provider's error, records it, and rethrows. Nothing else touches the span:",
    "recordedQuestion": "What status does the span end with?",
    "recorded": [
      {
        "key": "error",
        "label": "Error: recording the exception marked the span as failed",
        "why": "Recording an exception only records it. The status is a separate field, and nothing in this code sets it."
      },
      {
        "key": "event-only",
        "label": "Error if it was recorded as a span event, Unset if it was logged",
        "why": "Neither way of recording it touches the status. A span event and a log record both leave the status as it was."
      },
      {
        "key": "unset",
        "label": "Unset: nothing set the status",
        "why": "An exception record, whether a span event or a log record, does not change the status. The code or instrumentation that ends the span sets it, and this code never does, so the failure is invisible to anything that counts errors by status."
      }
    ],
    "recordedReason": "Pick the right answer to continue.",
    "errorsIntro": "<p>Here is what happened in three spans. Set each [[status]] by the outcome: Error when the operation failed, Unset when it completed, even if it handled an error on the way.</p>",
    "stories": [
      "The provider declined the card. <code>CardDeclinedError</code> was recorded and escaped the span: the charge failed.",
      "The span covers the whole charge, retries included. The first try hit a connection reset; the code caught it and retried, and the second try went through. Nothing was recorded, but a helper set Error.",
      "Answered 200. No exception."
    ],
    "errorsQuestion": "Give each span the status its outcome calls for.",
    "errorsReason": "Solve the board and press Check to continue.",
    "batchIntro": "notifications reads three order messages in one batch and sends one email run for them. Each message was published by a different request, so each <code>orders publish</code> span sits in its own trace. <code>send batch</code> can have only one parent, so it stays a root.",
    "batchQuestion": "Connect <code>send batch</code> to every message it handled.",
    "batchReason": "Solve the board and press Check to finish the level.",
    "finish": "You set status by outcome, not by what was recorded, and you link a batch to every message in it."
  }
};
