// Text of levels/everything-is-green.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
export default {
  "id": "everything-is-green",
  "name": "Everything is green",
  "sub": "The monitoring says fine",
  "rewardTitle": "Outside looker",
  "play": {
    "finish": "Green meant nothing here: every number counted requests that arrived, and the check ran from inside, while the failure sat in front of the service. Spans and an SLI tell you how the requests that arrive are doing; a probe from outside tells you whether a visitor can arrive at all.",
    "steps": [
      {
        "intro": "Customers cannot load the shop and nothing has paged. Find out why every dashboard says all is well.",
        "incident": {
          "id": "everything-is-green",
          "alert": {
            "title": "Shop unreachable, dashboards green",
            "html": "<p>PAGE 09:21, from support and not from an alert: customers have reported since 08:10 that the shop will not load. Every dashboard is green and no alert has fired. Find out why the monitoring says nothing is wrong.</p>"
          },
          "views": [
            {
              "id": "span-numbers",
              "label": "Server spans of the shop",
              "html": "<p>Server spans of the shop, 5-minute windows named by their start:</p><table><caption>Server spans of the shop</caption><thead><tr><th scope=\"col\">Window</th><th scope=\"col\">Requests</th><th scope=\"col\">Errors</th><th scope=\"col\">Error ratio</th><th scope=\"col\">Burn rate</th><th scope=\"col\">p99</th></tr></thead><tbody><tr><th scope=\"row\">{{at-before}}</th><td>{{req-before}}</td><td>{{err-before}}</td><td>{{ratio-before}}%</td><td>{{burn-before}}</td><td>{{p99-before}} ms</td></tr><tr><th scope=\"row\">{{at-first}}</th><td>{{req-first}}</td><td>{{err-first}}</td><td>{{ratio-first}}%</td><td>{{burn-first}}</td><td>{{p99-first}} ms</td></tr><tr><th scope=\"row\">{{at-now}}</th><td>{{req-now}}</td><td>{{err-now}}</td><td>{{ratio-now}}%</td><td>{{burn-now}}</td><td>{{p99-now}} ms</td></tr></tbody></table><p>Requests fell by {{drop-pct}}% between the first two windows and have stayed there. Every window still has requests, so each ratio has a value: {{err-now}} of {{req-now}} failed.</p>"
            },
            {
              "id": "who-calls",
              "label": "Requests by caller",
              "html": "<p>The {{at-now}} window, requests by caller. Visitors come through the CDN edge, then the load balancer, then the pods; internal tools call the load balancer directly.</p><table><caption>Requests by caller</caption><thead><tr><th scope=\"col\">Caller</th><th scope=\"col\">{{at-now}} today</th><th scope=\"col\">{{last-week-at}} last week</th></tr></thead><tbody><tr><th scope=\"row\">Browsers</th><td>{{visitors-now}}</td><td>{{visitors-last-week}}</td></tr><tr><th scope=\"row\">Internal tools</th><td>{{internal}}</td><td>{{internal}}</td></tr><tr><th scope=\"row\">Counted by the load balancer</th><td>{{req-now}}</td><td>{{last-week-requests}}</td></tr></tbody></table><p>The {{internal}} internal requests fail no more often than before.</p>"
            },
            {
              "id": "outside-request",
              "label": "A request from outside",
              "html": "<p>A request from a laptop outside the network, at {{outside-at}}, to the shop's public hostname (curl output, abridged):</p><pre data-wrap><code>$ curl -v -I https://shop.kettle.example/\n* Host shop.kettle.example:443 was resolved.\n* Connected to shop.kettle.example (203.0.113.10) port 443\n[...]\n* SSL certificate problem: certificate has expired\ncurl: (60) SSL certificate problem: certificate has expired</code></pre><p>The certificate the CDN edge serves for <code>shop.kettle.example</code> ends at {{expires-at}} today. The same request to the origin by its internal name returns 200.</p>"
            },
            {
              "id": "alert-rules",
              "label": "Alert rules and checks",
              "html": "<p>The shop's alert rules, state at {{at-now}}:</p><table><caption>Alert rules</caption><thead><tr><th scope=\"col\">Rule</th><th scope=\"col\">Reads</th><th scope=\"col\">Pages when</th><th scope=\"col\">State</th></tr></thead><tbody><tr><th scope=\"row\">Error ratio of the shop's server spans</th><td>{{ratio-now}}%</td><td>above {{error-ratio-pct}}%</td><td>Quiet</td></tr><tr><th scope=\"row\">Burn rate of the shop's server spans, over 5 minutes and 1 hour</th><td>{{burn-now}} in both</td><td>above {{burn-rate-line}} in both</td><td>Quiet</td></tr><tr><th scope=\"row\">p99 of the shop's server spans</th><td>{{p99-now}} ms</td><td>above {{p99-limit}} ms</td><td>Quiet</td></tr><tr><th scope=\"row\">Health check of the origin's /health, run every minute from inside the cluster</th><td>passed {{health-passed}} of {{health-passed}}</td><td>a run fails</td><td>Quiet</td></tr></tbody></table><p>No rule watches how many requests arrive.</p>"
            },
            {
              "id": "origin-pods",
              "label": "Pods behind the load balancer",
              "html": "<p>6 of 6 pods are Running with no restarts in 24 hours, at 9% CPU and 31% memory. None is under pressure.</p>"
            },
            {
              "id": "last-deploy",
              "label": "Recent deploys and config changes",
              "html": "<p>The last deploy of the shop was on Tuesday, and nothing was released near 08:00.</p>"
            },
            {
              "id": "database",
              "label": "Database",
              "html": "<p>11 of 200 connections are in use and the slowest query takes 5 ms. The database is quiet and healthy.</p>"
            },
            {
              "id": "collector-health",
              "label": "The Collector",
              "html": "<p>Spans accepted, refused and exported by the Collector, last 24 hours: no refusals and no export failures, apart from 90 seconds of retries at 06:42 that recovered. The inventory sync job's span arrives in every 5-minute window, so telemetry is flowing.</p>"
            },
            {
              "id": "payment-latency",
              "label": "The payment provider",
              "html": "<p>p99 of the shop's outgoing calls to the payment provider rose to 1.8 s from 09:02 to 09:06, on 14 test orders placed by internal tools, and was back to 320 ms from 09:07. The shop has had no browser visitors since 08:00.</p>"
            }
          ],
          "hypotheses": [
            {
              "id": "expired-certificate",
              "label": "The certificate on the CDN edge has expired, so browsers refuse to connect",
              "why": "In the span numbers, requests fell from {{req-before}} to {{req-first}} in the window starting {{at-first}}, and the callers view shows that only internal tools still send any: no browser request reaches the shop. The request from outside resolves the hostname and connects, then fails on a certificate that ends at {{expires-at}}. The monitoring is green because it measures requests that arrive: {{err-now}} of {{req-now}} failed is {{ratio-now}}%, the burn rate is {{burn-now}}, and the health check goes to the origin from inside the cluster, where the certificate is never presented."
            },
            {
              "id": "collector-dropping",
              "label": "The Collector is dropping the shop's spans, so the dashboards show only part of the real traffic",
              "why": "The Collector refused and failed to export nothing apart from 90 seconds of retries at 06:42, and the inventory sync job's span arrives in every window. The load balancer, which does not use spans, counts the same {{req-now}} requests in the {{at-now}} window, so the requests are missing before they reach telemetry, not after. And dropped spans could not make a visitor's request fail on a certificate."
            },
            {
              "id": "payment-provider-slow",
              "label": "The payment provider is slow, so shoppers give up at checkout",
              "why": "The slow calls ran from 09:02 to 09:06, more than an hour after the traffic fell, and they were test orders from internal tools. Shoppers cannot give up at checkout when they never load the page: browsers sent {{visitors-now}} requests in the {{at-now}} window against {{visitors-last-week}} a week earlier."
            },
            {
              "id": "dns-lapsed",
              "label": "The shop's public hostname no longer resolves, because the DNS record or the domain lapsed",
              "why": "Only the request from outside rules this out, and it does: the hostname resolved and the connection opened, and the request failed afterwards, at the certificate (curl error 60). A name that no longer resolved would have failed earlier, with curl error 6, Could not resolve host, before any certificate was presented."
            },
            {
              "id": "origin-overloaded",
              "label": "The origin is overloaded and refuses new connections from browsers",
              "why": "The pods are at 9% CPU and the database is quiet, and an overloaded origin would show errors or slow requests in its spans. The internal requests that do arrive take {{p99-now}} ms at p99, faster than the {{p99-before}} ms of the {{at-before}} window, and the same origin answers 200 when called by its internal name."
            }
          ],
          "hint": "<p>Green means the numbers see nothing wrong, not that nothing is wrong. For each number, ask what it counts and where it is counted, and compare that with what a customer does first.</p>"
        }
      },
      {
        "intro": "The incident is explained. In the review, someone asks which addition would have paged at 08:00.",
        "question": "Which addition would have paged within minutes of the certificate ending, and named the step that failed?",
        "choice": {
          "id": "eig-page",
          "choices": [
            {
              "key": "outside-check",
              "label": "A probe of the public hostname, run every minute from a public location, that pages on failure",
              "why": "The check makes the request from outside the network the way a visitor does, so it meets the expired certificate that the spans and the internal health check never meet. In Dash0, a synthetic check sends requests at regular intervals from locations you choose and fires a notification when an assertion fails, and a check run breaks the request into DNS resolution, TCP connection and the SSL/TLS handshake and shows a TLS error as such. It pages in the first minute after the certificate ends and says which step failed."
            },
            {
              "key": "tighter-ratio",
              "label": "An error-ratio alert on the shop's server spans, with the threshold lowered from {{error-ratio-pct}}% to 0.1%",
              "why": "The ratio is {{err-now}} of {{req-now}}, which is {{ratio-now}}% under any threshold above zero. A failed handshake never becomes a span of the shop's service, so no threshold on the shop's server spans can make them report it."
            },
            {
              "key": "load-balancer-sli",
              "label": "An SLI computed from the load balancer's request counts instead of from server spans",
              "why": "The load balancer is the better source for requests it turned away (7.2), but here the refusal happens in front of it, at the CDN edge. It counted {{req-now}} requests in the {{at-now}} window, all good, so its ratio reads {{ratio-now}}% failed just as the spans do."
            },
            {
              "key": "faster-health",
              "label": "A /health check on the origin from inside the cluster, run every 10 seconds instead of every minute",
              "why": "Every run already passes ({{health-passed}} of {{health-passed}}), and running it more often only repeats a passing result. The check goes to the origin from inside the cluster, a path that never meets the CDN edge or its certificate."
            },
            {
              "key": "rate-drop",
              "label": "An alert on the request rate of the shop's server spans falling below half of the usual for that hour",
              "why": "This one would have fired: the {{at-now}} window holds {{req-now}} requests against {{last-week-requests}} at that hour a week earlier, far under the half ({{rate-half}}) it waits for. It says only that traffic fell, and a certificate, a DNS fault, a bad release and a holiday all look the same in it. A probe from outside names the step that failed, which is what the question asks for."
            }
          ]
        }
      }
    ]
  }
};
