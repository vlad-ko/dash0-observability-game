// What a pooled step's content must hold on EVERY board (#390, docs/CONTENT.md section 10). A pooled step shows a
// different board each time, so a line that only reads right beside its siblings, or an intro that quotes one answer,
// is wrong on some boards. The checks run on the live pooled steps (none until content adopts a pool) and on the
// pooled fixtures, with a bad fixture for each check to prove it can fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveRegistry } from '../app.mjs';
import { choiceBoards, sortBoards } from '../lib/pool.mjs';
import { STEP_TYPES } from '../lib/play.mjs';
import { FIFTY_MIN } from '../lib/widgets/choice.mjs';
import { validateSortSpec } from '../lib/widgets/sort-it.mjs';
import { validateSortHelps } from '../lib/widgets/sort-it-help.mjs';
import { cp, fiftyPool, poolFixture } from './fixtures/pool-fixtures.mjs';

const plain = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
/** A line that points at a position or at its siblings, which is false on a board with other siblings. */
const POSITION = /\b(the (first|second|third|last) (option|answer|choice|item)|the other (two|three|ones|options|answers|choices)|both (of the )?others|neither of the others|options? above)\b/i;
/** A label this long (plain characters) is quotable: an intro that repeats it hands that answer to the player. */
const QUOTABLE = 12;
/** Boards of a sort pool the board check samples. */
const SORT_SAMPLE = 200;

/** The pooled steps of `play` as `{id, kind, spec, step}`: a choice or a sort that states `draw`. */
function pooledSteps(play) {
  return (play?.steps ?? []).flatMap((step) =>
    ['choice', 'sort'].filter((kind) => step[kind]?.draw !== undefined).map((kind) => ({ id: step[kind].id, kind, spec: step[kind], step })),
  );
}
/** Every line of text a pool's entries carry: labels, whys and whyNots. */
const poolText = ({ kind, spec }) =>
  (kind === 'choice' ? spec.choices : spec.items).flatMap((x) => [x.label, x.why, ...Object.values(x.whyNot ?? {})]).filter((t) => typeof t === 'string');
const poolLabels = ({ kind, spec }) => (kind === 'choice' ? spec.choices : spec.items).map((x) => x.label);

/** C1: every board is a valid ordinary step, and a board that offers the 50/50 has two wrong answers it may remove. */
function boardProblems(p) {
  const out = [];
  if (p.kind === 'choice') {
    for (const board of choiceBoards(p.spec)) {
      const keys = board.choices.map((c) => c.key).join();
      for (const problem of STEP_TYPES.choice.validate(board)) out.push(`${p.id} [${keys}]: ${problem}`);
      if (p.spec.draw >= FIFTY_MIN && board.choices.filter((c) => !c.right && !c.keep).length < 2) out.push(`${p.id} [${keys}]: fewer than two wrong answers the 50/50 may remove`);
    }
  } else {
    for (const board of sortBoards(p.spec, { limit: SORT_SAMPLE })) {
      for (const problem of [...validateSortSpec(board), ...validateSortHelps(board)]) out.push(`${p.id} [${board.items.map((i) => i.id).join()}]: ${problem}`);
    }
  }
  return out;
}
/** C2: no line points at a position or at its siblings. */
const positionProblems = (p) => poolText(p).filter((t) => POSITION.test(plain(t))).map((t) => `${p.id}: "${plain(t)}" refers to its siblings`);
/** C3: the step's own text quotes no quotable label. */
function quoteProblems(p) {
  const around = [p.step.intro, p.step.show, p.step.question, p.step.code, p.spec.hint].filter((t) => typeof t === 'string').map((t) => plain(t).toLowerCase());
  return poolLabels(p).map(plain).filter((l) => l.length >= QUOTABLE && around.some((t) => t.includes(l.toLowerCase()))).map((l) => `${p.id}: the step's text quotes "${l}"`);
}
/** C4: plain labels are unique within the pool. */
function labelProblems(p) {
  const labels = poolLabels(p).map(plain);
  return labels.filter((l, i) => labels.indexOf(l) !== i).map((l) => `${p.id}: label "${l}" appears twice`);
}

const CHECKS = { 'C1 boards': boardProblems, 'C2 position': positionProblems, 'C3 quotes': quoteProblems, 'C4 labels': labelProblems };

const live = Object.values(liveRegistry().levels).flatMap((l) => pooledSteps(l.play).map((p) => ({ ...p, level: l.id })));
const good = pooledSteps(poolFixture().play);

/** A bad fixture per check: the pooled fixture with one thing wrong. */
const withChoice = (edit) => {
  const pool = cp();
  edit(pool);
  return pooledSteps(poolFixture({ choice: pool }).play).filter((p) => p.id === 'cp');
};
const BAD = {
  'C1 boards': pooledSteps(poolFixture({ fifty: (() => { const f = fiftyPool(); for (const c of f.choices) if (['w1', 'w2', 'w3'].includes(c.key)) c.keep = true; return f; })() }).play).filter((p) => p.id === 'cf'),
  'C2 position': withChoice((pool) => { pool.choices[0].why = 'Unlike the other two options, this one does not hold.'; }),
  'C3 quotes': pooledSteps(poolFixture().play).filter((p) => p.id === 'cp').map((p) => ({ ...p, step: { ...p.step, intro: `Think about ${p.spec.choices[0].label} first.` } })),
  'C4 labels': withChoice((pool) => { pool.choices[1].label = `<b>${pool.choices[0].label}</b>`; }),
};

for (const [name, check] of Object.entries(CHECKS)) {
  test(`${name}: every live pooled step passes, and so does the fixture`, () => {
    for (const p of live) assert.deepEqual(check(p), [], `${p.level} ${p.id}`);
    assert.ok(good.length >= 2, 'the fixture holds pooled steps');
    for (const p of good) assert.deepEqual(check(p), [], p.id);
  });
  test(`${name}: has teeth, a pool with the fault is reported`, () => {
    assert.ok(BAD[name].length > 0, 'the bad fixture is there');
    for (const p of BAD[name]) assert.ok(check(p).length > 0, `${name} missed its fault`);
  });
}

test('C2 the position rule catches the phrasings it names, in any case, and leaves ordinary text alone', () => {
  for (const text of ['Unlike the other two options, it holds.', 'Both of the others fail.', 'Neither of the others holds.', 'See the options above.', 'It is the LAST answer.']) {
    assert.ok(POSITION.test(text), text);
  }
  for (const text of ['A trace holds timing.', 'Other signals do not.', 'The last span ends the trace.']) assert.equal(POSITION.test(text), false, text);
});
