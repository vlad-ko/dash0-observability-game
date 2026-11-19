// Act 3 boss: The bill. The volume of metric data a Collector sends to Dash0 jumps to more than ten times
// the morning's rate and dashboards start to time out; the dashboards' query error budget burns while the
// player investigates: from the volume view (one metric's series count stepped from 228 to 118,904), to the
// label breakdown of that metric (a new label, user_id, with one value for each user), to the deploy that
// added it (checkout 5.12.0 put user.id on the counter's attributes). Three views hold the chain (clues);
// two are red herrings; the rest are neutral. Scored. A plain-data Scenario for the incident engine, played
// through one declarative `incident` step (lib/widgets/incident.mjs, docs/M1-DESIGN.md §4.3,
// docs/DECLARATIVE-LEVELS.md §2), then one closing Choice that grades the fix. The scenario is designed for
// this game: docs/OUTLINE.md §4 Act 3 defines no boss (decided on #16); the Dash0 tie-in is the one OUTLINE
// gives for 3.5, "Dash0 shows what drives volume".
// Spec: docs/OUTLINE.md §4 Act 3 (3.5 Cardinality).
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/sdk/#cardinality-limits
// Spec: https://opentelemetry.io/docs/specs/semconv/http/http-metrics/
// Spec: https://prometheus.io/docs/practices/instrumentation/#do-not-overuse-labels
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/metrics/identify-high-cardinality-metrics
// Dash0 docs: https://www.dash0.com/docs/dash0/cost-control/spam-filters
//
// Facts used, each from the pages above (read 2026-11-01, OTel specification 1.62.0): the number of unique
// combinations of attributes is called cardinality; SDKs SHOULD support being configured with a cardinality
// limit, a default of 2000 SHOULD be used when none is configured, and measurements beyond the limit are
// folded into one point whose attributes are the single attribute otel.metric.overflow = true (SDK, "Cardinality
// limits"); cardinality limit enforcement SHOULD occur after attribute filtering, so a view can remove an
// attribute before the limit applies (same section). Prometheus: each labelset is an additional time series,
// and a metric with a cardinality over 100, or the potential to grow that large, is a prompt to reduce the
// dimensions (instrumentation practices). The semantic conventions say http.route MUST be low-cardinality and
// that the URI path cannot substitute for it. Dash0: the Metric Explorer tree map can size tiles by
// Cardinality, the metric sidebar shows the attributes behind a tile, and for random or unbounded values
// the guidance is to reduce them at the instrumentation layer; a spam filter drops matching data points
// before they are stored, what it drops cannot be recovered, and it reduces what SignalStore indexes, not what
// you send. Nothing below states a price: cost is described as volume and series only.
//
// The numbers agree by construction: 6 payment methods x 38 countries = 228 series before the deploy; one
// point per series every 60 s, so points a minute equal series; 12,400 - 228 + 118,904 = 131,076 points a
// minute after it; user_id has 112,367 values and the counter 118,904 series, because a few users appear
// with more than one method or country. The Prometheus-style names follow level 3.4 (dots become underscores,
// a monotonic Sum gets _total): the attribute user.id is the label user_id.
//
// The words are in content/core/levels/the-bill.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/the-bill.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const METHODS = 6;
const COUNTRIES = 38;
const SERIES_BEFORE = METHODS * COUNTRIES;
const SERIES_AFTER = 118904;
const FLEET_BEFORE = 12400;
const FLEET_AFTER = FLEET_BEFORE - SERIES_BEFORE + SERIES_AFTER;
const USERS = 112367;
const n = (x) => x.toLocaleString('en-US');

// What each {{name}} in the content file is replaced with. Every figure here is computed, so the copy and the
// arithmetic above cannot disagree. 'fleet-after-round' is the alert's "about" figure (to the nearest thousand) and
// 'series-share' the share of all series the one counter holds after the deploy, in whole percent.
const VARS = {
  methods: METHODS,
  countries: COUNTRIES,
  'series-before': SERIES_BEFORE,
  'series-after': n(SERIES_AFTER),
  'series-added': n(SERIES_AFTER - SERIES_BEFORE),
  'series-share': Math.round((SERIES_AFTER / FLEET_AFTER) * 100),
  users: n(USERS),
  'fleet-before': n(FLEET_BEFORE),
  'fleet-other': n(FLEET_BEFORE - SERIES_BEFORE),
  'fleet-after': n(FLEET_AFTER),
  'fleet-after-round': n(Math.round(FLEET_AFTER / 1000) * 1000),
};

const SCENARIO = {
  id: 'the-bill',
  budget: { startPct: 100, burnPctPerMin: 5 },
  views: [
    { id: 'volume-by-metric', costMin: 5, kind: 'clue' },
    { id: 'label-breakdown', costMin: 4, kind: 'clue' },
    { id: 'deploys', costMin: 3, kind: 'clue' },
    { id: 'request-rate', costMin: 2, kind: 'neutral' },
    { id: 'export-interval', costMin: 3, kind: 'neutral' },
    { id: 'collector-health', costMin: 2, kind: 'neutral' },
    { id: 'biggest-metric', costMin: 4, kind: 'herring' },
    { id: 'new-service', costMin: 3, kind: 'herring' },
  ],
  hypotheses: [
    { id: 'user-id-label', right: true },
    { id: 'traffic-growth', right: false },
    { id: 'new-service-metrics', right: false },
    { id: 'export-interval-change', right: false },
  ],
  answerAfterViews: 2,
};

// Step 2: the fix. `why` follows "Right." or "Not quite."; only the right choice is listed here.
const SKELETON = {
  id: 'the-bill',
  no: null,
  icon: '\u{1F9FE}',
  cards: [],
  lights: ['checkout'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'tbl',
    steps: [
      { incident: SCENARIO },
      { qid: 'tbl-q-fix', choice: { id: 'tbl-fix', choices: [{ key: 'drop-the-label', right: true }] } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
