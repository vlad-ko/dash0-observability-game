// Text of levels/ai-assisted-debugging.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
// The step 2 choice labels are all about the attribute name, so only the 8.2 migration pair separates them: the rule is in the Step 2 comment of levels/ai-assisted-debugging.mjs.
export default {
  "id": "ai-assisted-debugging",
  "name": "AI-assisted debugging",
  "sub": "The agent asks by name",
  "rewardTitle": "Query reader",
  "play": {
    "finish": "You read an empty answer as a question about a name, not as proof of health. A query on an old attribute name matches nothing, so use the names the spans carry.\n\nIn Dash0, the MCP Server lets an assistant query your telemetry with read-only tools, Agent0 reads telemetry in the OpenTelemetry semantic conventions it was produced in, and you check the keys present with getAttributeKeys on the Dash0 MCP Server before you ask for a name.",
    "steps": [
      {
        "intro": "Orders are failing at the last step and you are asking an agent to run the queries. It shows each query and what came back. Find out why orders fail.",
        "incident": {
          "id": "ai-assisted-debugging",
          "alert": {
            "title": "Checkout failing at the last step",
            "html": "<p>PAGE {{rule-fired-at}}: the checkout error ratio rule is firing, and customers report that their order fails at the last step. An agent has read access to the telemetry and runs the queries you pick. The agent is simulated: no model is called and no real MCP server is reached. Each view is a query it ran and what came back, written for the game.</p>"
          },
          "views": [
            {
              "id": "failures-by-version",
              "label": "Agent: failures by version, last hour",
              "html": "<p>The agent was asked how the failed checkout requests of the last hour are spread over the versions. Version {{new-v}} went live on 3 of the 6 pods at {{release-at}}.</p><pre data-wrap><code>spans where service.name = checkout and http.response.status_code = 500\ngroup by service.version, {{release-at}} to {{failures-from}} and {{failures-from}} to {{query-at}}</code></pre><table><caption>Failed requests per 1,000 requests</caption><thead><tr><th scope=\"col\">Version</th><th scope=\"col\">{{release-at}} to {{failures-from}}</th><th scope=\"col\">{{failures-from}} to {{query-at}}</th></tr></thead><tbody><tr><th scope=\"row\">{{old-v}}</th><td>{{old-before}}</td><td>{{old-after}}</td></tr><tr><th scope=\"row\">{{new-v}}</th><td>{{new-before}}</td><td>{{new-after}}</td></tr></tbody></table><p>Both versions fail at the same rate from {{failures-from}}: from {{failures-from}} to {{query-at}} each version had {{old-failed}} failed requests, {{failed-after}} failed in all. The version that went live at {{release-at}} ran {{before-min}} minutes before that at the rate of the one that did not change.</p>"
            },
            {
              "id": "failing-trace",
              "label": "Agent: one failing trace",
              "html": "<p>The agent opened one of the {{sampled-traces}} failing traces it found since {{failures-from}}; all {{sampled-traces}} end the same way. Checkout reserves stock first and takes the payment after.</p><pre data-wrap><code>POST /checkout   SERVER  500  1842 ms\n  POST           CLIENT  503  1790 ms  server.address=inventory.kettle.example</code></pre><p>No span in the trace calls the payment provider.</p>"
            },
            {
              "id": "request-rate",
              "label": "Agent: requests a minute, last hour",
              "html": "<p>The agent was asked how many requests a minute checkout took in the last hour, and whether that changed.</p><table><caption>Requests a minute to POST /checkout</caption><thead><tr><th scope=\"col\">Time</th><th scope=\"col\">Requests a minute</th></tr></thead><tbody><tr><th scope=\"row\">{{rate-0-at}}</th><td>{{rate-0}}</td></tr><tr><th scope=\"row\">{{rate-1-at}}</th><td>{{rate-1}}</td></tr><tr><th scope=\"row\">{{rate-2-at}}</th><td>{{rate-2}}</td></tr><tr><th scope=\"row\">{{rate-3-at}}</th><td>{{rate-3}}</td></tr></tbody></table><p>The rate did not change at {{failures-from}} or since.</p>"
            },
            {
              "id": "alert-rule",
              "label": "Agent: the rule that paged",
              "html": "<p>The agent read the rule that paged you: checkout error ratio above {{error-ratio-rule-pct}}% for 15 minutes. It has been firing since {{rule-fired-at}}. The ratio since {{failures-from}} is {{pct-after}}%.</p>"
            },
            {
              "id": "node-status",
              "label": "Agent: node status",
              "html": "<p>{{nodes}} of {{nodes}} nodes in the checkout pool are Ready.</p>"
            },
            {
              "id": "service-list",
              "label": "Agent: services sending data, last 10 minutes",
              "html": "<p>The agent listed the {{services}} services that sent data in the last 10 minutes, among them checkout, inventory, payments and recommendations. Every one of them sent data in the last minute.</p>"
            },
            {
              "id": "failed-requests",
              "label": "Agent: failed requests, {{failures-from}} to {{query-at}}",
              "html": "<p>The agent was asked how many checkout requests failed from {{failures-from}} to {{query-at}}.</p><pre data-wrap><code>spans where service.name = checkout and http.status_code = 500\nresult: 0 spans</code></pre><p>The agent's answer: no failed checkout requests from {{failures-from}} to {{query-at}}.</p>"
            },
            {
              "id": "recent-changes",
              "label": "Agent: changes in the last hour",
              "html": "<p>The agent was asked what changed in the last hour.</p><table><caption>Changes in the last hour</caption><thead><tr><th scope=\"col\">Time</th><th scope=\"col\">Service</th><th scope=\"col\">Change</th></tr></thead><tbody><tr><th scope=\"row\">{{release-at}}</th><td>checkout</td><td>release {{new-v}} on 3 of 6 pods</td></tr><tr><th scope=\"row\">10:10</th><td>recommendations</td><td>release 5.2.0</td></tr></tbody></table><p>The agent lists recommendations 5.2.0 as the change closest to {{failures-from}}. It does not say whether checkout calls that service.</p>"
            },
            {
              "id": "card-charges",
              "label": "Agent: card charge times, last hour",
              "html": "<p>The agent was asked how long card charges took in the last hour.</p><table><caption>Card charge time, 95th percentile</caption><thead><tr><th scope=\"col\">Time</th><th scope=\"col\">Milliseconds</th></tr></thead><tbody><tr><th scope=\"row\">{{charge-0-at}}</th><td>{{charge-0}}</td></tr><tr><th scope=\"row\">{{charge-1-at}}</th><td>{{charge-1}}</td></tr><tr><th scope=\"row\">{{charge-2-at}}</th><td>{{charge-2}}</td></tr></tbody></table><p>The slowest charges got slower after {{failures-from}}. The agent does not say whether the failing orders reached a charge.</p>"
            }
          ],
          "hypotheses": [
            {
              "id": "inventory-failing",
              "label": "Checkout's stock reservations at the inventory service are failing, and checkout returns them as 500s",
              "why": "The failing trace shows checkout's call to inventory.kettle.example returning 503 and checkout answering 500, with no payment call after it. The failures begin at {{failures-from}} on both versions, {{old-after}} per 1,000 requests each, so it is not the {{release-at}} release, and the request rate stayed near {{rate-0}} a minute."
            },
            {
              "id": "bad-release",
              "label": "The checkout release that went out this morning has a bug that fails some orders",
              "why": "Both versions fail at the same rate from {{failures-from}}: {{old-after}} per 1,000 requests for {{old-v}}, which did not change, and {{new-after}} for {{new-v}}. And {{new-v}} ran from {{release-at}} to {{failures-from}} at {{new-before}} per 1,000, about the {{old-before}} of {{old-v}}. A bug in the new release would not fail the old one."
            },
            {
              "id": "payment-timeouts",
              "label": "The payment provider is timing out on card charges, and checkout returns those failures as 500s",
              "why": "Checkout reserves stock before it takes payment, and the failing trace ends at the stock reservation: no span in it calls the payment provider, so a slow charge cannot be what fails these orders."
            },
            {
              "id": "order-surge",
              "label": "A surge of orders at the shop overloaded checkout, so some of its requests fail under the load",
              "why": "The request rate was {{rate-0}} a minute at {{rate-0-at}}, {{rate-2}} at {{rate-2-at}} and {{rate-3}} at {{rate-3-at}}. Nothing changed when the failures began, so there was no surge."
            }
          ],
          "hint": "<p>A cause has to explain where the failing requests stop and whether the release explains the failures. Which cause fits what the views show?</p>"
        }
      },
      {
        "intro": "The incident is explained. The agent's failed-requests query answered \"no failed requests\", and its versions query counted {{failed-after}} failed from {{window}}. Here are the two queries, for the same window and the same service.",
        "question": "Why did the agent's failed-requests query return nothing?",
        "code": "Failed-requests query, {{window}}:\n  spans where service.name = checkout and http.status_code = 500\n  result: 0 spans\n\nVersions query, the {{window}} column of the step 1 versions query:\n  spans where service.name = checkout and http.response.status_code = 500\n  result: {{failed-after}} failed",
        "choice": {
          "id": "aad-why",
          "choices": [
            {
              "key": "old-name",
              "label": "The query used the name the status code had before the HTTP conventions went stable",
              "why": "The failed-requests query asks for http.status_code, the name before the HTTP conventions went stable. Checkout sends http.response.status_code now (its opt-in is http, level 8.2), so the old name matches nothing even while orders fail: the versions query, on the same spans and the same window, counted {{failed-after}} failed from {{window}}. Use the names the spans carry. In Dash0, [[Agent0]] reads telemetry in the OpenTelemetry semantic conventions it was produced in, and getAttributeKeys, one of the tools of the [[Dash0 MCP Server]], lists the attribute keys present, so check the keys present before you ask for a name."
            },
            {
              "key": "invented-name",
              "label": "The agent made up a span attribute for a status code that the HTTP conventions do not list",
              "why": "http.status_code was a real OpenTelemetry name: it is the name the HTTP conventions used before http.response.status_code replaced it (the migration pair of level 8.2). The agent did not make it up, but checkout no longer sends it."
            },
            {
              "key": "newer-name",
              "label": "The query used a newer name for the status code than checkout's instrumentation sends yet",
              "why": "The direction is the other way round: http.status_code is the older name, and the 8.2 migration renamed it to http.response.status_code. Checkout's spans already carry the newer one, as the {{failed-after}} failed from {{window}} show. The empty query used the older name."
            },
            {
              "key": "metric-label",
              "label": "The HTTP status code is a metric label, while spans store it under a different key",
              "why": "Both names are span attribute names in the HTTP conventions (the migration page renames one to the other), so spans do carry the status code as an attribute. The two queries differ by the name the migration renamed, not by metric against span."
            },
            {
              "key": "renamed",
              "label": "The HTTP status code was renamed, and no span carries the key that the query named any more",
              "why": "The failed-requests query filters on http.status_code and the versions query on http.response.status_code, on the same service and window, and only the second found failures: {{failed-after}} failed from {{window}}. The conventions renamed that key (the migration pair of level 8.2), so spans that carry the stable key have nothing under the old one and the filter matches no span."
            },
            {
              "key": "stable-key",
              "label": "The failing spans carry the current status code attribute, not the old one",
              "why": "Checkout sends http.response.status_code (its opt-in is http, level 8.2), and the versions query counted {{failed-after}} failed from {{window}} by that key. The failed-requests query asked for http.status_code, which no checkout span carries now, so it matched nothing while orders failed."
            },
            {
              "key": "value-type",
              "label": "The HTTP conventions store the status code as text on spans, and the query used a number",
              "why": "The HTTP spans page lists http.response.status_code as an int, and both queries compare it with 500. The versions query found {{failed-after}} failed spans that way, so the value matches. The two queries differ in the attribute name, not in how the value is written."
            },
            {
              "key": "sampling",
              "label": "Sampling dropped the spans with a failing status code and the query never saw them",
              "why": "The versions query read the same spans for {{window}} and counted {{failed-after}} failed, so the failing spans were there to be found. Sampling that dropped them would have emptied both queries, not one."
            },
            {
              "key": "underscores",
              "label": "Dash0 wants the status code name written with underscores, and the query used dots",
              "why": "Both queries write the key with dots, and the one that found {{failed-after}} failed spans is the one with the stable name. Underscores are how a chart's PromQL writes an attribute in Dash0 (<code>service.name</code> is <code>service_name</code>), not how these span queries write it."
            },
            {
              "key": "logs",
              "label": "A failing HTTP status code is recorded in logs, not on spans, so a span query finds none",
              "why": "The versions query read spans and found {{failed-after}} failed checkout requests from {{window}}, so the failures are on spans. The failed-requests query asked spans the same question and used a name those spans no longer carry."
            },
            {
              "key": "refused",
              "label": "The backend refuses attribute names the HTTP conventions deprecated, and returned nothing at all",
              "why": "The answer was 0 spans, which is what a query returns when no span matches, not a refusal. Nothing on the migration page says a backend rejects the old names: the query ran, and no span carried that key."
            },
            {
              "key": "lag",
              "label": "The failing status code spans had not been ingested when the query ran",
              "why": "The versions query read the same window, {{window}}, and counted {{failed-after}} failed, so the spans had arrived. Spans that were late would be missing from both queries."
            }
          ]
        }
      }
    ]
  }
};
