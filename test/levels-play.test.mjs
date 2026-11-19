// Plays every registered level in a linkedom DOM the way a player would click through
// it, with the real ctx (lib/level-context.mjs). Catches a dead end, a wrong-wired
// button or a level that never finishes, before it ships. Spec: docs/FOUNDATION.md
// §6 F3 levels-play.
//
// TO ADD A LEVEL: for a run(ctx) level add DRIVERS['<id>'] below with a happy run and a
// sloppy run; the "every run-level has a driver" test fails until it exists. A declarative
// (play) level needs none: it is driven by drivers derived from its spec (derivedDriver below).
//   play()   clicks through with q / qa and the click / clickUntil below
//   expect   { stars, cards } that run must earn
//   sloppy   { play(), expect } a run with mistakes or hints that earns fewer stars
//            (optional for an unscored level; if present it must earn 0 too)
// Drivers click with this file's click / clickUntil (they record the last click).
// The Finish button carries `data-finish`: the first screen must not show it
// enabled, and finish() must come from a click on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, q, qa, click as domClick } from './helpers/dom.mjs';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { definedClasses } from './helpers/css.mjs';
import { readJsonModule } from './helpers/content-files.mjs';
import { checkWords, editRun, RUN_FIXTURES } from './helpers/run-edit.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import { createTelemetry } from '../lib/telemetry.mjs';
import { scoreStars } from '../lib/scoring.mjs';
import { buildRegistry } from '../lib/registry.mjs';
import { runPlay, validatePlay } from '../lib/play.mjs';
import { liveRegistry } from '../app.mjs';
import { stepsOf } from './helpers/step-drivers.mjs';
import { clickFrameOf, frameOf, recordFrames } from './helpers/snapshot.mjs';
import fixtureLevel, { FIXTURE_CARD } from './fixtures/fixture-level.mjs';
import { playFixture } from './fixtures/play-level.mjs';
import * as V from './fixtures/variant-levels.mjs';

const NOW = 1767225600000;

/** Type `text` into the textarea `sel` (what the player sees is its value). */
function type(sel, text) {
  const el = q(sel);
  assert.ok(el, `expected an element for ${sel}`);
  assert.ok(!el.disabled, `${sel} is disabled`);
  el.value = text;
}

const FIXED_ENV = [
  'OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318',
  'OTEL_SERVICE_NAME=checkout',
  'OTEL_RESOURCE_ATTRIBUTES=service.version=1.4.2,deployment.environment.name=production',
].join('\n');

/** Sort every `[item, bucket]` pair with this file's click (item, then bucket). */
function sortAll(pairs) {
  for (const [item, bucket] of pairs) {
    click(`[data-item="${item}"]`);
    click(`[data-bucket="${bucket}"]`);
  }
}

// Act 0 answers (docs/M1-DESIGN.md §6), spelled out here so a wrong key in a level fails.
const MVO_SORT = [['cpu', 'known'], ['5xx', 'known'], ['disk', 'known'], ['ios', 'new'], ['cust', 'new'], ['coupon', 'new']];
const SIG_DATA = [['duration', 'metric'], ['cpu-time', 'metric'], ['declined', 'log'], ['checkout-span', 'trace'], ['stacks', 'profile']];
const SIG_ASK = [['rps', 'metric'], ['slow-call', 'trace'], ['provider', 'log'], ['cpu-fn', 'profile']];
const OTEL_PARTS = [['start-span', 'api'], ['batch', 'sdk'], ['wire', 'otlp'], ['pipeline', 'collector'], ['method', 'semconv']];

// Act 2 answers (docs/M1-DESIGN.md §6), span ids spelled out here so a wrong id in a level fails.
// 2.1 (trace 4bf9...): B under A, C under B, D under C; E (trace 0af7...) stays a root. With the
// arrival queue (#146) the spans arrive in this order and E must be placed too, as a root.
const SAT_TREE = [['b7ad6b7169203331', '00f067aa0ba902b7'], ['53995c3f42cd8ad8', 'b7ad6b7169203331'], ['1d5c3a2f8e4b6a90', '53995c3f42cd8ad8']];
const SAT_E = '9e1f2a3b4c5d6e7f';
// 2.2 (a symptom hunt): the culprit is payments POST /charge; a decoy is the provider CLIENT span.
const KINDS_CULPRIT = 'b5f3a1c7e9d20486';
const KINDS_PROVIDER = '0d9e7c5b3a1f8264';

// 2.3: a storefront CLIENT 404 Error ok; b catalog SERVER 404 Error wrong; c checkout SERVER
// 500 Unset wrong; d inventory SERVER 200 Unset ok; e payments SERVER 503 Error ok. 2.5: what may ride in baggage.
const STATUS_SORT = [['a', 'ok'], ['b', 'wrong'], ['c', 'wrong'], ['d', 'ok'], ['e', 'ok']];
const BAG_SORT = [['variant', 'ok'], ['tier', 'ok'], ['email', 'never'], ['token', 'never'], ['last4', 'never']];
// 2.4: checkout's SERVER span under storefront's CLIENT span 00f067aa0ba902b7 (the parent-id).
const PROP_TREE = [['6e0c63257de34c92', '00f067aa0ba902b7']];
// 2.6: payments charge (exception escaped) Error; charge with retry (handled, went through) back to Unset;
// notifications send batch links the three orders publish spans.
const EVL_STATUS = [['8f14e45fceea167a', 'ERROR'], ['45c48cce2e2d7fbd', 'UNSET']];
const EVL_SEND = 'd67d8ab4f4c10bf2';
const EVL_LINKS = [[EVL_SEND, '1679091c5a880faf'], [EVL_SEND, '8e296a067a375633'], [EVL_SEND, 'a5771bce93e200c3']];
// 2.7: what the agent covers (auto) and what only your code adds (manual).
const AVM_SORT = [['server', 'auto'], ['loyalty', 'manual'], ['redis', 'auto'], ['coupon', 'manual'], ['client', 'auto'], ['item-count', 'manual']];

/** Pick each span, then its `attr` value (Build it), with this file's click. */
function buildAll(attr, pairs) {
  for (const [span, value] of pairs) {
    click(`[data-span="${span}"]`);
    click(`[data-${attr}="${value}"]`);
  }
}

/** One driver per registered level id. */
const DRIVERS = {
  'monitoring-vs-observability': {
    play() {
      sortAll(MVO_SORT);
      click('#mvo-next');
      click('[data-pick="rich"]');
      click('#mvo-finish');
    },
    expect: { stars: 5, cards: [] },
    sloppy: {
      play() {
        sortAll([['cpu', 'new'], ...MVO_SORT]); // one wrong placement
        click('#mvo-next');
        click('[data-pick="rich"]');
        click('#mvo-finish');
      },
      expect: { stars: 4, cards: [] },
    },
  },
  'the-signals': {
    play() {
      sortAll(SIG_DATA);
      click('#sig-next');
      sortAll(SIG_ASK);
      click('#sig-next');
      click('[data-pick="profiles"]');
      click('#sig-finish');
    },
    expect: { stars: 5, cards: ['profiles-signal'] },
    sloppy: {
      play() {
        sortAll(SIG_DATA);
        click('#sig-next');
        sortAll(SIG_ASK);
        click('#sig-next');
        click('[data-pick="logs"]'); // one wrong pick
        click('[data-pick="profiles"]');
        click('#sig-finish');
      },
      expect: { stars: 4, cards: ['profiles-signal'] },
    },
  },
  'why-opentelemetry': {
    play() {
      sortAll(OTEL_PARTS);
      click('#otel-next');
      click('[data-pick="api"]');
      click('#otel-finish');
    },
    expect: { stars: 5, cards: ['api-vs-sdk'] },
    sloppy: {
      play() {
        sortAll([['batch', 'collector'], ...OTEL_PARTS]); // one wrong placement
        click('#otel-next');
        click('[data-pick="api"]');
        click('#otel-finish');
      },
      expect: { stars: 4, cards: ['api-vs-sdk'] },
    },
  },
  // Act 0 boss: unscored, so every run earns 0; the sloppy run takes all four looks.
  'the-pager': {
    play() {
      click('[data-look="service"]');
      click('#pager-escalate');
      for (const k of ['service', 'since', 'customers', 'trace']) click(`[data-ask="${k}"]`);
      click('#pager-finish');
    },
    expect: { stars: 0, cards: [] },
    sloppy: {
      play() {
        for (const look of ['service', 'since', 'customers', 'trace']) click(`[data-look="${look}"]`);
        for (const k of ['service', 'since', 'customers', 'trace']) click(`[data-ask="${k}"]`); // budget 0 moved on
        click('#pager-finish');
      },
      expect: { stars: 0, cards: [] },
    },
  },
  'spans-and-traces': {
    play() {
      click('[data-pick="trace-id"]');
      click('#sat-next');
      buildAll('parent', [...SAT_TREE, [SAT_E, 'none']]); // instant feedback: the last right drop completes it
      click('#sat-next');
      click('[data-pick="other-request"]');
      click('#sat-finish');
    },
    expect: { stars: 5, cards: ['no-trace-object'] },
    sloppy: {
      play() {
        click('[data-pick="trace-id"]');
        click('#sat-next');
        buildAll('parent', SAT_TREE);
        buildAll('parent', [[SAT_E, '53995c3f42cd8ad8']]); // E under C: another trace, one wrong drop
        buildAll('parent', [[SAT_E, 'none']]);
        click('#sat-next');
        click('[data-pick="other-request"]');
        click('#sat-finish');
      },
      expect: { stars: 4, cards: ['no-trace-object'] },
    },
  },
  'span-kinds': {
    play() {
      click(`[data-open-span="${KINDS_CULPRIT}"]`);
      click('#kinds-flag');
      click('#kinds-next');
      click('[data-pick="server"]');
      click('#kinds-finish');
    },
    expect: { stars: 5, cards: ['span-kind-edges'] },
    sloppy: {
      play() {
        click(`[data-open-span="${KINDS_PROVIDER}"]`);
        click('#kinds-flag'); // one wrong flag
        click(`[data-open-span="${KINDS_CULPRIT}"]`);
        click('#kinds-flag');
        click('#kinds-next');
        click('[data-pick="server"]');
        click('#kinds-finish');
      },
      expect: { stars: 4, cards: ['span-kind-edges'] },
    },
  },
  'status-and-errors': {
    play() {
      sortAll(STATUS_SORT);
      click('#status-next');
      click('[data-pick="stays-ok"]');
      click('#status-finish');
    },
    expect: { stars: 5, cards: ['span-status'] },
    sloppy: {
      play() {
        sortAll([['b', 'ok'], ...STATUS_SORT]); // one wrong placement: a SERVER 404 as Error
        click('#status-next');
        click('[data-pick="stays-ok"]');
        click('#status-finish');
      },
      expect: { stars: 4, cards: ['span-status'] },
    },
  },
  baggage: {
    play() {
      sortAll(BAG_SORT);
      click('#bag-next');
      click('[data-pick="only-if-copied"]');
      click('#bag-finish');
    },
    expect: { stars: 5, cards: ['baggage-leaks'] },
    sloppy: {
      play() {
        sortAll(BAG_SORT);
        click('#bag-next');
        click('[data-pick="yes-auto"]'); // one wrong pick
        click('[data-pick="only-if-copied"]');
        click('#bag-finish');
      },
      expect: { stars: 4, cards: ['baggage-leaks'] },
    },
  },
  'context-propagation': {
    play() {
      click('[data-pick="proxy"]');
      click('#prop-next');
      click('[data-pick="valid"]');
      click('#prop-next');
      buildAll('parent', PROP_TREE);
      click('#prop-tree-check');
      click('#prop-finish');
    },
    expect: { stars: 5, cards: ['broken-propagation'] },
    sloppy: {
      play() {
        click('[data-pick="proxy"]');
        click('#prop-next');
        click('[data-pick="short-parent"]'); // one wrong pick: a 15-hex parent-id
        click('[data-pick="valid"]');
        click('#prop-next');
        buildAll('parent', PROP_TREE);
        click('#prop-tree-check');
        click('#prop-finish');
      },
      expect: { stars: 4, cards: ['broken-propagation'] },
    },
  },
  'events-and-links': {
    play() {
      click('[data-pick="unset"]');
      click('#evl-next');
      buildAll('status', EVL_STATUS);
      click('#evl-errors-check');
      click('#evl-next');
      buildAll('link', EVL_LINKS);
      click('#evl-batch-check');
      click('#evl-finish');
    },
    expect: { stars: 5, cards: ['exception-no-status', 'batch-links'] },
    sloppy: {
      play() {
        click('[data-pick="unset"]');
        click('#evl-next');
        buildAll('status', EVL_STATUS.slice(0, 1));
        click('#evl-errors-check'); // one failed check: the retried charge still Error
        buildAll('status', EVL_STATUS);
        click('#evl-errors-check');
        click('#evl-next');
        buildAll('link', EVL_LINKS);
        click('#evl-batch-check');
        click('#evl-finish');
      },
      expect: { stars: 4, cards: ['exception-no-status', 'batch-links'] },
    },
  },
  'auto-vs-manual': {
    play() {
      sortAll(AVM_SORT);
      click('#avm-next');
      click('[data-pick="two-setups"]');
      click('#avm-next');
      click('[data-pick="keep-one"]');
      click('#avm-finish');
    },
    expect: { stars: 5, cards: ['double-instrumentation'] },
    sloppy: {
      play() {
        sortAll(AVM_SORT);
        click('#avm-next');
        click('[data-pick="retries"]'); // one wrong pick
        click('[data-pick="two-setups"]');
        click('#avm-next');
        click('[data-pick="keep-one"]');
        click('#avm-finish');
      },
      expect: { stars: 4, cards: ['double-instrumentation'] },
    },
  },
  // Act 2 boss: reference path is the two clues and n-plus-one (5 stars). Sloppy: a herring
  // (one mistake) and a wrong hypothesis (another) are 2 penalties, so 3 stars.
  'checkout-is-slow': {
    play() {
      click('[data-view="trace-slow"]');
      click('[data-view="triage"]');
      click('[data-hypothesis="n-plus-one"]');
      click('#cis-finish');
    },
    expect: { stars: 5, cards: [] },
    sloppy: {
      play() {
        click('[data-view="payments-errors"]');
        click('[data-view="trace-slow"]');
        click('[data-hypothesis="provider"]');
        click('[data-hypothesis="n-plus-one"]');
        click('#cis-finish');
      },
      expect: { stars: 3, cards: [] },
    },
  },
  'naming-your-service': {
    play() {
      click('[data-pick="fallback"]');
      click('#nys-next');
      type('#nys-env', FIXED_ENV);
      click('#nys-check');
      click('#nys-next');
      click('[data-pick="env-var"]');
      click('#nys-finish');
    },
    expect: { stars: 5, cards: ['unknown-service'] },
    sloppy: {
      play() {
        click('[data-pick="name"]');
        click('[data-pick="fallback"]');
        click('#nys-next');
        click('#nys-check'); // the given config, unfixed: one failed check
        type('#nys-env', FIXED_ENV);
        click('#nys-check');
        click('#nys-next');
        click('[data-pick="env-var"]');
        click('#nys-finish');
      },
      expect: { stars: 3, cards: ['unknown-service'] },
    },
  },
  // Practice mode against the simulated Dash0 (no network). Plays what the player does: reads the
  // endpoint and the minted token off the screen, types them in, waits for the test span.
  'connect-to-dash0': {
    async: true,
    telemetry: practiceTelemetry,
    async play() {
      await connectPractice('ingest');
      click('#ctd-finish');
    },
    expect: { stars: 5, cards: [] },
    sloppy: {
      telemetry: practiceTelemetry,
      async play() {
        click('#ctd-practice');
        const ep = practiceEndpoint();
        type('#ctd-endpoint', q('#ctd-ep-grpc').textContent.trim()); // the gRPC row: a mistake
        type('#ctd-token', 'auth_whatever_0000');
        click('#ctd-connect');
        type('#ctd-endpoint', `${ep}/v1/traces`); // the signal path already added: a mistake
        type('#ctd-token', 'auth_whatever_0000');
        click('#ctd-connect');
        await sendPractice('read', ep); // a read-only token: a mistake at the pick, then a 403
        await until('#ctd-feedback[data-outcome="rejected"]');
        assert.ok(q('#ctd-feedback').textContent.includes('refused this token'), 'the refusal is explained');
        await sendPractice('ingest', ep);
        await until('#ctd-finish');
        click('#ctd-finish');
      },
      expect: { stars: 2, cards: [] },
    },
  },
  // The lab boss in practice (the session was never connected): filter the simulated Trace Explorer by the
  // session id, open the trace, open the spans, read the failing one, and type what the page shows. The expected values come from the page, so
  // the driver breaks if the view stops showing them. Sloppy: a wrong operation and a wrong retry count.
  'its-us': {
    async: true,
    telemetry: practiceTelemetry,
    async play({ telemetry }) {
      await findIncident(telemetry);
      click('#its-finish');
    },
    expect: { stars: 5, cards: [] },
    sloppy: {
      telemetry: practiceTelemetry,
      async play({ telemetry }) {
        await findIncident(telemetry, { operation: 'progress.sync', retryCount: '9' });
        await fixAnswers(telemetry);
        click('#its-finish');
      },
      expect: { stars: 3, cards: [] },
    },
  },
};

/** Read the failing span off the practice trace view and type the four answers (with `over` swapped in). */
async function findIncident(telemetry, over = {}) {
  click('#its-practice');
  // The Trace Explorer lists several sessions' traces: filter by the session id the page shows.
  for (const r of qa('input[name="its-fkey"]')) r.checked = r.value === 'session.id';
  for (const r of qa('input[name="its-fop"]')) r.checked = r.value === 'is';
  type('#its-fvalue', q('#its-session').textContent.trim());
  click('#its-filter-apply');
  assert.equal(qa('#its-explorer tbody tr').length, 1, 'the filter narrows the list to one trace');
  click('#its-open-trace-0');
  const spans = telemetry.incident().spans;
  const rows = qa('#its-explorer tbody tr');
  const bad = rows.findIndex((tr) => tr.lastElementChild.textContent.trim() === 'Error');
  assert.ok(bad >= 0, 'the failing span is marked in the list');
  click(`#its-open-${bad}`);
  const detail = q('#its-detail');
  const code = [...detail.querySelectorAll('tr')].find((tr) => tr.textContent.includes('game.fault.code')).querySelectorAll('td')[1].textContent.trim();
  const retries = [...detail.querySelectorAll('tr')].filter((tr) => tr.querySelector('td')?.textContent.trim() === 'retry').length;
  type('#its-q-operation', over.operation ?? spans[bad].name);
  type('#its-q-faultCode', code);
  type('#its-q-retryCount', over.retryCount ?? String(retries));
  type('#its-q-traceId', q('#its-trace').textContent.trim());
  click('#its-check');
  await Promise.resolve();
}

/** After a sloppy first check: type the right operation and retry count from the same page. */
async function fixAnswers(telemetry) {
  const bad = telemetry.incident().spans.findIndex((s) => s.status?.code === 'error');
  const detail = q('#its-detail');
  type('#its-q-operation', telemetry.incident().spans[bad].name);
  type('#its-q-retryCount', String([...detail.querySelectorAll('tr')].filter((tr) => tr.querySelector('td')?.textContent.trim() === 'retry').length));
  click('#its-check');
}

// A fixed clock (2023-11-14T22:13:20Z), so the wall-clock times its-us shows are the same on every run
// and a LEVEL_SNAPSHOT before and after a change to the level can be compared (#391).
const PRACTICE_NOW_MS = 1_700_000_000_000;

function practiceTelemetry() {
  return createTelemetry({ randomBytes: (n) => new Uint8Array(n).fill(7), now: () => PRACTICE_NOW_MS, setTimeout, clearTimeout });
}

/** The OTLP/HTTP endpoint the simulated Dash0 settings panel shows. */
function practiceEndpoint() {
  return q('#ctd-ep-http').textContent.trim();
}

/** Pick a permission, create the token, type endpoint and the shown token, press Connect. */
async function sendPractice(scope, endpoint) {
  click(`#ctd-scope-${scope}`);
  click('#ctd-mint');
  type('#ctd-endpoint', endpoint);
  type('#ctd-token', q('#ctd-minted').textContent.trim());
  click('#ctd-connect');
}

/** The happy path through screen 2: practice, the right permission, the shown endpoint. */
async function connectPractice(scope) {
  click('#ctd-practice');
  await sendPractice(scope, practiceEndpoint());
  await until('#ctd-finish');
}

// The same registry the app boots with (levels/index.mjs, the deck and the map's node ids),
// so a level the app accepts is a level this file plays, and vice versa.
const LIVE = liveRegistry();

/** Ids registered without a driver, and drivers for ids that are not registered. */
function driverGaps(order, drivers) {
  const ids = new Set(order);
  const keys = Object.keys(drivers);
  return {
    missing: order.filter((id) => !Object.hasOwn(drivers, id)),
    extra: keys.filter((id) => !ids.has(id)),
  };
}

// The click in progress, set only while its handler runs, so a finish can be traced
// to the click that caused it; a finish outside a wrapper click sees null. Drivers
// use these wrappers, not ./helpers/dom.mjs directly.
let current = null;
// While a level plays (playLevel), every class on the page after each click (T8).
let seenClasses = null;
// Likewise the attributes the CSP and Alpine rules forbid (style=, on*=, x-, @, :), by element.
let seenAttrs = null;
// Likewise the level's overlay and the list collecting the screen before each click (LEVEL_SNAPSHOT `clicks`).
let recording = null;
const FORBIDDEN_ATTR = /^(x-|@|:|on|style$)/;

/** Add the class names of every element in the document to `into`; and the forbidden attributes to the run's set. */
function pageClasses(into) {
  for (const el of globalThis.document.querySelectorAll('[class]')) {
    for (const c of el.getAttribute('class').split(/\s+/)) if (c) into.add(c);
  }
  if (!seenAttrs) return;
  for (const el of globalThis.document.querySelectorAll('*')) {
    for (const n of el.getAttributeNames()) if (FORBIDDEN_ATTR.test(n)) seenAttrs.add(`<${el.localName} ${n}>`);
  }
}

// A configured guide (#17 P4): every play step with a panel shows it, so the class, CSP and Alpine
// checks below cover the panel on every step. It is never asked here (test/guide-panel.test.mjs does).
const FAKE_GUIDE = Object.freeze({ configured: true, ask: async () => ({ kind: 'failed' }) });

// The "fifty" run (#371): when set, a click on a multiple-choice answer first uses that question's
// enabled, unused 50/50 button, as a player would. `used` collects the button ids it pressed.
let fifty = null;
/** The tempting near-misses the 50/50 must never remove (`keep: true` in the level), as `level:pick`. */
const KEEP_PICKS = new Set([
  'span-kinds:provider',
  'cardinality:sum',
  'synthetic-checks:health-check',
  'frontend-rum:page-origin-otlp-header',
]);

/** Press the 50/50 of the question `answer` belongs to, if it has one that is enabled. */
function useFifty(answer) {
  const box = answer.closest('[id$="-choices"]');
  const btn = box && q(`#${box.id.slice(0, -'-choices'.length)}-fifty`);
  if (!btn || btn.disabled) return;
  domClick(btn);
  fifty.used.push(btn.id);
  assert.equal(answer.hidden, false, `the 50/50 removed the driver's right answer ${answer.dataset.pick}`);
  // keep (#371): a tempting near-miss is never removed.
  for (const k of box.querySelectorAll('[data-pick]')) {
    if (KEEP_PICKS.has(`${fifty.level}:${k.dataset.pick}`)) assert.equal(k.hidden, false, `the 50/50 removed the keep answer ${k.dataset.pick}`);
  }
}

/** dom.mjs click, recording for its duration whether it hit the Finish button. */
function click(elOrSel) {
  const el = typeof elOrSel === 'string' ? q(elOrSel) : elOrSel;
  if (recording) recording.clicks.push(clickFrameOf(String(elOrSel), recording.dom.body, recording.dom.actions));
  if (fifty && el?.matches?.('[data-pick]')) useFifty(el);
  current = { sel: String(elOrSel), finish: !!el?.matches?.('[data-finish]') };
  try {
    domClick(elOrSel);
  } finally {
    current = null;
    if (seenClasses) pageClasses(seenClasses);
  }
}

/** Click `sel` then `next` each round until `until` exists (at most `max` rounds). */
function clickUntil(sel, next, until, max = 30) {
  for (let i = 0; i < max && !q(until); i++) {
    click(sel);
    click(next);
  }
  assert.ok(q(until), `never reached ${until}`);
}

/** Open a level with the real ctx (and the run's telemetry, if any); `end()` collects what happened. */
function openLevel(level, { telemetry = null } = {}) {
  const dom = makeDom();
  const calls = [];
  const steps = [];
  const widgets = [];
  current = null;
  const ctx = createLevelContext({
    onWidget: (key) => widgets.push(key),
    level,
    ovBody: dom.body,
    ovActions: dom.actions,
    now: () => NOW,
    shuffle: (a) => a,
    reduceMotion: true,
    onFinish: (id, result) => calls.push({ id, result, via: current }),
    signal: new AbortController().signal,
    reportError: (e) => {
      throw e;
    },
    telemetry,
    guide: FAKE_GUIDE,
  });
  const render = ctx.renderStep;
  // LEVEL_SNAPSHOT=<dir> (test/helpers/snapshot.mjs): the live overlay as each step is left and
  // entered. Collected always (cheap), written only when the variable is set.
  const frames = [];
  ctx.renderStep = (body, actions) => {
    steps.push(`${body}${actions ?? ''}`);
    if (steps.length > 1) frames.push(frameOf('leave', dom.body, dom.actions));
    render(body, actions);
    frames.push(frameOf('step', dom.body, dom.actions));
  };
  const classes = new Set();
  seenClasses = classes;
  const attrs = new Set();
  seenAttrs = attrs;
  const clicks = [];
  recording = { dom, clicks };
  let first;
  const injected = [];
  try {
    level.run(ctx);
    pageClasses(classes);
    first = {
      rendered: steps.length,
      finishEnabled: qa('[data-finish]').some((b) => !b.disabled),
      finishedEarly: calls.length,
    };
    // The live overlay, not just renderStep's strings: setAttribute, innerHTML and
    // insertAdjacentHTML can add Alpine attributes too.
    injected.push(...liveAlpineAttrs(dom.body, dom.actions));
  } catch (e) {
    seenClasses = null;
    seenAttrs = null;
    recording = null;
    throw e;
  }
  return {
    ctx,
    telemetry,
    end() {
      injected.push(...liveAlpineAttrs(dom.body, dom.actions));
      pageClasses(classes);
      frames.push(frameOf('end', dom.body, dom.actions));
      return { calls, steps, first, injected, classes, attrs: [...attrs], widgets, frames, clicks };
    },
  };
}

/** Run a level with the real ctx, play it synchronously, return what happened. */
function playLevel(level, play, opts) {
  const session = openLevel(level, opts);
  try {
    play(session);
    return session.end();
  } finally {
    seenClasses = null;
    seenAttrs = null;
    recording = null;
  }
}

/** playLevel for a driver that awaits (a level that sends a request); `play` may return a promise. */
async function playLevelAsync(level, play, opts) {
  const session = openLevel(level, opts);
  try {
    await play(session);
    return session.end();
  } finally {
    seenClasses = null;
    seenAttrs = null;
    recording = null;
  }
}

/** Wait (a few event-loop turns) until `sel` is on the page; fails if it never appears. */
async function until(sel, max = 50) {
  for (let i = 0; i < max && !q(sel); i++) await new Promise((r) => setImmediate(r));
  assert.ok(q(sel), `never appeared: ${sel}`);
}

// ---- T8 (#158): every class a level shows has a CSS rule --------------------------------

const DEFINED = definedClasses();
// Empty since #158 P7: every class a level renders has a CSS rule, with no exceptions.
const UNDEFINED_ALLOW = [];

/** The classes in `steps` (renderStep strings) and `live` (seen on the page) that no stylesheet defines. */
function undefinedClasses(steps, live) {
  const all = new Set(live);
  const box = globalThis.document.createElement('div');
  for (const s of steps) {
    box.innerHTML = s;
    for (const el of box.querySelectorAll('[class]')) {
      for (const c of el.getAttribute('class').split(/\s+/)) if (c) all.add(c);
    }
  }
  return [...all].filter((c) => !DEFINED.has(c)).sort();
}

/** Alpine attribute names (see alpineAttrs) on `roots` and everything under them. */
function liveAlpineAttrs(...roots) {
  return roots.flatMap((root) => [root, ...root.querySelectorAll('*')]).flatMap((el) =>
    el.getAttributeNames().filter((n) => ALPINE_ATTR.test(n)).map((n) => `<${el.localName} ${n}>`));
}

/** True when `html` holds a [data-finish] element (a real query, not a substring). */
function hasFinish(html) {
  const box = globalThis.document.createElement('div');
  box.innerHTML = html;
  return box.querySelector('[data-finish]') !== null;
}

const ALPINE_ATTR = /^(x-|@|:)/;

/**
 * Alpine attribute names (x-*, @*, :*) in `html`. Level HTML must have none: Alpine's
 * mutation observer initialises nodes added under x-ignore too (it never checks
 * ancestors), so such an attribute would run as an Alpine expression.
 */
function alpineAttrs(html) {
  const box = globalThis.document.createElement('div');
  box.innerHTML = html;
  return [...box.querySelectorAll('*')].flatMap((el) =>
    el.getAttributeNames().filter((n) => ALPINE_ATTR.test(n)).map((n) => `<${el.localName} ${n}>`));
}

/** Every check a play-through must pass; returns the stars earned. */
function checkRun(level, run, label = 'happy') {
  return assertRun(level, run, playLevel(level, run.play, { telemetry: run.telemetry?.() }), label);
}

/** checkRun for a driver whose play awaits (`async: true` on the DRIVERS entry). */
async function checkRunAsync(level, run, label = 'happy') {
  return assertRun(level, run, await playLevelAsync(level, run.play, { telemetry: run.telemetry?.() }), label);
}

function assertRun(level, run, { calls, steps, first, injected, classes, attrs, widgets, frames, clicks }, label) {
  // The How to play modal follows the step the player is on: every widget a level declares is
  // reported as its step mounts, and nothing it does not declare (#316).
  if (level.widgets) assert.deepEqual([...new Set(widgets)].sort(), [...new Set(level.widgets)].sort(), 'ctx.widget reports the level\'s declared widgets');
  assert.deepEqual(injected, [], 'the overlay holds an Alpine attribute (set outside renderStep)');
  assert.deepEqual(attrs, [], 'the page shows an Alpine attribute, style= or on*= on some step (CSP)');
  const missing = undefinedClasses(steps, classes);
  assert.deepEqual(missing.filter((c) => !UNDEFINED_ALLOW.includes(c)), [], 'rendered classes with no CSS rule (T8)');
  assert.ok(first.rendered >= 1, 'run() renders a first step');
  assert.equal(first.finishEnabled, false, 'the first screen has no enabled Finish');
  assert.equal(first.finishedEarly, 0, 'run() alone does not finish');
  assert.equal(calls.length, 1, 'onFinish is called exactly once');
  const { id, result, via } = calls[0];
  assert.ok(via?.finish, `finished from a [data-finish] click, not from ${via?.sel ?? 'no click'}`);
  assert.equal(id, level.id);
  assert.deepEqual({ stars: result.stars, cards: result.cards }, run.expect);
  for (const c of result.cards) {
    assert.ok(level.cards.includes(c), `card ${c} is not in level.cards`);
  }
  assert.ok(result.text.length > 10, 'finish carries reward text');
  assert.ok(!result.text.includes('\u2014'), 'reward text has an em dash');
  assert.ok(!/&(amp|lt|gt|quot|apos|#\d+);/.test(result.text), 'reward text has an HTML entity; the card sets it as plain text (x-text)');
  assert.ok(result.text.split(/\n\s*\n/).every((p) => p.length <= 420), 'a reward paragraph over 420 characters; split it at a blank line');
  assert.ok(steps.some(hasFinish), 'some step shows a Finish button ([data-finish])');
  for (const s of steps) {
    assert.ok(/<button|<input/.test(s), `step has nothing to click: ${s.slice(0, 80)}`);
    assert.ok(!s.includes('\u2014'), `step copy has an em dash: ${s.slice(0, 80)}`);
    assert.deepEqual(alpineAttrs(s), [], `step uses an Alpine attribute: ${s.slice(0, 80)}`);
  }
  // Registered levels only: the harness self-checks below play fixtures that are not the game.
  if (LIVE.levels[level.id] === level) recordFrames(process.env, level.id, label, frames, result.text, clicks);
  return result.stars;
}

/** Happy run, then sloppy: required and worse for scored levels; optional and 0 if unscored. */
function checkLevel(level, driver) {
  return judge(level, driver, checkRun(level, driver), () => driver.sloppy && checkRun(level, driver.sloppy, 'sloppy'));
}

async function checkLevelAsync(level, driver) {
  return judge(level, driver, await checkRunAsync(level, driver),
    () => driver.sloppy && checkRunAsync(level, driver.sloppy, 'sloppy'));
}

// `sloppy` is a thunk giving the sloppy run's stars (or a promise of them).
function judge(level, driver, happy, sloppyRun) {
  if (!driver.sloppy) {
    assert.ok(!level.scored, `DRIVERS["${level.id}"] needs a sloppy run`);
    return undefined;
  }
  const after = (sloppy) => {
    if (!level.scored) {
      assert.equal(sloppy, 0, 'an unscored level earns 0 stars on any run');
      return;
    }
    assert.ok(sloppy < happy, `sloppy run (${sloppy}) must score fewer stars than happy (${happy})`);
  };
  const ran = sloppyRun();
  return ran instanceof Promise ? ran.then(after) : after(ran);
}

test('every registered run-level has a driver and every driver is registered', () => {
  const gaps = driverGaps(LIVE.order, DRIVERS);
  assert.deepEqual({ ...gaps, missing: gaps.missing.filter((id) => !LIVE.levels[id].play) }, { missing: [], extra: [] });
});

test('driverGaps catches a missing driver and a driver without a level', () => {
  assert.deepEqual(driverGaps(['a', 'b'], { a: {}, c: {} }), { missing: ['b'], extra: ['c'] });
  assert.deepEqual(driverGaps([], {}), { missing: [], extra: [] });
});

for (const id of LIVE.order) {
  if (!DRIVERS[id] && LIVE.levels[id].play) continue; // played with a derived driver below
  test(`level "${id}" plays through (happy and sloppy)`, async () => {
    if (DRIVERS[id].async) await checkLevelAsync(LIVE.levels[id], DRIVERS[id]);
    else checkLevel(LIVE.levels[id], DRIVERS[id]);
  });
}

// A run level converted to a content file (docs/CONTENT.md section 11) plays only the words it is given: play it
// through every screen with its own drivers, over content where each word carries its own `EDITED<n> ` mark (n is
// the entry's number), and the test fails on a word shown without its mark, on an entry no run shows with its mark,
// and on a stale UNREACHED entry (a step reading the module's built-in text instead of the text handed to withText
// would show a word without its mark).
const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'core', 'levels');
const RUN_CONTENT_IDS = readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => f.replace(/\.mjs$/, ''))
  .filter((id) => readJsonModule(join(CONTENT_DIR, `${id}.mjs`)).value.run !== undefined);

// The entries of `run` (by path) that the drivers of a level do not reach: the feedback of a wrong sort placement, and
// the explanation of a wrong pick the sloppy run does not make. A run that does show one fails the test, so the list
// cannot go stale; an entry not listed that no run shows edited fails it too.
const UNREACHED = {
  baggage: [
    'run.sort.items[0].whyNot.never',
    'run.sort.items[1].whyNot.ok',
    'run.sort.items[2].whyNot.never',
    'run.sort.items[3].whyNot.ok',
    'run.sort.items[4].whyNot.ok',
    'run.onSpans[1].why',
  ],
  // Both drivers connect to the simulated Dash0 (practice). Never on a screen: the no-telemetry build, everything
  // live (your own Dash0), the wrong pick the sloppy run does not make (All permissions), the form errors it does
  // not trigger, a token or dataset named in a form error, the failures of a send and the accepted line (an accepted
  // send moves on to the Connected screen).
  'connect-to-dash0': [
    'run.startIntro',
    'run.startNote',
    'run.modeLive',
    'run.scopes[0].why',
    'run.connectGuide',
    'run.connectLiveLegend',
    'run.connectIntroLive',
    'run.connectChipLive',
    'run.connectLiveNote',
    'run.connectRetryButton',
    'run.connectSwitchButton',
    'run.connectMintSays',
    'run.connectEndpointFirstSays',
    'run.connectScopeFirstSays',
    'run.connectReadingSays',
    'run.connectAgainPractice',
    'run.connectAgainLive',
    'run.fieldName.token',
    'run.fieldName.datasetField',
    'run.fieldNameOther',
    'run.problemUnavailable',
    'run.problemMode',
    'run.problemUnchecked',
    'run.unreachable.network',
    'run.unreachable.timeout',
    'run.unreachable.opaque',
    'run.unreachable.aborted',
    'run.unreachableFallback',
    'run.whereLive',
    'run.outcomeAccepted',
    'run.outcomeRefusedStatus',
    'run.outcomeSaid',
    'run.connectedIntroLive',
    'run.connectedChipLive',
    'run.connectedFinishLive',
  ],
  // Never on a screen: the broken-build starts, everything live (the send screen, its failures, the live find
  // guide and finish), the filters and answers the drivers never get wrong, and the explorer states they never reach
  // (no match, a match of several, a span with no events).
  'its-us': [
    'run.startIntroNoIncident',
    'run.startIntroNoTelemetry',
    'run.startNote',
    'run.notConnectedWhyAvailable',
    'run.notConnectedReasonAvailable',
    'run.sendLeadElsewhere',
    'run.sendHostsJoiner',
    'run.sendLeadAttempted',
    'run.sendLeadFresh',
    'run.sendChip',
    'run.sendBody',
    'run.duplicateNote',
    'run.sendButton',
    'run.sendBarButton',
    'run.sendRetryButton',
    'run.sendSwitchButton',
    'run.sendSendingSays',
    'run.describeRefusedToken',
    'run.describeRefused',
    'run.describeSaid',
    'run.unreachable.network',
    'run.unreachable.timeout',
    'run.unreachable.opaque',
    'run.unreachable.aborted',
    'run.unreachable.invalid',
    'run.unreachableFallback',
    'run.filterValueSays',
    'run.listMatchMany',
    'run.listNone',
    'run.detailNoEvents',
    'run.findGuideTitle',
    'run.findGuide',
    'run.findIntroLive',
    'run.findChipLive',
    'run.questions[0].nudge',
    'run.questions[1].nudge',
    'run.questions[1].wrong',
    'run.questions[2].nudge',
    'run.questions[3].nudge',
    'run.questions[3].wrong',
    'run.findFinishUnfiltered',
    'run.findFinishLive',
  ],
  // The runs open the two clue views and the herring and make one wrong pick: the other views' notes, the explanations of
  // the other wrong picks and the triage table's "no data" (no row lacks data) are never on a screen. The hint is: HINT_PLAYS presses the Hint button.
  'checkout-is-slow': [
    'run.scenario.views[2].html',
    'run.scenario.views[3].html',
    'run.scenario.views[4].html',
    'run.scenario.views[5].html',
    'run.scenario.views[7].html',
    'run.scenario.hypotheses[2].why',
    'run.scenario.hypotheses[3].why',
    'run.triageNoData',
  ],
  // The sloppy run makes one wrong pick; the explanations of the other wrong picks are never on a screen.
  'context-propagation': [
    'run.where[0].why',
    'run.where[2].why',
    'run.valid[0].why',
    'run.valid[1].why',
  ],
  // The sloppy run makes no wrong pick: the explanations of the wrong picks are never on a screen.
  'events-and-links': [
    'run.recorded[0].why',
    'run.recorded[1].why',
  ],
  // The drivers make one wrong pick in step 1 and none in step 3, check the given config once (two problems) and never
  // check a repeat, a blank, a one-problem config or one that names the service in the attribute list.
  'naming-your-service': [
    'run.showsUpAs[2].why',
    'run.showsUpAs[3].why',
    'run.fixBlankSays',
    'run.fixRepeatSays',
    'run.fixMissOneSays',
    'run.fixAttrNote',
    'run.whoWins[1].why',
    'run.whoWins[2].why',
    'run.whoWins[3].why',
  ],
  // The sloppy run places one item wrong; the other wrong-placement explanations and the explanations of the wrong
  // picks it does not make are never on a screen. The hints are: HINT_PLAYS presses each Hint button.
  'monitoring-vs-observability': [
    'run.sort.items[1].whyNot.known',
    'run.sort.items[2].whyNot.new',
    'run.sort.items[3].whyNot.known',
    'run.sort.items[4].whyNot.new',
    'run.sort.items[5].whyNot.known',
    'run.answerable[1].why',
    'run.answerable[2].why',
    'run.answerable[3].why',
  ],
  // The sloppy run makes one wrong flag (payments' call out to the provider) and opens only that span and the culprit: the
  // other spans' explanations, the root and no-attribute sidebar words, and the sidebar button of a span opened after the
  // solve are never on a screen; the "no data" title and the "none" map line cannot occur (the view always has a rate and
  // an edge). No run makes a wrong fix pick, so those explanations are not shown. The hints are: HINT_PLAYS presses the Hint button.
  'span-kinds': [
    'run.alertTitleNoData',
    'run.edgesNone',
    'run.sidebarHuntOver',
    'run.sidebarNoParent',
    'run.sidebarNoAttrs',
    'run.flagWhy[0].why',
    'run.flagWhy[1].why',
    'run.flagWhy[2].why',
    'run.flagWhy[3].why',
    'run.flagWhy[4].why',
    'run.flagWhy[5].why',
    'run.flagWhy[6].why',
    'run.fix[1].why',
    'run.fix[2].why',
    'run.fix[3].why',
  ],
  // The sloppy run makes no wrong pick (its one slip is a wrong drop on the board): the explanations of the wrong picks are never on a screen.
  'spans-and-traces': [
    'run.oneTrace[1].why',
    'run.other[0].why',
    'run.other[1].why',
  ],
  // The sloppy run places one item wrong (b); the other wrong-placement explanations and the explanations of the wrong
  // picks are never on a screen. The hint is: HINT_PLAYS presses the Hint button.
  'status-and-errors': [
    'run.sort.items[0].whyNot.wrong',
    'run.sort.items[2].whyNot.ok',
    'run.sort.items[3].whyNot.wrong',
    'run.sort.items[4].whyNot.wrong',
    'run.okThenError[0].why',
    'run.okThenError[2].why',
  ],
  'the-signals': [
    'run.data.items[0].whyNot.log',
    'run.data.items[0].whyNot.trace',
    'run.data.items[0].whyNot.profile',
    'run.data.items[1].whyNot.metric',
    'run.data.items[1].whyNot.trace',
    'run.data.items[1].whyNot.profile',
    'run.data.items[2].whyNot.metric',
    'run.data.items[2].whyNot.log',
    'run.data.items[2].whyNot.trace',
    'run.data.items[3].whyNot.log',
    'run.data.items[3].whyNot.trace',
    'run.data.items[3].whyNot.profile',
    'run.data.items[4].whyNot.metric',
    'run.data.items[4].whyNot.log',
    'run.data.items[4].whyNot.profile',
    'run.ask.items[0].whyNot.log',
    'run.ask.items[0].whyNot.trace',
    'run.ask.items[0].whyNot.profile',
    'run.ask.items[1].whyNot.metric',
    'run.ask.items[1].whyNot.trace',
    'run.ask.items[1].whyNot.profile',
    'run.ask.items[2].whyNot.metric',
    'run.ask.items[2].whyNot.log',
    'run.ask.items[2].whyNot.trace',
    'run.ask.items[3].whyNot.metric',
    'run.ask.items[3].whyNot.log',
    'run.ask.items[3].whyNot.profile',
    'run.newest[0].why',
    'run.newest[2].why',
  ],
  'why-opentelemetry': [
    'run.parts.items[0].whyNot.api',
    'run.parts.items[0].whyNot.sdk',
    'run.parts.items[0].whyNot.collector',
    'run.parts.items[0].whyNot.semconv',
    'run.parts.items[1].whyNot.sdk',
    'run.parts.items[1].whyNot.otlp',
    'run.parts.items[1].whyNot.collector',
    'run.parts.items[1].whyNot.semconv',
    'run.parts.items[2].whyNot.api',
    'run.parts.items[2].whyNot.sdk',
    'run.parts.items[2].whyNot.otlp',
    'run.parts.items[2].whyNot.collector',
    'run.parts.items[3].whyNot.api',
    'run.parts.items[3].whyNot.sdk',
    'run.parts.items[3].whyNot.otlp',
    'run.parts.items[3].whyNot.semconv',
    'run.parts.items[4].whyNot.api',
    'run.parts.items[4].whyNot.otlp',
    'run.parts.items[4].whyNot.semconv',
    'run.dependsOn[0].why',
    'run.dependsOn[2].why',
    'run.dependsOn[3].why',
  ],
};

// A play per run level with Hint buttons that presses each step's Hint button (one tier 1 hint, the step's own `hint`)
// before solving it. DRIVERS stay as they are: no driver presses Hint, and a hint costs a star, so this run is only
// looked at for the words it shows. baggage, events-and-links and the-pager have no Hint button. The Act 2 boss and span-kinds have three
// hint tiers: each play presses the button three times, so every tier's words are on a screen (the boss's tier 1 is its own `hint`).
const HINT_PLAYS = {
  'checkout-is-slow'() {
    for (let tier = 0; tier < 3; tier++) click('#checkout-is-slow-hint');
    click('[data-view="trace-slow"]');
    click('[data-view="triage"]');
    click('[data-hypothesis="n-plus-one"]');
    click('#cis-finish');
  },
  'context-propagation'() {
    click('[data-pick="proxy"]');
    click('#prop-next');
    click('[data-pick="valid"]');
    click('#prop-next');
    click('#prop-tree-hint');
    buildAll('parent', PROP_TREE);
    click('#prop-tree-check');
    click('#prop-finish');
  },
  'monitoring-vs-observability'() {
    click('#mvo-sort-hint');
    sortAll(MVO_SORT);
    click('#mvo-next');
    click('[data-pick="rich"]');
    click('#mvo-finish');
  },
  // Three Hint presses: the third fills in the reference config and checks it ("Filled in for you.").
  'naming-your-service'() {
    click('[data-pick="fallback"]');
    click('#nys-next');
    click('#nys-hint');
    click('#nys-hint');
    click('#nys-hint');
    click('#nys-next');
    click('[data-pick="env-var"]');
    click('#nys-finish');
  },
  'span-kinds'() {
    for (let tier = 0; tier < 3; tier++) click('#kinds-hunt-hint');
    click(`[data-open-span="${KINDS_CULPRIT}"]`);
    click('#kinds-flag');
    click('#kinds-next');
    click('[data-pick="server"]');
    click('#kinds-finish');
  },
  'spans-and-traces'() {
    click('[data-pick="trace-id"]');
    click('#sat-next');
    click('#sat-tree-hint');
    buildAll('parent', [...SAT_TREE, [SAT_E, 'none']]);
    click('#sat-next');
    click('[data-pick="other-request"]');
    click('#sat-finish');
  },
  'status-and-errors'() {
    click('#status-sort-hint');
    sortAll(STATUS_SORT);
    click('#status-next');
    click('[data-pick="stays-ok"]');
    click('#status-finish');
  },
  'the-signals'() {
    click('#sig-data-hint');
    sortAll(SIG_DATA);
    click('#sig-next');
    click('#sig-ask-hint');
    sortAll(SIG_ASK);
    click('#sig-next');
    click('[data-pick="profiles"]');
    click('#sig-finish');
  },
  'why-opentelemetry'() {
    click('#otel-parts-hint');
    sortAll(OTEL_PARTS);
    click('#otel-next');
    click('[data-pick="api"]');
    click('#otel-finish');
  },
};

test('a converted run level plays every screen, happy and sloppy, with the words it was given and no others', async () => {
  for (const id of ['baggage', 'checkout-is-slow', 'connect-to-dash0', 'context-propagation', 'events-and-links', 'its-us', 'monitoring-vs-observability', 'naming-your-service', 'span-kinds', 'spans-and-traces', 'status-and-errors', 'the-pager', 'the-signals', 'why-opentelemetry']) assert.ok(RUN_CONTENT_IDS.includes(id), `${id} is a converted run level`);
  for (const id of RUN_CONTENT_IDS) {
    const core = readJsonModule(join(CONTENT_DIR, `${id}.mjs`)).value;
    const mod = await import(pathToFileURL(join(CONTENT_DIR, '..', '..', '..', 'levels', `${id}.mjs`)).href);
    const level = mod.withText({ ...core, run: editRun(core.run) });
    const shown = [];
    const runs = [['happy', DRIVERS[id]], ['sloppy', DRIVERS[id].sloppy], ...(HINT_PLAYS[id] ? [['hinted', { play: HINT_PLAYS[id] }]] : [])];
    for (const [label, run] of runs) {
      // A level that sends a request (connect-to-dash0, its-us) has an async driver and a telemetry session.
      const { calls, frames, clicks } = DRIVERS[id].async
        ? await playLevelAsync(level, run.play, { telemetry: run.telemetry?.() })
        : playLevel(level, run.play);
      assert.equal(calls.length, 1, `${id} ${label}: finished once`);
      assert.match(calls[0].result.text, /^EDITED\d+ /, `${id} ${label}: the finish text is the one it was given`);
      shown.push(...[...frames, ...clicks].flatMap((f) => [f.body, f.actions]), calls[0].result.text);
    }
    const { leaked, unseen, stale } = checkWords(core.run, shown, { unreached: UNREACHED[id], kept: RUN_FIXTURES[id] });
    assert.deepEqual(leaked, [], `${id}: words of the real content shown without the edit`);
    assert.deepEqual(unseen, [], `${id}: entries no run shows edited (add them to UNREACHED if the drivers cannot reach them)`);
    assert.deepEqual(stale, [], `${id}: UNREACHED entries that a run does show, or that are no entry`);
  }
});

/**
 * A driver for a play level, derived from its steps (test/helpers/step-drivers.mjs): the happy
 * run solves every step; the sloppy run makes the first slip it can find, then solves.
 */
function derivedDriver(level) {
  const steps = stepsOf(level);
  const advance = (i) => `#${level.play.prefix ?? level.id}-${i === steps.length - 1 ? 'finish' : 'next'}`;
  const run = (slipAt = -1) => () =>
    steps.forEach(({ driver, spec }, i) => {
      if (i === slipAt) for (const sel of driver.slips(spec)[0].clicks) click(sel);
      for (const sel of driver.solve(spec)) click(sel);
      click(advance(i));
    });
  const expect = (stars) => ({ stars: level.scored ? stars : 0, cards: [...level.cards] });
  const slipAt = steps.findIndex(({ driver, spec }) => driver.slips(spec).length > 0);
  return { play: run(), expect: expect(5), sloppy: { play: run(slipAt), expect: expect(4) } };
}

/** The happy run of `level` with the 50/50 pressed wherever a question offers it: stars and the buttons used. */
async function fiftyRun(level) {
  const driver = DRIVERS[level.id] ?? derivedDriver(level);
  fifty = { used: [], level: level.id };
  try {
    const opts = { telemetry: driver.telemetry?.() };
    const done = driver.async ? await playLevelAsync(level, driver.play, opts) : playLevel(level, driver.play, opts);
    assert.equal(done.calls.length, 1, `${level.id}: finishes once`);
    return { stars: done.calls[0].result.stars, used: fifty.used, expect: driver.expect };
  } finally {
    fifty = null;
  }
}

// #371: the 50/50 costs one hint per use, never a mistake, and never removes the right answer.
// B10 pins the real list of questions that offer it (four or more answers).
const FIFTY_PINNED = [
  'monitoring-vs-observability:mvo-fifty',
  'the-signals:sig-fifty',
  'why-opentelemetry:otel-fifty',
  'naming-your-service:nys-fifty',
  'naming-your-service:nys-fifty',
  'span-kinds:kinds-fix-fifty',
  'context-propagation:prop-tp-fifty',
  'temporality:temp-convert-fifty',
  'promql-basics:pql-unit-fifty',
  'cardinality:cdn-combos-fifty',
  'cardinality:cdn-dash0-fifty',
  'red-and-use:ru-connector-fifty',
  'the-bill:tbl-fix-fifty',
  'ottl-and-transforms:ottl-backend-fifty',
  'what-costs-money:wcm-host-fifty',
  'good-alerts:ga-fix-fifty',
  'slis-and-slos:sl-budget-fifty',
  'burn-rate-alerts:br-rule-fifty',
  'synthetic-checks:sc-alert-fifty',
  'everything-is-green:eig-page-fifty',
  'dashboards-as-code:dac-deploy-fifty',
  'migrating-vendors:mv-fix-fifty',
  'frontend-rum:frum-cors-fifty',
  'ai-assisted-debugging:aad-why-fifty',
  'the-trace-that-starts-in-the-middle:ttsm-verdict-fifty',
];

test('#371 the 50/50 run: every level still finishes, one penalty per 50/50 used, and the offering questions are pinned', async () => {
  const seen = [];
  for (const id of LIVE.order) {
    const level = LIVE.levels[id];
    const { stars, used, expect } = await fiftyRun(level);
    for (const u of used) seen.push(`${id}:${u}`);
    const clean = scoreStars({ mistakes: 0, hintsUsed: 0, elapsedMs: 0 }, level);
    if (expect.stars === clean) {
      assert.equal(stars, scoreStars({ mistakes: 0, hintsUsed: used.length, elapsedMs: 0 }, level), `${id}: stars after ${used.length} 50/50`);
    } else {
      // A level that does not finish clean must not offer a 50/50 here (it would be charged on top of its own penalty).
      assert.equal(used.length, 0, `${id}: a level with a penalty in its happy run offers a 50/50; extend this run`);
      assert.equal(stars, expect.stars, id);
    }
  }
  assert.ok(seen.length >= 1);
  assert.deepEqual(seen, FIFTY_PINNED);
});

const PLAY_LEVELS = [
  ...Object.values(LIVE.levels).filter((l) => l.play && !DRIVERS[l.id]),
  ...Object.values(
    buildRegistry([{ id: 'play-act', no: 0, levels: [playFixture()], boss: null }], {
      deck: [FIXTURE_CARD], nodeIds: [], play: { validatePlay, runPlay },
    }).levels,
  ),
];

for (const level of PLAY_LEVELS) {
  test(`play level "${level.id}" plays through (derived driver, happy and sloppy)`, () => {
    checkLevel(level, derivedDriver(level));
  });
}

test('LEVEL_SNAPSHOT: a real level writes its happy and sloppy frames and click frames, and a fixture writes none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lvl-snap-'));
  const was = process.env.LEVEL_SNAPSHOT;
  process.env.LEVEL_SNAPSHOT = dir;
  try {
    const level = LIVE.levels['good-alerts'];
    checkLevel(level, derivedDriver(level));
    checkLevel(FIXTURE, FIXTURE_DRIVER);
    assert.deepEqual(readdirSync(dir).sort(), ['good-alerts.happy.json', 'good-alerts.sloppy.json']);
    const clickCounts = {};
    for (const label of ['happy', 'sloppy']) {
      const { frames, clicks, finish } = JSON.parse(readFileSync(join(dir, `good-alerts.${label}.json`), 'utf8'));
      // clicks: the screen as it stood just BEFORE each driver click, so a content move shows which click led where.
      clickCounts[label] = clicks.length;
      assert.ok(clicks.length >= 1, `${label}: a frame per click`);
      assert.ok(clicks.every((c) => typeof c.sel === 'string' && c.body.length > 0), `${label}: every click frame names its target and holds the screen`);
      // Not equal to frames[0]: that frame is taken as the step renders, before its widget has mounted.
      assert.ok(clicks[0].body.includes('alert: OrdersWaiting'), `${label}: the first click is made on the first screen`);
      assert.ok(!clicks[0].body.includes('aria-pressed="true"'), `${label}: the frame is taken before the click, nothing is picked yet`);
      const ats = frames.map((f) => f.at);
      const steps = ats.filter((a) => a === 'step').length;
      assert.ok(steps >= stepsOf(level).length, `${label}: a step frame per step`);
      assert.deepEqual(ats, [...Array(steps - 1).fill(['step', 'leave']).flat(), 'step', 'end'], `${label}: step, leave, step ... step, end`);
      assert.ok(frames.every((f) => f.body.length > 0), `${label}: every frame holds the screen`);
      assert.ok(frames[0].body.includes('alert: OrdersWaiting'), `${label}: the first step frame holds the level's first screen`);
      assert.notEqual(frames[0].body, frames[0].actions, `${label}: body and actions are recorded apart`);
      assert.ok(frames.some((f) => f.actions.includes('data-finish')), `${label}: the Finish button is in some frame`);
      assert.ok(finish.length > 10, `${label}: the finish text`);
    }
    assert.ok(clickCounts.sloppy > clickCounts.happy, 'the sloppy run clicks more than the happy run');
  } finally {
    if (was === undefined) delete process.env.LEVEL_SNAPSHOT;
    else process.env.LEVEL_SNAPSHOT = was;
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- harness teeth: fixture levels prove the checks above can fail ------------

const FIXTURES = buildRegistry(
  [
    {
      id: 'fixture-act',
      no: 0,
      levels: [
        fixtureLevel,
        V.UNSCORED,
        V.FINISH_ON_FIRST_SCREEN,
        V.FINISH_FROM_OTHER,
        V.FINISH_IN_RUN,
        V.CARD_OUTSIDE,
        V.FINISH_OUTSIDE_RENDER,
        V.STALE_FINISH_CLICK,
      ],
      boss: null,
    },
  ],
  { deck: [FIXTURE_CARD], nodeIds: [] },
).levels;
const FIXTURE = FIXTURES['fixture-level'];

const FIXTURE_DRIVER = {
  play() {
    click('[data-pick="trace"]');
    click('#fx-next');
    click('#fx-finish');
  },
  expect: { stars: 5, cards: ['fixture-card'] },
  sloppy: {
    play() {
      click('[data-pick="metric"]');
      click('[data-pick="trace"]');
      click('#fx-next');
      click('#fx-finish');
    },
    expect: { stars: 4, cards: ['fixture-card'] },
  },
};

test('harness: the fixture level finishes once with 5 stars, sloppy with 4', () => {
  const { calls } = playLevel(FIXTURE, FIXTURE_DRIVER.play);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].result.stars, 5);
  checkLevel(FIXTURE, FIXTURE_DRIVER);
});

test('harness: an unscored level passes without a sloppy run, or with one that earns 0', () => {
  const lvl = FIXTURES['fx-unscored'];
  const zero = { stars: 0, cards: ['fixture-card'] };
  const happy = { play: FIXTURE_DRIVER.play, expect: zero };
  checkLevel(lvl, happy);
  checkLevel(lvl, { ...happy, sloppy: { play: FIXTURE_DRIVER.sloppy.play, expect: zero } });
});

test('harness: clicking a missing element throws naming the selector', () => {
  assert.throws(() => playLevel(FIXTURE, () => click('#missing')), /#missing/);
});

test('harness: clicking a disabled button throws "disabled"', () => {
  assert.throws(() => playLevel(FIXTURE, () => click('#fx-next')), /disabled/);
});

test('harness: clickUntil clicks through to its target and records the clicks', () => {
  playLevel(FIXTURE, () => {
    clickUntil('[data-pick="trace"]', '#fx-next', '#fx-finish', 3);
    click('#fx-finish');
  });
  assert.throws(
    () => playLevel(FIXTURE, () => clickUntil('[data-pick="metric"]', '#fx-feedback', '#nope', 2)),
    /no click handler|never reached/,
  );
});

test('harness: a driver that never finishes fails the run', () => {
  assert.throws(
    () => checkRun(FIXTURE, { play() {}, expect: FIXTURE_DRIVER.expect }),
    /exactly once/,
  );
});

test('harness: a first screen with an enabled Finish fails', () => {
  const lvl = FIXTURES['fx-first-finish'];
  assert.throws(
    () => checkRun(lvl, { play: () => click('#ff'), expect: { stars: 5, cards: [] } }),
    /first screen has no enabled Finish/,
  );
});

test('harness: finishing inside run() fails', () => {
  const lvl = FIXTURES['fx-run-finish'];
  assert.throws(
    () => checkRun(lvl, { play() {}, expect: { stars: 5, cards: [] } }),
    /run\(\) alone does not finish/,
  );
});

test('harness: finishing from a button that is not the Finish button fails', () => {
  const lvl = FIXTURES['fx-other-button'];
  assert.throws(
    () => checkRun(lvl, { play: () => click('#go'), expect: { stars: 5, cards: [] } }),
    /finished from a \[data-finish\] click/,
  );
});

test('harness: awarding a card the level does not list fails', () => {
  const lvl = FIXTURES['fx-card-outside'];
  assert.throws(
    () =>
      checkRun(lvl, {
        play: () => (click('#go'), click('#fin')),
        expect: { stars: 5, cards: ['other-card'] },
      }),
    /not in level.cards/,
  );
});

test('harness: a Finish named only in text, never rendered as an element, fails', () => {
  const lvl = FIXTURES['fx-outside-render'];
  assert.throws(
    () =>
      checkRun(lvl, { play: () => (click('#go'), click('#fin')), expect: { stars: 5, cards: [] } }),
    /some step shows a Finish button/,
  );
});

test('harness: an earlier Finish click does not cover a finish from outside a click', () => {
  const lvl = FIXTURES['fx-stale-click'];
  const expect = { stars: 5, cards: [] };
  const bypasses = [
    () => domClick('#real'), // the F1 helper, which does not record
    () => q('#real').onclick(), // calling the handler directly
  ];
  for (const bypass of bypasses) {
    assert.throws(
      () => checkRun(lvl, { play: () => (click('#go'), click('#fin'), bypass()), expect }),
      /finished from a \[data-finish\] click, not from no click/,
    );
  }
});

test('harness: an async level whose sloppy run equals its happy run fails', async () => {
  const same = { async: true, async play() { FIXTURE_DRIVER.play(); }, expect: FIXTURE_DRIVER.expect };
  await checkLevelAsync(FIXTURE, { ...same, sloppy: { ...FIXTURE_DRIVER.sloppy, async play() { FIXTURE_DRIVER.sloppy.play(); } } });
  await assert.rejects(
    checkLevelAsync(FIXTURE, { ...same, sloppy: { ...same } }),
    /must score fewer/,
  );
});

test('harness: an async run that finishes from a stray button fails', async () => {
  await assert.rejects(
    checkRunAsync(FIXTURES['fx-other-button'], { async play() { click('#go'); }, expect: { stars: 5, cards: [] } }),
    /finished from a \[data-finish\] click/,
  );
});

test('harness: a wrong expectation, a missing sloppy run or an equal sloppy run fails', () => {
  const wrong = { stars: 2, cards: ['fixture-card'] };
  assert.throws(() => checkRun(FIXTURE, { ...FIXTURE_DRIVER, expect: wrong }));
  const noSloppy = { play: FIXTURE_DRIVER.play, expect: FIXTURE_DRIVER.expect };
  assert.throws(() => checkLevel(FIXTURE, noSloppy), /needs a sloppy run/);
  assert.throws(
    () => checkLevel(FIXTURE, { ...FIXTURE_DRIVER, sloppy: FIXTURE_DRIVER }),
    /fewer stars/,
  );
});

test('harness: a step with an Alpine attribute (x-, @ or :) fails', () => {
  const tags = ['x-on:click="go()"', '@click="go()"', ':disabled="false"'];
  for (const attr of tags) {
    const [lvl] = Object.values(
      buildRegistry(
        [{ id: 'fx-act', no: 0, levels: [{ ...fixtureLevel, id: 'fx-alpine', run(ctx) {
          ctx.renderStep('<p>Go on.</p>', `<button id="fin" data-finish ${attr}>Finish</button>`);
          ctx.ovActions.querySelector('#fin').disabled = true;
          ctx.ovActions.querySelector('#fin').onclick = () => ctx.finish({ text: 'A long enough reward text.' });
        } }], boss: null }],
        { deck: [FIXTURE_CARD], nodeIds: [] },
      ).levels,
    );
    const play = () => {
      q('#fin').disabled = false;
      click('#fin');
    };
    assert.throws(() => checkRun(lvl, { play, expect: { stars: 5, cards: [] } }), /Alpine attribute/, attr);
  }
  assert.deepEqual(alpineAttrs('<p data-x="1" class="x-y" aria-label=":)">ok</p>'), []);
});

test('the live registry checks levels against the real map nodes', () => {
  const act = (lights) => [{ id: 'fx-act', no: 0, levels: [{ ...fixtureLevel, lights }], boss: null }];
  const reg = liveRegistry(act(['checkout', 'payments']), [FIXTURE_CARD]);
  assert.deepEqual(reg.levels['fixture-level'].lights, ['checkout', 'payments']);
  assert.throws(() => liveRegistry(act(['nowhere']), [FIXTURE_CARD]), /unknown node "nowhere"/);
});

test('harness: an Alpine attribute added outside renderStep, after run() or during play, fails', () => {
  const REWARD = 'A long enough reward text.';
  const level = (id, inject) => ({
    ...fixtureLevel,
    id,
    run(ctx) {
      ctx.renderStep('<p id="msg">Go on.</p>', '<button id="go">Go</button>');
      inject.atRun?.(ctx);
      ctx.ovActions.querySelector('#go').onclick = () => {
        inject.atPlay?.(ctx);
        ctx.renderStep('<p>Done.</p>', '<button id="fin" data-finish>Finish</button>');
        inject.afterFinishRender?.(ctx);
        ctx.ovActions.querySelector('#fin').onclick = () => ctx.finish({ text: REWARD });
      };
    },
  });
  const cases = {
    'fx-set-attr': { atRun: (ctx) => ctx.ovBody.querySelector('#msg').setAttribute('@click', 'go()') },
    'fx-set-attr-late': {
      afterFinishRender: (ctx) => ctx.ovActions.querySelector('#fin').setAttribute('x-on:click', 'go()'),
    },
    'fx-adjacent': {
      afterFinishRender: (ctx) => ctx.ovBody.insertAdjacentHTML('beforeend', '<span :class="c">!</span>'),
    },
    'fx-root-attr': { atRun: (ctx) => ctx.ovBody.setAttribute('x-data', '{}') },
  };
  for (const [id, inject] of Object.entries(cases)) {
    const lvl = buildRegistry(
      [{ id: 'fx-act', no: 0, levels: [level(id, inject)], boss: null }],
      { deck: [FIXTURE_CARD], nodeIds: [] },
    ).levels[id];
    const play = () => (click('#go'), click('#fin'));
    assert.throws(() => checkRun(lvl, { play, expect: { stars: 5, cards: [] } }), /Alpine attribute \(set outside/, id);
  }
  // The same flow with nothing injected passes, so the cases above fail only on the attribute.
  const clean = buildRegistry(
    [{ id: 'fx-act', no: 0, levels: [level('fx-clean', {})], boss: null }],
    { deck: [FIXTURE_CARD], nodeIds: [] },
  ).levels['fx-clean'];
  checkRun(clean, { play: () => (click('#go'), click('#fin')), expect: { stars: 5, cards: [] } });
});

test('harness T8: a class with no CSS rule fails, in a rendered step or added later on the page', () => {
  const REWARD = 'A long enough reward text.';
  const level = (id, { body = '<p>Go on.</p>', late = null }) => buildRegistry(
    [{ id: 'fx-act', no: 0, levels: [{ ...fixtureLevel, id, run(ctx) {
      ctx.renderStep(body, '<button id="go">Go</button>');
      ctx.ovActions.querySelector('#go').onclick = () => {
        ctx.renderStep('<p id="msg">Done.</p>', '<button id="fin" data-finish>Finish</button>');
        if (late) ctx.ovBody.querySelector('#msg').setAttribute('class', late);
        ctx.ovActions.querySelector('#fin').onclick = () => ctx.finish({ text: REWARD });
      };
    } }], boss: null }],
    { deck: [FIXTURE_CARD], nodeIds: [] },
  ).levels[id];
  const play = () => (click('#go'), click('#fin'));
  const expect = { stars: 5, cards: [] };
  assert.throws(() => checkRun(level('fx-nope', { body: '<p class="nope">Go on.</p>' }), { play, expect }), /no CSS rule/);
  assert.throws(() => checkRun(level('fx-late', { late: 'ui-lesson nope-late' }), { play, expect }), /no CSS rule/);
  // Defined classes pass: a kit class and a utility one.
  checkRun(level('fx-ok', { body: '<p class="ui-note">Go on.</p>', late: 'visually-hidden' }), { play, expect });
});

// Runs last: every level above has played, so an allowed class no level renders is stale.
test('T8 UNDEFINED_ALLOW is empty: every rendered class has a CSS rule', () => {
  assert.deepEqual(UNDEFINED_ALLOW, []);
});
