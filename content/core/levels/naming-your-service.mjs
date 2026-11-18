// Text of levels/naming-your-service.mjs (docs/CONTENT.md). {{count}}, {{issues}}, {{name}}, {{version}} and {{environment}} are slots the code fills with a count of problems, the list of problems and the values the checked config gives.
// A run(ctx) level: levels/naming-your-service.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). A "why" follows "Right." or "Not quite." (the choice widget adds them). The given .env of step 2 and the hint texts come from lib/widgets/env-config-help.mjs.
export default {
  "id": "naming-your-service",
  "name": "Naming your service",
  "sub": "Why can nobody find checkout?",
  "rewardTitle": "Service namer",
  "run": {
    "showsUpAsIntro": "Your first ticket: checkout went live last week and nobody can find its traces. Its code sets no service name and it runs on a plain Linux VM, so this environment is all its SDK has to go on. The process is started as <code>node</code>.",
    "showsUpAsQuestion": "What service name does its telemetry show up under?",
    "showsUpAs": [
      {
        "key": "name",
        "label": "<code>checkout</code>",
        "why": "Nothing in this config says checkout, and nothing here lets the SDK work it out: it does not read the repository, the image or the host name. (SDKs can fall back to language- or platform-specific sources, but on a plain VM there is nothing to find.)"
      },
      {
        "key": "fallback",
        "label": "<code>unknown_service:node</code>",
        "why": "With no <code>OTEL_SERVICE_NAME</code> and no <code>service.name</code> in <code>OTEL_RESOURCE_ATTRIBUTES</code>, the SDK falls back to <code>unknown_service:&lt;executable&gt;</code>. For a process started as <code>node</code>, that is <code>unknown_service:node</code>, the same name every other unnamed service started that way gets."
      },
      {
        "key": "bare",
        "label": "<code>unknown_service</code>",
        "why": "Plain <code>unknown_service</code> is the fallback only when the SDK cannot tell which executable is running. Node can, so it appends it: <code>unknown_service:&lt;executable&gt;</code>."
      },
      {
        "key": "env",
        "label": "<code>production</code>",
        "why": "<code>deployment.environment.name</code> says where the service runs, not what it is called. It never stands in for <code>service.name</code>."
      }
    ],
    "showsUpAsReason": "Pick the right answer to continue.",
    "rule": {
      "costs": "a config that Check reports as wrong, a hint",
      "free": "Checking a config you already checked is free."
    },
    "envNote": "<code>OTEL_RESOURCE_ATTRIBUTES</code> is a comma-separated list of <code>key=value</code> pairs. If one pair is malformed, the spec says the whole value should be discarded and an error reported, so check every pair.",
    "fixIntro": "Fix it. Set <code>OTEL_SERVICE_NAME</code> to <code>checkout</code>, add a <code>service.version</code> to <code>OTEL_RESOURCE_ATTRIBUTES</code> (any version, say 1.4.2) so you can tell deploys apart, and keep <code>deployment.environment.name=production</code>. Use that key, not the deprecated <code>deployment.environment</code>.",
    "fixEditorLabel": "checkout .env",
    "fixCheckButton": "Check",
    "fixInstantChip": "Instant feedback",
    "fixHintsChip": "Hints",
    "fixSideTitle": "Config solved",
    "fixNextReason": "Fix the config and press Check to continue.",
    "fixWrongNounOne": "failed Check",
    "fixWrongNounMany": "failed Checks",
    "fixBlankSays": "Type a config first.",
    "fixRepeatSays": "You already checked this config. Nothing new was counted.{{issues}}",
    "fixMissOneSays": "Not quite: 1 problem.{{issues}}",
    "fixMissManySays": "Not quite: {{count}} problems.{{issues}}",
    "fixFilledSays": "Filled in for you.",
    "fixPassSays": "Config passes. The SDK now reports <code>service.name</code> {{name}}, <code>service.version</code> {{version}} and <code>deployment.environment.name</code> {{environment}}.",
    "fixAttrNote": "Note: the name comes from the attribute list. That works, but <code>OTEL_SERVICE_NAME</code> is the dedicated variable and wins if both are set.",
    "whoWinsIntro": "Checkout has a name. A week later a teammate pastes settings copied from the cart service into the deploy, and now both are set.",
    "clashEnv": "OTEL_SERVICE_NAME=checkout\nOTEL_RESOURCE_ATTRIBUTES=service.name=cart,service.version=1.4.2,deployment.environment.name=production",
    "whoWinsQuestion": "Which service name does the SDK report?",
    "whoWins": [
      {
        "key": "env-var",
        "label": "<code>checkout</code>",
        "why": "<code>OTEL_SERVICE_NAME</code> wins over <code>service.name</code> in <code>OTEL_RESOURCE_ATTRIBUTES</code>, so the SDK reports checkout. Delete the stray <code>service.name=cart</code> anyway: the next person to read this file will believe it."
      },
      {
        "key": "resource-attr",
        "label": "<code>cart</code>",
        "why": "<code>service.name</code> in <code>OTEL_RESOURCE_ATTRIBUTES</code> only counts when <code>OTEL_SERVICE_NAME</code> is unset or empty. Here it is set, and it wins."
      },
      {
        "key": "fallback",
        "label": "<code>unknown_service:node</code>",
        "why": "Two names are not an error. The fallback applies only when no name is set at all, and <code>OTEL_SERVICE_NAME</code> takes precedence."
      },
      {
        "key": "last-line",
        "label": "Whichever line comes last",
        "why": "These are two different variables, so their order in the file does not matter. <code>OTEL_SERVICE_NAME</code> takes precedence over <code>service.name</code> in <code>OTEL_RESOURCE_ATTRIBUTES</code>."
      }
    ],
    "whoWinsReason": "Pick the right answer to finish the level.",
    "finish": "Checkout now reports as checkout instead of unknown_service:node, so its traces now show up under the right name."
  }
};
