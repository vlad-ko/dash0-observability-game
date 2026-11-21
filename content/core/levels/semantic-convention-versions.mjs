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
              "label": "As each query sees the same data under both names, switch without waiting",
              "why": "The data is the same, the names are not. A query, a dashboard panel or an alert rule that filters on <code>http.status_code</code> matches nothing once that name stops arriving, and an alert that matches nothing stays quiet."
            },
            {
              "key": "move-queries",
              "label": "Move every query, alert rule and dashboard to the stable names, then switch to <code>http</code>",
              "why": "While <code>http/dup</code> is on, both names arrive, so you can move each query, dashboard and alert rule to <code>http.response.status_code</code>, <code>server.port</code> and <code>url.path</code> plus <code>url.query</code> and see it still returns data. Then set <code>OTEL_SEMCONV_STABILITY_OPT_IN</code> to <code>http</code> and the old names stop. In Dash0, a chart's PromQL filters name OpenTelemetry attributes, with the dots written as underscores (<code>service.name</code> is <code>service_name</code>), so check your charts for the old names too."
            },
            {
              "key": "rewrite-filters",
              "label": "Switch each filter to the new spelling while both versions arrive",
              "why": "With <code>http/dup</code> on, both names arrive, so a query, dashboard panel or alert rule rewritten to the stable name returns data straight away, and you can compare it with the old one. Once every filter has moved, setting <code>http</code> takes away only names that nothing reads. Check your Dash0 charts too: their PromQL filters name OpenTelemetry attributes."
            },
            {
              "key": "dup-until-unread",
              "label": "Stay on <code>http/dup</code> until no query depends on an old name, and go to <code>http</code> when that is true",
              "why": "<code>http/dup</code> emits the old and the stable names together so the move can be phased, and <code>http</code> stops emitting the old ones. So the order is to keep sending both while every query, dashboard and alert moves, and to set <code>http</code> only when no reader of an old name is left. The opt-in is meant for migrating, not as an end state."
            },
            {
              "key": "fix-when-quiet",
              "label": "Drop <code>http/dup</code>, set the opt-in to <code>http</code> and fix each alert rule when it goes quiet",
              "why": "An alert rule that filters on <code>http.status_code</code> matches nothing once that name stops arriving, and an alert that matches nothing stays quiet, which looks the same as healthy. The first you would learn of it is an incident that no rule paged for."
            },
            {
              "key": "alerts-first",
              "label": "While <code>http/dup</code> is on, move the alert rules to the stable names and each dashboard later",
              "why": "Alert rules are not the only readers of the old names. A dashboard panel that filters on an old name shows nothing once that name stops arriving, so the dashboards have to move before the switch too."
            },
            {
              "key": "route-only",
              "label": "Move the query on <code>http.route</code> to the stable name and then switch",
              "why": "<code>http.route</code> did not change: the migration page marks it \"No change\", so it keeps its name with either opt-in. The queries that break are the ones that filter on a name that was renamed, such as <code>http.status_code</code> or <code>net.host.port</code>."
            },
            {
              "key": "three-only",
              "label": "Update all queries that use these three old names on this span, and only then switch to <code>http</code>",
              "why": "Those three are only the old names on this one span. The migration page renames more, for example <code>http.method</code> to <code>http.request.method</code> and <code>http.scheme</code> to <code>url.scheme</code>, and a query on any of them stops matching when the opt-in goes to <code>http</code>."
            },
            {
              "key": "backend-joins",
              "label": "As the backend treats both versions alike, switch right away",
              "why": "The two names are different attributes, and a filter matches the key it names: in Dash0, a chart's PromQL filters name OpenTelemetry attributes, so a chart that filters on <code>http.status_code</code> matches that key and nothing else. Nothing on the migration page says a backend treats the two names as one."
            },
            {
              "key": "delete-rebuild",
              "label": "With <code>http/dup</code> on, delete every dashboard, alert and query that names an old attribute, then rebuild them once you switch to <code>http</code>",
              "why": "Between the delete and the rebuild nothing watches, and the rebuilt ones have no earlier version to compare with. While <code>http/dup</code> is on, both names arrive, so each one can be moved in place and checked against the data it already returns."
            },
            {
              "key": "keep-dup",
              "label": "Keep <code>http/dup</code> on for good, as no query or dashboard would then need to change",
              "why": "Every span then carries two copies of each attribute that changed, and the old names are the ones being replaced. <code>http/dup</code> is for the move, not the end state: the opt-in is meant for migrating."
            }
          ]
        }
      }
    ]
  }
};
