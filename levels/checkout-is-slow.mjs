// Act 2 boss: Checkout is slow. Checkout p95 is over 2 s and the error budget burns while
// the player investigates with traces, a triage comparison and a few dashboards. Two views
// hold the answer (an N+1 query in inventory, introduced by version 2.4.0); two are red
// herrings; the rest are neutral. Scored. A plain-data Scenario for the incident engine
// (lib/widgets/incident.mjs, docs/M1-DESIGN.md §4.3). Spec: docs/M1-DESIGN.md §6 Boss
// checkout-is-slow.
// Spec: https://opentelemetry.io/docs/concepts/signals/traces/ , https://opentelemetry.io/docs/specs/semconv/database/database-spans/
//
// A run(ctx) level: its words are in content/core/levels/checkout-is-slow.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the scenario's ids, costs, kinds and answers, the triage data and the screens.
import CORE from '../content/core/levels/checkout-is-slow.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { fillSlots } from '../lib/content/placeholders.mjs';
import { actions, finishButton, step } from '../lib/ui/index.mjs';
import { escapeHtml } from '../lib/lesson-kit.mjs';
import { incidentLesson, renderIncident, mountIncident } from '../lib/widgets/incident-view.mjs';
import { newIncident } from '../lib/widgets/incident.mjs';
import { compareAttribute } from '../lib/widgets/triage.mjs';

// The requests behind the triage view: slow checkouts (> 2 s) and a sample of normal ones.
// Each carries the attributes of its inventory span. Version 2.4.0 separates the two sets;
// the region does not.
const slow = (region) => ({ 'service.version': '2.4.0', 'cloud.region': region });
const normal = (version, region) => ({ 'service.version': version, 'cloud.region': region });
const TRIAGE = {
  slow: ['eu-west-1', 'us-east-1', 'eu-west-1', 'us-east-1', 'eu-west-1', 'us-east-1'].map(slow),
  normal: [
    ...Array(6).fill('eu-west-1').map((r) => normal('2.3.9', r)),
    ...Array(7).fill('us-east-1').map((r) => normal('2.3.9', r)),
    normal('2.4.0', 'eu-west-1'),
  ],
};

// This level's copy has no figure a grader computes over: no fill-ins. The slots are the attribute name in a table's
// caption and the two triage tables, which the code builds from TRIAGE and the table words.
const VARS = {};
const SLOTS = ['attr', 'version-table', 'region-table'];

/** A comparison table: one row per value, share of slow requests then of normal ones, with its words from `say`. */
function triageHtml(attr, say) {
  const pct = (n) => (n === null ? say.triageNoData : `${n}%`);
  const rows = compareAttribute(TRIAGE.slow, TRIAGE.normal, attr)
    .map((r) => `<tr><th scope="row">${escapeHtml(r.value)}</th><td>${pct(r.slowPct)}</td><td>${pct(r.baselinePct)}</td></tr>`)
    .join('');
  return (
    `<table><caption>${fillSlots(say.triageCaption, { attr: escapeHtml(attr) })}</caption>` +
    `<thead><tr><th scope="col">${say.triageValue}</th><th scope="col">${say.triageSlow}</th><th scope="col">${say.triageNormal}</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  );
}

// The scenario without its words: each view's cost and kind, the budget, and which hypothesis is right (`right: false`
// as written). The alert, the views' and hypotheses' words, the hint, the finish text and the scenario line are in the
// content (the entries scenario, finish and intro).
const TRIAGE_VIEW = 'triage'; // the view that holds the two triage tables
const SKELETON = {
  id: 'checkout-is-slow',
  no: null,
  icon: '\u{1F6A8}',
  mechanics: ['incident'],
  widgets: ['incident'],
  cards: [],
  lights: ['inventory'],
  scored: true,
  scoring: { parMs: null },
  run: {
    scenario: {
      id: 'checkout-is-slow',
      budget: { startPct: 100, burnPctPerMin: 4 },
      views: [
        { id: 'trace-slow', costMin: 5, kind: 'clue' },
        { id: TRIAGE_VIEW, costMin: 4, kind: 'clue' },
        { id: 'deploys', costMin: 2, kind: 'neutral' },
        { id: 'checkout-logs', costMin: 4, kind: 'neutral' },
        { id: 'db-metrics', costMin: 6, kind: 'neutral' },
        { id: 'gateway-latency', costMin: 4, kind: 'neutral' },
        { id: 'payments-errors', costMin: 5, kind: 'herring' },
        { id: 'redis-cpu', costMin: 3, kind: 'herring' },
      ],
      hypotheses: [
        { id: 'n-plus-one', right: true },
        { id: 'provider', right: false },
        { id: 'redis', right: false },
        { id: 'replicas', right: false },
      ],
      answerAfterViews: 1,
    },
  },
};

/**
 * The boss's data (pinned by test/checkout-is-slow.test.mjs), from the bound words `say`: the scenario with the two
 * triage tables built into the triage view, the triage data, the finish text and the scenario line on the lesson card
 * (incidentLesson adds one short rules line).
 */
const contentOf = (say) => ({
  scenario: {
    ...say.scenario,
    views: say.scenario.views.map((v) =>
      v.id === TRIAGE_VIEW
        ? { ...v, html: fillSlots(v.html, { 'version-table': triageHtml('service.version', say), 'region-table': triageHtml('cloud.region', say) }) }
        : v),
  },
  triage: TRIAGE,
  finish: say.finish,
  intro: say.intro,
});
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, { vars: VARS, slots: SLOTS }).run);

function screens(ctx, say) {
  const { scenario: SCENARIO } = contentOf(say); // the same scenario CONTENT holds
  ctx.renderStep(
    step({
      surface: 'game',
      wide: true,
      bodyHtml: `${ctx.speech(incidentLesson(say.intro))}${renderIncident(SCENARIO, newIncident(SCENARIO), { escapeHtml: ctx.escapeHtml })}`,
    }),
    actions({ wide: true, buttonsHtml: finishButton('cis-finish', say.startReason) }),
  );
  const finish = ctx.ovActions.querySelector('#cis-finish');
  mountIncident(ctx, SCENARIO, {
    onComplete: () => {
      finish.disabled = false;
      return finish;
    },
  });
  finish.onclick = () => ctx.finish({ text: say.finish, cards: [] });
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { vars: VARS, slots: SLOTS, screens });
}

export default withText(CORE);
