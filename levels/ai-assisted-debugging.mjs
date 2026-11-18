// Level 8.5: AI-assisted debugging. Act 8 "Operating at scale". Checkout fails for about 1 order in 11 at the last step, and an AGENT runs
// the queries: each view shows the query the agent ran and what came back. The agent is simulated, an authored view per query: no
// model is called and no real MCP server is reached, and the copy says so. Three clues hold the chain (the failures are spread over
// both versions of checkout, so it is not the release; a failing trace ends at a 503 from the inventory service, before any payment
// call; the request rate never moved, so it is not a surge). Four views are neutral; two are red herrings (the release list and the
// card charge times, which point at the release and at the payment provider). The nuance is a neutral view, not a herring: the agent's
// failed-requests query used a legacy attribute name (`http.status_code`, the old name 8.2 teaches) and got 0 spans, which tempts "nothing is
// failing". Looking at it costs no penalty. Step 2 puts it beside the versions query (same window and service, the stable name
// `http.response.status_code`, 984 failed) and asks WHY it found nothing: the closing Choice grades the nuance.
// Agents need good semantic conventions as much as people do. Scored. A plain-data Scenario for the incident engine, played through
// one declarative `incident` step (lib/widgets/incident.mjs, docs/M1-DESIGN.md §4.3, docs/DECLARATIVE-LEVELS.md §2), then one
// closing Choice on why the failed-requests query found nothing, which the incident step does not grade.
// The scenario is designed for this game (issue #138).
// Spec: https://opentelemetry.io/docs/specs/semconv/non-normative/http-migration/
// Dash0 docs: https://www.dash0.com/docs/dash0/ai/mcp , https://www.dash0.com/docs/dash0/ai/agent0/overview , https://www.dash0.com/docs/dash0/ai/agent0/overview/use-agent0/query-telemetry-via-mcp
//
// Facts used (each read on the page named, 2026-11-07). The old-to-stable pair is the one level 8.2 uses (HTTP migration page):
// `http.status_code` became `http.response.status_code`; `OTEL_SEMCONV_STABILITY_OPT_IN=http` emits the stable conventions and
// stops emitting the old ones the instrumentation emitted before, and `http/dup` emits both. Dash0 "About the Dash0 MCP Server": it
// lets AI assistants such as Claude, Claude Code and Cursor query your Dash0 data through read-only tools, over the Model Context
// Protocol. Dash0 "Agent0 overview": Agent0 reads your telemetry directly, in the OpenTelemetry semantic conventions it was produced
// in. Dash0 "Query Telemetry via MCP": the direct tools take `filters` of `key`, `operator` and `value`, and the keys to filter on
// are discovered with `getAttributeKeys`, which lists the attribute keys present in a kind of telemetry over a time range.
// Not claimed: how any agent turns a question into a query, that an agent "learns" a name, what Agent0 does when a filter matches
// nothing, anything about cost or credits, or that the query and result shapes below are the ones the tools print.
//
// Invented for the game: the company and its checkout, the services and pods, every time and count in the TABLE, the six-pod split of
// two versions, the traces and what they hold, the order in which checkout calls inventory and payment, and the query and result
// shapes the simulated agent prints (they are not the output of any tool).
//
// The words are in content/core/levels/ai-assisted-debugging.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/ai-assisted-debugging.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const fmt = (n) => n.toLocaleString('en-US');

/** The one table every figure in the views and the answers comes from. */
export const TABLE = {
  releaseAt: '09:40', // checkout 2.14.0 goes live on 3 of its 6 pods
  failuresFrom: '10:12',
  ruleFiredAt: '10:27', // 15 minutes above 5% after the failures start
  queryAt: '10:36', // the agent's queries run until here
  // Card charges, 95th percentile in ms (the card charge times view, a herring: failing orders never reach a charge).
  charges: [
    { at: '09:50', p95Ms: 410 },
    { at: '10:12', p95Ms: 430 },
    { at: '10:30', p95Ms: 520 },
  ],
  beforeMin: 32, // 09:40 to 10:12
  afterMin: 24, // 10:12 to 10:36
  // One row per version: requests and failed requests before and after 10:12, 225 requests a minute each.
  versions: [
    { v: '2.13.4', beforeRequests: 7200, beforeErrors: 8, afterRequests: 5400, afterErrors: 492 },
    { v: '2.14.0', beforeRequests: 7200, beforeErrors: 7, afterRequests: 5400, afterErrors: 492 },
  ],
  // Requests a minute to POST /checkout, both versions together.
  rate: [
    { at: '09:50', perMin: 448 },
    { at: '10:10', perMin: 452 },
    { at: '10:12', perMin: 449 },
    { at: '10:30', perMin: 451 },
  ],
  errorRatioRulePct: 5,
  sampledTraces: 20,
  services: 23,
  nodes: 9,
};

const per1000 = (errors, requests) => ((errors / requests) * 1000).toFixed(1);
const failedAfter = TABLE.versions.reduce((n, x) => n + x.afterErrors, 0); // 984
const requestsAfter = TABLE.versions.reduce((n, x) => n + x.afterRequests, 0); // 10,800
const pctAfter = ((failedAfter / requestsAfter) * 100).toFixed(1); // 9.1
const [OLD, NEW] = TABLE.versions;
const WINDOW = `${TABLE.failuresFrom} to ${TABLE.queryAt}`;

// What each {{name}} in the content file is replaced with: every figure the views and the answers quote, from TABLE.
// OLD is the version that did not change, NEW the one released at TABLE.releaseAt; before and after are the windows either side of TABLE.failuresFrom.
// The rate-N and charge-N rows are TABLE.rate[N] and TABLE.charges[N].
const VARS = {
  'release-at': TABLE.releaseAt,
  'failures-from': TABLE.failuresFrom,
  'rule-fired-at': TABLE.ruleFiredAt,
  'query-at': TABLE.queryAt,
  window: WINDOW,
  'before-min': TABLE.beforeMin,
  'old-v': OLD.v,
  'new-v': NEW.v,
  'old-before': per1000(OLD.beforeErrors, OLD.beforeRequests),
  'old-after': per1000(OLD.afterErrors, OLD.afterRequests),
  'new-before': per1000(NEW.beforeErrors, NEW.beforeRequests),
  'new-after': per1000(NEW.afterErrors, NEW.afterRequests),
  'old-failed': fmt(OLD.afterErrors),
  'failed-after': fmt(failedAfter),
  'sampled-traces': TABLE.sampledTraces,
  'rate-0-at': TABLE.rate[0].at,
  'rate-0': fmt(TABLE.rate[0].perMin),
  'rate-1-at': TABLE.rate[1].at,
  'rate-1': fmt(TABLE.rate[1].perMin),
  'rate-2-at': TABLE.rate[2].at,
  'rate-2': fmt(TABLE.rate[2].perMin),
  'rate-3-at': TABLE.rate[3].at,
  'rate-3': fmt(TABLE.rate[3].perMin),
  'error-ratio-rule-pct': TABLE.errorRatioRulePct,
  'pct-after': pctAfter,
  nodes: TABLE.nodes,
  services: TABLE.services,
  'charge-0-at': TABLE.charges[0].at,
  'charge-0': fmt(TABLE.charges[0].p95Ms),
  'charge-1-at': TABLE.charges[1].at,
  'charge-1': fmt(TABLE.charges[1].p95Ms),
  'charge-2-at': TABLE.charges[2].at,
  'charge-2': fmt(TABLE.charges[2].p95Ms),
};

// The incident: the ids, the cost and kind of each view, and which hypothesis is right. The alert, every label, view, explanation and the hint are in the content file.
const SCENARIO = {
  id: 'ai-assisted-debugging',
  budget: { startPct: 100, burnPctPerMin: 5 },
  views: [
    { id: 'failures-by-version', costMin: 4, kind: 'clue' },
    { id: 'failing-trace', costMin: 4, kind: 'clue' },
    { id: 'request-rate', costMin: 3, kind: 'clue' },
    { id: 'alert-rule', costMin: 2, kind: 'neutral' },
    { id: 'node-status', costMin: 3, kind: 'neutral' },
    { id: 'service-list', costMin: 2, kind: 'neutral' },
    { id: 'failed-requests', costMin: 1, kind: 'neutral' },
    { id: 'recent-changes', costMin: 4, kind: 'herring' },
    { id: 'card-charges', costMin: 3, kind: 'herring' },
  ],
  hypotheses: [
    { id: 'inventory-failing', right: true },
    { id: 'bad-release', right: false },
    { id: 'payment-timeouts', right: false },
    { id: 'order-surge', right: false },
  ],
  answerAfterViews: 3,
};

// Step 2: why the agent's failed-requests query found nothing. Both queries share the window (10:12 to 10:36) and the service, so only the
// attribute name differs on screen, and the labels are all about the name: only knowing the 8.2 migration pair separates them.
// `why` follows "Right." or "Not quite.". Only the answer is marked; every choice's text is in the content file.
const SKELETON = {
  id: 'ai-assisted-debugging',
  no: '8.5',
  icon: '\u{1F916}',
  cards: [],
  lights: ['checkout', 'inventory'],
  scoring: { parMs: null },
  play: {
    prefix: 'aad',
    steps: [
      { incident: SCENARIO },
      { qid: 'aad-q-why', choice: { id: 'aad-why', choices: [{ key: 'old-name', right: true }] } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
