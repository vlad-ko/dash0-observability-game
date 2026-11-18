// Act 7 boss: Everything is green. Customers cannot load Kettle & Co's shop and every dashboard and alert is green. The cause is
// an expired TLS certificate on the CDN edge: browsers refuse the connection during the handshake, so no request reaches the
// instrumented service, and the span-based alerts and the inside-the-cluster health check have nothing to fail on. The player follows it
// from the span numbers (requests collapse at one window, errors stay at zero), to who still sends requests (only internal tools),
// to a request made from outside (it resolves and connects, then fails on the certificate), to what the alert rules measure (spans, and
// an internal /health). Four views hold the chain (clues); two are red herrings; three are neutral. Scored. Three clues unlock the
// answers, and the outside request is the only view that refutes the second hypothesis in front of the load balancer (a lapsed DNS
// record or domain), so a board without it keeps two defensible causes and the player has to make the request. A plain-data Scenario for the incident engine,
// played through one declarative `incident` step (lib/widgets/incident.mjs, docs/M1-DESIGN.md §4.3, docs/DECLARATIVE-LEVELS.md §2),
// then one closing Choice on what would have paged (7.2: the SLI source; 7.4: probing from outside).
// The scenario is designed for this game (decided on #135, owner decision 2026-11-01).
// Spec: https://opentelemetry.io/docs/specs/otel/trace/api/#spankind
// Dash0 docs: https://www.dash0.com/docs/dash0/monitoring/synthetics/synthetic-monitoring , https://www.dash0.com/docs/dash0/monitoring/synthetics/explore-run-details
//
// Facts used (each read on the page named in its parentheses, 2026-11-07, as levels/synthetic-checks.mjs uses them): a SERVER span
// covers server-side handling of a remote request (the trace API page, SpanKind). In Dash0, a synthetic check sends requests to your
// websites and APIs at regular intervals from public or private locations and fires a notification when an assertion fails; a check
// run shows a timeline of DNS resolution, TCP connection, SSL/TLS handshake, request send, response wait and download, and error
// attributes that highlight network errors such as a TLS error (the synthetic monitoring and run details pages).
//
// Stated as reasoning, with no source (as levels/synthetic-checks.mjs does): a browser that refuses an expired certificate during the
// handshake sends no HTTP request, so the code behind the CDN never handles one and your service's spans hold nothing for it. The copy
// scopes this to your service's spans and to a certificate the CDN edge serves; whether a CDN or load balancer records its own
// events for a refused handshake depends on the product and is not claimed.
//
// Invented for the game: the company, the hostnames, every number and time, the curl line (curl's usual form for an expired
// certificate, abridged and shown as illustration, since curl's lines differ by version and TLS backend), the callers view, the load balancer behind the CDN, and the alert rules. Every figure the views
// and the answers state is derived from TABLE below and pinned in test/everything-is-green.test.mjs, so the story and the
// arithmetic cannot disagree.
//
// Why the dashboards are green: the shop's server spans still hold TABLE.internal requests a window, from internal tools that
// reach the origin without the CDN, and none of them fails. The error ratio is 0 of 240, a value and not 0/0 (an empty ratio would
// show no data, not green), the burn rate is that ratio over the 0.1% the 99.9% target allows, so 0, and the health check goes to the
// origin from inside the cluster, so it never meets the certificate. No rule watches how many requests arrive.
//
// The words are in content/core/levels/everything-is-green.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/everything-is-green.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const fmt = (n) => n.toLocaleString('en-US');

/** The one table every figure in the views and the answers comes from. */
export const TABLE = {
  sloTarget: 0.999,
  // Server spans of the shop, one row per 5-minute window, named by its start. The certificate expires at 08:00.
  windows: [
    { at: '07:55', requests: 12000, errors: 12, p99Ms: 210 },
    { at: '08:00', requests: 240, errors: 0, p99Ms: 190 },
    { at: '09:15', requests: 240, errors: 0, p99Ms: 190 },
  ],
  internal: 240, // requests a window from internal tools, which reach the origin directly
  lastWeek: { at: '09:15', requests: 12300 }, // the same window a week earlier, a normal morning
  expiresAt: '08:00',
  rules: { errorRatioPct: 1, burnRate: 14.4, p99LimitMs: 800, rateFloor: 0.5 },
  healthPassed: 60, // of the last 60 one-minute runs
  outsideAt: '09:22', // the on-call makes the outside request after the 09:21 page
};

const ratioPct = (w) => Math.round((w.errors / w.requests) * 1000) / 10;
const burn = (w) => Math.round((w.errors / w.requests / (1 - TABLE.sloTarget)) * 10) / 10;
const one = (n) => n.toFixed(1);
const [BEFORE, FIRST, NOW] = TABLE.windows;
const visitors = (w) => w.requests - TABLE.internal;
const lastWeekVisitors = TABLE.lastWeek.requests - TABLE.internal;
const dropPct = Math.round(((BEFORE.requests - FIRST.requests) / BEFORE.requests) * 100);
const rateHalf = TABLE.rules.rateFloor * TABLE.lastWeek.requests; // the line a request-rate rule waits for, from the usual for the hour on the board

// What each {{name}} in the content file is replaced with: every figure the views and the answers quote, from TABLE.
// The three windows are before (BEFORE), first (FIRST) and now (NOW).
const VARS = {
  'at-before': BEFORE.at,
  'at-first': FIRST.at,
  'at-now': NOW.at,
  'req-before': fmt(BEFORE.requests),
  'req-first': fmt(FIRST.requests),
  'req-now': fmt(NOW.requests),
  'err-before': fmt(BEFORE.errors),
  'err-first': fmt(FIRST.errors),
  'err-now': fmt(NOW.errors),
  'ratio-before': one(ratioPct(BEFORE)),
  'ratio-first': one(ratioPct(FIRST)),
  'ratio-now': one(ratioPct(NOW)),
  'burn-before': one(burn(BEFORE)),
  'burn-first': one(burn(FIRST)),
  'burn-now': one(burn(NOW)),
  'p99-before': BEFORE.p99Ms,
  'p99-first': FIRST.p99Ms,
  'p99-now': NOW.p99Ms,
  'drop-pct': dropPct,
  'visitors-now': fmt(visitors(NOW)),
  'visitors-last-week': fmt(lastWeekVisitors),
  internal: fmt(TABLE.internal),
  'last-week-at': TABLE.lastWeek.at,
  'last-week-requests': fmt(TABLE.lastWeek.requests),
  'expires-at': TABLE.expiresAt,
  'outside-at': TABLE.outsideAt,
  'error-ratio-pct': TABLE.rules.errorRatioPct,
  'burn-rate-line': TABLE.rules.burnRate,
  'p99-limit': fmt(TABLE.rules.p99LimitMs),
  'health-passed': TABLE.healthPassed,
  'rate-half': fmt(rateHalf),
};

// The incident: the ids, the cost and kind of each view, and which hypothesis is right. Every label, view and explanation is in the content file.
const SCENARIO = {
  id: 'everything-is-green',
  budget: { startPct: 100, burnPctPerMin: 5 },
  views: [
    { id: 'span-numbers', costMin: 3, kind: 'clue' },
    { id: 'who-calls', costMin: 3, kind: 'clue' },
    { id: 'outside-request', costMin: 3, kind: 'clue' },
    { id: 'alert-rules', costMin: 4, kind: 'clue' },
    { id: 'origin-pods', costMin: 2, kind: 'neutral' },
    { id: 'last-deploy', costMin: 2, kind: 'neutral' },
    { id: 'database', costMin: 2, kind: 'neutral' },
    { id: 'collector-health', costMin: 4, kind: 'herring' },
    { id: 'payment-latency', costMin: 3, kind: 'herring' },
  ],
  hypotheses: [
    { id: 'expired-certificate', right: true },
    { id: 'collector-dropping', right: false },
    { id: 'payment-provider-slow', right: false },
    { id: 'dns-lapsed', right: false },
    { id: 'origin-overloaded', right: false },
  ],
  answerAfterViews: 3,
};

// Step 2: what would have paged. `why` follows "Right." or "Not quite.".
const PAGE = [
  { key: 'outside-check', right: true },
  { key: 'tighter-ratio' },
  { key: 'load-balancer-sli' },
  { key: 'faster-health' },
  { key: 'rate-drop' },
];

const SKELETON = {
  id: 'everything-is-green',
  no: null,
  icon: '\u{1F7E2}',
  cards: [],
  lights: ['storefront', 'api-gateway'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'eig',
    steps: [
      { incident: SCENARIO },
      { qid: 'eig-q-page', choice: { id: 'eig-page', choices: PAGE } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
