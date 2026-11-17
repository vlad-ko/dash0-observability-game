// The kit modals are one table in app.mjs (MODALS, #378). These tests pin the behaviour that was written out by hand
// before: every combination of the modal flags against an oracle that restates the old per-site rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { makeDom } from './helpers/dom.mjs';
import { fakeStorage } from './helpers/fake-storage.mjs';
import { createGame, MODALS } from '../app.mjs';
import { buildRegistry } from '../lib/registry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const FLAGS = ['feedbackOpen', 'howToOpen', 'saveOpen', 'boardOpen', 'accountOpen', 'aboutOpen', 'overlayOpen', 'rewardOpen'];

function build() {
  const dom = makeDom(html);
  const game = createGame({
    registry: buildRegistry([], { deck: [], nodeIds: [] }), deck: [], storage: () => fakeStorage(), document: dom.document, window: { addEventListener() {} },
    now: () => 0, rand: () => 0, reduceMotion: () => true, setTimeout: () => {}, clearTimeout: () => {},
    reportError: (e) => { throw e; }, debug: false, fetch: async () => ({ status: 404, ok: false, json: async () => ({}) }),
    globeMap: { ACT_REGIONS: {}, LEVEL_COUNTRY: {}, COUNTRY_NAMES: {}, actOf: () => null }, dots: [],
  });
  return { game, dom };
}

// The oracle: the rules as they were written site by site before the table.
const oracle = {
  selector: (f) => (f.feedbackOpen ? '#feedback-modal' : f.howToOpen ? '#howto-modal' : f.saveOpen ? '#save-modal'
    : f.boardOpen ? '#board-modal' : f.accountOpen ? '#account-modal' : f.aboutOpen ? '#about-modal' : null),
  scrollLocked: (f) => f.howToOpen || f.aboutOpen || f.saveOpen || f.boardOpen || f.accountOpen || f.feedbackOpen,
  dialogOpen: (f) => f.overlayOpen || f.rewardOpen || f.aboutOpen || f.saveOpen || f.boardOpen || f.accountOpen,
  overlayInert: (f) => f.howToOpen || f.feedbackOpen,
  escape: (f, typing) => {
    if (f.rewardOpen) return 'closeReward';
    if (f.feedbackOpen) return 'closeFeedback';
    if (f.aboutOpen) return 'closeAbout';
    if (f.saveOpen) return 'closeSave';
    if (f.boardOpen) return 'closeBoard';
    if (f.accountOpen) return 'closeAccount';
    if (!f.overlayOpen) return null;
    if (f.howToOpen) return 'closeHowTo';
    return typing ? null : 'closeOverlay';
  },
};

test('over every combination of the modal flags the table answers what the hand-written rules did', () => {
  const { game, dom } = build();
  const CLOSERS = ['closeReward', 'closeFeedback', 'closeAbout', 'closeSave', 'closeBoard', 'closeAccount', 'closeHowTo', 'closeOverlay'];
  const input = dom.document.createElement('textarea');
  for (let bits = 0; bits < 1 << FLAGS.length; bits++) {
    const f = Object.fromEntries(FLAGS.map((k, i) => [k, Boolean(bits & (1 << i))]));
    Object.assign(game, f);
    const at = JSON.stringify(f);
    assert.equal(game.openModalSelector(), oracle.selector(f), `selector ${at}`);
    assert.equal(game.scrollLocked(), oracle.scrollLocked(f), `scrollLocked ${at}`);
    assert.equal(game.dialogOpen(), oracle.dialogOpen(f), `dialogOpen ${at}`);
    assert.equal(game.hubInert(), oracle.dialogOpen(f), `hubInert ${at}`);
    assert.equal(game.overlayInert(), oracle.overlayInert(f), `overlayInert ${at}`);
    for (const typing of [false, true]) {
      const called = [];
      for (const c of CLOSERS) game[c] = () => called.push(c);
      game.onEscape({ defaultPrevented: false, target: typing ? input : null });
      assert.deepEqual(called, [oracle.escape(f, typing)].filter(Boolean), `escape ${at} typing=${typing}`);
    }
    const called = [];
    for (const c of CLOSERS) game[c] = () => called.push(c);
    game.onEscape({ defaultPrevented: true, target: null });
    assert.deepEqual(called, [], `a handled Escape closes nothing ${at}`);
  }
});

test('the index.html inert binding on the level overlay is the table answer', () => {
  const shell = parseHTML(html).document;
  assert.equal(shell.querySelector('.overlay').getAttribute(':inert'), 'overlayInert()');
});

test('every .ui-modal in index.html is in MODALS and every MODALS entry has its .ui-modal', () => {
  const shell = parseHTML(html).document;
  const ids = [...shell.querySelectorAll('.ui-modal')].map((m) => m.id).sort();
  assert.deepEqual(MODALS.map((m) => m.id).sort(), ids);
  for (const m of MODALS) {
    const el = shell.getElementById(m.id);
    assert.equal(el.getAttribute('x-show'), m.flag, `${m.id} is shown by its flag`);
  }
  const { game } = build();
  for (const m of MODALS) {
    assert.equal(typeof game[m.close], 'function', `${m.id} close method`);
    assert.equal(game[m.flag], false, `${m.id} flag starts closed`);
  }
});
