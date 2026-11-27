// #518: a wrong Spot Check must not reveal the answer through the whyNot list. Select every line and Check on
// every live Spot board (from the registry, so a new board is covered): no whyNot is shown, so the lines
// cannot be told apart. A focused wrong pick still gets its whyNots, and the penalty is one per distinct wrong Check.
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

function board(spec) {
  const dom = makeDom();
  const counts = { mistakes: 0 };
  const ctx = {
    ovBody: dom.body,
    ovActions: dom.actions,
    escapeHtml,
    signal: new AbortController().signal,
    shuffle: (a) => [...a],
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

test('select all then Check on every live Spot board shows no whyNot, so the answer cannot be read off', async () => {
  const specs = await allSpotSpecs();
  assert.ok(specs.length >= 10, 'the registry has the live boards');
  for (const spec of specs) {
    const b = board(spec);
    b.pick(spec.lines.map((l) => l.id));
    b.check();
    const text = b.feedback();
    for (const [id, why] of Object.entries(spec.whyNot ?? {})) {
      assert.ok(!text.includes(plain(why)), `${spec.id}: whyNot of ${id} is shown on a select-all Check`);
    }
    assert.match(text, new RegExp(`^Not quite\\. ${spec.lines.length - spec.faults.length} of your picks do not match the question\\.`), spec.id);
    assert.equal(b.counts.mistakes, 1, `${spec.id}: one mistake`);
  }
});

test('a single wrong pick still shows its whyNot on every live board that has one', async () => {
  for (const spec of await allSpotSpecs()) {
    for (const [id, why] of Object.entries(spec.whyNot ?? {})) {
      const b = board(spec);
      b.pick([id]);
      b.check();
      assert.ok(b.feedback().includes(plain(why)), `${spec.id}: whyNot of ${id}`);
    }
  }
});

test('a focused wrong pair on a board with several faults still shows both whyNots', async () => {
  let seen = 0;
  for (const spec of await allSpotSpecs()) {
    const ids = Object.keys(spec.whyNot ?? {});
    if (spec.faults.length < 2 || ids.length < 2) continue;
    const b = board(spec);
    b.pick(ids.slice(0, 2));
    b.check();
    for (const id of ids.slice(0, 2)) assert.ok(b.feedback().includes(plain(spec.whyNot[id])), `${spec.id}: ${id}`);
    seen += 1;
  }
  assert.ok(seen >= 8, 'most boards have a pair to try');
});

test('a broad wrong Check costs one mistake, and the same selection again is free', async () => {
  const [spec] = await allSpotSpecs();
  const b = board(spec);
  b.pick(spec.lines.map((l) => l.id));
  b.check();
  assert.equal(b.counts.mistakes, 1);
  assert.equal(q(`[id="${spec.id}-wrong"]`).textContent, '1');
  b.check();
  assert.equal(b.counts.mistakes, 1);
  assert.match(b.feedback(), /already checked/);
  click(`[data-line="${spec.lines[0].id}"]`); // a different broad selection: a second distinct wrong Check
  b.check();
  assert.equal(b.counts.mistakes, 2);
  assert.equal(qa('[data-line]').length, spec.lines.length);
});
