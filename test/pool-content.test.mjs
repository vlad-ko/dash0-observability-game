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
const POSITION = new RegExp(
  `\\b(${[
    'the (first|second|third|fourth|fifth|last) (option|answer|choice|item)s?',
    'the other (one|two|three|ones|options|answers|choices|items)',
    'the others',
    '(the )?(rest|remaining) (of the )?(options|answers|choices|items)',
    'both (of the )?others?',
    'both other (options|answers|choices|items)',
    'neither of (the others|these|the two)',
    'of the two',
    '(option|answer|choice|item)s? (above|below)',
  ].join('|')})\\b`,
  'i',
);
/** A label this long (plain characters) is quotable: an intro that repeats it hands that answer to the player. */
const QUOTABLE = 12;
/** Boards of a sort pool the board check samples. */
const SORT_SAMPLE = 200;

/** The pooled steps of `play` as `{id, kind, spec, step}`: a choice or a sort that states `draw`. */
function pooledSteps(play) {
  return (play?.steps ?? []).flatMap((step) =>
    ['choice', 'sort'].filter((kind) => step[kind]?.draw !== undefined).map((kind) => ({ id: step[kind].id, kind, spec: step[kind], step, play })),
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
/** The plain, lower-case text of a step's own lines that a player reads around the question. */
const stepLines = (step) => [step.intro, step.show, step.question, step.code].filter((t) => typeof t === 'string').map((t) => plain(t).toLowerCase());
/**
 * C3: the step's own text quotes no quotable label, and no other step's text or the finish text quotes a quotable
 * right label: a right answer is on only some boards, so a line that names it is true only on those.
 */
function quoteProblems(p) {
  const around = [...stepLines(p.step), ...(typeof p.spec.hint === 'string' ? [plain(p.spec.hint).toLowerCase()] : [])];
  const labelsIn = (labels, texts) => labels.map(plain).filter((l) => l.length >= QUOTABLE && texts.some((t) => t.includes(l.toLowerCase())));
  const own = labelsIn(poolLabels(p), around).map((l) => `${p.id}: the step's text quotes "${l}"`);
  const rights = (p.kind === 'choice' ? p.spec.choices : p.spec.items).filter((x) => x.right).map((x) => x.label);
  const later = [...p.play.steps.filter((s) => s !== p.step).flatMap(stepLines), ...(typeof p.play.finish === 'string' ? [plain(p.play.finish).toLowerCase()] : [])];
  return [...own, ...labelsIn(rights, later).map((l) => `${p.id}: another step or the finish text quotes the right answer "${l}"`)];
}
/** C5: no pooled why or whyNot quotes another entry's label, which is only on some boards. */
function crossQuoteProblems(p) {
  const entries = p.kind === 'choice' ? p.spec.choices : p.spec.items;
  return entries.flatMap((x) =>
    entries
      .filter((y) => y !== x && plain(y.label).length >= QUOTABLE)
      .filter((y) => [x.why, ...Object.values(x.whyNot ?? {})].filter((t) => typeof t === 'string').some((t) => plain(t).toLowerCase().includes(plain(y.label).toLowerCase())))
      .map((y) => `${p.id}: the why of "${plain(x.label)}" quotes "${plain(y.label)}"`),
  );
}
/** C4: plain labels are unique within the pool. */
function labelProblems(p) {
  const labels = poolLabels(p).map(plain);
  return labels.filter((l, i) => labels.indexOf(l) !== i).map((l) => `${p.id}: label "${l}" appears twice`);
}

const CHECKS = { 'C1 boards': boardProblems, 'C2 position': positionProblems, 'C3 quotes': quoteProblems, 'C4 labels': labelProblems, 'C5 cross-quotes': crossQuoteProblems };

const live = Object.values(liveRegistry().levels).flatMap((l) => pooledSteps(l.play).map((p) => ({ ...p, level: l.id })));
const good = pooledSteps(poolFixture().play);

/** A bad fixture per check: the pooled fixture with one thing wrong. */
const withChoice = (edit) => {
  const pool = cp();
  edit(pool);
  return pooledSteps(poolFixture({ choice: pool }).play).filter((p) => p.id === 'cp');
};
/** The fixture's choice step `cp` with the play edited, so a later step or the finish text can carry the fault. */
const withPlay = (edit) => {
  const level = poolFixture();
  edit(level.play);
  return pooledSteps(level.play).filter((p) => p.id === 'cp');
};
const RIGHT_LABEL = cp().choices.find((c) => c.right).label;
const BAD = {
  'C1 boards': pooledSteps(poolFixture({ fifty: (() => { const f = fiftyPool(); for (const c of f.choices) if (['w1', 'w2', 'w3'].includes(c.key)) c.keep = true; return f; })() }).play).filter((p) => p.id === 'cf'),
  'C2 position': withChoice((pool) => { pool.choices[0].why = 'Unlike the other two options, this one does not hold.'; }),
  'C3 quotes': [
    ...pooledSteps(poolFixture().play).filter((p) => p.id === 'cp').map((p) => ({ ...p, step: { ...p.step, intro: `Think about ${p.spec.choices[0].label} first.` } })),
    ...withPlay((play) => { play.steps[1].question = `Is it ${RIGHT_LABEL}?`; }),
    ...withPlay((play) => { play.finish = `You knew that ${RIGHT_LABEL} holds.`; }),
  ],
  'C4 labels': withChoice((pool) => { pool.choices[1].label = `<b>${pool.choices[0].label}</b>`; }),
  'C5 cross-quotes': withChoice((pool) => { pool.choices[0].why = `Not like ${pool.choices[1].label}.`; }),
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

// ---- C6: a generative tell finder over the labels of a pooled choice ----
// Hand-fixing one wording tell at a time moves it somewhere else, so this searches them all: every word and two-word phrase that
// two or more labels share, every final word two or more labels share, and every punctuation mark. For each feature it scores
// "pick a label that has it" and "pick a label that has not" over every board (ties split evenly, a board with no candidate is
// chance) and the score must stay within TELL_BAND of 1 / draw, the same band as test/choice-tells.test.mjs T2.
const TELL_BAND = 0.15;
const MARKS = [',', ':', ';', '%', '(', ')', "'", '/', '-', '.', '?', '&'];
/** The lower-case words of a label with tags stripped. */
const wordsOf = (label) => plain(label).toLowerCase().match(/[a-z0-9]+/g) ?? [];
/** The features of `labels` as `{name, has}`: `has(label)` says whether a label carries it. */
function tellFeatures(labels) {
  const count = (get) => {
    const n = new Map();
    for (const l of labels) for (const f of new Set(get(l))) n.set(f, (n.get(f) ?? 0) + 1);
    return [...n].filter(([, c]) => c >= 2).map(([f]) => f);
  };
  const bigrams = (l) => wordsOf(l).slice(1).map((w, i) => `${wordsOf(l)[i]} ${w}`);
  const last = (l) => wordsOf(l).slice(-1);
  return [
    ...count(wordsOf).map((w) => ({ name: `word "${w}"`, has: (l) => wordsOf(l).includes(w) })),
    ...count(bigrams).map((w) => ({ name: `phrase "${w}"`, has: (l) => bigrams(l).includes(w) })),
    ...count(last).map((w) => ({ name: `last word "${w}"`, has: (l) => last(l)[0] === w })),
    ...MARKS.filter((m) => labels.some((l) => plain(l).includes(m))).map((m) => ({ name: `mark "${m}"`, has: (l) => plain(l).includes(m) })),
  ];
}
// A family of words split over the right answers (each word on a different right one, and on a wrong one or two) passes every single
// feature, so C6 also scores the OR of any two words or two-word phrases that two or more labels share ("pick a label that has either"),
// within PAIR_BAND of chance. Pairs whose labels are the same as a single feature's, or all of the labels, are not scored twice.
const PAIR_BAND = 0.25;
/** The board of every showing as label indexes, and which labels are right. */
function indexedBoards(spec) {
  const at = new Map(spec.choices.map((c, i) => [c, i]));
  return { boards: choiceBoards(spec).map((b) => b.choices.map((c) => at.get(c))), right: spec.choices.map((c) => !!c.right) };
}
/** The mean first-try score over every board of picking the labels whose `match` equals `want` (a board no label decides counts as chance). */
function maskScore({ boards, right }, match, want) {
  let sum = 0;
  for (const board of boards) {
    let n = 0;
    let r = 0;
    for (const i of board) if (match[i] === want) { n++; if (right[i]) r++; }
    sum += n === 0 ? 1 / board.length : r / n;
  }
  return sum / boards.length;
}
/** Every feature's two blind strategies over every board of a pooled choice: `{name, score}`; a board no label can decide counts as chance. */
function tellScores(spec) {
  const data = indexedBoards(spec);
  const out = [];
  for (const f of tellFeatures(spec.choices.map((c) => c.label))) {
    const match = spec.choices.map((c) => f.has(c.label));
    for (const want of [true, false]) out.push({ name: `${want ? 'pick' : 'skip'} ${f.name}`, score: maskScore(data, match, want) });
  }
  return out;
}
/** The OR-pairs of words and two-word phrases shared by two or more labels, as `{name, score}` for "pick a label with either" and "skip them". */
function pairScores(spec) {
  const labels = spec.choices.map((c) => c.label);
  const feats = tellFeatures(labels).filter((f) => f.name.startsWith('word ') || f.name.startsWith('phrase '));
  const masks = feats.map((f) => labels.map((l) => f.has(l)));
  const singles = new Set([...masks, ...tellFeatures(labels).map((f) => labels.map((l) => f.has(l)))].map((m) => m.join()));
  const data = indexedBoards(spec);
  const seen = new Set(singles);
  const out = [];
  for (let i = 0; i < feats.length; i++) {
    for (let j = i + 1; j < feats.length; j++) {
      const match = masks[i].map((v, k) => v || masks[j][k]);
      const key = match.join();
      if (seen.has(key) || match.every(Boolean)) continue;
      seen.add(key);
      for (const want of [true, false]) out.push({ name: `${want ? 'pick' : 'skip'} ${feats[i].name} or ${feats[j].name}`, score: maskScore(data, match, want), pair: true });
    }
  }
  return out;
}
/** The scores furthest from chance first. */
const furthest = (spec, scores) => scores.sort((a, b) => Math.abs(b.score - 1 / spec.draw) - Math.abs(a.score - 1 / spec.draw));
const byTell = (spec) => furthest(spec, tellScores(spec));
const byPair = (spec) => furthest(spec, pairScores(spec));
const report = (p, s) => `${p.id}: ${s.name} scores ${s.score.toFixed(3)} against chance ${(1 / p.spec.draw).toFixed(3)}`;
const tellProblems = (p) => (p.kind !== 'choice' ? [] : byTell(p.spec).filter((s) => Math.abs(s.score - 1 / p.spec.draw) > TELL_BAND).map((s) => report(p, s)));
const pairProblems = (p) => (p.kind !== 'choice' ? [] : byPair(p.spec).filter((s) => Math.abs(s.score - 1 / p.spec.draw) > PAIR_BAND).map((s) => report(p, s)));

test('C6 no word, phrase, ending or punctuation mark of a pooled choice picks the right answer far from chance, either way', () => {
  for (const p of live) assert.deepEqual(tellProblems(p), [], `${p.level} ${p.id}`);
  for (const p of good) assert.deepEqual(tellProblems(p), [], p.id);
  if (process.env.TELLS) for (const p of live.filter((x) => x.kind === 'choice')) console.log('C6', p.id, byTell(p.spec).slice(0, 5).map((s) => `${s.name} ${s.score.toFixed(3)}`).join('; '));
});

test('C6 no pair of words or phrases (pick a label with either) picks the right answer far from chance, either way', () => {
  for (const p of live) assert.deepEqual(pairProblems(p), [], `${p.level} ${p.id}`);
  for (const p of good) assert.deepEqual(pairProblems(p), [], p.id);
  if (process.env.TELLS) for (const p of live.filter((x) => x.kind === 'choice')) console.log('C6 pairs', p.id, byPair(p.spec).slice(0, 3).map((s) => `${s.name} ${s.score.toFixed(3)}`).join('; '));
});

test('C6 pairs have teeth: a family of words split over the right answers, each word also on one wrong answer, passes every single feature and fails the pair', () => {
  // Four rights and thirty-two wrongs, three shown: a word on one right and one wrong is within the single band, two such words are not within the pair band.
  const family = () => {
    const pool = { id: 'cf4', draw: 3, choices: [] };
    for (let i = 0; i < 4; i++) pool.choices.push({ key: `r${i}`, label: `Answer r${i} ${['alpha', 'beta', 'gamma', 'delta'][i]}`, why: `Right ${i}.`, right: true });
    for (let i = 0; i < 32; i++) pool.choices.push({ key: `w${i}`, label: `Answer w${i}${i < 4 ? ` ${['alpha', 'beta', 'gamma', 'delta'][i]}` : ''}`, why: `Wrong ${i}.` });
    return pool;
  };
  const spec = family();
  const step = { id: 'cf4', kind: 'choice', spec };
  assert.deepEqual(tellProblems(step), [], 'every single feature passes');
  assert.ok(pairProblems(step).some((m) => /alpha|beta|gamma|delta/.test(m)), `a pair of the family words is reported: ${byPair(spec).slice(0, 2).map((s) => `${s.name} ${s.score.toFixed(3)}`).join('; ')}`);
});

test('C6 has teeth: a word on every right answer, a word on every wrong answer and a comma on every right answer are reported', () => {
  const marked = withChoice((pool) => { for (const c of pool.choices) if (c.right) c.label = `${c.label} golden`; });
  assert.ok(tellProblems(marked[0]).some((m) => m.includes('golden')), 'a word on every right answer');
  const wrongMarked = withChoice((pool) => { for (const c of pool.choices) if (!c.right) c.label = `${c.label} golden`; });
  assert.ok(tellProblems(wrongMarked[0]).some((m) => m.includes('golden')), 'a word on every wrong answer');
  const skipOnly = withChoice((pool) => { for (const c of pool.choices) if (c.key !== 'r1') c.label = `${c.label} golden`; });
  assert.ok(tellProblems(skipOnly[0]).some((m) => m.startsWith('cp: skip word "golden"')), 'a word on every answer but one right one is a tell only when skipped');
  const comma = withChoice((pool) => { for (const c of pool.choices) if (c.right) c.label = `${c.label}, so it holds`; });
  assert.ok(tellProblems(comma[0]).some((m) => m.includes('mark ","')), 'a comma on every right answer');
});

test('C2 the position rule catches the phrasings it names, in any case, and leaves ordinary text alone', () => {
  const caught = [
    'Unlike the other two options, it holds.', 'Both of the others fail.', 'Neither of the others holds.', 'See the options above.', 'It is the LAST answer.',
    'Unlike the others, it holds.', 'It is the other one that fails.', 'The rest of the options fail.', 'The remaining answers fail.', 'It is one of the two.',
    'Neither of these holds.', 'See the options below.', 'Both other answers fail.', 'It is the fourth option.',
  ];
  for (const text of caught) assert.ok(POSITION.test(text), text);
  for (const text of ['A trace holds timing.', 'Other signals do not.', 'The last span ends the trace.', 'The other service is idle.', 'Two of the spans are slow.']) {
    assert.equal(POSITION.test(text), false, text);
  }
});
