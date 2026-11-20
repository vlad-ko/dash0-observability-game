// Answer pools (#390, docs/CONTENT.md section 10): a multiple-choice or sort step may list more answers than one
// showing uses and say how many to show with `draw`. The logic file states `draw` (a choice: a whole number of
// answers shown; a sort: how many items from each bucket), the content file lists the whole pool. Each time the
// step is shown, one board is drawn from the pool through the level's injected random source (ctx.shuffle), and
// that board is what the step renders, mounts, grades and tells the guide about. Nothing is saved.
//
// Pure and DOM-free. The step type's `draw` hook (lib/play.mjs) is the one seam that draws; the enumerators serve
// the tests that must hold on EVERY board a pool can make; boardOf is how the guide server reads a client's board
// back; the validators say whether a pool is fair (exposure parity, the 50/50 floor, per-board rules).

import { FIFTY_MIN, validateChoiceSpec } from './widgets/choice.mjs';
import { BOARD_ITEMS, validateSortSpec } from './widgets/sort-it.mjs';
import { validateSortHelps } from './widgets/sort-it-help.mjs';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.hasOwn(o, k);
const plain = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim();
const sum = (list) => list.reduce((a, b) => a + b, 0);

/**
 * The right/wrong balance of a choice pool, the one place its numbers live (see validateChoicePool). With R rights,
 * W wrongs and `draw` shown, `minWrongPerRightSlot * R * (draw - 1) <= W <= maxWrongPerRightSlot * R * (draw - 1)`.
 * 2 and 1 allow about 3-4 rights to 16-17 wrongs at 3-4 shown. Setting both to 1 is exact parity (a right and a
 * wrong answer are shown equally often, so how often an answer was seen says nothing): the pool then needs more
 * rights, for example 5 rights and 15 wrongs at 4 shown.
 */
export const EXPOSURE = Object.freeze({ maxWrongPerRightSlot: 2, minWrongPerRightSlot: 1 });
/** The most the shown shares of two sort buckets may differ, relative to the larger share: 15 / 100 (see validateSortPool). */
const SHARE_SPREAD_NUM = 15;
const SHARE_SPREAD_DEN = 100;
/** A pool that shows at least FIFTY_MIN answers keeps this many wrong ones free of `keep` (the 50/50 removes two, one wrong always stays). */
const FIFTY_SPARE = 3;
/** Boards a sort pool is expanded to at most, by default, before a seeded sample stands in (see sortBoards). */
export const SORT_BOARD_LIMIT = 5000;

const isChoicePool = (spec) => isObject(spec) && Array.isArray(spec.choices);
const isSortPool = (spec) => isObject(spec) && Array.isArray(spec.items);

/** `spec` without `draw`: the board's shape is the shape of an ordinary step. */
function without(spec, extra) {
  const { draw: _draw, ...rest } = spec;
  return { ...rest, ...extra };
}

/** Every k-element subset of `list`, in list order. */
function* subsets(list, k, from = 0) {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = from; i <= list.length - k; i++) for (const rest of subsets(list, k - 1, i + 1)) yield [list[i], ...rest];
}

/** A small seeded generator: the default random source of sortBoards, so its sample is the same on every run. */
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffle of a copy of `list` by Fisher-Yates through `rng`. */
function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- drawing ----

/**
 * The board of one showing of a pooled choice: one right answer (the first of `shuffle(rights)`) and `draw - 1`
 * wrong ones (the first of `shuffle(wrongs)`), in the pool's content order; the display order is the widget's own
 * shuffle. `{id, choices}` as an ordinary choice spec, without `draw`. Never edits `spec`.
 */
export function drawChoiceBoard(spec, shuffle) {
  const right = shuffle(spec.choices.filter((c) => c.right))[0];
  const wrongs = shuffle(spec.choices.filter((c) => !c.right)).slice(0, spec.draw - 1);
  const drawn = new Set([right, ...wrongs]);
  return without(spec, { choices: spec.choices.filter((c) => drawn.has(c)) });
}

/**
 * The board of one showing of a pooled sort: `draw[bucket]` items from each bucket (the first of
 * `shuffle(items of the bucket)`), in the pool's content order. The spec's own shape without `draw`.
 */
export function drawSortBoard(spec, shuffle) {
  const drawn = new Set();
  for (const b of spec.buckets) {
    for (const it of shuffle(spec.items.filter((x) => x.bucket === b.id)).slice(0, spec.draw[b.id])) drawn.add(it);
  }
  return without(spec, { items: spec.items.filter((it) => drawn.has(it)) });
}

/** The board for one showing of `spec` through `shuffle`, whichever type it is. */
export const drawBoard = (spec, shuffle) => (isChoicePool(spec) ? drawChoiceBoard(spec, shuffle) : drawSortBoard(spec, shuffle));

/** What a board shows, as the ids the guide is told: a choice's keys, a sort's item ids, in board order. */
export const shownOf = (board) => (isChoicePool(board) ? board.choices.map((c) => c.key) : board.items.map((it) => it.id));

// ---- enumerating ----

/** Every board of a pooled choice: each right with each set of `draw - 1` wrongs, once. */
export function choiceBoards(spec) {
  const rights = spec.choices.filter((c) => c.right);
  const wrongs = spec.choices.filter((c) => !c.right);
  const out = [];
  for (const right of rights) {
    for (const set of subsets(wrongs, spec.draw - 1)) {
      const drawn = new Set([right, ...set]);
      out.push(without(spec, { choices: spec.choices.filter((c) => drawn.has(c)) }));
    }
  }
  return out;
}

const choose = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};

/**
 * The boards of a pooled sort: every one when there are `limit` or fewer, else the identity board (the first
 * `draw` items of each bucket) and `limit` boards drawn through `rng` (a function giving a number in [0, 1); seeded
 * by default, so the sample repeats). A rule that must hold on every board is checked on all of these.
 */
export function sortBoards(spec, { limit = SORT_BOARD_LIMIT, rng = seeded(1) } = {}) {
  const per = spec.buckets.map((b) => ({ items: spec.items.filter((x) => x.bucket === b.id), k: spec.draw[b.id] }));
  const total = per.reduce((n, p) => n * choose(p.items.length, p.k), 1);
  const board = (drawn) => without(spec, { items: spec.items.filter((it) => drawn.has(it)) });
  if (total > limit) {
    const identity = drawSortBoard(spec, (list) => [...list]);
    return [identity, ...Array.from({ length: limit }, () => drawSortBoard(spec, (list) => shuffled(list, rng)))];
  }
  let sets = [[]];
  for (const p of per) sets = sets.flatMap((acc) => [...subsets(p.items, p.k)].map((s) => [...acc, ...s]));
  return sets.map((s) => board(new Set(s)));
}

// ---- reading a board back ----

/**
 * The board a client says it was shown: `shown` (a choice's keys, a sort's item ids) read against the pool `spec`.
 * Null unless every entry is a different member of the pool and the total is the size of a board. It never counts
 * rights or items per bucket: how many of the shown are right is exactly what a client must not be able to learn
 * from a refusal (api/guide.mjs). Null too for a step with no `draw`.
 */
export function boardOf(spec, shown) {
  if (!isObject(spec) || !has(spec, 'draw') || !Array.isArray(shown) || !shown.every((k) => typeof k === 'string')) return null;
  const choice = isChoicePool(spec);
  if (!choice && !isSortPool(spec)) return null;
  const size = choice ? spec.draw : isObject(spec.draw) ? sum(Object.values(spec.draw)) : NaN;
  const pool = choice ? spec.choices : spec.items;
  const idOf = (x) => (choice ? x.key : x.id);
  if (shown.length !== size || new Set(shown).size !== shown.length) return null;
  if (!shown.every((k) => pool.some((x) => idOf(x) === k))) return null;
  const set = new Set(shown);
  return without(spec, choice ? { choices: pool.filter((x) => set.has(x.key)) } : { items: pool.filter((x) => set.has(x.id)) });
}

// ---- validating ----

/**
 * Every problem with a pooled choice (`{id, draw, choices}`), as strings; [] when valid. Pure, never throws.
 * `draw` is a whole number from 2 up to below the pool size. The pool has a right answer and at least `draw - 1`
 * wrong ones. Exposure parity: with R rights and W wrongs and `draw` shown, a right answer is shown in 1/R of the
 * showings and a wrong one in (draw - 1)/W of them. W must lie within the bounds of `exposure` (EXPOSURE by default):
 * the upper bound is an accepted tell, the answer seen most often is right more often than chance, and below the
 * lower bound the answer not seen before wins.
 * From FIFTY_MIN shown, at most `draw - 3` wrongs carry `keep`, so every board has two wrongs the 50/50 may
 * remove. Each right is judged with all the wrongs through validateChoiceSpec, the one expression of the per-answer
 * rules. Keys and plain labels are unique across the pool.
 */
export function validateChoicePool(spec, exposure = EXPOSURE) {
  if (!isObject(spec)) return ['spec: not an object'];
  const { choices, draw } = spec;
  if (!Array.isArray(choices) || !choices.every(isObject)) return ['choices must be a list of objects', ...validateChoiceSpec(choices)];
  const problems = [];
  const keyed = choices.every((c) => typeof c.key === 'string' && c.key !== '');
  if (!Number.isInteger(draw) || draw < 2) problems.push(`draw must be a whole number of at least 2, not ${JSON.stringify(draw) ?? String(draw)}`);
  else if (draw >= choices.length) problems.push(`draw ${draw} must be smaller than the pool of ${choices.length} choices (it is not a pool otherwise)`);
  const rights = choices.filter((c) => c.right);
  const wrongs = choices.filter((c) => !c.right);
  if (rights.length < 1) problems.push('needs at least 1 right answer, has 0');
  if (Number.isInteger(draw) && draw >= 2) {
    if (wrongs.length < draw - 1) problems.push(`needs at least ${draw - 1} wrong answers to fill a board, has ${wrongs.length}`);
    const answers = `${rights.length} right ${rights.length === 1 ? 'answer' : 'answers'}`;
    const slots = rights.length * (draw - 1);
    const most = exposure.maxWrongPerRightSlot * slots;
    const least = exposure.minWrongPerRightSlot * slots;
    if (rights.length >= 1 && wrongs.length > most) {
      problems.push(
        `exposure: ${wrongs.length} wrong answers to ${answers} with ${draw} shown ` +
          `would show a wrong answer far less often than a right one (at most ${most} wrong answers, or add right answers)`,
      );
    }
    if (rights.length >= 1 && wrongs.length < least) {
      problems.push(
        `exposure: ${wrongs.length} wrong answers to ${answers} with ${draw} shown ` +
          `would show a wrong answer more often than a right one, so the answer not seen before wins (at least ${least} wrong answers, or fewer right answers)`,
      );
    }
    if (draw >= FIFTY_MIN) {
      const keeps = wrongs.filter((c) => c.keep).length;
      if (keeps > draw - FIFTY_SPARE) problems.push(`${keeps} wrong answers carry keep, more than the ${draw - FIFTY_SPARE} a board of ${draw} may hold and still give the 50/50 two to remove`);
    }
  }
  if (keyed) {
    const keys = choices.map((c) => c.key);
    if (new Set(keys).size !== keys.length) problems.push('choice keys must be unique across the pool');
  }
  const labels = choices.map((c) => (typeof c.label === 'string' ? plain(c.label) : null)).filter((l) => l !== null);
  if (new Set(labels).size !== labels.length) problems.push('two choices have the same label once markup is removed');
  const found = new Set();
  for (const right of rights) {
    for (const p of validateChoiceSpec([right, ...wrongs])) found.add(p);
  }
  return [...new Set([...problems, ...found])];
}

/**
 * Every problem with a pooled sort (`{id, buckets, items, draw}` and the usual helps), as strings; [] when valid.
 * Pure, never throws. `draw` names exactly the bucket ids, each a whole number from 1 up to below the bucket's pool
 * (every bucket rotates, `draw[b] < n_b`), the board's total within the usual 2..12 items. The shown shares
 * `draw[b] / n_b` are within 15% of each other, relative to the largest, so how often a player has seen an item
 * does not say which bucket it is in. The pool itself is judged as a sort without the item-count range
 * (validateSortSpec's `pooled`).
 */
export function validateSortPool(spec) {
  const problems = validateSortSpec(spec, { pooled: true });
  if (!isObject(spec)) return problems;
  const { draw } = spec;
  if (!isObject(draw)) return [...problems, 'draw must be an object of bucket id to the number of items shown'];
  const buckets = Array.isArray(spec.buckets) ? spec.buckets.filter(isObject).map((b) => b.id) : [];
  const items = Array.isArray(spec.items) ? spec.items.filter(isObject) : [];
  for (const id of buckets) if (!has(draw, id)) problems.push(`draw has no count for bucket "${String(id)}"`);
  for (const id of Object.keys(draw)) if (!buckets.includes(id)) problems.push(`draw names "${id}", which is not a bucket`);
  let more = false;
  const shares = [];
  for (const id of buckets) {
    if (!has(draw, id)) continue;
    const n = items.filter((it) => it.bucket === id).length;
    if (!Number.isInteger(draw[id]) || draw[id] < 1) problems.push(`draw for bucket "${String(id)}" must be a whole number of at least 1`);
    else if (draw[id] > n) problems.push(`draw for bucket "${String(id)}" is ${draw[id]}, more than its ${n} items`);
    else if (draw[id] < n) {
      more = true;
      shares.push({ id, shown: draw[id], of: n });
    } else problems.push(`bucket "${String(id)}" shows all its ${n} items, so it never rotates and a player learns them by sight`);
  }
  // The shown shares draw[b] / n_b must be near equal, so how often an item has been seen says nothing of its bucket.
  // In whole numbers: (hi - lo) / hi <= SHARE_SPREAD for every pair of buckets, hi and lo being their shares.
  for (const [i, x] of shares.entries()) {
    for (const y of shares.slice(i + 1)) {
      const [hi, lo] = x.shown * y.of >= y.shown * x.of ? [x, y] : [y, x];
      if ((hi.shown * lo.of - lo.shown * hi.of) * SHARE_SPREAD_DEN > SHARE_SPREAD_NUM * hi.shown * lo.of) {
        problems.push(`bucket "${hi.id}" shows ${hi.shown} of ${hi.of} items and bucket "${lo.id}" ${lo.shown} of ${lo.of}: the shares are more than 15% apart, so seeing an item often says which bucket it is in`);
      }
    }
  }
  const total = sum(Object.values(draw).filter(Number.isInteger));
  if (total < BOARD_ITEMS.min || total > BOARD_ITEMS.max) problems.push(`draw adds up to ${total} items, expected ${BOARD_ITEMS.min}..${BOARD_ITEMS.max}`);
  if (!more && !problems.some((p) => /^draw for bucket/.test(p))) problems.push('draw shows every item of every bucket, so this is not a pool: drop draw');
  return problems.length ? problems : validateSortHelps(spec);
}
