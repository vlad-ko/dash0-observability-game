// Answer pools (#390, lib/pool.mjs): the pure core. A pooled question lists more answers than one showing
// uses; draw* picks the board for one showing through an injected shuffle, the enumerators list every board a
// pool can make, boardOf reads a client's shown keys back into a board, and the two validators judge a pool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardOf, choiceBoards, drawChoiceBoard, drawSortBoard, shownOf, sortBoards, validateChoicePool, validateSortPool } from '../lib/pool.mjs';
import { CP, IDENT, REV, SP, cp, deepFreeze, pick, sp } from './fixtures/pool-fixtures.mjs';

const keys = (board) => board.choices.map((c) => c.key);
const ids = (board) => board.items.map((i) => i.id);

/** A pool of `rights` rights and `wrongs` wrongs (12-character labels, all different), showing `draw`; `keeps` wrongs carry keep. */
function poolOf(rights, wrongs, draw, keeps = 0) {
  const word = (i) => `${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`;
  const choices = [
    ...Array.from({ length: rights }, (_, i) => pick(`r${i}`, `r${word(i)}`, true)),
    ...Array.from({ length: wrongs }, (_, i) => pick(`w${i}`, `w${word(i)}`, false, i < keeps ? { keep: true } : {})),
  ];
  return { id: 'bp', draw, choices };
}

// ---- drawChoiceBoard ----

test('P1 drawChoiceBoard: one right and draw-1 wrongs, drawn through the shuffle, shown in content order', () => {
  assert.deepEqual(keys(drawChoiceBoard(CP, IDENT)), ['w1', 'r1', 'w2']);
  assert.deepEqual(keys(drawChoiceBoard(CP, REV)), ['w5', 'r3', 'w6']);
  for (const shuffle of [IDENT, REV]) {
    const board = drawChoiceBoard(CP, shuffle);
    assert.equal(board.choices.filter((c) => c.right).length, 1);
    assert.equal(board.id, 'cp');
    assert.equal(Object.hasOwn(board, 'draw'), false);
  }
  assert.deepEqual(CP, deepFreeze(cp()), 'the pool is untouched');
});

test('P1 drawChoiceBoard: the right answer is drawn from the rights, the wrongs from the wrongs', () => {
  const calls = [];
  drawChoiceBoard(CP, (list) => {
    calls.push(list.map((c) => c.key).join());
    return [...list];
  });
  assert.deepEqual(calls, ['r1,r2,r3', 'w1,w2,w3,w4,w5,w6']);
});

// ---- choiceBoards ----

test('P2 choiceBoards: every right with every set of draw-1 wrongs, once each', () => {
  const boards = choiceBoards(CP);
  assert.equal(boards.length, 45);
  assert.equal(new Set(boards.map((b) => keys(b).join())).size, 45);
  for (const b of boards) {
    assert.equal(b.choices.length, 3);
    assert.equal(b.choices.filter((c) => c.right).length, 1);
    assert.equal(Object.hasOwn(b, 'draw'), false);
  }
  const pairs = new Map();
  for (const b of boards) {
    const key = keys(b).filter((k) => k.startsWith('w')).join();
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  assert.equal(pairs.size, 15);
  assert.ok([...pairs.values()].every((n) => n === 3));
});

// ---- validateChoicePool ----

test('P3 validateChoicePool: the fixture is valid and the draw must be a whole number below the pool size', () => {
  assert.deepEqual(validateChoicePool(CP), []);
  assert.match(validateChoicePool({ ...cp(), draw: 9 }).join('\n'), /smaller than the pool/);
  assert.ok(validateChoicePool({ ...cp(), draw: 1 }).length > 0);
  assert.ok(validateChoicePool({ ...cp(), draw: 2.5 }).length > 0);
  assert.ok(validateChoicePool({ ...cp(), draw: '3' }).length > 0);
});

test('P3 validateChoicePool: a pool needs a right answer and enough wrong ones', () => {
  assert.ok(validateChoicePool(poolOf(0, 8, 3)).length > 0);
  assert.ok(validateChoicePool(poolOf(5, 1, 3)).length > 0);
});

test('P3 validateChoicePool: exposure parity, R*(draw-1) <= W <= 2*R*(draw-1), holds at both boundaries and fails past each', () => {
  assert.deepEqual(validateChoicePool(poolOf(1, 4, 3)), []);
  assert.match(validateChoicePool(poolOf(1, 5, 3)).join('\n'), /exposure.*at most 4/);
  assert.deepEqual(validateChoicePool(poolOf(3, 12, 3)), []);
  assert.match(validateChoicePool(poolOf(3, 13, 3)).join('\n'), /exposure.*at most 12/);
  // The lower bound: a wrong answer shown less often than a right one lets "the one not seen before" win.
  assert.deepEqual(validateChoicePool(poolOf(2, 4, 3)), []);
  assert.deepEqual(validateChoicePool(poolOf(3, 6, 3)), []);
  assert.deepEqual(validateChoicePool(poolOf(3, 9, 4)), []);
  assert.match(validateChoicePool(poolOf(3, 5, 3)).join('\n'), /exposure.*at least 6/);
  assert.match(validateChoicePool(poolOf(3, 8, 4)).join('\n'), /exposure.*at least 9/);
  assert.match(validateChoicePool(poolOf(8, 2, 3)).join('\n'), /exposure.*at least 16/);
});

test('P3 validateChoicePool: from 4 shown, at most draw-3 wrongs carry keep so the 50/50 always has two to remove', () => {
  assert.deepEqual(validateChoicePool(poolOf(3, 9, 4, 1)), []);
  assert.ok(validateChoicePool(poolOf(3, 9, 4, 2)).length > 0);
  // Below four shown there is no 50/50, so keep is not limited by it.
  assert.deepEqual(validateChoicePool(poolOf(3, 6, 3, 2)), []);
});

test('P3 validateChoicePool: every right is judged with the wrongs, not only the first', () => {
  const noWhy = poolOf(3, 6, 3);
  delete noWhy.choices[2].why; // r2 has no why
  assert.ok(validateChoicePool(noWhy).some((p) => /r2/.test(p)), 'a right after the first');
  const keepRight = poolOf(3, 6, 3);
  keepRight.choices[1].keep = true;
  assert.ok(validateChoicePool(keepRight).some((p) => /r1/.test(p)), 'keep on a right');
});

test('P3 validateChoicePool: keys are unique across the whole pool, and so are the plain labels', () => {
  const twin = poolOf(3, 6, 3);
  twin.choices[1].key = twin.choices[0].key; // two rights share a key, which no single board holds together
  assert.ok(validateChoicePool(twin).some((p) => /unique/.test(p)));
  const same = poolOf(3, 6, 3);
  same.choices[4].label = `<b>${same.choices[3].label}</b>`;
  assert.ok(validateChoicePool(same).some((p) => /same label/.test(p)));
});

test('P3 validateChoicePool: never throws on odd input', () => {
  for (const bad of [null, undefined, 4, 'x', [], { draw: 3 }, { draw: 3, choices: 'no' }, { draw: 3, choices: [null, 1, {}] }]) {
    assert.ok(Array.isArray(validateChoicePool(bad)), String(bad));
    assert.ok(validateChoicePool(bad).length > 0, String(bad));
  }
});

// ---- sort ----

test('P4 drawSortBoard: draw[b] items from each bucket, drawn through the shuffle, shown in content order', () => {
  assert.deepEqual(ids(drawSortBoard(SP, IDENT)), ['a1', 'b1', 'a2', 'b2', 'b3']);
  assert.deepEqual(ids(drawSortBoard(SP, REV)), ['a4', 'a5', 'b5', 'b6', 'b7']);
  const board = drawSortBoard(SP, IDENT);
  assert.deepEqual(board.buckets, SP.buckets);
  assert.equal(Object.hasOwn(board, 'draw'), false);
  assert.equal(board.id, 'sp');
  assert.deepEqual(SP, deepFreeze(sp()), 'the pool is untouched');
});

test('P5 validateSortPool: the fixture is valid, and a pool may be larger than a board may be', () => {
  assert.deepEqual(validateSortPool(SP), []);
  const big = sp();
  big.items = [];
  for (let i = 0; i < 10; i++) big.items.push({ id: `a${i}`, label: `Item a${i}`, bucket: 'a', why: 'It is.' }, { id: `b${i}`, label: `Item b${i}`, bucket: 'b', why: 'It is.' });
  big.draw = { a: 6, b: 6 };
  assert.deepEqual(validateSortPool(big), []);
  big.draw = { a: 7, b: 6 };
  assert.ok(validateSortPool(big).some((p) => /2\.\.12|sum/.test(p)));
});

test('P5 validateSortPool: draw names exactly the buckets, each a whole number from 1 up to its pool, and some bucket is a pool', () => {
  const bad = (draw) => validateSortPool({ ...sp(), draw }).join('\n');
  assert.match(bad({ a: 2 }), /bucket "b"/);
  assert.match(bad({ a: 2, b: 3, c: 1 }), /"c"/);
  assert.ok(bad({ a: 0, b: 3 }).length > 0);
  assert.ok(bad({ a: 6, b: 3 }).length > 0);
  assert.ok(bad({ a: 1.5, b: 3 }).length > 0);
  assert.match(bad({ a: 5, b: 7 }), /not a pool/);
  assert.ok(bad(3).length > 0);
  assert.ok(bad(undefined).length > 0);
});

/** The fixture sort with `a` items in bucket a and `b` in bucket b, showing `draw`. */
function sortPool(n, draw) {
  const items = [];
  for (const b of ['a', 'b']) for (let i = 1; i <= n[b]; i++) items.push({ id: `${b}${i}`, label: `Item ${b}${i}`, bucket: b, why: `${b}${i} belongs in ${b}.` });
  return { ...sp(), draw, items };
}

test('P5 validateSortPool: every bucket must rotate, so a bucket shown whole cannot tell the player its items', () => {
  assert.deepEqual(validateSortPool(sortPool({ a: 5, b: 7 }, { a: 2, b: 3 })), []);
  assert.match(validateSortPool(sortPool({ a: 3, b: 12 }, { a: 3, b: 3 })).join('\n'), /bucket "a".*never rotates/);
  assert.match(validateSortPool(sortPool({ a: 6, b: 6 }, { a: 6, b: 3 })).join('\n'), /bucket "a".*never rotates/);
});

test('P5 validateSortPool: the buckets show about the same share of their items, within 15% of the largest share', () => {
  const problems = (n, draw) => validateSortPool(sortPool(n, draw)).join('\n');
  assert.deepEqual(validateSortPool(sortPool({ a: 4, b: 20 }, { a: 2, b: 9 })), [], '0.5 and 0.45');
  assert.match(problems({ a: 4, b: 5 }, { a: 2, b: 2 }), /share/, '0.5 and 0.4 is a fifth less');
  assert.match(problems({ a: 3, b: 12 }, { a: 2, b: 3 }), /share/);
  assert.match(problems({ a: 5, b: 6 }, { a: 4, b: 2 }), /share/);
});

test('P5 validateSortPool: every pool item is judged like a sort item', () => {
  const noWhy = sp();
  delete noWhy.items[8].why; // a5
  assert.ok(validateSortPool(noWhy).some((p) => /a5/.test(p)));
  const unknown = sp();
  unknown.items[0].bucket = 'zz';
  assert.ok(validateSortPool(unknown).some((p) => /a1/.test(p)));
});

test('P5 validateSortPool: never throws on odd input', () => {
  for (const bad of [null, undefined, 4, 'x', [], {}, { draw: {}, buckets: 1, items: 'no' }]) {
    assert.ok(validateSortPool(bad).length > 0, String(bad));
  }
});

test('sortBoards: every board of a small pool once; a big pool gets the limit of seeded boards and the identity board', () => {
  const all = sortBoards(SP);
  assert.equal(all.length, 10 * 35); // C(5,2) * C(7,3)
  assert.equal(new Set(all.map((b) => ids(b).join())).size, 350);
  for (const b of all) assert.deepEqual(b.items.filter((i) => i.bucket === 'a').length, 2);
  const limited = sortBoards(SP, { limit: 5 });
  assert.equal(limited.length, 6);
  assert.deepEqual(ids(limited[0]), ['a1', 'b1', 'a2', 'b2', 'b3'], 'the identity board comes first');
  assert.deepEqual(limited.map((b) => ids(b).join()), sortBoards(SP, { limit: 5 }).map((b) => ids(b).join()), 'a seeded run repeats');
});

// ---- boardOf ----

test('P6 boardOf: the shown keys read back into a board, in content order', () => {
  assert.deepEqual(keys(boardOf(CP, ['r1', 'w1', 'w2'])), ['w1', 'r1', 'w2']);
  assert.equal(boardOf(CP, ['r1', 'w1', 'nope']), null);
  assert.equal(boardOf(CP, ['r1', 'w1', 'w1']), null);
  assert.equal(boardOf(CP, ['r1', 'w1']), null);
  assert.equal(boardOf(CP, ['r1', 'w1', 'w2', 'w3']), null);
  assert.equal(boardOf(CP, 'r1'), null);
  assert.equal(boardOf(CP, [1, 2, 3]), null);
});

test('P6 boardOf never says how many rights there are: a board of three wrongs is still a board', () => {
  assert.deepEqual(keys(boardOf(CP, ['w1', 'w2', 'w3'])), ['w1', 'w2', 'w3']);
  assert.deepEqual(keys(boardOf(CP, ['r1', 'r2', 'r3'])), ['r1', 'r2', 'r3']);
});

test('boardOf for a sort: item ids read back, the total size checked and never the per-bucket count', () => {
  assert.deepEqual(ids(boardOf(SP, ['a1', 'b1', 'a2', 'b2', 'b3'])), ['a1', 'b1', 'a2', 'b2', 'b3']);
  assert.deepEqual(ids(boardOf(SP, ['a1', 'a2', 'a3', 'a4', 'a5'])), ['a1', 'a2', 'a3', 'a4', 'a5']);
  assert.equal(boardOf(SP, ['a1', 'b1']), null);
  assert.equal(boardOf(SP, ['a1', 'b1', 'a2', 'b2', 'zz']), null);
  assert.equal(boardOf(SP, ['a1', 'a1', 'a2', 'b2', 'b3']), null);
});

test('boardOf: a step with no draw has no board', () => {
  const { draw: _draw, ...fixed } = cp();
  assert.equal(boardOf(fixed, ['r1', 'w1', 'w2']), null);
  assert.equal(boardOf(null, []), null);
});

test('shownOf: the keys a board shows, for a choice and the item ids for a sort', () => {
  assert.deepEqual(shownOf(drawChoiceBoard(CP, IDENT)), ['w1', 'r1', 'w2']);
  assert.deepEqual(shownOf(drawSortBoard(SP, IDENT)), ['a1', 'b1', 'a2', 'b2', 'b3']);
});
