// Text of levels/the-34-percent-error-rate.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
// Every trade-off whyNot is a whole sentence that names its own option: the rule is in the Step 2 comment of levels/the-34-percent-error-rate.mjs.
export default {
  "id": "the-34-percent-error-rate",
  "name": "The 34% error rate",
  "sub": "Does that answer hold?",
  "rewardTitle": "Ratio sceptic",
  "play": {
    "finish": "You did not take {{stored-pct}}% on trust: {{wrong-sum}} is a share of kept spans, and the request error rate is {{true-sum}}. Keep the errors you want to open, but compute the rate before sampling.",
    "steps": [
      {
        "intro": "On a call, a customer asks: \"Does checkout really fail 34% of requests?\" The presenter answers without a pause: \"Yes. That number comes straight from the spans, so it is real.\"",
        "question": "Does the presenter's answer hold?",
        "show": "<p>Here is the setup behind the number. The load balancer sees {{requests}} requests a second. Tail sampling keeps every trace with an error plus {{keep-pct}}% of the rest. The backend gets this many spans a second:</p><table><caption>Spans a second reaching the backend</caption><thead><tr><th scope=\"col\">Spans</th><th scope=\"col\">Per second</th></tr></thead><tbody><tr><td>With status Error</td><td>{{errors}}</td></tr><tr><td>Healthy, kept at {{keep-pct}}%</td><td>{{kept-healthy}}</td></tr><tr><td>Total reaching the backend</td><td>{{stored}}</td></tr></tbody></table>",
        "choice": {
          "id": "ser-verdict",
          "choices": [
            {
              "key": "holds",
              "label": "The backend counts the spans it receives, so {{stored-pct}}% of requests fail",
              "why": "The {{stored-pct}}% is a share of the spans that were kept, not of the requests. Most healthy spans were dropped on purpose, and the errors were all kept."
            },
            {
              "key": "wrong",
              "label": "{{stored-pct}}% is a share of the kept spans, not a share of the requests",
              "why": "The policy keeps every error and {{keep-pct}}% of the rest, so the numerator is complete and the denominator is small. {{wrong-sum}} is a share of kept spans. Of {{requests}} requests a second, {{errors}} failed: {{true-sum}}."
            },
            {
              "key": "follow-up",
              "label": "{{errors}} errors in {{stored}} spans is a small sample, so get a week of spans",
              "why": "A bigger sample does not help, because the bias comes from the policy, not from noise. Keeping every error and {{keep-pct}}% of the rest overweights errors at any size. The question to ask is what the ratio is a share of."
            }
          ]
        }
      },
      {
        "intro": "The honest answer needs a setup that keeps the failed traces you want to open and an error rate that matches the requests. A sampling policy decides which traces are kept: a random share of all of them, every trace, or every error plus a share of the rest. The backend takes {{cap}} spans a second.",
        "question": "Pick the setup: keep what the team needs and stay within the cap.",
        "tradeoff": {
          "id": "ser-plan",
          "unit": "spans/s sent to the backend",
          "knobs": [
            {
              "id": "sampler",
              "label": "Sampling policy",
              "options": [
                {
                  "id": "probabilistic-10pct",
                  "label": "A probabilistic policy at {{keep-pct}}% of all traces: about {{uniform}} spans/s, chosen at random"
                },
                {
                  "id": "keep-all",
                  "label": "Keep every trace: {{requests}} spans/s"
                },
                {
                  "id": "probabilistic-18pct",
                  "label": "A probabilistic policy at {{decoy-pct}}% of all traces: about {{decoy}} spans/s, chosen at random"
                },
                {
                  "id": "errors-10pct",
                  "label": "Every error plus {{keep-pct}}% of the rest: {{stored-n}} spans/s"
                },
                {
                  "id": "errors-20pct",
                  "label": "Every error plus {{more-pct}}% of the rest: {{stored-more}} spans/s"
                }
              ]
            },
            {
              "id": "rate",
              "label": "Where the error rate is computed",
              "options": [
                {
                  "id": "red-before",
                  "label": "From RED metrics computed before sampling: data points, no extra spans"
                },
                {
                  "id": "mirror",
                  "label": "From every span, sent to a second backend that counts them: {{requests}} spans/s"
                },
                {
                  "id": "stored-spans",
                  "label": "From the spans the backend keeps: no extra spans"
                }
              ]
            }
          ],
          "needs": [
            {
              "id": "every-error",
              "label": "every failed trace"
            },
            {
              "id": "true-rate",
              "label": "an error rate that matches the requests"
            }
          ],
          "whyNot": {
            "sampler:probabilistic-10pct": "This policy keeps an honest ratio, but only about {{uniform-errors}} of the {{errors}} failed traces a second, so most failures can't be opened.",
            "sampler:probabilistic-18pct": "This policy keeps an honest ratio, but only about {{decoy-errors}} of the {{errors}} failed traces a second, so most failures can't be opened.",
            "sampler:keep-all": "Keeping every trace sends {{requests}} spans/s, {{times-over}} times the cap of {{cap}}.",
            "sampler:errors-20pct": "This policy keeps every error and a larger share of the healthy traces: {{stored-more}} spans/s, over the cap of {{cap}}.",
            "rate:mirror": "Counting every span gives the true rate, and sending all {{requests}} spans a second to a second backend is {{times-over}} times the cap of {{cap}} on its own.",
            "rate:stored-spans": "The rate from the spans the backend keeps is a share of kept spans. With every error kept and {{keep-pct}}% of the rest, that reads {{wrong-sum}}, not {{true-pct}}%."
          },
          "explain": "The plan sends {{stored-n}} of {{cap}} spans/s: all {{errors}} errors and {{kept-healthy}} of the {{healthy}} healthy traces. The rate comes from RED metrics computed before sampling, from all {{requests}} requests, so it reads {{true-sum}}; those metrics are data points, not spans, so they add nothing to the spans sent. Computed from the kept spans it would read {{wrong-sum}}. Sampling and the rate answer different questions: sampling decides which traces you keep to look at, the rate must count everything. Dash0 computes RED metrics before sampling when it samples your traces ([[SignalControl]]), and at the edge the <code>dash0redmetrics</code> connector runs in the pre-sampling pipeline, on 100% of spans. If you sample in your own Collector, the pipeline fix is the one in 6.2: compute span metrics before the sampler. These figures come from one authored table, not a measurement."
        }
      }
    ]
  }
};
