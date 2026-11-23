// Level 8.2: Semantic convention versions. Act 8 "Operating at scale". Kettle & Co's checkout upgraded its instrumentation and
// runs with OTEL_SEMCONV_STABILITY_OPT_IN=http/dup, so its HTTP spans carry the old attribute names and the stable ones side by side.
// The player reads eight attributes of one server span and spots the three old names that stop arriving when the opt-in goes to
// `http` (Spot it), then answers what has to happen first (Choice): move every query, alert and dashboard to the stable names, then
// switch. Hints are off (the default ladder: hints in early acts only).
// The Choice is an answer pool (#390, docs/CONTENT.md section 10): the content lists 11 answers and a showing draws 3. Its extra
// answers use only the pages below, re-read 2026-11-21: on the migration page, `http/dup` is "for a phased rollout", `http` stops
// emitting the old names, the variable "is only intended to be used when migrating", `http.route` is "No change", and more names
// are renamed than the eight shown (`http.method` to `http.request.method`, `http.scheme` to `url.scheme`, `net.host.name` to
// `server.address`); on the Dash0 drilldown page, a chart's PromQL filters and series labels are OpenTelemetry attributes. Not
// claimed: that a backend (Dash0 included) reads the old and the stable names as one, which the wrong answer "the backend treats
// them as the same attribute" rests on as reasoning (a filter matches the key it names).
// Spec: https://opentelemetry.io/docs/specs/semconv/non-normative/http-migration/ , https://opentelemetry.io/docs/specs/semconv/http/http-spans/
// Dash0 docs: https://www.dash0.com/docs/dash0/dashboards/reference-drilldown-filter-translation
//
// Facts used (read on the migration page and the HTTP spans page, 2026-11-05, except where noted): the migration page maps `http.method`
// to `http.request.method`, `http.status_code` to `http.response.status_code`, `net.host.port` to `server.port` on server spans, and
// `http.target` to `url.path` plus `url.query`; `http.route` is "No change"; `http.user_agent` to `user_agent.original` (the intro
// example, not a line). `OTEL_SEMCONV_STABILITY_OPT_IN` accepts `http` (emit the stable conventions and stop emitting the old ones the
// instrumentation emitted before) and `http/dup` (emit both, for a phased rollout). The HTTP spans page: `http.request.method` is a
// stable name; on server spans `client.address` is Recommended ("domain name if available without reverse DNS lookup"), and
// `http.request.header.<key>` is Opt-In, a string[], the key the normalized lowercase header name, so a `Content-Type: application/json`
// header is `http.request.header.content-type` with value `["application/json"]` (the migration page: the dash to underscore
// normalization was removed). Dash0 page: its drilldown filter translation page says a chart's PromQL filters and series labels are
// OpenTelemetry attributes (`service.name`, `http.response.status_code`), written with underscores in PromQL (`service_name`). Not
// claimed: that Dash0 reads both the old and the stable names, or that anything keeps working in Dash0 after the switch.
//
// The board is built so no first-segment namespace reads the answer: the old names are in `http.` and `net.`, and so are three stable names
// (`http.request.method`, `http.route`, `http.request.header.content-type`). A depth-2 rule ("not under `http.request.`")
// does pick the faults plus `http.route`; that is accepted as the concept (#207). Pinned in test/spot-tells.test.mjs.
//
// Invented for the game: the company, the checkout service, the values on the span (/checkout, /checkout?step=pay, POST, 500, 8443, gw.kettle.example) and the
// scenario of the week-ahead switch. Each attribute is shown as `key=value`.
//
// The words are in content/core/levels/semantic-convention-versions.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/semantic-convention-versions.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

const SKELETON = {
  id: 'semantic-convention-versions',
  no: '8.2',
  icon: '\u{1F4D6}',
  cards: [],
  lights: ['storefront'],
  scoring: { parMs: null },
  play: {
    prefix: 'scv',
    steps: [
      {
        qid: 'scv-q-spot',
        spot: {
          id: 'scv-spot',
          target: 'span',
          helps: { hints: false },
          faults: ['http-target', 'net-host-port', 'http-status-code'],
        },
      },
      {
        qid: 'scv-q-switch',
        // An answer pool: 3 right and 8 wrong in the content, a showing draws 3. Every right answer is marked here, and a right
        // answer added in the content file without `right: true` would be graded wrong. Every choice's text is in the content file.
        choice: {
          id: 'scv-switch',
          draw: 3,
          choices: [{ key: 'move-queries', right: true }, { key: 'rewrite-filters', right: true }, { key: 'dup-until-unread', right: true }],
        },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
