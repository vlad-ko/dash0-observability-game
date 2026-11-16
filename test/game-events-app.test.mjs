// The game's wiring of the play events (epic #18 P2): app.mjs createGame with the real lib/play-telemetry.mjs,
// a fake fetch that says the events are on, and a window and document that record their listeners.
// Spec: docs/GAME-EVENTS.md (client contract), docs/FOUNDATION.md §2.6 and §2.10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDom } from './helpers/dom.mjs';
import { fakeStorage } from './helpers/fake-storage.mjs';
import { buildRegistry } from '../lib/registry.mjs';
import { createGame } from '../app.mjs';
import { createPlayTelemetry } from '../lib/play-telemetry.mjs';

const read = (rel) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', rel), 'utf8');
const HTML = read('index.html');
const NOW = 1767225600000;
const tick = () => new Promise((resolve) => setImmediate(resolve));

let ctxs = {};
const L = (id, no) => ({
  id,
  no,
  name: `Level ${id}`,
  icon: '*',
  rewardTitle: `Title ${id}`,
  mechanics: ['query'],
  run(ctx) {
    ctxs[id] = ctx;
    ctx.renderStep(`<p>${id}</p>`, '<button data-finish>Finish</button>');
  },
});
const REG = buildRegistry([{ id: 'a0', no: 0, name: 'First act', levels: [L('x', '0.1'), L('y', '0.2')], boss: null }], { deck: [], nodeIds: [] });

async function rig({ throwingPlay = false, registry = REG } = {}) {
  const dom = makeDom(HTML);
  const posts = [];
  const beacons = [];
  const winListeners = {};
  const docListeners = {};
  const doc = dom.document;
  const realAdd = doc.addEventListener.bind(doc);
  doc.addEventListener = (type, fn, ...rest) => {
    (docListeners[type] ??= []).push(fn);
    return realAdd(type, fn, ...rest);
  };
  let visibility = 'visible';
  Object.defineProperty(doc, 'visibilityState', { get: () => visibility, configurable: true });
  const win = { addEventListener: (type, fn) => (winListeners[type] ??= []).push(fn) };
  const play = createPlayTelemetry({
    fetch: async (url, init) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(init.body));
        return { ok: true, status: 204 };
      }
      return { ok: true, status: 200, json: async () => ({ v: 1, on: true }) };
    },
    sendBeacon: (url, body) => {
      beacons.push(JSON.parse(body));
      return true;
    },
    randomBytes: (n) => new Uint8Array(n),
    monotonic: () => 5000,
    debug: false,
  });
  const errors = [];
  ctxs = {};
  const game = createGame({
    registry,
    deck: [],
    storage: () => fakeStorage({}),
    document: doc,
    window: win,
    now: () => NOW,
    rand: () => 0,
    reportError: (e) => errors.push(e),
    setTimeout: () => {},
    clearTimeout: () => {},
    play: throwingPlay ? { ...play, error: () => { throw new Error('play broke'); } } : play,
  });
  game.init();
  await tick();
  const fire = (target, type, ev = {}) => (target[type] ?? []).forEach((fn) => fn(ev));
  return {
    game,
    posts,
    beacons,
    errors,
    pagehide: (ev) => fire(winListeners, 'pagehide', ev),
    visibility: (v) => {
      visibility = v;
      fire(docListeners, 'visibilitychange', {});
    },
  };
}
const outcomes = (batch) => batch.events.map((e) => `${e.level}:${e.outcome}`);

test('1 finishing a level sends exactly one complete with its mistakes, and no abandon', async () => {
  const r = await rig();
  r.game.openLevel('x');
  ctxs.x.mistake();
  ctxs.x.mistake();
  ctxs.x.finish();
  await tick();
  assert.equal(r.posts.length, 1);
  assert.deepEqual(outcomes(r.posts[0]), ['x:complete']);
  assert.equal(r.posts[0].events[0].mistakes, 2);
  assert.equal(r.posts[0].events[0].hints, 0);
  r.game.closeOverlay();
  r.pagehide({ persisted: false });
  assert.deepEqual(r.beacons, [], 'nothing left to abandon');
});

test('2 closing a level mid-play abandons it; a level still open is abandoned only when the page really goes',async () => {
  const r = await rig();
  r.game.openLevel('x');
  r.game.closeOverlay();
  r.pagehide({ persisted: true });
  assert.deepEqual(r.beacons.map(outcomes), [['x:abandon']]);
  r.game.openLevel('x');
  assert.equal(r.game.openLevel('y'), false, 'the hub is inert behind an open level');
  r.pagehide({ persisted: true });
  assert.equal(r.beacons.length, 1, 'x is still open, nothing new to send');
  r.pagehide({ persisted: false });
  assert.deepEqual(r.beacons.map(outcomes).at(-1), ['x:abandon']);
});

test('3 pagehide abandons the open level unless the page is kept (back/forward cache), and always flushes', async () => {
  const gone = await rig();
  gone.game.openLevel('x');
  gone.pagehide({ persisted: false });
  assert.deepEqual(gone.beacons.map(outcomes), [['x:abandon']]);

  const kept = await rig();
  kept.game.openLevel('x');
  kept.game.closeOverlay();
  kept.game.openLevel('y');
  kept.pagehide({ persisted: true });
  assert.deepEqual(kept.beacons.map(outcomes), [['x:abandon']], 'y stays open; only the earlier abandon is flushed');
});

test('4 the page going hidden flushes with a beacon; visible does not', async () => {
  const r = await rig();
  r.game.openLevel('x');
  r.game.closeOverlay();
  r.visibility('visible');
  assert.equal(r.beacons.length, 0);
  r.visibility('hidden');
  assert.deepEqual(r.beacons.map(outcomes), [['x:abandon']]);
});

test('5 a page error reaches play as a kind; a throwing play.error still leaves reportError called once', async () => {
  const boom = { ...L('t', '0.1'), run() { throw new RangeError('secret nick@x.com'); } };
  const registry = buildRegistry([{ id: 'a0', no: 0, name: 'A', levels: [boom], boss: null }], { deck: [], nodeIds: [] });

  const r = await rig({ registry });
  r.game.openLevel('t');
  assert.equal(r.errors.length, 1, 'the page still reports it');
  r.pagehide({ persisted: true });
  assert.equal(r.beacons.length, 1);
  assert.equal(JSON.stringify(r.beacons[0]).includes('nick'), false);
  assert.deepEqual(r.beacons[0].events.map((e) => [e.t, e.kind, e.level]), [['error', 'RangeError', 't']]);

  const bad = await rig({ registry, throwingPlay: true });
  assert.doesNotThrow(() => bad.game.openLevel('t'));
  assert.equal(bad.errors.length, 1, 'reportError ran once; the throwing play added nothing');
  assert.equal(bad.errors[0] instanceof RangeError, true);
});
