// Text of levels/the-alert-that-stayed-green.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
// Both steps show the same table (a step replaces the screen): the note is above VARS in levels/the-alert-that-stayed-green.mjs.
// The step 1 labels are close in length and the right one is the third: the rule is in the Step 1 comment of levels/the-alert-that-stayed-green.mjs.
export default {
  "id": "the-alert-that-stayed-green",
  "name": "The alert that stayed green",
  "sub": "Does that answer hold?",
  "rewardTitle": "Green doubter",
  "play": {
    "finish": "A green alert is not proof of health: an expression that returns nothing never fires. Check that the selector matches a series that exists, and group by the label that names the failure, so one route failing {{pay-failed}} of {{pay-requests}} is not averaged away by the rest.",
    "steps": [
      {
        "intro": "In a review, a presenter says: \"The checkout error alert has been green all afternoon, so checkout is healthy.\" Checkout deployed 20 minutes ago. The counter <code>http_server_requests_total</code> is incremented by the server for every request it handles (it is not made from spans), and has the labels <code>service</code>, <code>route</code> and <code>status</code>. The alert expression is <code>{{rule}}</code>, and it fires when that returns anything.",
        "question": "Why has the alert stayed green?",
        "show": "<table><caption>Checkout, per scrape (every 15 seconds), since the deploy</caption><thead><tr><th scope=\"col\">Route</th><th scope=\"col\">Requests</th><th scope=\"col\">With status 500</th></tr></thead><tbody><tr><td>/pay</td><td>{{pay-requests}}</td><td>{{pay-failed}}</td></tr><tr><td>/quote</td><td>{{quote-requests}}</td><td>0</td></tr></tbody></table><p>The only values the <code>status</code> label takes are \"200\" and \"500\". The labels are <code>service</code>, <code>route</code> and <code>status</code>.</p>",
        "choice": {
          "id": "asg-why",
          "choices": [
            {
              "key": "sampling",
              "label": "Sampling dropped the failed requests, so the counter never saw most of them",
              "why": "The server adds one to this counter for every request it handles, not from spans, so sampling cannot remove a request from it. The table shows the failures are counted: {{pay-failed}} of /pay's {{pay-requests}} requests a scrape carry status 500."
            },
            {
              "key": "window",
              "label": "The 5-minute window is too short, so the failures never lift the rate over 0.1",
              "why": "The failures are steady: /pay has failed {{pay-failed}} of {{pay-requests}} requests on every scrape since the deploy, and 5 minutes hold {{window-scrapes}} scrapes of them. A longer window averages the same steady failures and would still select the same series: the query returns nothing because of what it selects, not because of how long it looks."
            },
            {
              "key": "selector",
              "label": "The counter has no series with status=\"5xx\", so the numerator matches nothing",
              "why": "The status label holds the exact values \"200\" and \"500\", and a selector with <code>status=\"5xx\"</code> is an equality match on that text, not a class of codes, so it selects no series. A numerator with no series is empty, and an empty result divided by anything is empty. A rule fires when its expression returns something, so this one can never fire, however many requests fail."
            }
          ]
        }
      },
      {
        "intro": "The rule fires when its expression returns anything, and it compares a share of failed requests with {{threshold}}. The figures are the same as before.",
        "question": "Fix the rule so it returns one series per route, labelled route only, for each route whose share of failed requests over the last 5 minutes is above {{threshold}}.",
        "show": "<table><caption>Checkout, per scrape (every 15 seconds), since the deploy</caption><thead><tr><th scope=\"col\">Route</th><th scope=\"col\">Requests</th><th scope=\"col\">With status 500</th></tr></thead><tbody><tr><td>/pay</td><td>{{pay-requests}}</td><td>{{pay-failed}}</td></tr><tr><td>/quote</td><td>{{quote-requests}}</td><td>0</td></tr></tbody></table><p>The only values the <code>status</code> label takes are \"200\" and \"500\". The labels are <code>service</code>, <code>route</code> and <code>status</code>.</p>",
        "query": {
          "id": "asg-rule",
          "explain": "Two things were wrong, and fixing either alone still leaves the rule silent. <code>status=\"5xx\"</code> selects no series, because the label holds \"500\": the numerator was empty. With only that fixed, the whole service fails {{pay-failed}} of {{all-requests}} requests, {{service-ratio}}, which a comparison with {{threshold}} drops from the result (the operators page: elements for which the comparison is false get dropped), so the rule is still empty and still silent. With only <code>by (route)</code> fixed, the numerator is still empty. With both, /pay reads {{pay-ratio}}, above {{threshold}}, and the rule returns <code>{route=\"/pay\"}</code>, one series per route, labelled route only (<code>by</code> drops the other labels). A rule is active for each label set its expression returns (the alerting rules page), so the alert now carries the route that fails. To catch a typo like this early, <code>absent()</code> is a guard: the functions page says it \"returns an empty vector if the vector passed to it has any elements\" and a 1-element vector with the value 1 \"if the vector passed to it has no elements\", and that it is \"useful for alerting on when no time series exist for a given metric name and label combination\". Use it on a selector that must always have series, such as the status \"200\" ones: for status \"500\", no series may just mean no failures, so it is no rule on its own."
        }
      }
    ]
  }
};
