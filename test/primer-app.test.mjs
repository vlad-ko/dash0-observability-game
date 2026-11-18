// The act primer tile and pop-up in the game component (#389): when it opens, what it records, where focus goes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { makeDom } from './helpers/dom.mjs';
import { recordFocus } from './helpers/focus.mjs';
import { fakeStorage } from './helpers/fake-storage.mjs';
import { buildRegistry } from '../lib/registry.mjs';
import { PRIMER_KEY } from '../lib/primer-prefs.mjs';
import { createGame } from '../app.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const L = (id, no) => ({
  id, no, name: `Level ${id}`, icon: '*', rewardTitle: `Title ${id}`, mechanics: ['query'],
  run(ctx) {
    ctx.renderStep(`<p id="step-${id}">${id}</p>`, '<button data-finish>Finish</button>');
  },
});
const REG = buildRegistry(
  [
    { id: 'a0', no: 0, name: 'First act', levels: [L('x', '0.1'), L('y', '0.2')], boss: null },
    { id: 'a1', no: 1, name: 'Second act', levels: [L('z', '1.1')], boss: null },
  ],
  { deck: [], nodeIds: [] },
);
const GLOBE_MAP = { ACT_REGIONS: {}, LEVEL_COUNTRY: {}, COUNTRY_NAMES: {}, actOf: () => null };

const src = { kind: 'otel', label: 'OpenTelemetry docs', url: 'https://opentelemetry.io/docs/', audience: 'public' };
const chapter = (id) => ({ id, title: `Chapter ${id}`, blocks: [{ type: 'paragraph', text: `About ${id}.` }], sources: [src] });
const P0 = {
  act: 'a0', placeholder: false, title: 'Primer zero',
  overview: [{ type: 'paragraph', text: 'The overview.' }],
  chapters: [chapter('c-one'), chapter('c-two'), chapter('c-three')],
};

// A map where every level lights a country, so a completion leaves a reveal waiting for the map.
const LIT_MAP = {
  ACT_REGIONS: { a0: { region: 'R0' }, a1: { region: 'R1' } },
  LEVEL_COUNTRY: { x: 'XXX', y: 'YYY', z: 'ZZZ' },
  COUNTRY_NAMES: { XXX: 'Xland', YYY: 'Yland', ZZZ: 'Zland' },
  actOf: () => null,
};
const DONE = { stars: 3, text: 'ok', cards: [] };

function setup({ primers = [P0], debug = false, initial, storage, globeMap = GLOBE_MAP, globe = null } = {}) {
  const dom = makeDom(html);
  const focus = recordFocus(dom.window);
  const store = fakeStorage({ initial });
  const errors = [];
  const game = createGame({
    registry: REG, deck: [], storage: storage ?? (() => store), document: dom.document, window: { addEventListener() {} },
    now: () => 0, rand: () => 0, reduceMotion: () => true, setTimeout: () => {}, clearTimeout: () => {},
    reportError: (e) => errors.push(e), globeMap, dots: [], primers, debug, globe,
  });
  // The elements a focus goes back to (the level card, the tile) are Alpine-rendered, so linkedom has none: note the selectors asked for.
  const asked = [];
  const real = game.focusSoon;
  game.focusSoon = function focusSoon(sel) {
    asked.push(sel);
    return real.call(this, sel);
  };
  return { game, dom, store, errors, focus, asked };
}
const stored = (store) => JSON.parse(store.data.get(PRIMER_KEY));
const writes = (store) => store.sets.filter(([k]) => k === PRIMER_KEY).length;
const tileText = (game) => game.primerTile('a0').text;

test('the tile exists only for an act with a primer', () => {
  const { game } = setup();
  assert.deepEqual(game.primerTile('a0'), { text: 'New', tone: 'attention', isNew: true, label: 'Act primer: New' });
  assert.equal(game.primerTile('a1'), null);
  assert.equal(game.primerTile('nope'), null);
  assert.equal(setup({ primers: [] }).game.primerTile('a0'), null);
});

test('index.html: the tile is a button before the level list, and the modal foot has only the two entry buttons', () => {
  const shell = parseHTML(html).document;
  const body = shell.querySelector('template[x-for="act in acts"]').content.querySelector('.act-body');
  const tpl = body.querySelector('template[x-if]');
  assert.equal(tpl.nextElementSibling.classList.contains('level-list'), true);
  const tile = tpl.content.firstElementChild;
  assert.equal(tile.localName, 'button');
  assert.equal(tile.getAttribute('type'), 'button');
  assert.equal(tile.classList.contains('act-primer'), true);
  assert.equal(tile.hasAttribute('aria-controls'), false);
  assert.equal(tile.getAttribute(':aria-controls'), 'primerTileControls(act.id)');
  assert.equal(tile.getAttribute('@click'), 'openPrimer(act.id)');
  const labels = [...shell.querySelectorAll('#primer-modal .ui-modal-foot button')].map((b) => b.textContent.trim());
  assert.deepEqual(labels, ['I am already familiar with the topic', 'Proceed with learning']);
  const bodyEl = shell.getElementById('primer-body');
  assert.equal(bodyEl.hasAttribute('x-ignore'), true);
  assert.equal(bodyEl.children.length, 0);
});

test('the first level of an act opens its primer instead; the level waits', () => {
  const { game, store, focus, dom } = setup();
  assert.equal(game.openLevel('x'), false);
  assert.equal(game.overlayOpen, false);
  assert.equal(game.primerOpen, true);
  assert.equal(game.primerScreen, -1);
  assert.equal(game.primerActId, 'a0');
  assert.equal(game.primerThen, 'x');
  assert.deepEqual(stored(store).acts.a0, { seen: true, skipped: false, read: [] });
  assert.equal(focus.last(), '#primer-title');
  assert.equal(dom.document.querySelector('#primer-body .ui-prose p').textContent, 'The overview.');
  assert.equal(game.primerTitle(), 'Primer zero');
});

test('an act without a primer is never new', () => {
  const { game } = setup();
  assert.equal(game.primerNew('a1'), false);
  assert.equal(game.primerNew('nope'), false);
  assert.equal(game.primerNew('a0'), true);
});

test('"already familiar" starts the level, records skipped, and the primer does not pop again', () => {
  const { game, store } = setup();
  game.openLevel('x');
  game.primerFamiliar();
  assert.equal(game.primerOpen, false);
  assert.equal(game.overlayOpen, true);
  assert.equal(game.currentLevelId, 'x');
  assert.equal(stored(store).acts.a0.skipped, true);
  assert.equal(tileText(game), 'Skipped');
  game.closeOverlay();
  assert.equal(game.openLevel('x'), true, 'never gates a level a second time');
  assert.equal(game.primerOpen, false);
});

test('the primer does not pop again in a new visit once it was seen (stored state alone)', () => {
  const first = setup();
  first.game.openLevel('x');
  const next = setup({ initial: { [PRIMER_KEY]: first.store.data.get(PRIMER_KEY) } });
  assert.equal(next.game.openLevel('x'), true);
  assert.equal(next.game.primerOpen, false);
});

test('blocked storage: it still pops once per visit and nothing throws', () => {
  const blocked = () => {
    throw new Error('blocked');
  };
  const { game, errors } = setup({ storage: blocked });
  assert.equal(game.openLevel('x'), false);
  assert.equal(game.primerOpen, true);
  game.primerFamiliar();
  assert.equal(game.overlayOpen, true);
  game.closeOverlay();
  assert.equal(game.openLevel('x'), true);
  game.toggleAct('a0');
  game.toggleAct('a0');
  assert.equal(game.primerOpen, false);
  assert.deepEqual(errors, []);
});

test('opening an act pops the overview once; folding never does', () => {
  const { game, asked } = setup();
  assert.equal(game.actExpanded('a0'), true, 'act 0 starts open');
  game.toggleAct('a0');
  assert.equal(game.primerOpen, false, 'folding does not pop');
  game.toggleAct('a0');
  assert.equal(game.primerOpen, true);
  assert.equal(game.primerScreen, -1);
  assert.equal(game.primerThen, null);
  game.closePrimer();
  assert.equal(asked.at(-1), '#act-toggle-a0');
  game.toggleAct('a0');
  game.toggleAct('a0');
  assert.equal(game.primerOpen, false, 'only the first time');
  game.toggleAct('a1');
  game.toggleAct('a1');
  assert.equal(game.primerOpen, false, 'an act with no primer never pops');
});

test('proceed and Next mark each chapter read when the player leaves it, and the tile follows', () => {
  const { game, store } = setup();
  game.openPrimer('a0');
  assert.equal(tileText(game), '0 of 3 chapters read');
  game.primerProceed();
  assert.equal(game.primerZoneOpen, true);
  assert.equal(game.primerScreen, 0);
  assert.equal(tileText(game), '0 of 3 chapters read', 'entering a chapter reads nothing');
  game.primerNext();
  assert.equal(game.primerScreen, 1);
  assert.equal(tileText(game), '1 of 3 chapters read');
  assert.deepEqual(stored(store).acts.a0.read, ['c-one']);
  game.primerNext();
  assert.equal(tileText(game), '2 of 3 chapters read');
  assert.equal(game.primerNextLabel(), 'Done');
  game.primerNext();
  assert.equal(game.primerZoneOpen, false);
  assert.equal(game.primerOpen, false);
  assert.equal(tileText(game), 'Read');
  assert.equal(game.primerTile('a0').tone, 'success');
});

test('the last chapter\'s button names the level when one is waiting, and starts it', () => {
  const { game } = setup();
  game.openLevel('x');
  game.primerProceed();
  game.primerNext();
  game.primerNext();
  assert.equal(game.primerNextLabel(), 'Start: Level x');
  game.primerNext();
  assert.equal(game.primerOpen, false);
  assert.equal(game.primerZoneOpen, false);
  assert.equal(game.overlayOpen, true);
  assert.equal(game.currentLevelId, 'x');
});

test('Back records nothing and returns through the chapters, never to the overview', () => {
  const { game, store, dom } = setup();
  game.openPrimer('a0');
  game.primerProceed();
  game.primerNext();
  const before = writes(store);
  game.primerBack();
  assert.equal(game.primerScreen, 0);
  assert.equal(dom.document.querySelector('#primer-zone-body .ui-eyebrow').textContent, 'Chapter 1 of 3');
  game.primerBack();
  assert.equal(game.primerScreen, 0, 'nothing before chapter 1');
  assert.equal(game.primerOpen, false);
  assert.equal(game.primerZoneOpen, true);
  assert.equal(writes(store), before);
  assert.deepEqual(stored(store).acts.a0.read, ['c-one']);
});

test('Escape and the close button close it, drop the waiting level and give focus back', () => {
  const { game, asked, store } = setup();
  game.openLevel('x');
  game.onEscape({ defaultPrevented: false, target: null });
  assert.equal(game.primerOpen, false);
  assert.equal(game.overlayOpen, false, 'the level did not open');
  assert.equal(game.primerThen, null);
  assert.equal(asked.at(-1), '[data-level-id="x"]');
  assert.equal(tileText(game), '0 of 3 chapters read', 'it counts as seen, nothing read');
  assert.equal(writes(store), 1);
  assert.equal(game.openPrimer('a0'), true);
  assert.equal(game.primerZoneOpen, true, 'it was seen, so the tile goes into the zone');
  game.closePrimer();
  assert.equal(game.primerZoneOpen, false);
  assert.equal(asked.at(-1), '#primer-open-a0');
  assert.equal(game.overlayOpen, false);
});

test('while it is open the hub is inert, Tab stays inside and no other dialog opens', () => {
  const { game, dom } = setup();
  game.openPrimer('a0');
  assert.equal(game.openModalSelector(), '#primer-modal');
  assert.equal(game.hubInert(), true);
  assert.equal(game.scrollLocked(), true);
  assert.equal(game.openAbout(), false);
  assert.equal(game.aboutOpen, false);
  assert.equal(game.openLevel('x'), false);
  assert.equal(game.openPrimer('a0'), false);
  let stopped = false;
  assert.equal(game.trapTab({ key: 'Tab', shiftKey: false, preventDefault() { stopped = true; } }), true);
  assert.equal(stopped, true);
  assert.equal(dom.document.querySelector('#primer-modal') !== null, true);
});

test('the tile reopens it at any time, in the zone at chapter 1 once all is read, and a dialog blocks it', () => {
  const { game } = setup();
  game.openPrimer('a0');
  game.primerProceed();
  for (let i = 0; i < 3; i++) game.primerNext();
  assert.equal(tileText(game), 'Read');
  assert.equal(game.openPrimer('a0'), true);
  assert.equal(game.primerOpen, false);
  assert.equal(game.primerZoneOpen, true);
  assert.equal(game.primerScreen, 0);
  game.closePrimer();
  game.aboutOpen = true;
  assert.equal(game.openPrimer('a0'), false);
  assert.equal(game.primerOpen, false);
  assert.equal(game.primerZoneOpen, false);
});

test('?mode=debug: the pop-up and zone work and nothing is written; the tile opens the pop-up again', () => {
  const { game, store } = setup({ debug: true });
  assert.equal(game.openLevel('x'), false, 'it still pops once');
  assert.equal(game.primerOpen, true);
  game.primerProceed();
  assert.equal(game.primerZoneOpen, true);
  for (let i = 0; i < 3; i++) game.primerNext();
  assert.equal(game.overlayOpen, true, 'the last Next starts the level');
  assert.equal(game.currentLevelId, 'x');
  game.closeOverlay();
  assert.equal(game.openPrimer('a0'), true);
  assert.equal(game.primerOpen, true, 'debug stores nothing, so the status stays new');
  assert.equal(game.primerZoneOpen, false);
  game.primerFamiliar();
  assert.equal(store.data.has(PRIMER_KEY), false);
  assert.equal(writes(store), 0);
});

test('another tab\'s change to the stored primers updates the tile', () => {
  const { game, store } = setup();
  assert.equal(tileText(game), 'New');
  const before = game.primerRev;
  store.data.set(PRIMER_KEY, JSON.stringify({ v: 1, acts: { a0: { seen: true, skipped: false, read: ['c-one'] } } }));
  game.onStorage({ key: 'oncall.other' });
  assert.equal(game.primerRev, before, 'an unrelated key changes nothing');
  game.onStorage({ key: PRIMER_KEY });
  assert.equal(game.primerRev, before + 1);
  assert.equal(tileText(game), '1 of 3 chapters read');
  game.onStorage({ key: null });
  assert.equal(game.primerRev, before + 2, 'a cleared storage re-reads it too');
});

test('this tab\'s own writes bump primerRev, so the tile re-renders', () => {
  const { game } = setup();
  const before = game.primerRev;
  game.openPrimer('a0');
  assert.ok(game.primerRev > before);
});

test('an invalid primer shows no tile, never gates a level and is reported once', () => {
  const bad = { ...P0, chapters: [] };
  const { game, errors } = setup({ primers: [bad] });
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /chapters/);
  assert.equal(game.primerTile('a0'), null);
  assert.equal(game.openLevel('x'), true);
  assert.equal(game.primerOpen, false);
  assert.equal(game.openPrimer('a0'), false);
  game.closeOverlay();
  game.toggleAct('a0');
  game.toggleAct('a0');
  assert.equal(game.primerOpen, false);
  assert.equal(errors.length, 1);
});

test('Continue from the reward into an act whose primer pops: closing it plays the map reveal that was waiting', () => {
  const { game } = setup({ primers: [{ ...P0, act: 'a1' }], globeMap: LIT_MAP });
  game.openLevel('x');
  game.completeLevel('x', DONE);
  game.closeReward();
  assert.match(game.litNote, /Xland/, 'control: closing the reward reveals');
  game.openLevel('y');
  game.completeLevel('y', DONE);
  assert.equal(game.continueFromReward(), false);
  assert.equal(game.primerOpen, true, 'the primer of the next act stands in for its first level');
  game.closePrimer();
  assert.equal(game.overlayOpen, false);
  assert.match(game.litNote, /Yland/);
});

test('hub Continue into a primer: the level it waits for keeps its Continue origin, and focus goes back to Continue', () => {
  const { game, asked } = setup();
  assert.equal(game.continueNext(), false);
  assert.equal(game.primerOpen, true);
  assert.equal(game.primerFrom, 'continue');
  game.closePrimer();
  assert.equal(asked.at(-1), '#hub-continue');
  game.continueNext();
  game.primerFamiliar();
  assert.equal(game.openedFrom, 'continue');
  game.closeOverlay();
  assert.equal(asked.at(-1), '#hub-continue');
});

test('focus after closing is worked out then: an act another tab folded meanwhile sends it to the act toggle', () => {
  const shared = fakeStorage();
  const { game, asked } = setup({ storage: () => shared });
  const other = setup({ primers: [], storage: () => shared }).game; // a second tab on the same storage
  assert.equal(game.openLevel('y'), false);
  assert.equal(game.primerOpen, true);
  other.openLevel('x');
  other.completeLevel('x', DONE);
  other.closeReward();
  other.openLevel('y');
  other.completeLevel('y', DONE);
  other.closeReward();
  game.onStorage({ key: 'oncall.progress' });
  assert.equal(game.actExpanded('a0'), false, 'the act is finished, so it folds and its cards are hidden');
  game.closePrimer();
  assert.equal(asked.at(-1), '#act-toggle-a0');
});

test('the tile opener falls back to the act toggle when the act is folded at close time', () => {
  const { game, asked } = setup();
  game.openPrimer('a0');
  game.actOverrides = { a0: false };
  game.closePrimer();
  assert.equal(asked.at(-1), '#act-toggle-a0');
});

test('a stray "already familiar" or Proceed in the zone does nothing', () => {
  const { game, store } = setup();
  game.openPrimer('a0');
  game.primerProceed();
  game.primerNext();
  assert.equal(game.primerScreen, 1);
  const before = writes(store);
  game.primerProceed();
  assert.equal(game.primerScreen, 1, 'Proceed only leaves the pop-up');
  game.primerFamiliar();
  assert.equal(game.primerZoneOpen, true, 'familiar only works in the pop-up');
  assert.equal(stored(store).acts.a0.skipped, false);
  assert.equal(writes(store), before);
});

// ---- the primer zone (#410): a short pop-up for a new primer, a full-screen zone otherwise ----
const seeded = (read, extra = {}) => ({ [PRIMER_KEY]: JSON.stringify({ v: 1, acts: { a0: { seen: true, skipped: false, read, ...extra } } }) });
const tick = () => new Promise((r) => setImmediate(r));

test('Z1 Proceed leaves the pop-up for the zone at chapter 1 and keeps the waiting level; it writes nothing', () => {
  const { game, store, focus, dom } = setup();
  game.openLevel('x');
  const before = writes(store);
  assert.equal(before, 1);
  game.primerProceed();
  assert.equal(game.primerOpen, false);
  assert.equal(game.primerZoneOpen, true);
  assert.equal(game.primerScreen, 0);
  assert.equal(game.primerThen, 'x');
  assert.equal(game.primerFrom, 'card');
  assert.equal(game.overlayOpen, false);
  assert.equal(focus.last(), '#primer-zone-title');
  const body = dom.document.querySelector('#primer-zone-body');
  assert.match(body.textContent, /Chapter 1 of 3/);
  assert.match(body.textContent, /About c-one\./);
  assert.equal(writes(store), 1);
});

test('Z2 a seen primer with chapters left opens the zone at the first unread one, not the pop-up', () => {
  const { game, store } = setup({ initial: seeded(['c-one', 'c-three']) });
  assert.equal(game.openPrimer('a0'), true);
  assert.equal(game.primerOpen, false);
  assert.equal(game.primerZoneOpen, true);
  assert.equal(game.primerScreen, 1);
  assert.equal(game.primerThen, null);
  assert.deepEqual(stored(store).acts.a0.read, ['c-one', 'c-three']);
  assert.equal(stored(store).acts.a0.seen, true);
  assert.equal(writes(store), 1);
});

test('Z3 a new primer opens the pop-up', () => {
  const { game } = setup();
  assert.equal(game.openPrimer('a0'), true);
  assert.equal(game.primerOpen, true);
  assert.equal(game.primerZoneOpen, false);
  assert.equal(game.primerScreen, -1);
});

test('Z4 all read, skipped with nothing read, and seen with nothing read all open the zone at chapter 1', () => {
  const all = setup({ initial: seeded(['c-one', 'c-two', 'c-three']) });
  assert.equal(tileText(all.game), 'Read');
  all.game.openPrimer('a0');
  assert.equal(all.game.primerZoneOpen, true);
  assert.equal(all.game.primerScreen, 0);
  const skipped = setup({ initial: seeded([], { skipped: true }) });
  skipped.game.openPrimer('a0');
  assert.equal(skipped.game.primerZoneOpen, true);
  assert.equal(skipped.game.primerScreen, 0);
  const seen = setup({ initial: seeded([]) });
  seen.game.openPrimer('a0');
  assert.equal(seen.game.primerZoneOpen, true);
  assert.equal(seen.game.primerScreen, 0);
});

test('Z5 the tile controls the pop-up while the primer is new and the zone after', () => {
  const { game } = setup();
  assert.equal(game.primerTileControls('a0'), 'primer-modal');
  game.openPrimer('a0');
  game.closePrimer();
  assert.equal(game.primerTileControls('a0'), 'primer-zone');
  assert.equal(game.primerTileControls('a1'), null);
  const tile = parseHTML(html).document.querySelector('template[x-for="act in acts"]').content.querySelector('.act-body template[x-if]').content.firstElementChild;
  assert.equal(tile.getAttribute(':aria-controls'), 'primerTileControls(act.id)');
  assert.equal(tile.hasAttribute('aria-controls'), false);
});

test('Z6 writes per action: open marks seen, Proceed nothing, each Next marks the chapter it leaves', () => {
  const { game, store, asked } = setup();
  game.openPrimer('a0');
  assert.equal(writes(store), 1);
  game.primerProceed();
  assert.equal(writes(store), 1);
  game.primerNext();
  assert.equal(writes(store), 2);
  assert.deepEqual(stored(store).acts.a0.read, ['c-one']);
  assert.equal(tileText(game), '1 of 3 chapters read');
  game.primerNext();
  assert.equal(writes(store), 3);
  assert.equal(game.primerNextLabel(), 'Done');
  game.primerNext();
  assert.equal(writes(store), 4);
  assert.equal(game.primerZoneOpen, false);
  assert.equal(tileText(game), 'Read');
  assert.equal(asked.at(-1), '#primer-open-a0');
});

test('Z7 the last chapter of a primer opened by a level starts that level', () => {
  const { game } = setup();
  game.openLevel('x');
  game.primerProceed();
  game.primerNext();
  game.primerNext();
  assert.equal(game.primerNextLabel(), 'Start: Level x');
  game.primerNext();
  assert.equal(game.primerZoneOpen, false);
  assert.equal(game.overlayOpen, true);
  assert.equal(game.currentLevelId, 'x');
  assert.equal(game.openedFrom, 'card');
});

test('Z8 Back goes down a chapter, stops at 1, and writes nothing', () => {
  const { game, store } = setup({ initial: seeded(['c-one']) });
  game.openPrimer('a0');
  assert.equal(game.primerScreen, 1);
  assert.equal(game.primerBackShown(), true);
  const before = writes(store);
  game.primerBack();
  assert.equal(game.primerScreen, 0);
  assert.equal(game.primerBackShown(), false);
  game.primerBack();
  assert.equal(game.primerScreen, 0);
  assert.equal(game.primerOpen, false);
  assert.equal(game.primerZoneOpen, true);
  assert.equal(writes(store), before);
});

test('Z9 the chapter list jumps without writing, marks read chapters and ignores bad targets', () => {
  const { game, store, dom, focus } = setup();
  game.openPrimer('a0');
  game.primerProceed();
  const doc = dom.document;
  assert.equal(doc.querySelector('#primer-go-0') === null, true, 'the current chapter is not a button');
  const before = writes(store);
  doc.querySelector('#primer-go-2').onclick();
  assert.equal(game.primerScreen, 2);
  assert.equal(focus.last(), '#primer-zone-title');
  assert.equal(writes(store), before);
  game.primerBack();
  assert.equal(game.primerScreen, 1);
  game.primerNext();
  const items = [...doc.querySelectorAll('#primer-zone-body nav li')];
  assert.match(items[1].textContent, /Read/);
  assert.doesNotMatch(items[2].textContent, /Read/);
  for (const bad of [-1, 3, 1.5, 2]) {
    game.primerGo(bad);
    assert.equal(game.primerScreen, 2, `go(${bad})`);
  }
});

test('Z10 Escape and the back arrow close the zone, drop the waiting level and give focus to the level card', () => {
  const { game, asked, store, dom } = setup();
  game.openLevel('x');
  game.primerProceed();
  const target = dom.document.querySelector('#primer-zone-body a');
  game.onEscape({ defaultPrevented: false, target });
  assert.equal(game.primerZoneOpen, false);
  assert.equal(game.overlayOpen, false);
  assert.equal(game.primerThen, null);
  assert.equal(asked.at(-1), '[data-level-id="x"]');
  assert.equal(writes(store), 1);
  game.openPrimer('a0');
  game.onEscape({ defaultPrevented: true, target: null });
  assert.equal(game.primerZoneOpen, true, 'a handled Escape closes nothing');
  assert.equal(parseHTML(html).document.querySelector('#primer-zone-back').getAttribute('@click'), 'closePrimer()');
});

test('Z11 the zone counts as a dialog: hub inert, Tab trapped, nothing else opens', () => {
  const { game } = setup({ initial: seeded([]) });
  game.openPrimer('a0');
  assert.equal(game.primerZoneOpen, true);
  assert.equal(game.hubInert(), true);
  assert.equal(game.dialogOpen(), true);
  let stopped = false;
  assert.equal(game.trapTab({ key: 'Tab', shiftKey: false, preventDefault() { stopped = true; } }), true);
  assert.equal(stopped, true);
  assert.equal(game.trapSelector(), '#primer-zone');
  assert.equal(game.scrollLocked(), false);
  assert.equal(game.openModalSelector(), null);
  assert.equal(game.openAbout(), false);
  assert.equal(game.openLevel('x'), false);
  assert.equal(game.openPrimer('a0'), false);
  game.toggleAct('a0');
  game.toggleAct('a0');
  assert.equal(game.primerOpen, false);
  assert.equal(game.primerZoneOpen, true);
});

test('Z12 the globe is freed while the zone is open and mounts again when it closes', async () => {
  let calls = 0;
  let disposed = 0;
  const globe = async () => {
    calls++;
    return { update() {}, ignite() {}, dispose() { disposed++; } };
  };
  const { game } = setup({ globe, initial: seeded(['c-one']) });
  game.showGlobe();
  await tick();
  assert.equal(calls, 1);
  game.openPrimer('a0');
  assert.equal(disposed, 1);
  game.showGlobe();
  await tick();
  assert.equal(calls, 1, 'no mount while the zone covers the hub');
  game.closePrimer();
  await tick();
  assert.equal(calls, 2);
});

test('Z13 closing the zone plays a map reveal that was waiting', () => {
  const { game } = setup({ primers: [{ ...P0, act: 'a1' }], globeMap: LIT_MAP });
  game.openLevel('x');
  game.completeLevel('x', DONE);
  game.closeReward();
  game.openLevel('y');
  game.completeLevel('y', DONE);
  assert.equal(game.continueFromReward(), false);
  game.primerProceed();
  game.closePrimer();
  assert.equal(game.overlayOpen, false);
  assert.match(game.litNote, /Yland/);
});

test('Z14 debug: pop-up, zone and starting the level write nothing, and the tile opens the pop-up again', () => {
  const { game, store } = setup({ debug: true });
  game.openLevel('x');
  assert.equal(game.primerOpen, true);
  game.primerProceed();
  for (let i = 0; i < 3; i++) game.primerNext();
  assert.equal(game.overlayOpen, true);
  assert.equal(writes(store), 0);
  game.closeOverlay();
  game.openPrimer('a0');
  assert.equal(game.primerOpen, true);
});

test('Z15 each button works on its own surface only', () => {
  const zone = setup({ initial: seeded(['c-one']) });
  zone.game.openPrimer('a0');
  const before = writes(zone.store);
  zone.game.primerFamiliar();
  zone.game.primerProceed();
  assert.equal(zone.game.primerScreen, 1);
  assert.equal(zone.game.primerZoneOpen, true);
  assert.equal(writes(zone.store), before);
  assert.equal(stored(zone.store).acts.a0.skipped, false);
  const pop = setup();
  pop.game.openPrimer('a0');
  const w = writes(pop.store);
  pop.game.primerNext();
  pop.game.primerBack();
  assert.equal(pop.game.primerOpen, true);
  assert.equal(pop.game.primerScreen, -1);
  assert.equal(writes(pop.store), w);
  assert.deepEqual(stored(pop.store).acts.a0.read, []);
});

test('Z16 index.html: the pop-up foot has two buttons and the zone is a level-overlay sibling with its parts', () => {
  const shell = parseHTML(html).document;
  const labels = [...shell.querySelectorAll('#primer-modal .ui-modal-foot button')].map((b) => b.textContent.trim());
  assert.deepEqual(labels, ['I am already familiar with the topic', 'Proceed with learning']);
  const zone = shell.getElementById('primer-zone');
  assert.equal(zone.classList.contains('overlay'), true);
  assert.equal(zone.getAttribute('role'), 'dialog');
  assert.equal(zone.getAttribute('aria-modal'), 'true');
  const overlays = [...shell.querySelectorAll('.overlay')];
  assert.equal(overlays.indexOf(zone) > 0, true, 'after the level overlay');
  assert.equal(zone.querySelector('#primer-zone-back').getAttribute('aria-label'), 'Back to the map');
  const title = zone.querySelector('h2#primer-zone-title');
  assert.equal(title.getAttribute('tabindex'), '-1');
  const body = zone.querySelector('#primer-zone-body');
  assert.equal(body.classList.contains('lesson-scroll'), true);
  assert.equal(body.hasAttribute('x-ignore'), true);
  assert.equal(body.children.length, 0);
  const actions = zone.querySelector('.lesson-actions');
  assert.ok(actions.querySelector('#primer-back'));
  assert.ok(actions.querySelector('#primer-next'));
});

test('Z17 what the zone draws carries no style, handler or Alpine attribute', () => {
  const { game, dom } = setup();
  game.openPrimer('a0');
  game.primerProceed();
  game.primerNext();
  dom.document.querySelector('#primer-go-0').onclick();
  for (const el of dom.document.querySelectorAll('#primer-zone-body *')) {
    for (const name of el.getAttributeNames()) {
      assert.equal(/^(style$|on|x-|@|:)/.test(name), false, `${el.localName} has ${name}`);
    }
  }
});

test('Z18 focus after leaving the zone is worked out then: an act folded meanwhile sends it to the act toggle', () => {
  const shared = fakeStorage();
  const { game, asked } = setup({ storage: () => shared });
  const other = setup({ primers: [], storage: () => shared }).game;
  assert.equal(game.openLevel('y'), false);
  game.primerProceed();
  assert.equal(game.primerZoneOpen, true);
  other.openLevel('x');
  other.completeLevel('x', DONE);
  other.closeReward();
  other.openLevel('y');
  other.completeLevel('y', DONE);
  other.closeReward();
  game.onStorage({ key: 'oncall.progress' });
  assert.equal(game.actExpanded('a0'), false);
  game.closePrimer();
  assert.equal(asked.at(-1), '#act-toggle-a0');
});
