// Blind strategies must not win any Sort it in the game (#186). Each rule below ignores what
// the labels mean and uses only a tell in how they look; if one sorts a spec perfectly the
// player can finish without knowing the concept. Specs come from the live registry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTS } from '../levels/index.mjs';
import { drawSortBoard, sortBoards } from '../lib/pool.mjs';
import { runPlay, validatePlay } from '../lib/play.mjs';
import { buildRegistry } from '../lib/registry.mjs';
import { FIXTURE_CARD } from './fixtures/fixture-level.mjs';
import { IDENT, sp } from './fixtures/pool-fixtures.mjs';

// One wrong placement still earns 4 stars (lib/scoring.mjs), so a blind rule must cost at least two.
const MIN_WRONG = 2;
// An answer pool (#390) is checked on its boards: every one when there are this many or fewer, else this many drawn at
// random (seeded) plus the first-items board. A tell that only some boards have is still a tell the player can meet.
const BOARD_LIMIT = 5000;

const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ');

/** Every Sort it spec as written, as { level, spec } (a pool is one entry), from declarative (play.steps) and hand-written (CONTENT.steps) levels. `fixtures` (built registry levels) are read as well. */
async function allSortSources(fixtures = []) {
  const out = [];
  for (const act of ACTS) {
    for (const level of [...act.levels, ...(act.boss ? [act.boss] : [])]) {
      const mod = await import(`../levels/${level.id}.mjs`);
      const steps = mod.CONTENT?.steps ?? mod.default.play?.steps ?? [];
      for (const s of steps) if (s.sort) out.push({ level: level.id, spec: s.sort });
    }
  }
  for (const level of fixtures) for (const s of level.play?.steps ?? []) if (s.sort) out.push({ level: level.id, spec: s.sort });
  return out;
}

/** Every board a Sort it can show, as { level, spec }: a fixed spec is its own board, a pool is expanded to its boards. Every rule runs on all of them. */
async function allSortSpecs(fixtures = []) {
  return (await allSortSources(fixtures)).flatMap(({ level, spec }) =>
    spec.draw === undefined ? [{ level, spec }] : sortBoards(spec, { limit: BOARD_LIMIT, rng: rng(1) }).map((board) => ({ level, spec: board })),
  );
}

/** How many items a rule places in the wrong bucket; `pick(item, i)` returns a bucket id. */
const mistakes = (spec, pick) => spec.items.filter((it, i) => pick(it, i) !== it.bucket).length;

const len = (it) => plain(it.label).length;

/**
 * Fewest wrong placements any length rule gets. Two buckets: every cut between two distinct
 * lengths, shorter side to either bucket. More buckets: items ranked by length, cut into runs of
 * floor(n/k) or ceil(n/k), shortest run to the first bucket and the reverse.
 */
function bestByLength(spec) {
  const k = spec.buckets.length;
  const ids = spec.buckets.map((b) => b.id);
  const tries = [];
  if (k === 2) {
    const lengths = [...new Set(spec.items.map(len))].sort((a, b) => a - b);
    for (const cut of lengths.slice(1)) {
      for (const [short, long] of [ids, [...ids].reverse()]) tries.push((it) => (len(it) < cut ? short : long));
    }
  } else {
    for (const dir of [1, -1]) {
      const ranked = [...spec.items].sort((a, b) => dir * (len(a) - len(b)));
      const rank = new Map(ranked.map((it, r) => [it, r]));
      for (const size of new Set([Math.floor(spec.items.length / k), Math.ceil(spec.items.length / k)])) {
        tries.push((it) => ids[Math.min(k - 1, Math.floor(rank.get(it) / size))]);
      }
    }
  }
  return Math.min(...tries.map((pick) => mistakes(spec, pick)));
}

/** Tokens of a label with the markup stripped: lower-case words and %. A dotted key (service.name) is one token. */
const tokens = (it) =>
  new Set((plain(it.label).toLowerCase().match(/[a-z0-9][a-z0-9._-]*|%/g) ?? []).map((t) => t.replace(/[._-]+$/, '')));

/**
 * Fewest wrong placements any single-token rule gets on a two-bucket spec: every token found in
 * two or more labels (CLIENT, SERVER, %, "the" ...) sends the items with it to one bucket and the
 * rest to the other, either way round.
 */
function bestByToken(spec) {
  const ids = spec.buckets.map((b) => b.id);
  const sets = spec.items.map(tokens);
  const counts = new Map();
  for (const s of sets) for (const t of s) counts.set(t, (counts.get(t) ?? 0) + 1);
  let best = { wrong: Infinity, token: null };
  for (const [token, n] of counts) {
    if (n < 2) continue;
    for (const [yes, no] of [ids, [...ids].reverse()]) {
      const wrong = mistakes(spec, (it) => (tokens(it).has(token) ? yes : no));
      if (wrong < best.wrong) best = { wrong, token };
    }
  }
  return best;
}

/**
 * Fewest wrong placements any two-token decision list gets on a spec with three or more buckets:
 * "label has token A -> bucket X, else label has token B -> bucket Y, else bucket Z", over every
 * ordered pair of tokens found in two or more labels (A = B is the one-token rule) and every
 * assignment of buckets to X, Y and Z (repeats allowed, so "A -> X, else Y" is in it too).
 * Two-bucket boards keep their own token test above.
 */
function bestByTokenList(spec) {
  const ids = spec.buckets.map((b) => b.id);
  const sets = spec.items.map(tokens);
  const counts = new Map();
  for (const s of sets) for (const t of s) counts.set(t, (counts.get(t) ?? 0) + 1);
  const shared = [...counts].filter(([, n]) => n >= 2).map(([t]) => t);
  // With no shared token the list is just "everything to Z".
  let best = { wrong: Infinity, rule: null };
  for (const z of ids) {
    const wrong = mistakes(spec, () => z);
    if (wrong < best.wrong) best = { wrong, rule: `everything -> ${z}` };
  }
  for (const a of shared) {
    for (const b of shared) {
      for (const x of ids) {
        for (const y of ids) {
          for (const z of ids) {
            let wrong = 0;
            for (let i = 0; i < spec.items.length && wrong < best.wrong; i++) {
              const pick = sets[i].has(a) ? x : sets[i].has(b) ? y : z;
              if (pick !== spec.items[i].bucket) wrong++;
            }
            if (wrong < best.wrong) best = { wrong, rule: `"${a}" -> ${x}, else "${b}" -> ${y}, else ${z}` };
          }
        }
      }
    }
  }
  return best;
}

/**
 * All-caps words of a label, case kept (CPU, SERVER, UTC): 2+ letters or digits with at least one
 * letter, none lower-case. `tokens` lower-cases everything, so it cannot see these tells.
 */
const capsWords = (it) =>
  new Set(plain(it.label).split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 2 && /[A-Z]/.test(w) && w === w.toUpperCase()));

/** Wrong placements when items with an all-caps word go to the bucket at `capsIndex`, the rest to the other (two buckets only). */
function byCaps(spec, capsIndex) {
  return mistakes(spec, (it) => spec.buckets[capsWords(it).size > 0 ? capsIndex : 1 - capsIndex].id);
}

/** Like bestByToken, case-sensitive: each all-caps word found in two or more labels, either way round. */
function bestByCapsWord(spec) {
  const ids = spec.buckets.map((b) => b.id);
  const counts = new Map();
  for (const it of spec.items) for (const w of capsWords(it)) counts.set(w, (counts.get(w) ?? 0) + 1);
  let best = { wrong: Infinity, token: null };
  for (const [token, n] of counts) {
    if (n < 2) continue;
    for (const [yes, no] of [ids, [...ids].reverse()]) {
      const wrong = mistakes(spec, (it) => (capsWords(it).has(token) ? yes : no));
      if (wrong < best.wrong) best = { wrong, token };
    }
  }
  return best;
}

/** A board whose every label is a question (ends with "?"), two buckets only. */
const questionBoard = (spec) => spec.buckets.length === 2 && spec.items.every((it) => plain(it.label).trim().endsWith('?'));

/** First word of a label, lower-cased. */
const opener = (it) => (plain(it.label).trim().match(/^[A-Za-z]+/)?.[0] ?? '').toLowerCase();

const YES_NO = new Set(['is', 'are', 'has', 'have', 'does', 'do', 'did', 'can', 'was', 'were', 'will', 'should']);

/** Wrong placements when yes/no questions go to the bucket at `yesNoIndex`, every other question to the other. */
function byYesNo(spec, yesNoIndex) {
  return mistakes(spec, (it) => spec.buckets[YES_NO.has(opener(it)) ? yesNoIndex : 1 - yesNoIndex].id);
}

/**
 * Fewest wrong placements when one opener word shared by two or more labels sends those items to
 * one bucket and the rest to the other, either way round. Not the token rule: that one also
 * matches the word mid-label ("Why is ..." has "is" but opens with "why").
 */
function bestByOpener(spec) {
  const ids = spec.buckets.map((b) => b.id);
  const counts = new Map();
  for (const it of spec.items) counts.set(opener(it), (counts.get(opener(it)) ?? 0) + 1);
  let best = { wrong: Infinity, token: null };
  for (const [token, n] of counts) {
    if (n < 2) continue;
    for (const [yes, no] of [ids, [...ids].reverse()]) {
      const wrong = mistakes(spec, (it) => (opener(it) === token ? yes : no));
      if (wrong < best.wrong) best = { wrong, token };
    }
  }
  return best;
}

/** Items with `<code>` to the bucket at `codeIndex`, the rest to the other (two buckets only). */
function byCode(spec, codeIndex) {
  return mistakes(spec, (it) => spec.buckets[/<code>/.test(it.label) ? codeIndex : 1 - codeIndex].id);
}

/** A small seeded generator, so the shuffles are the same on every run. */
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffles of the spec on which "put it in the emptier bucket" sorts everything right (ties to a random bucket). A
 * pool draws a fresh board for every shuffle, as the game does; `boards` (a Set) collects the boards drawn.
 */
function balancedWins(spec, runs, boards = new Set()) {
  let wins = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const rand = rng(seed);
    const drawn = spec.draw === undefined ? spec : drawSortBoard(spec, (list) => [...list].sort(() => rand() - 0.5));
    boards.add(drawn.items.map((it) => it.id).join());
    const items = [...drawn.items].sort(() => rand() - 0.5);
    const counts = Object.fromEntries(spec.buckets.map((b) => [b.id, 0]));
    let bad = 0;
    for (const it of items) {
      const low = Math.min(...Object.values(counts));
      const open = spec.buckets.filter((b) => counts[b.id] === low);
      const pick = open[Math.floor(rand() * open.length)].id;
      counts[pick]++;
      if (pick !== it.bucket) bad++;
    }
    if (bad === 0) wins++;
  }
  return wins;
}

test('Sort it: the registry has Sort it specs to check', async () => {
  // Independent of the spec walk: every level whose raw entry declares the sort mechanic must
  // yield a spec, so a level the walk cannot reach does not slip out of the checks.
  const specs = await allSortSpecs();
  const have = new Set(specs.map((s) => s.level));
  for (const act of ACTS) {
    for (const level of [...act.levels, ...(act.boss ? [act.boss] : [])]) {
      const mod = await import(`../levels/${level.id}.mjs`);
      const steps = mod.CONTENT?.steps ?? mod.default.play?.steps ?? [];
      const declares = (mod.default.mechanics ?? []).includes('sort') || steps.some((s) => s.sort);
      if (declares) assert.equal(have.has(level.id), true, `${level.id} declares Sort it but yields no spec`);
    }
  }
  assert.equal(specs.length > 0, true);
});

test('Sort it: "short labels to one bucket, long to the other" never earns 4 stars', async () => {
  for (const { level, spec } of await allSortSpecs()) {
    const wrong = bestByLength(spec);
    assert.equal(wrong >= MIN_WRONG, true, `${level} ${spec.id}: some label-length cut gets ${wrong} wrong`);
  }
});

test('Sort it: "the items with code formatting go in one bucket" never earns 4 stars', async () => {
  for (const { level, spec } of await allSortSpecs()) {
    if (spec.buckets.length !== 2) continue;
    for (const codeIndex of [0, 1]) {
      const wrong = byCode(spec, codeIndex);
      assert.equal(wrong >= MIN_WRONG, true, `${level} ${spec.id}: <code> alone gets ${wrong} wrong (to bucket ${codeIndex})`);
    }
  }
});

test('Sort it: "a word or a % shared by labels goes to one bucket" never earns 4 stars', async () => {
  for (const { level, spec } of await allSortSpecs()) {
    if (spec.buckets.length !== 2) continue;
    const { wrong, token } = bestByToken(spec);
    assert.equal(wrong >= MIN_WRONG, true, `${level} ${spec.id}: the token "${token}" alone gets ${wrong} wrong`);
  }
});

test('Sort it: "word A to one bucket, else word B to another, else the third" never earns 4 stars (3+ buckets)', async () => {
  let boards = 0;
  for (const { level, spec } of await allSortSpecs()) {
    if (spec.buckets.length < 3) continue;
    boards++;
    const { wrong, rule } = bestByTokenList(spec);
    assert.equal(wrong >= MIN_WRONG, true, `${level} ${spec.id}: the rule ${rule} gets ${wrong} wrong`);
  }
  assert.equal(boards > 0, true, 'no Sort it board with three or more buckets to check');
});

test('Sort it: "the labels with an all-caps word go in one bucket" never earns 4 stars', async () => {
  for (const { level, spec } of await allSortSpecs()) {
    if (spec.buckets.length !== 2) continue;
    for (const capsIndex of [0, 1]) {
      const wrong = byCaps(spec, capsIndex);
      assert.equal(wrong >= MIN_WRONG, true, `${level} ${spec.id}: an all-caps word alone gets ${wrong} wrong (to bucket ${capsIndex})`);
    }
  }
});

// Guards the mixed-case case (SERVER in one label beside server in another), which the lower-cased token test cannot see.
test('Sort it: "one all-caps word shared by labels goes to one bucket" never earns 4 stars', async () => {
  for (const { level, spec } of await allSortSpecs()) {
    if (spec.buckets.length !== 2) continue;
    const { wrong, token } = bestByCapsWord(spec);
    assert.equal(wrong >= MIN_WRONG, true, `${level} ${spec.id}: the all-caps word "${token}" alone gets ${wrong} wrong`);
  }
});

test('Sort it: "yes/no questions go in one bucket, other questions in the other" never earns 4 stars', async () => {
  let boards = 0;
  for (const { level, spec } of await allSortSpecs()) {
    if (!questionBoard(spec)) continue;
    boards++;
    for (const yesNoIndex of [0, 1]) {
      const wrong = byYesNo(spec, yesNoIndex);
      assert.equal(wrong >= MIN_WRONG, true, `${level} ${spec.id}: the question form alone gets ${wrong} wrong (yes/no to bucket ${yesNoIndex})`);
    }
  }
  assert.equal(boards > 0, true, 'no all-question Sort it board to check');
});

test('Sort it: "questions with the same opening word go in one bucket" never earns 4 stars', async () => {
  for (const { level, spec } of await allSortSpecs()) {
    if (!questionBoard(spec)) continue;
    const { wrong, token } = bestByOpener(spec);
    assert.equal(wrong >= MIN_WRONG, true, `${level} ${spec.id}: the opening word "${token}" alone gets ${wrong} wrong`);
  }
});

test('Sort it: "keep the buckets balanced" wins a spec on at most 1 shuffle in 10', async () => {
  const runs = 200;
  // The specs as written: a pool draws a fresh board for each shuffle, so it is not expanded here.
  for (const { level, spec } of await allSortSources()) {
    const wins = balancedWins(spec, runs);
    assert.equal(wins <= runs / 10, true, `${level} ${spec.id}: balancing sorts it right on ${wins} of ${runs} shuffles`);
  }
});

// ---- answer pools (#390) ----

/** Two buckets; the first two items of each are plain, bucket a's third to fifth carry <code>. Shows two of each. */
function codePool() {
  const item = (id, bucket, label) => ({ id, label, bucket, why: `${id} belongs in ${bucket}.` });
  return {
    id: 'code-pool',
    draw: { a: 2, b: 2 },
    buckets: [{ id: 'a', label: 'Bucket A' }, { id: 'b', label: 'Bucket B' }],
    items: [
      item('a1', 'a', 'Plain one'), item('a2', 'a', 'Plain two'), item('a3', 'a', '<code>three</code>'), item('a4', 'a', '<code>four</code>'), item('a5', 'a', '<code>five</code>'),
      item('b1', 'b', 'Plain six'), item('b2', 'b', 'Plain seven'), item('b3', 'b', 'Plain eight'),
    ],
  };
}
const codeLevel = () =>
  Object.values(
    buildRegistry(
      [{ id: 'a', no: 0, levels: [{ id: 'code-fixture', no: '0.3', name: 'Code', icon: '*', rewardTitle: 'Code', cards: ['fixture-card'], play: { steps: [{ intro: 'Sort.', question: 'Sort them.', sort: codePool() }], finish: 'You sorted the pool.' } }], boss: null }],
      { deck: [FIXTURE_CARD], nodeIds: [], play: { validatePlay, runPlay } },
    ).levels,
  );
const fewestByCode = (spec) => Math.min(byCode(spec, 0), byCode(spec, 1));

test('T5 a tell only some boards have is caught: the first-items board is clean, another board is flagged by the <code> rule', async () => {
  const identity = drawSortBoard(codePool(), IDENT);
  assert.ok(fewestByCode(identity) >= MIN_WRONG, 'the first-items board has no code tell');
  const boards = (await allSortSpecs(codeLevel())).filter((s) => s.level === 'code-fixture');
  assert.ok(boards.length > 1, `${boards.length} boards`);
  const flagged = boards.filter(({ spec }) => fewestByCode(spec) < MIN_WRONG);
  assert.ok(flagged.length > 0, 'some board lets <code> alone sort it');
  // A board of two plain items per bucket stays clean, so the flag is the board's, not the pool's.
  assert.ok(boards.some(({ spec }) => fewestByCode(spec) >= MIN_WRONG));
});

test('every rule runs on every board of a pool: the fixture pool expands to all its boards', async () => {
  const boards = (await allSortSpecs(codeLevel())).filter((s) => s.level === 'code-fixture');
  assert.equal(boards.length, 10 * 3); // C(5,2) * C(3,2)
  for (const { spec } of boards) assert.equal(spec.items.length, 4);
});

test('balance draws a fresh board for each shuffle of a pool', () => {
  const boards = new Set();
  balancedWins(sp(), 30, boards);
  assert.ok(boards.size > 1, `${boards.size} distinct boards in 30 shuffles`);
  const fixed = new Set();
  balancedWins({ ...sp(), draw: undefined }, 5, fixed);
  assert.equal(fixed.size, 1);
});
