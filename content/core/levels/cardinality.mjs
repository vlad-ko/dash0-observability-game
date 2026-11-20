// Text of levels/cardinality.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
export default {
  "id": "cardinality",
  "name": "Cardinality",
  "sub": "Every label counts",
  "rewardTitle": "Series counter",
  "play": {
    "finish": "You can count the series a metric makes, spot the attributes that never stop growing, and keep to a budget with http.route and the user id on a span. Dash0 shows what drives volume, and a spam filter drops it at ingestion, though fixing the source comes first.",
    "steps": [
      {
        "intro": "Kettle & Co's recommendations service counts the requests it serves in <code>http.server.requests</code>. A [[metric]] keeps one <b>[[series|time-series]]</b> for every unique combination of attribute values it has seen. This counter carries <code>http.request.method</code> ({{method}} values), <code>http.route</code> ({{route}} routes) and <code>http.response.status_code</code> ({{status}} codes).",
        "question": "At most how many series can this one counter have?",
        "choice": {
          "id": "cdn-combos",
          "choices": [
            {
              "key": "sum",
              "label": "{{method}} + {{route}} + {{status}} = {{sum-mrs}}: one series per value",
              "why": "A series is one value of every [[attribute]] together, not one value alone. A POST to one route with a 200 and a GET to the same route with a 200 are two series, so adding the counts leaves most of them out."
            },
            {
              "key": "product",
              "label": "{{times-mrs}} = {{product-mrs}}",
              "why": "Every combination of a method, a route and a status code is its own series, so the product is the most the counter can have. In practice fewer exist, because not every route answers every method and every code. One more attribute multiplies it again: add <code>user.id</code> with {{user}} values and the bound is {{product-mrsu}}."
            },
            {
              "key": "attributes",
              "label": "3: one series per attribute",
              "why": "An attribute is a dimension, not a series. A counter with three attributes has one series for every combination of their values."
            },
            {
              "key": "one",
              "label": "1: a counter is a single number",
              "why": "Without attributes it would be one series. Every attribute splits it by that attribute's values."
            }
          ]
        }
      },
      {
        "intro": "Then somebody adds attributes \"to make the dashboards more useful\". The Metric Explorer lists one sample series for each attribute now on the counter, with a value it carries. Some attributes stay a short, fixed list. Others take a new value for every URL, user or request.",
        "question": "Spot the attributes whose values never stop growing.",
        "spot": {
          "id": "cdn-spot",
          "hint": "Ask how many different values each [[label]] takes over a month, not what one value looks like.",
          "lines": [
            {
              "id": "route",
              "text": "http_server_requests_total{http_route=\"/recommendations/{id}\"}"
            },
            {
              "id": "method",
              "text": "http_server_requests_total{http_request_method=\"POST\"}"
            },
            {
              "id": "url-path",
              "text": "http_server_requests_total{url_path=\"/recommendations/48211\"}"
            },
            {
              "id": "port",
              "text": "http_server_requests_total{server_port=\"8443\"}"
            },
            {
              "id": "user-id",
              "text": "http_server_requests_total{user_id=\"u-31402\"}"
            },
            {
              "id": "status",
              "text": "http_server_requests_total{http_response_status_code=\"503\"}"
            },
            {
              "id": "request-id",
              "text": "http_server_requests_total{request_id=\"xkqmvzthbwpr\"}"
            },
            {
              "id": "region",
              "text": "http_server_requests_total{cloud_region=\"eu-west-1\"}"
            }
          ],
          "whyNot": {
            "route": "A route template: the dynamic segments are placeholders, so every request to the route carries the same value. The semantic conventions require <code>http.route</code> to be low-cardinality for this reason.",
            "method": "A short list of values. The semantic conventions map a method the instrumentation does not know to <code>_OTHER</code>, so this cannot grow without bound.",
            "status": "It looks like a number, but a status code is one of a short list of values. What makes an attribute high-cardinality is how many different values it takes, not what they look like.",
            "port": "A port is a number, but a service listens on a short list of ports that its configuration sets, and the list changes only when somebody changes that configuration. What makes an attribute high-cardinality is how many different values it takes, not how many digits it has.",
            "region": "A cloud provider has a short, published list of regions, and a company runs in a handful of them. Few values, and the set changes rarely."
          },
          "explain": "The URL path, the user id and the request id each take a new value for every URL, user or request, so each new one is a new series. For the URL, use <code>http.route</code>: the template with the ids replaced by placeholders, <code>/recommendations/{id}</code> and not <code>/recommendations/48211</code>. The price is more than the bill. Prometheus' own guidance is not to use labels for unbounded values such as user IDs, and an SDK that implements the specification's cardinality limit (2,000 per metric by default) folds the combinations it has not seen yet into one point marked <code>otel.metric.overflow</code>, so the breakdown you added stops being accurate."
        }
      },
      {
        "intro": "The team has a budget of {{cap}} series for the recommendations metrics, and three questions to keep answering. Every option shows its worst case: the product of the number of values of the attributes it keeps, for one metric. A plan costs the sum of the series of its two counters; a span attribute is not a metric series, so it costs 0.",
        "question": "Pick a setting for each of the three: keep every need and stay within the budget.",
        "tradeoff": {
          "id": "cdn-budget",
          "unit": "series",
          "hint": "A counter's series are the number of values of every attribute on it, multiplied together, so each attribute you add multiplies the counter that carries it. Ask what each attribute lets you ask, and what it does to the counter it sits on.",
          "knobs": [
            {
              "id": "requests",
              "label": "Counter <code>http.server.requests</code>",
              "options": [
                {
                  "id": "route",
                  "label": "<code>http.route</code>: {{route}}"
                },
                {
                  "id": "route-status-tier",
                  "label": "<code>http.route</code>, <code>http.response.status_code</code> and <code>customer.tier</code>: {{times-rst}} = {{route-status-tier}}"
                },
                {
                  "id": "route-method",
                  "label": "<code>http.route</code> and <code>http.request.method</code>: {{times-rm}} = {{route-method}}"
                },
                {
                  "id": "route-status",
                  "label": "<code>http.route</code> and <code>http.response.status_code</code>: {{times-rs}} = {{route-status}}"
                },
                {
                  "id": "route-tier",
                  "label": "<code>http.route</code> and <code>customer.tier</code>: {{times-rt}} = {{route-tier}}"
                }
              ]
            },
            {
              "id": "served",
              "label": "Counter <code>recommendations.served</code>",
              "options": [
                {
                  "id": "user",
                  "label": "<code>user.id</code>: {{user}}"
                },
                {
                  "id": "none",
                  "label": "No attributes"
                },
                {
                  "id": "tier",
                  "label": "<code>customer.tier</code>: {{tier}}"
                },
                {
                  "id": "tier-kind",
                  "label": "<code>customer.tier</code> and <code>recommendation.type</code>: {{times-tk}} = {{tier-kind}}"
                },
                {
                  "id": "type",
                  "label": "<code>recommendation.type</code>: {{kind}}"
                }
              ]
            },
            {
              "id": "customer",
              "label": "Where one customer's failing requests can be found",
              "options": [
                {
                  "id": "nothing",
                  "label": "Nowhere: no attribute carries the user"
                },
                {
                  "id": "span-attribute",
                  "label": "<code>user.id</code> as an attribute on the checkout span: not a metric series, so 0"
                }
              ]
            }
          ],
          "needs": [
            {
              "id": "errors-by-route",
              "label": "the error rate of each route"
            },
            {
              "id": "tier-volume",
              "label": "a count of traffic for each customer tier"
            },
            {
              "id": "one-customer",
              "label": "one customer's failing requests"
            }
          ],
          "whyNot": {
            "requests:route": "One series for each route, and no status code, so no error rate of each route.",
            "requests:route-method": "It splits each route by method, and the error rate of a route needs the status code, not the method.",
            "requests:route-tier": "It counts the traffic of each tier on each route, and with no status code there is no error rate of each route.",
            "requests:route-status-tier": "It keeps the tier on the same counter, and every attribute multiplies the counter: {{times-rst}} = {{route-status-tier}}, where a counter of its own for the tier adds {{tier}}. With no attributes on the other counter and the span attribute the plan is {{one-counter}} series, over the {{cap}}.",
            "served:user": "One series for each of {{user}} users, from a single counter, and still no tier. A per-customer view belongs on a span.",
            "served:none": "One series, and no count for each tier on this counter.",
            "served:type": "A count for each kind of recommendation, {{kind}} series, and no count for each customer tier.",
            "served:tier-kind": "Every attribute multiplies the counter: {{times-tk}} = {{tier-kind}} where the tier alone is {{tier}}, and the count of traffic for each tier needs only the tier. With the route and status counter the plan is {{tier-and-kind}} series, over the {{cap}}.",
            "customer:nothing": "No attribute carries the user anywhere, so one customer's failing requests cannot be found."
          },
          "explain": "{{route-status}} series for the route and status counter, {{tier}} for the tier counter and 0 for the span attribute. The tier is cheap on a counter of its own, and an attribute multiplies the counter that carries it: the same tier on the requests counter would make {{times-rst}} = {{route-status-tier}}. Put the route template and the tier on the metrics, where a bounded set of values is what aggregation needs, and the user id on the span, where one value for each request is what a span is for. Spans have their own volume and cost, which this budget does not count."
        }
      },
      {
        "intro": "Dash0's Metric Explorer has a tree map that sizes every metric by its cardinality. The <code>recommendations.served</code> counter is a big tile since a <code>user_id</code> attribute shipped last quarter. Dash0 also has spam filters, which drop telemetry at ingestion.",
        "question": "What do you do about it?",
        "choice": {
          "id": "cdn-dash0",
          "choices": [
            {
              "key": "fix-source",
              "label": "Stop emitting the attribute at the source: a spam filter drops whole data points, not one attribute",
              "why": "The tree map shows which metric is large, and its sidebar shows the attributes behind it. Dash0's guidance for random or unbounded values is to reduce them at the instrumentation layer. A spam filter matches data points and drops them before they are stored, and a drop cannot be recovered. The filtered data still passes through ingest and carries the ingest charge, so a filter cuts what is stored, not what you send. To filter before sending, you can export it as a Collector filter processor configuration."
            },
            {
              "key": "spam-attribute",
              "label": "Add a spam filter on <code>user_id</code>: it strips that attribute and keeps the rest of each point",
              "why": "A spam filter drops the data points that match its criteria. It does not strip one attribute from a point and keep the point, so the counts you wanted would go too."
            },
            {
              "key": "spam-free",
              "label": "Add a spam filter on the metric: the dropped points never reach ingest and stop counting toward the data you send",
              "why": "Dropped data is not stored, but it still passes through SignalControl and carries the ingest charge. A spam filter reduces what is stored, not what you send."
            },
            {
              "key": "leave",
              "label": "Leave it: storage handles a large number of series well, so a high cardinality score is a warning to ignore",
              "why": "A high score is not always a problem, but it is a prompt to ask whether all of those dimensions are needed. Here a user id is the reason for it, and nothing needs a series for every user."
            }
          ]
        }
      }
    ]
  }
};
