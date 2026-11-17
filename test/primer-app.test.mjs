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

function setup({ primers = [P0], debug = false, initial, storage, globeMap = GLOBE_MAP } = {}) {
  const dom = makeDom(html);
  const focus = recordFocus(dom.window);
  const store = fakeStorage({ initial });
  const errors = [];
  const game = createGame({
    registry: REG, deck: [], storage: storage ?? (() => store), document: dom.document, window: { addEventListener() {} },
    now: () => 0, rand: () => 0, reduceMotion: () => true, setTimeout: () => {}, clearTimeout: () => {},
    reportError: (e) => errors.push(e), globeMap, dots: [], primers, debug,
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

test('index.html: the tile is a button before the level list, and the modal foot has the overview and chapter buttons', () => {
  const shell = parseHTML(html).document;
  const body = shell.querySelector('template[x-for="act in acts"]').content.querySelector('.act-body');
  const tpl = body.querySelector('template[x-if]');
  assert.equal(tpl.nextElementSibling.classList.contains('level-list'), true);
  const tile = tpl.content.firstElementChild;
  assert.equal(tile.localName, 'button');
  assert.equal(tile.getAttribute('type'), 'button');
  assert.equal(tile.classList.contains('act-primer'), true);
  assert.equal(tile.getAttribute('aria-controls'), 'primer-modal');
  assert.equal(tile.getAttribute('@click'), 'openPrimer(act.id)');
  const labels = [...shell.querySelectorAll('#primer-modal .ui-modal-foot button')].map((b) => b.textContent.trim());
  assert.deepEqual(labels, ['I am already familiar with the topic', 'Proceed with learning', 'Back', 'Next']);
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
  assert.equal(game.overlayOpen, true);
  assert.equal(game.currentLevelId, 'x');
});

test('Back records nothing and returns through the chapters to the overview', () => {
  const { game, store, dom } = setup();
  game.openPrimer('a0');
  game.primerProceed();
  game.primerNext();
  const before = writes(store);
  game.primerBack();
  assert.equal(game.primerScreen, 0);
  assert.equal(dom.document.querySelector('#primer-body .ui-eyebrow').textContent, 'Chapter 1 of 3');
  game.primerBack();
  assert.equal(game.primerScreen, -1);
  game.primerBack();
  assert.equal(game.primerScreen, -1, 'nothing before the overview');
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
  game.openPrimer('a0');
  game.closePrimer();
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

test('the tile reopens it at any time, at the overview, and a dialog blocks it', () => {
  const { game } = setup();
  game.openPrimer('a0');
  game.primerProceed();
  for (let i = 0; i < 3; i++) game.primerNext();
  assert.equal(tileText(game), 'Read');
  assert.equal(game.openPrimer('a0'), true);
  assert.equal(game.primerOpen, true);
  assert.equal(game.primerScreen, -1);
  game.closePrimer();
  game.aboutOpen = true;
  assert.equal(game.openPrimer('a0'), false);
  assert.equal(game.primerOpen, false);
});

test('?mode=debug: the pop-up works and nothing is written', () => {
  const { game, store } = setup({ debug: true });
  assert.equal(game.openLevel('x'), false, 'it still pops once');
  assert.equal(game.primerOpen, true);
  game.primerFamiliar();
  assert.equal(game.overlayOpen, true);
  game.closeOverlay();
  assert.equal(game.openLevel('x'), true, 'and does not pop again');
  game.closeOverlay();
  game.openPrimer('a0');
  game.primerProceed();
  for (let i = 0; i < 3; i++) game.primerNext();
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

test('a stray "already familiar" or Proceed on a chapter screen does nothing', () => {
  const { game, store } = setup();
  game.openPrimer('a0');
  game.primerProceed();
  game.primerNext();
  assert.equal(game.primerScreen, 1);
  const before = writes(store);
  game.primerProceed();
  assert.equal(game.primerScreen, 1, 'Proceed only leaves the overview');
  game.primerFamiliar();
  assert.equal(game.primerOpen, true, 'familiar only works on the overview');
  assert.equal(stored(store).acts.a0.skipped, false);
  assert.equal(writes(store), before);
});
