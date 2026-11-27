// The words of the In Dash0 step (#509, docs/DECLARATIVE-LEVELS.md): its buttons, its answers to Check, and the notice a
// player reads when a level's In Dash0 task was left out (D7). Strict JSON, plain text only, kept apart from the code that
// draws it (lib/widgets/dash0-task-view.mjs, lib/dash0-task/notice.mjs, app.mjs). A `{seconds}` or `{field}` is filled by the code.
// content-author edits this file; the rules are docs/CONTENT.md.
export default {
  "start": "Start the task",
  "open": "Open in Dash0",
  "check": "Check",
  "retry": "Try again",
  "restart": "Start again",
  "skip": "Finish without the Dash0 task",
  "nameLabel": "The asset to read in Dash0",
  "tagLabel": "Your task tag",
  "ready": "Your data takes about {seconds} seconds to appear in Dash0.",
  "starting": "Starting the task.",
  "checking": "Checking.",
  "passed": "Right. The task is done.",
  "failed": "Not quite. Look again in Dash0 and check your answer.",
  "failedField": "Not quite. Look again at {field}.",
  "answered": "Right.",
  "left": "{n} to go.",
  "retryIn": "Try again in {seconds} seconds.",
  "offer": "The task server is not answering. You can try again, or finish the level without this task.",
  "reasons": {
    "off": "The task server is switched off right now.",
    "signed-out": "You are signed out. Sign in with your dash0.com account to do this task.",
    "settling": "Dash0 is still receiving your data.",
    "cooldown": "Checks need a few seconds between them.",
    "not-visible": "The game cannot see your work in Dash0 yet.",
    "upstream": "Dash0 did not answer just now.",
    "not-sent": "Your task data has not been sent to Dash0 yet.",
    "ingest": "The game could not send your task data to Dash0.",
    "answer": "That answer does not match.",
    "network": "The game could not reach the task server.",
    "rate-limited": "That was too many tries in a short time.",
    "expired": "This task ran out of time. Start it again.",
    "stale": "A newer task replaced this one. Start it again.",
    "unavailable": "The task server did not give a usable answer.",
    "default": "The task could not be checked just now."
  },
  "notices": {
    "off": "This level has an In Dash0 task. Come back once the admin restores the connection to Dash0.",
    "signed-out": "Sign in with your dash0.com account to do this level's In Dash0 task."
  },
  "waiting": "In Dash0 task waiting",
  "waitingLabel": "has an In Dash0 task waiting"
};
