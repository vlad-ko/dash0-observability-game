// Replaying a pooled step (#390, docs/CONTENT.md section 10): a player who plays the same level again and again and
// remembers which answers they have seen must not be able to read the right one off how often it appears. Each test
// replays a pool with a seeded random source, many players at once, and scores a strategy that uses only the
// counts of what was shown, never the content. Seeded, so the rates are the same on every run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPOSURE, drawChoiceBoard, drawSortBoard, validateChoicePool, validateSortPool } from '../lib/pool.mjs';
import { pick, sp } from './fixtures/pool-fixtures.mjs';

/** A small seeded generator (mulberry32). */
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A Fisher-Yates shuffle of a copy of `list` through `rng`: the level's `ctx.shuffle`. */
const shuffleWith = (rng) => (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const PLAYERS = 4000;
const PLAYS = 10;
const LAST = PLAYS - 1;
/** How far above chance the choice tells tests let a pooled question score (test/choice-tells.test.mjs, T2). */
const BAND = 0.15;

/** A pool of `rights` rights and `wrongs` wrongs (all labels different), showing `draw`. */
function poolOf(rights, wrongs, draw) {
  const word = (i) => `${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`;
  const choices = [
    ...Array.from({ length: rights }, (_, i) => pick(`r${i}`, `r${word(i)}`, true)),
    ...Array.from({ length: wrongs }, (_, i) => pick(`w${i}`, `w${word(i)}`, false)),
  ];
  return { id: 'rp', draw, choices };
}

/** Of the shown answers, the key with the most (`most`) or fewest sightings so far; a tie is broken at random. */
const bySightings = (most) => (shown, seen, rng) => {
  const score = (k) => (most ? 1 : -1) * (seen.get(k) ?? 0);
  const best = Math.max(...shown.map(score));
  const tied = shown.filter((k) => score(k) === best);
  return tied[Math.floor(rng() * tied.length)];
};

/** The share of players who pick the right answer on each play (index 0 is the first play) when they pick through `strategy`. */
function replayChoice(pool, strategy, seed) {
  const rng = seeded(seed);
  const shuffle = shuffleWith(rng);
  const right = new Set(pool.choices.filter((c) => c.right).map((c) => c.key));
  const wins = Array(PLAYS).fill(0);
  for (let p = 0; p < PLAYERS; p++) {
    const seen = new Map();
    for (let play = 0; play < PLAYS; play++) {
      const shown = drawChoiceBoard(pool, shuffle).choices.map((c) => c.key);
      if (right.has(strategy(shown, seen, rng))) wins[play]++;
      for (const k of shown) seen.set(k, (seen.get(k) ?? 0) + 1);
    }
  }
  return wins.map((w) => w / PLAYERS);
}

const SLOTS = (rights, draw) => rights * (draw - 1);

test('R1 choice: at the upper bound of EXPOSURE (3 right, 4 shown) the answer seen most often wins about 0.6 by play 10, an accepted tell (owner decision 2026-11-20)', () => {
  const pool = poolOf(3, EXPOSURE.maxWrongPerRightSlot * SLOTS(3, 4), 4);
  assert.deepEqual(validateChoicePool(pool), []);
  const most = replayChoice(pool, bySightings(true), 7);
  assert.ok(Math.abs(most[0] - 0.25) < 0.03, `play 1 is chance, got ${most[0]}`);
  assert.ok(most[LAST] > 0.5, `the tell is real, got ${most[LAST]}`);
  assert.ok(most[LAST] < 0.65, `the tell stays below 0.65, got ${most[LAST]}`);
});

test('R1 choice: at the lower bound of EXPOSURE neither the most nor the least seen answer beats chance by more than the T2 band', () => {
  for (const [rights, draw] of [[3, 3], [3, 4]]) {
    const pool = poolOf(rights, EXPOSURE.minWrongPerRightSlot * SLOTS(rights, draw), draw);
    assert.deepEqual(validateChoicePool(pool), []);
    for (const most of [true, false]) {
      for (const rate of replayChoice(pool, bySightings(most), 7)) assert.ok(Math.abs(rate - 1 / draw) <= BAND, `${draw} shown, ${most ? 'most' : 'least'} seen scored ${rate}`);
    }
  }
});

test('R1 choice: below the lower bound the answer not seen before wins, which is why the rule is there', () => {
  const pool = poolOf(8, 2, 3);
  assert.match(validateChoicePool(pool).join('\n'), /exposure/);
  const least = replayChoice(pool, bySightings(false), 7);
  assert.ok(least[LAST] > 0.9, `least seen scored ${least[LAST]}`);
});

test('R1 choice: at parity (both bounds 1, 5 right and 15 wrong with 4 shown) the most seen answer stays at chance, so tightening is a one-line change plus new content', () => {
  const parity = { maxWrongPerRightSlot: 1, minWrongPerRightSlot: 1 };
  const pool = poolOf(5, 15, 4);
  assert.deepEqual(validateChoicePool(pool, parity), []);
  assert.match(validateChoicePool(poolOf(3, 17, 4), parity).join('\n'), /exposure/, 'today\'s pool is too wrong-heavy for parity');
  for (const most of [true, false]) {
    for (const rate of replayChoice(pool, bySightings(most), 7)) assert.ok(Math.abs(rate - 0.25) <= 0.03, `${most ? 'most' : 'least'} seen scored ${rate}`);
  }
});

/** A sort pool of `n` items per bucket (`{a, b}`) drawing `draw` per bucket. */
function sortOf(n, draw) {
  const items = [];
  for (let i = 0; i < Math.max(n.a, n.b); i++) {
    for (const b of ['a', 'b']) if (i < n[b]) items.push({ id: `${b}${i}`, label: `Item ${b}${i}`, bucket: b, why: `${b}${i} belongs in ${b}.` });
  }
  return { id: 'sr', draw, buckets: [{ id: 'a', label: 'Bucket A' }, { id: 'b', label: 'Bucket B' }], items };
}
/**
 * The share of items put in the right bucket on each play when every item seen before goes in `busy` and a new one in
 * the other bucket. The best a player can do without a tell is to put everything in the bucket with more items on
 * the board, and `uninformed` is that share.
 */
function replaySort(pool, busy, seed) {
  const shuffle = shuffleWith(seeded(seed));
  const other = busy === 'a' ? 'b' : 'a';
  const right = Array(PLAYS).fill(0);
  let shown = 0;
  let uninformed = 0;
  for (let p = 0; p < PLAYERS; p++) {
    const seen = new Set();
    for (let play = 0; play < PLAYS; play++) {
      const board = drawSortBoard(pool, shuffle).items;
      shown = board.length;
      uninformed = Math.max(board.filter((it) => it.bucket === 'a').length, board.filter((it) => it.bucket === 'b').length) / board.length;
      for (const it of board) if (it.bucket === (seen.has(it.id) ? busy : other)) right[play]++;
      for (const it of board) seen.add(it.id);
    }
  }
  return { rates: right.map((r) => r / (PLAYERS * shown)), uninformed };
}

test('R2 sort: on a pool whose buckets show about the same share of their items, "seen before goes in the busy bucket" does no better than the best uninformed guess', () => {
  const pool = sp(); // a shows 2 of 5, b shows 3 of 7
  assert.deepEqual(validateSortPool(pool), []);
  const { rates, uninformed } = replaySort(pool, 'b', 3);
  for (const rate of rates) assert.ok(rate <= uninformed + 0.05, `scored ${rate}, uninformed ${uninformed}`);
});

test('R2 sort: a pool with a bucket that never rotates leaks, and the validator refuses it', () => {
  const pool = sortOf({ a: 3, b: 12 }, { a: 3, b: 3 });
  assert.ok(validateSortPool(pool).some((p) => /rotate|more than|every item/.test(p)), validateSortPool(pool).join('\n'));
  const { rates, uninformed } = replaySort(pool, 'a', 3);
  assert.ok(rates[1] > uninformed + 0.2, `scored ${rates[1]}, uninformed ${uninformed}`);
});
