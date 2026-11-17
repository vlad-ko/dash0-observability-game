// Level 3.5: Cardinality. The player counts the series a counter makes (the product of the number of
// values of each attribute), spots the attributes whose values never stop growing (a user id, a raw
// URL, a request id) among the ones that do, keeps a series budget by using http.route, giving the tier a counter of its own and
// putting the user id on a span, and learns what Dash0's tree map and spam filters do about volume.
// Spec: docs/OUTLINE.md §4 Act 3.
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/sdk/#cardinality-limits , https://opentelemetry.io/docs/specs/otel/metrics/supplementary-guidelines/
// Spec: https://opentelemetry.io/docs/specs/semconv/http/http-metrics/ , https://opentelemetry.io/docs/specs/semconv/http/http-spans/
// Spec: https://prometheus.io/docs/practices/naming/#labels , https://prometheus.io/docs/practices/instrumentation/#do-not-overuse-labels
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/metrics/identify-high-cardinality-metrics , https://www.dash0.com/docs/dash0/cost-control/spam-filters
//
// The words are in content/core/levels/cardinality.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/cardinality.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// How many distinct values each attribute takes at Kettle & Co (an invented but fixed table). Every
// number in the copy and every cost below is computed from it, so they cannot disagree.
const VALUES = { method: 5, route: 14, status: 9, tier: 3, kind: 8, user: 31402, path: 48211 };
const n = (x) => x.toLocaleString('en-US');
const times = (...keys) => keys.map((k) => n(VALUES[k])).join(' × ');
const product = (...keys) => keys.reduce((acc, k) => acc * VALUES[k], 1);
const sum = (...xs) => xs.reduce((a, b) => a + b, 0);

const ROUTE_STATUS = product('route', 'status');
const ROUTE_STATUS_TIER = product('route', 'status', 'tier');
const ROUTE_TIER = product('route', 'tier');
const ROUTE_METHOD = product('route', 'method');
const TIER_KIND = product('tier', 'kind');
const COST_NONE = 1; // a counter with no attributes is one series
const ONE_COUNTER = sum(ROUTE_STATUS_TIER, COST_NONE, 0); // the tier on the requests counter, nothing on the other
const TIER_AND_KIND = sum(ROUTE_STATUS, TIER_KIND, 0);
const CAP = 140;

// What each {{name}} in the content file is replaced with (every name is used, and every figure in the copy is here).
const VARS = {
  method: VALUES.method,
  route: VALUES.route,
  status: VALUES.status,
  tier: VALUES.tier,
  kind: VALUES.kind,
  user: n(VALUES.user),
  cap: n(CAP),
  'sum-mrs': n(VALUES.method + VALUES.route + VALUES.status),
  'times-mrs': times('method', 'route', 'status'),
  'product-mrs': n(product('method', 'route', 'status')),
  'product-mrsu': n(product('method', 'route', 'status', 'user')),
  'times-rst': times('route', 'status', 'tier'),
  'route-status-tier': n(ROUTE_STATUS_TIER),
  'times-rm': times('route', 'method'),
  'route-method': n(ROUTE_METHOD),
  'times-rs': times('route', 'status'),
  'route-status': n(ROUTE_STATUS),
  'times-rt': times('route', 'tier'),
  'route-tier': n(ROUTE_TIER),
  'times-tk': times('tier', 'kind'),
  'tier-kind': n(TIER_KIND),
  'one-counter': n(ONE_COUNTER),
  'tier-and-kind': n(TIER_AND_KIND),
};

// Step 3. Every cost is the product of the number of values of the attributes kept, in series. Adding an
// attribute to a counter multiplies that counter's cost; a second counter only adds its own. That is the
// deciding fact: the tier is cheap on a counter of its own (3) and dear on the requests counter (126 × 3), and
// every extra attribute on it multiplies it again (3 × 8 = 24). The cards show the costs and not what an
// option keeps until a Check, so the player has to know what an attribute lets you ask. No blind rule finds
// the plan (test/trade-off-balance.test.mjs probes them). Needs: 'tier-volume' is a count of traffic for
// each customer tier, which the requests counter split by tier or the served counter split by tier answers.
const BUDGET = {
  id: 'cdn-budget',
  cap: CAP,
  helps: { hints: true },
  knobs: [
    {
      id: 'requests',
      options: [
        { id: 'route', cost: VALUES.route },
        { id: 'route-status-tier', cost: ROUTE_STATUS_TIER, keeps: ['errors-by-route', 'tier-volume'] },
        { id: 'route-method', cost: ROUTE_METHOD },
        { id: 'route-status', cost: ROUTE_STATUS, keeps: ['errors-by-route'] },
        { id: 'route-tier', cost: ROUTE_TIER, keeps: ['tier-volume'] },
      ],
    },
    {
      id: 'served',
      options: [
        { id: 'user', cost: VALUES.user, keeps: ['one-customer'] },
        { id: 'none', cost: COST_NONE },
        { id: 'tier', cost: VALUES.tier, keeps: ['tier-volume'] },
        { id: 'tier-kind', cost: TIER_KIND, keeps: ['tier-volume'] },
        { id: 'type', cost: VALUES.kind },
      ],
    },
    {
      id: 'customer',
      options: [
        { id: 'nothing', cost: 0 },
        { id: 'span-attribute', cost: 0, keeps: ['one-customer'] },
      ],
    },
  ],
  answer: { requests: 'route-status', served: 'tier', customer: 'span-attribute' },
};

// `choices` lists only what the logic knows about an answer; every choice's text is in the content file.
// Step 1 and step 4: `why` follows "Right." or "Not quite.".
const SKELETON = {
  id: 'cardinality',
  no: '3.5',
  icon: '\u{1F522}',
  cards: ['series-are-combinations'],
  lights: ['postgres'],
  scoring: { parMs: null },
  play: {
    prefix: 'cdn',
    steps: [
      {
        qid: 'cdn-q-combos',
        choice: {
          id: 'cdn-combos',
          choices: [
            { key: 'sum', keep: true }, // the tempting near-miss: the 50/50 never removes it (#371)
            { key: 'product', right: true },
          ],
        },
      },
      {
        // Step 2. Lines read `name{labels}`: one sample series for each attribute on the counter.
        qid: 'cdn-q-spot',
        spot: {
          id: 'cdn-spot',
          target: 'metric',
          helps: { hints: true },
          faults: ['url-path', 'user-id', 'request-id'],
        },
      },
      { qid: 'cdn-q-budget', tradeoff: BUDGET },
      { qid: 'cdn-q-dash0', choice: { id: 'cdn-dash0', choices: [{ key: 'fix-source', right: true }] } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
