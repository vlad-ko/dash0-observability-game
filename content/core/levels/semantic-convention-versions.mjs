// Text of levels/semantic-convention-versions.mjs (docs/CONTENT.md).
// When editing the attribute lines, keep their placement rule: no first-segment namespace reads the answer; see the header of levels/semantic-convention-versions.mjs, pinned in test/spot-tells.test.mjs.
export default {
  "id": "semantic-convention-versions",
  "name": "Semantic convention versions",
  "sub": "Names change",
  "rewardTitle": "Convention keeper",
  "play": {
    "finish": "Semantic convention names change as they go stable. Send both names with http/dup, move every query, dashboard and alert to the stable names, then set the opt-in to http.",
    "steps": [
      {
        "intro": "OpenTelemetry's HTTP semantic conventions went stable with new names: <code>http.user_agent</code> became <code>user_agent.original</code>. Kettle &amp; Co's checkout upgraded its instrumentation and set <code>OTEL_SEMCONV_STABILITY_OPT_IN</code> to <code>http/dup</code>, so its HTTP spans carry the old and the stable names side by side. Next week the team sets it to <code>http</code>, which sends the stable names only. Here are eight attributes from one checkout server span. Each line is one attribute, as key=value.",
        "question": "Spot the attributes that stop arriving once the opt-in is set to http.",
        "spot": {
          "id": "scv-spot",
          "lines": [
            {
              "id": "http-target",
              "text": "http.target=/checkout?step=pay"
            },
            {
              "id": "server-port",
              "text": "server.port=8443"
            },
            {
              "id": "request-method",
              "text": "http.request.method=POST"
            },
            {
              "id": "client-address",
              "text": "client.address=gw.kettle.example"
            },
            {
              "id": "net-host-port",
              "text": "net.host.port=8443"
            },
            {
              "id": "route",
              "text": "http.route=/checkout"
            },
            {
              "id": "request-header",
              "text": "http.request.header.content-type=[\"application/json\"]"
            },
            {
              "id": "http-status-code",
              "text": "http.status_code=500"
            }
          ],
          "whyNot": {
            "server-port": "The stable name for the port the request was addressed to, usually from the Host header.",
            "request-method": "The stable name for the request method. Stable names can start with <code>http.</code> too.",
            "client-address": "Not an old name: the address of the client that sent the request, a stable name.",
            "route": "Unchanged: <code>http.route</code> keeps its name with either opt-in, so it stays. Not every name that looks old has changed.",
            "request-header": "A stable name: a request header, recorded as a list of values under <code>http.request.header.</code> plus the header name."
          },
          "explain": "Those three are the old names: <code>http.target</code> (now split into <code>url.path</code> and <code>url.query</code>), <code>net.host.port</code> (now <code>server.port</code>) and <code>http.status_code</code> (now <code>http.response.status_code</code>). With <code>OTEL_SEMCONV_STABILITY_OPT_IN</code> set to <code>http/dup</code> the instrumentation sends the old and the stable names side by side; with <code>http</code> it sends only the stable ones, and the old names stop arriving. <code>http.route</code> did not change."
        }
      },
      {
        "intro": "The team is ready to set the opt-in to <code>http</code>. Of the eight attributes you just read, 3 are old names that <code>http/dup</code> sends alongside the stable ones.",
        "question": "What has to happen first?",
        "choice": {
          "id": "scv-switch",
          "choices": [
            {
              "key": "switch-now",
              "label": "Switch now: the stable names are the same data, so everything keeps working",
              "why": "The data is the same, the names are not. A query, a dashboard panel or an alert rule that filters on <code>http.status_code</code> matches nothing once that name stops arriving, and an alert that matches nothing stays quiet."
            },
            {
              "key": "move-queries",
              "label": "Move every query, alert and dashboard to the stable names, then switch",
              "why": "While <code>http/dup</code> is on, both names arrive, so you can move each query, dashboard and alert rule to <code>http.response.status_code</code>, <code>server.port</code> and <code>url.path</code> plus <code>url.query</code> and see it still returns data. Then set <code>OTEL_SEMCONV_STABILITY_OPT_IN</code> to <code>http</code> and the old names stop. In Dash0, a chart's PromQL filters name OpenTelemetry attributes, with the dots written as underscores (<code>service.name</code> is <code>service_name</code>), so check your charts for the old names too."
            },
            {
              "key": "keep-dup",
              "label": "Keep <code>http/dup</code> on for good, so no query, dashboard or alert has to change",
              "why": "Every span then carries two copies of each attribute that changed, and the old names are the ones being replaced. <code>http/dup</code> is for the move, not the end state: the opt-in is meant for migrating."
            }
          ]
        }
      }
    ]
  }
};
