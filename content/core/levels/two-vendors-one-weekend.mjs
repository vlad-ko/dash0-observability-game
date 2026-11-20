// Text of levels/two-vendors-one-weekend.mjs (docs/CONTENT.md).
// The question and the explain follow the accepted gaps (#381 and the pipelines graded by name) in the header of levels/two-vendors-one-weekend.mjs.
export default {
  "id": "two-vendors-one-weekend",
  "name": "Two vendors, one weekend",
  "sub": "Does that answer hold?",
  "rewardTitle": "Fan-out engineer",
  "play": {
    "finish": "A pipeline that lists two exporters sends each a copy, so trying a second vendor does not take the first one away: define the new exporter and list it beside the old one.",
    "steps": [
      {
        "intro": "Kettle &amp; Co wants to try Dash0 for a weekend and keep its current vendor running beside it. The apps send OTLP to one Collector, and nothing else leaves them. A teammate says, without a pause: \"The moment we add Dash0 to the Collector, the old vendor stops getting data. We would have to switch over in one go.\"",
        "question": "Does the teammate's answer hold?",
        "choice": {
          "id": "tvw-verdict",
          "choices": [
            {
              "key": "replaces",
              "label": "The old vendor is dropped: a pipeline sends to one exporter, so the new one takes its place",
              "why": "A pipeline's <code>exporters</code> is a list, not a single slot. Adding a second exporter to it does not remove the first."
            },
            {
              "key": "sdk",
              "label": "The old vendor is unaffected: the apps also send to it directly, whatever the Collector does",
              "why": "Here the apps send OTLP only to the Collector, and nothing else leaves them. Whatever the old vendor receives, it receives from the Collector's exporters."
            },
            {
              "key": "copy",
              "label": "Both get data: a pipeline that lists two exporters sends each of them a copy of the data",
              "why": "The architecture page says it: the last processor pushes the data to the exporters, and \"each exporter gets a copy of each data element\". Listing the old vendor and Dash0 in one pipeline feeds both."
            }
          ]
        }
      },
      {
        "intro": "The platform team started the change. The Collector's config now sends traces to an exporter for Dash0 only, and nobody defined that exporter, so the config is invalid. Metrics and logs still go to the old vendor. Dash0 needs an endpoint and a [[token|auth-token]]: both are in environment variables, <code>DASH0_ENDPOINT</code> and <code>DASH0_AUTH_TOKEN</code>.",
        "question": "Fix the config so it is valid, the old vendor keeps getting traces, metrics and logs, and Dash0 gets them too, in the existing pipelines.",
        "configure": {
          "id": "tvw-config",
          "hint": "A list feeds every exporter it names. Read each pipeline against the definitions above it: a name can be listed without being defined, and a component that is defined does nothing until a pipeline lists it. Check all three signals.",
          "explain": "A pipeline can only list an exporter that is defined, so this config was invalid while <code>traces</code> named <code>otlp_grpc/dash0</code> and nobody had defined it. Defining it is not enough either: configuring an exporter does not enable it, it works only when a pipeline lists it. The teammate's change pointed traces at Dash0 alone, which is the replacement the Choice ruled out. A list feeds every exporter it names: with both in a pipeline each gets a copy of each data element, so the old vendor keeps its data while Dash0 gets the same. Fixing traces alone would leave metrics and logs with one vendor, and keeping Dash0 only would end the comparison, so the task needs both in all three pipelines, each exporter defined in <code>exporters</code> and listed under a pipeline's <code>exporters</code>. The Dash0 exporter reads its endpoint and token from environment variables with <code>${env:...}</code>, which the Collector expands in its configuration, so no secret is written in the file. The token travels in <code>headers</code>, the name/value pairs added to each request: the name is <code>Authorization</code> and the value is <code>Bearer</code>, a space and the token. A separate pipeline such as <code>traces/dash0</code> that sends to the new exporter is also valid in a real Collector. This game reads the lists of the existing pipelines, which is why the task says so. It checks the wiring, not the settings."
        }
      }
    ]
  }
};
