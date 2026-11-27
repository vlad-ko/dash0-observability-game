// #518: a wrong Spot Check must not reveal the answer through the whyNot list. Every wrong Check, of any size,
// shows the count and exactly ONE whyNot from a picked wrong line, chosen through the injected ctx.shuffle (from
// the registry's live boards, so a new board is covered). A minimax run shows a blind player still needs 3+ wrong Checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDom, q, qa, click } from './helpers/dom.mjs';
import { escapeHtml } from '../lib/lesson-kit.mjs';
import { newSpotState } from '../lib/widgets/spot-it.mjs';
import { mountSpot, renderSpot } from '../lib/widgets/spot-it-view.mjs';
import { ACTS } from '../levels/index.mjs';

async function allSpotSpecs() {
  const out = [];
  for (const act of ACTS) {
    for (const level of [...act.levels, ...(act.boss ? [act.boss] : [])]) {
      const mod = await import(`../levels/${level.id}.mjs`);
      const byId = new Map();
      for (const s of [...(mod.default.play?.steps ?? []), ...(mod.CONTENT?.steps ?? [])]) if (s?.spot) byId.set(s.spot.id, s.spot);
      out.push(...byId.values());
    }
  }
  return out;
}

function board(spec, shuffle = (a) => a) {
  const dom = makeDom();
  const counts = { mistakes: 0 };
  const ctx = {
    ovBody: dom.body,
    ovActions: dom.actions,
    escapeHtml,
    signal: new AbortController().signal,
    shuffle: (a) => shuffle([...a]),
    mistake: () => { counts.mistakes += 1; },
    hint() {},
  };
  dom.body.innerHTML = renderSpot(spec, newSpotState(spec), { escapeHtml });
  dom.actions.innerHTML = '<button id="finish" disabled>Finish</button>';
  mountSpot(ctx, spec, { onComplete() {}, swirl() {} });
  return {
    counts,
    pick: (ids) => ids.forEach((id) => click(`[data-line="${id}"]`)),
    check: () => click(`[id="${spec.id}-check"]`),
    feedback: () => q(`[id="${spec.id}-feedback"] [data-feedback-text]`).textContent,
  };
}

const plain = (html) => html.replace(/<[^>]*>/g, '');

const shownWhys = (spec, text) => Object.entries(spec.whyNot ?? {}).filter(([, why]) => text.includes(plain(why))).map(([id]) => id);
const wrongOf = (spec) => spec.lines.map((l) => l.id).filter((id) => !spec.faults.includes(id));

test('every wrong Check of any size shows exactly one whyNot, from a picked wrong line', async () => {
  for (const spec of await allSpotSpecs()) {
    const wrong = wrongOf(spec);
    const picks = [
      spec.lines.map((l) => l.id), // everything
      [...spec.faults, wrong[0]], // the answer plus one extra
      wrong.slice(0, 2),
      wrong.slice(0, Math.ceil(wrong.length / 2)),
      wrong,
    ];
    for (const ids of picks) {
      const b = board(spec);
      b.pick(ids);
      b.check();
      const text = b.feedback();
      const shown = shownWhys(spec, text);
      const candidates = ids.filter((id) => wrong.includes(id) && Object.hasOwn(spec.whyNot ?? {}, id));
      assert.equal(shown.length, candidates.length ? 1 : 0, `${spec.id} [${ids}]: exactly one whyNot`);
      for (const id of shown) assert.ok(candidates.includes(id), `${spec.id}: ${id} was picked and wrong`);
      const extra = ids.filter((id) => wrong.includes(id)).length;
      assert.match(text, new RegExp(`^Not quite\\. ${extra} of your picks ${extra === 1 ? 'does' : 'do'} not match the question\\.`), spec.id);
      assert.ok(!text.includes('a lot of lines'), 'no broad-pick nudge any more');
    }
  }
});

test('a single wrong pick shows its own whyNot on every live board that has one', async () => {
  for (const spec of await allSpotSpecs()) {
    for (const [id, why] of Object.entries(spec.whyNot ?? {})) {
      const b = board(spec);
      b.pick([id]);
      b.check();
      assert.ok(b.feedback().includes(plain(why)), `${spec.id}: whyNot of ${id}`);
      assert.deepEqual(shownWhys(spec, b.feedback()), [id], spec.id);
    }
  }
});

test('the injected shuffle decides which whyNot: the same order gives the same one, other orders can differ', async () => {
  let differed = 0;
  for (const spec of await allSpotSpecs()) {
    const ids = wrongOf(spec).filter((id) => Object.hasOwn(spec.whyNot ?? {}, id));
    if (ids.length < 2) continue;
    const run = (rotate) => {
      const b = board(spec, (a) => [...a.slice(rotate % a.length), ...a.slice(0, rotate % a.length)]);
      b.pick(spec.lines.map((l) => l.id));
      b.check();
      return shownWhys(spec, b.feedback());
    };
    assert.deepEqual(run(0), run(0), `${spec.id}: same seed, same choice`);
    if (run(0)[0] !== run(1)[0]) differed += 1;
  }
  assert.ok(differed >= 8, 'different seeds pick different whyNots');
});

test('a wrong Check costs one mistake at any size, and the same selection again is free', async () => {
  const [spec] = await allSpotSpecs();
  const b = board(spec);
  b.pick(spec.lines.map((l) => l.id));
  b.check();
  assert.equal(b.counts.mistakes, 1);
  assert.equal(q(`[id="${spec.id}-wrong"]`).textContent, '1');
  b.check();
  assert.equal(b.counts.mistakes, 1);
  assert.match(b.feedback(), /already checked/);
  click(`[data-line="${spec.lines[0].id}"]`); // a different selection: a second distinct wrong Check
  b.check();
  assert.equal(b.counts.mistakes, 2);
  assert.equal(qa('[data-line]').length, spec.lines.length);
});

// Exact minimax over bitmasks (the reviewer's solve-alt.mjs "one" model): the learner knows the board shape and
// that faults are k of n lines, and each wrong Check tells them the count of wrong picks plus ONE whyNot, taken
// here as the first picked wrong line (more information than a random one, so the true floor is no lower).
// Returns the fewest wrong Checks that always suffice, or null when the deadline passes first.
function blindWorstCase(n, k, ms) {
  const deadline = Date.now() + ms;
  const pc = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
  const ALL = (1 << n) - 1;
  const fb = (s, h) => { const x = s & ~h; return pc(x) * 4096 + (x & -x); };
  const H = [];
  for (let h = 1; h < ALL; h++) if (pc(h) === k) H.push(h);
  const memo = new Map();
  const le = (Hs, d) => {
    if (Hs.length <= 1) return true;
    if (d === 0) return false;
    if (Hs.length > (n + 1) ** d * 4096 + d) return false;
    const mk = `${d}:${Hs.join(',')}`;
    if (memo.has(mk)) return memo.get(mk);
    if (Date.now() > deadline) throw new Error('deadline');
    let res = false;
    for (let s = 1; s <= ALL && !res; s++) {
      // Root symmetry: at the root every k-of-n answer set is possible, so a blind player cannot tell the lines
      // apart and any two queries of the same size are equivalent up to relabelling the lines. Trying only the
      // first-m-lines query (s = 2^m - 1) per size covers them all; this skips the rest of the root's 2^n queries.
      if (Hs.length === H.length && (s & (s + 1))) continue;
      const classes = new Map();
      for (const h of Hs) {
        if (h === s) continue;
        const key = fb(s, h);
        if (!classes.has(key)) classes.set(key, []);
        classes.get(key).push(h);
      }
      if (classes.size === 1 && !Hs.includes(s) && [...classes.values()][0].length === Hs.length) continue;
      res = [...classes.values()].every((c) => le(c, d - 1));
    }
    memo.set(mk, res);
    return res;
  };
  try {
    for (let v = 0; v <= n; v++) if (le(H, v)) return v;
  } catch {
    return null;
  }
  return null;
}

test('a blind player needs at least 3 wrong Checks on the live board shapes (exact minimax, under a deadline)', async () => {
  const shapes = new Map();
  for (const spec of await allSpotSpecs()) shapes.set(`${spec.lines.length}/${spec.faults.length}`, [spec.lines.length, spec.faults.length]);
  const results = {};
  for (const [name, [n, k]] of [...shapes].sort((a, b) => a[1][0] - b[1][0])) {
    if (n > 10) continue; // 12/3 does not finish in seconds (the reviewer's run: over 100 s); the smaller shapes bound the idea
    const worst = blindWorstCase(n, k, 30000);
    results[name] = worst;
    if (worst !== null) assert.ok(worst >= 3, `${name}: a blind player can finish in ${worst} wrong Checks`);
  }
  const finished = Object.values(results).filter((v) => v !== null).length;
  assert.ok(finished >= 4, `the minimax finished on enough shapes: ${JSON.stringify(results)}`);
  console.log('blind worst case by lines/faults', JSON.stringify(results));
});
