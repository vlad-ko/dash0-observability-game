// lib/play-telemetry.mjs: the browser client of the game's play events (epic #18 P2, docs/GAME-EVENTS.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayTelemetry } from '../lib/play-telemetry.mjs';
import { MAX_EVENTS, MAX_ERRORS_PER_PAGE, MAX_MS, parseBatch } from '../lib/play-events.mjs';

const registry = {
  levels: {
    'lvl-a': { id: 'lvl-a', scored: true, actId: 'act-1' },
    'lvl-b': { id: 'lvl-b', scored: true, actId: 'act-1' },
  },
};
const ON = { ok: true, status: 200, json: async () => ({ v: 1, on: true }) };

function rig({ probe = ON, debug = false, noFetch = false, beacon = () => true, post } = {}) {
  const gets = [];
  const posts = [];
  const beacons = [];
  let t = 0;
  const env = {
    fetch: noFetch
      ? undefined
      : (url, init) => {
          if (init?.method === 'POST') {
            posts.push({ url, init });
            return post ? post() : Promise.resolve({ ok: true, status: 204 });
          }
          gets.push({ url, init });
          return typeof probe === 'function' ? probe() : Promise.resolve(probe);
        },
    sendBeacon: (url, body) => {
      beacons.push({ url, body });
      return beacon();
    },
    randomBytes: (n) => new Uint8Array(n).fill(0xab),
    monotonic: () => t,
    debug,
  };
  const play = createPlayTelemetry(env);
  return { play, gets, posts, beacons, at: (ms) => (t = ms) };
}
const on = async (opts) => {
  const r = rig(opts);
  await r.play.init();
  return r;
};
const sent = (r) => r.posts.map((p) => JSON.parse(p.init.body));

test('1 debug or no fetch: nothing is ever requested or beaconed', async () => {
  for (const opts of [{ debug: true }, { noFetch: true }]) {
    const r = rig(opts);
    await r.play.init();
    r.play.begin('lvl-a');
    r.play.complete('lvl-a', { stars: 5, mistakes: 0, hintsUsed: 0 });
    r.play.error(new Error('x'));
    r.play.flush({ final: true });
    r.play.flush();
    assert.equal(r.gets.length + r.posts.length + r.beacons.length, 0, JSON.stringify(opts));
  }
});

test('2 only {v:1, on:true} turns it on; anything else is off, drops the buffer and sends nothing later', async () => {
  const bad = [
    ['on is a string', () => Promise.resolve({ ok: true, status: 200, json: async () => ({ v: 1, on: 'true' }) })],
    ['wrong version', () => Promise.resolve({ ok: true, status: 200, json: async () => ({ v: 2, on: true }) })],
    ['500', () => Promise.resolve({ ok: false, status: 500, json: async () => ({ v: 1, on: true }) })],
    ['json throws', () => Promise.resolve({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } })],
    ['fetch rejects', () => Promise.reject(new Error('offline'))],
  ];
  for (const [name, probe] of bad) {
    const r = rig({ probe });
    const ready = r.play.init();
    r.play.begin('lvl-a');
    r.play.abandon();
    assert.equal(r.play.stats().buffered, 1, name);
    await ready;
    assert.deepEqual(r.play.stats(), { buffered: 0, dropped: 1, sent: 0, failed: 0 }, name);
    r.play.begin('lvl-a');
    r.play.abandon();
    r.play.flush({ final: true });
    assert.equal(r.posts.length + r.beacons.length, 0, name);
  }
  const good = await on();
  good.play.begin('lvl-a');
  good.play.abandon();
  good.play.flush();
  assert.equal(good.posts.length, 1);
});

test('3 init twice asks once', async () => {
  const r = rig();
  await Promise.all([r.play.init(), r.play.init()]);
  await r.play.init();
  assert.equal(r.gets.length, 1);
  assert.equal(r.gets[0].url, '/api/events');
});

test('4 a completed play: real duration, ago measured at flush, valid on the wire', async () => {
  const r = await on();
  r.at(1000);
  r.play.begin('lvl-a');
  r.at(62000);
  r.play.complete('lvl-a', { stars: 4, mistakes: 1, hintsUsed: 0 });
  r.at(63200);
  r.play.flush();
  assert.equal(r.posts.length, 1);
  const parsed = parseBatch(r.posts[0].init.body, registry);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.events, [
    { t: 'play', level: 'lvl-a', outcome: 'complete', durationMs: 61000, agoMs: 1200, stars: 4, mistakes: 1, hints: 0 },
  ]);
  assert.match(parsed.sid, /^[0-9a-f]{16}$/);
  assert.equal(parsed.sid, 'abababababababab');
});

test('5 one play event per opened level: complete wins over a later abandon; a new begin abandons the open one', async () => {
  const r = await on();
  r.play.begin('lvl-a');
  r.play.complete('lvl-a', { stars: 5, mistakes: 0, hintsUsed: 0 });
  r.play.abandon();
  r.play.begin('lvl-a');
  r.play.begin('lvl-b');
  r.play.flush();
  assert.deepEqual(sent(r)[0].events.map((e) => [e.level, e.outcome]), [['lvl-a', 'complete'], ['lvl-a', 'abandon']]);
  r.play.abandon();
  r.play.abandon();
  r.play.flush();
  assert.deepEqual(sent(r)[1].events.map((e) => [e.level, e.outcome]), [['lvl-b', 'abandon']]);
});

test('6 a complete for a level that is not the open one is ignored', async () => {
  const r = await on();
  r.play.begin('lvl-a');
  r.play.complete('lvl-b', { stars: 5, mistakes: 0, hintsUsed: 0 });
  r.play.flush();
  assert.equal(r.posts.length, 0);
  r.play.abandon();
  r.play.flush();
  assert.equal(sent(r)[0].events[0].outcome, 'abandon');
});

test('7 an untrustworthy duration is not sent and is counted, never sent as 0', async () => {
  for (const delta of [NaN, -5, MAX_MS + 1, Infinity]) {
    const r = await on();
    r.at(1000);
    r.play.begin('lvl-a');
    r.at(delta === Infinity || Number.isNaN(delta) ? delta : 1000 + delta);
    r.play.abandon();
    r.play.flush({ final: true });
    assert.equal(r.posts.length + r.beacons.length, 0, String(delta));
    assert.equal(r.play.stats().dropped, 1, String(delta));
  }
});

test('8 final flush beacons a string; a refused beacon falls back to a keepalive fetch; a normal flush uses fetch', async () => {
  const ok = await on();
  ok.play.begin('lvl-a');
  ok.play.abandon();
  ok.play.flush({ final: true });
  assert.equal(ok.beacons.length, 1);
  assert.equal(typeof ok.beacons[0].body, 'string');
  assert.equal(ok.beacons[0].url, '/api/events');
  assert.equal(ok.posts.length, 0);

  const refused = await on({ beacon: () => false });
  refused.play.begin('lvl-a');
  refused.play.abandon();
  refused.play.flush({ final: true });
  assert.equal(refused.posts.length, 1);
  assert.deepEqual(
    { ...refused.posts[0].init, body: null },
    { method: 'POST', body: null, keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain;charset=UTF-8' } },
  );

  const thrown = await on({ beacon: () => { throw new Error('no'); } });
  thrown.play.begin('lvl-a');
  thrown.play.abandon();
  thrown.play.flush({ final: true });
  assert.equal(thrown.posts.length, 1);

  const plain = await on();
  plain.play.begin('lvl-a');
  plain.play.abandon();
  plain.play.flush();
  assert.equal(plain.beacons.length, 0);
  assert.equal(plain.posts.length, 1);
  assert.equal(plain.posts[0].init.keepalive, true);
});

test('9 two flushes in a row send once (the buffer is taken before the send resolves)', async () => {
  const r = await on({ post: () => new Promise(() => {}) });
  r.play.begin('lvl-a');
  r.play.abandon();
  r.play.flush();
  r.play.flush();
  r.play.flush({ final: true });
  assert.equal(r.posts.length, 1);
  assert.equal(r.beacons.length, 0);
  assert.equal(r.play.stats().buffered, 0);
});

test('10 while the probe is pending a normal flush keeps the buffer and a final one sends it', async () => {
  const r = rig({ probe: () => new Promise(() => {}) });
  r.play.init();
  r.play.begin('lvl-a');
  r.play.abandon();
  r.play.flush();
  assert.equal(r.posts.length + r.beacons.length, 0);
  assert.equal(r.play.stats().buffered, 1);
  r.play.flush({ final: true });
  assert.equal(r.beacons.length, 1);
  assert.equal(r.play.stats().buffered, 0);
});

test('11 the 20th event flushes while on; while pending the 21st is dropped and counted', async () => {
  const r = await on();
  for (let i = 0; i < MAX_EVENTS - 1; i++) {
    r.play.begin('lvl-a');
    r.play.abandon();
  }
  assert.equal(r.posts.length, 0);
  r.play.begin('lvl-a');
  r.play.abandon();
  assert.equal(r.posts.length, 1);
  assert.equal(sent(r)[0].events.length, MAX_EVENTS);

  const p = rig({ probe: () => new Promise(() => {}) });
  p.play.init();
  for (let i = 0; i < MAX_EVENTS + 1; i++) {
    p.play.begin('lvl-a');
    p.play.abandon();
  }
  assert.equal(p.play.stats().buffered, MAX_EVENTS);
  assert.equal(p.play.stats().dropped, 1);
  assert.equal(p.posts.length, 0);
});

test('12 an error event carries only its class name and the open level, and is capped per page', async () => {
  const r = await on();
  r.play.error(new RangeError('nick@x.com'));
  r.play.begin('lvl-a');
  r.play.error(new RangeError('nick@x.com'));
  r.play.flush();
  const body = r.posts[0].init.body;
  assert.equal(body.includes('nick'), false);
  const parsed = parseBatch(body, registry);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.events.map(({ agoMs, ...e }) => e), [
    { t: 'error', kind: 'RangeError' },
    { t: 'error', kind: 'RangeError', level: 'lvl-a' },
  ]);

  const many = await on();
  for (let i = 0; i < MAX_ERRORS_PER_PAGE + 1; i++) many.play.error(new Error('x'));
  many.play.flush();
  assert.equal(sent(many)[0].events.length, MAX_ERRORS_PER_PAGE);
});

test('13 a throwing fetch or beacon never throws out of the client', async () => {
  const boom = () => { throw new Error('boom'); };
  const r = rig({ beacon: boom, post: boom });
  await r.play.init();
  assert.doesNotThrow(() => {
    r.play.begin('lvl-a');
    r.play.complete('lvl-a', { stars: 1, mistakes: 0, hintsUsed: 0 });
    r.play.flush();
    r.play.begin('lvl-a');
    r.play.abandon();
    r.play.flush({ final: true });
  });
  assert.equal(r.play.stats().failed >= 1, true);
  const rejected = await on({ post: () => Promise.reject(new Error('offline')) });
  rejected.play.begin('lvl-a');
  rejected.play.abandon();
  rejected.play.flush();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rejected.play.stats().failed, 1);
  const dead = createPlayTelemetry({ fetch: () => { throw new Error('x'); }, sendBeacon: boom, randomBytes: () => new Uint8Array(8), monotonic: () => 0, debug: false });
  await assert.doesNotReject(dead.init());
});
