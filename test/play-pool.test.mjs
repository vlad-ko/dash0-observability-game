// Answer pools in play (#390, lib/play.mjs): a pooled step draws ONE board each time it is shown, through the
// level's injected random source, and render, mount, the 50/50 and the guide all see that board. Real level
// context on a linkedom DOM, a pooled fixture level, drivers from test/helpers/step-drivers.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, q, qa, click } from './helpers/dom.mjs';
import { stepsOf } from './helpers/step-drivers.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import { bindText } from '../lib/content/bind.mjs';
import { drawChoiceBoard, drawSortBoard } from '../lib/pool.mjs';
import { runPlay, validatePlay } from '../lib/play.mjs';
import { buildRegistry } from '../lib/registry.mjs';
import { playFixture, FIXTURE_CARD } from './fixtures/play-level.mjs';
import { CP, IDENT, REV, SP, cp, deepFreeze, fiftyPool, poolFixture, sp } from './fixtures/pool-fixtures.mjs';

const NOW = 1767225600000;
const KIT = { validatePlay, runPlay };
const reg = (lv) => buildRegistry([{ id: 'a', no: 0, levels: [lv], boss: null }], { deck: [FIXTURE_CARD], nodeIds: [], play: KIT }).levels[lv.id];
const POOL = reg(poolFixture());
const FIXED = reg(playFixture());

/** A small seeded generator (the one test/sort-tells.test.mjs uses), so the shuffles repeat. */
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seededShuffle = (rand) => (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Open `level` with the real context; `shuffle` is the random source, `guide` the guide status. */
function open(level, { shuffle = IDENT, guide = null } = {}) {
  const dom = makeDom();
  const calls = [];
  const ctx = createLevelContext({
    level, ovBody: dom.body, ovActions: dom.actions, now: () => NOW, shuffle, reduceMotion: true, guide,
    onFinish: (id, result) => calls.push({ id, result }), signal: new AbortController().signal,
    reportError: (e) => { throw e; },
  });
  level.run(ctx);
  return { calls };
}

const picks = () => qa('[data-pick]').map((b) => b.dataset.pick).sort();
const items = () => qa('[data-item]').map((b) => b.dataset.item).sort();
const keysOf = (board) => board.choices.map((c) => c.key).sort();
const idsOf = (board) => board.items.map((i) => i.id).sort();
const advance = (i) => `#pf-${i === 2 ? 'finish' : 'next'}`;
const rightOf = (pool) => pool.choices.find((c) => c.right && picks().includes(c.key)).key;

/** Solve step `i` from what is on screen (any shuffle), then advance. */
function solve(i) {
  if (i === 0) click(`[data-pick="${rightOf(CP)}"]`);
  else if (i === 1) for (const id of items()) click(`[data-item="${id}"]`), click(`[data-bucket="${SP.items.find((x) => x.id === id).bucket}"]`);
  else click(`[data-pick="${rightOf(fiftyPool())}"]`);
  click(advance(i));
}

test('R1 a pooled choice renders the drawn board and only it, and a wrong click does not change it', () => {
  open(POOL, { shuffle: REV });
  assert.equal(qa('[data-pick]').length, 3);
  assert.deepEqual(picks(), keysOf(drawChoiceBoard(CP, REV)));
  const wrong = picks().find((k) => k.startsWith('w'));
  click(`[data-pick="${wrong}"]`);
  assert.deepEqual(picks(), keysOf(drawChoiceBoard(CP, REV)));
});

test('R2 render and mount see one board: fifty seeded shuffles never mismatch and always show three', () => {
  for (let seed = 1; seed <= 50; seed++) {
    open(POOL, { shuffle: seededShuffle(rng(seed)) });
    assert.equal(qa('[data-pick]').length, 3, `seed ${seed}`);
  }
});

test('R3 every showing draws again: twenty openings on one random source show different boards, and the level is untouched', () => {
  const before = JSON.stringify(POOL.play);
  const shuffle = seededShuffle(rng(7));
  const boards = new Set();
  for (let i = 0; i < 20; i++) {
    open(POOL, { shuffle });
    boards.add(picks().join());
  }
  assert.ok(boards.size >= 2, `${boards.size} distinct boards in 20 openings`);
  assert.equal(JSON.stringify(POOL.play), before);
});

test('R4 the drawn right answer unlocks Next, a clean run earns five stars and one wrong pick costs one', () => {
  const clean = open(POOL, { shuffle: REV });
  assert.equal(q('#pf-next').disabled, true);
  for (const i of [0, 1, 2]) solve(i);
  assert.equal(clean.calls.length, 1);
  assert.equal(clean.calls[0].result.stars, 5);

  const slip = open(POOL, { shuffle: REV });
  click(`[data-pick="${picks().find((k) => k.startsWith('w'))}"]`);
  for (const i of [0, 1, 2]) solve(i);
  assert.equal(slip.calls[0].result.stars, 4);
});

test('R4 a pool that shows four has the 50/50, it never removes the right answer or the near-miss, and the right stays visible', () => {
  for (const shuffle of [IDENT, REV, seededShuffle(rng(11)), seededShuffle(rng(12))]) {
    open(POOL, { shuffle });
    solve(0);
    solve(1);
    assert.equal(qa('[data-pick]').length, 4);
    const right = rightOf(fiftyPool());
    click('#cf-fifty');
    const left = qa('[data-pick]').filter((b) => !b.hidden);
    assert.equal(left.length, 2);
    assert.ok(left.some((b) => b.dataset.pick === right), 'the right answer is still shown');
    const board = qa('[data-pick]').map((b) => b.dataset.pick);
    if (board.includes('w2')) assert.ok(left.some((b) => b.dataset.pick === 'w2'), 'a keep answer stays');
  }
});

test('R5 the guide is told the board a pooled step shows, and nothing for a fixed step', async () => {
  const asks = [];
  const guide = { configured: true, ask: async (...args) => (asks.push(args), { kind: 'failed' }) };
  const ask = async () => {
    q('#guide-q').value = 'What does this mean?';
    q('#guide-q').oninput?.();
    await q('#guide-ask').onclick();
  };
  open(POOL, { shuffle: REV, guide });
  await ask();
  assert.equal(asks.length, 1);
  assert.deepEqual([...asks[0][4]].sort(), picks());
  assert.deepEqual([...asks[0][4]].sort(), keysOf(drawChoiceBoard(CP, REV)));

  const fixed = [];
  open(FIXED, { guide: { configured: true, ask: async (...args) => (fixed.push(args), { kind: 'failed' }) } });
  q('#guide-q').value = 'What does this mean?';
  q('#guide-q').oninput?.();
  await q('#guide-ask').onclick();
  assert.equal(fixed.length, 1);
  assert.equal(fixed[0][4], undefined);
});

test('R6 draw is a key of a choice and a sort, and of no other step', () => {
  assert.deepEqual(validatePlay(poolFixture().play).errors, []);
  const spot = playFixture().play;
  spot.steps[4].spot.draw = 2;
  assert.ok(validatePlay(spot).errors.some((e) => /unknown key "draw"/.test(e)), validatePlay(spot).errors.join('\n'));
  const tradeoff = playFixture().play;
  tradeoff.steps[5].tradeoff.draw = 2;
  assert.ok(validatePlay(tradeoff).errors.some((e) => /unknown key "draw"/.test(e)));
});

test('R6 draw is stated in the logic: a pool binds from logic plus content, and draw in the content is refused', () => {
  const skeleton = () => ({
    id: 'lv', no: '1.1', cards: [],
    play: { prefix: 'p', steps: [{ qid: 'p-q1', choice: { id: 'c1', draw: 2, choices: [{ key: 'b', right: true }] } }] },
  });
  const text = (extra = {}) => ({
    id: 'lv', name: 'Level', sub: 'Sub', rewardTitle: 'Title',
    play: {
      finish: 'You did the thing well.',
      steps: [{ intro: 'I', question: 'Q?', choice: { id: 'c1', ...extra, choices: [{ key: 'b', label: 'Bee', why: 'Yes.' }, { key: 'a', label: 'Ay', why: 'No.' }, { key: 'c', label: 'Cee', why: 'Never.' }] } }],
    },
  });
  const good = bindText(text(), skeleton());
  assert.deepEqual(good.errors, []);
  assert.equal(good.value.play.steps[0].choice.draw, 2);
  assert.equal(good.value.play.steps[0].choice.choices.length, 3);
  assert.deepEqual(validatePlay(good.value.play).errors, []);
  const bad = bindText(text({ draw: 2 }), { ...skeleton(), play: { prefix: 'p', steps: [{ qid: 'p-q1', choice: { id: 'c1', choices: [{ key: 'b', right: true }] } }] } });
  assert.ok(bad.errors.some((e) => /"draw" is not a content key/.test(e)), bad.errors.join('\n'));
});

test('R7 a pooled sort renders the drawn items and only them', () => {
  open(POOL, { shuffle: REV });
  solve(0);
  assert.deepEqual(items(), idsOf(drawSortBoard(SP, REV)));
  assert.equal(qa('[data-item]').length, 5);
});

test('the drivers play a pooled level the way the harness shuffles it (identity), and the fixtures are not edited', () => {
  const { calls } = open(POOL);
  stepsOf(POOL).forEach(({ driver, spec }, i) => {
    // Every click a driver offers, slips included, is on a button the player can see.
    for (const sel of [...driver.solve(spec), ...driver.slips(spec).flatMap((s) => s.clicks)]) assert.ok(q(sel), `${spec.id}: ${sel} is on screen`);
    for (const sel of driver.solve(spec)) click(sel);
    click(advance(i));
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(CP, deepFreeze(cp()));
  assert.deepEqual(SP, deepFreeze(sp()));
});
