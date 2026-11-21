// What a pooled step's content must hold on EVERY board (#390, docs/CONTENT.md section 10). A pooled step shows a
// different board each time, so a line that only reads right beside its siblings, or an intro that quotes one answer,
// is wrong on some boards. The checks run on the live pooled steps and on the pooled fixtures, with a bad fixture for
// each check to prove it can fail. C1 to C5 and C8 are hard checks; the tell finders C6 and C7 are advisory: they fail
// nothing and print their report only when TELLS=1 is set (docs/CONTENT.md section 10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveRegistry } from '../app.mjs';
import { choiceBoards, sortBoards } from '../lib/pool.mjs';
import { scoreStars } from '../lib/scoring.mjs';
import { STEP_TYPES } from '../lib/play.mjs';
import { FIFTY_MIN } from '../lib/widgets/choice.mjs';
import { validateSortSpec } from '../lib/widgets/sort-it.mjs';
import { validateSortHelps } from '../lib/widgets/sort-it-help.mjs';
import { cp, fiftyPool, poolFixture, sp } from './fixtures/pool-fixtures.mjs';

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

const CHECKS = {
  'C1 boards': boardProblems,
  'C2 position': positionProblems,
  'C3 quotes': quoteProblems,
  'C4 labels': labelProblems,
  'C5 cross-quotes': crossQuoteProblems,
  'C8 marking word': markingWordProblems,
};

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
  'C8 marking word': withChoice((pool) => { for (const c of pool.choices) if (c.right) c.label = `${c.label} golden`; }),
};
/** What a check's report must name for its bad fixture, where the fault is one planted thing (any report line otherwise). */
const NAMES = { 'C8 marking word': (m) => m.includes('"golden"') };

for (const [name, check] of Object.entries(CHECKS)) {
  test(`${name}: every live pooled step passes, and so does the fixture`, () => {
    for (const p of live) assert.deepEqual(check(p), [], `${p.level} ${p.id}`);
    assert.ok(good.length >= 2, 'the fixture holds pooled steps');
    for (const p of good) assert.deepEqual(check(p), [], p.id);
  });
  test(`${name}: has teeth, a pool with the fault is reported`, () => {
    assert.ok(BAD[name].length > 0, 'the bad fixture is there');
    for (const p of BAD[name]) assert.ok(check(p).some(NAMES[name] ?? (() => true)), `${name} missed its fault`);
  });
}

// ---- C6: a generative tell finder over the labels of a pooled choice (advisory) ----
// Hand-fixing one wording tell at a time moves it somewhere else, so this searches them all: every word and two-word phrase that
// two or more labels share, every final word two or more labels share, and every punctuation mark. For each feature it scores
// "pick a label that has it" and "pick a label that has not" over every board (ties split evenly, a board with no candidate is
// chance) and reports a score further than TELL_BAND from 1 / draw, the same band as test/choice-tells.test.mjs T2. It fails
// nothing: a pool exists so a replay cannot be clicked through, and removing every wording pattern is not a goal (owner
// decision 2026-11-21). The one wording tell that fails the suite is C8 below.
const TELL_BAND = 0.15;
const MARKS = [',', ':', ';', '%', '(', ')', "'", '/', '-', '.', '?', '&'];
/** Function words a label may use freely: they carry no meaning, so they are neither features nor part of a two-word phrase. */
const FUNCTION_WORDS = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'to', 'by', 'as', 'it', 'that', 'with', 'is', 'for', 'at', 'and']);
/** A word with a plural -s folded away, so "error" and "errors" are one feature. */
const fold = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
/** The lower-case words of a label with tags stripped, function words dropped and plurals folded. */
const wordsOf = (label) => (plain(label).toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !FUNCTION_WORDS.has(w)).map(fold);
/**
 * C8 (hard): no word, plurals folded and function words skipped, is on every right answer and on no wrong one. Every board shows
 * one right answer, so such a word picks it on every board: the one wording tell a player meets each time, whatever is drawn.
 */
function markingWordProblems(p) {
  if (p.kind !== 'choice') return [];
  const words = (c) => new Set(wordsOf(c.label));
  const rights = p.spec.choices.filter((c) => c.right).map(words);
  const wrongs = p.spec.choices.filter((c) => !c.right).map(words);
  return [...rights[0]]
    .filter((w) => rights.every((r) => r.has(w)) && !wrongs.some((s) => s.has(w)))
    .map((w) => `${p.id}: the word "${w}" is on every right answer and on no wrong one`);
}
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
function tellScores(spec, step) {
  const data = indexedBoards(spec);
  const out = [];
  const features = [...tellFeatures(spec.choices.map((c) => c.label)), CAPITAL_TERM];
  for (const f of features) {
    const match = spec.choices.map((c) => f.has(c.label));
    for (const want of [true, false]) out.push({ name: `${want ? 'pick' : 'skip'} ${f.name}`, score: maskScore(data, match, want) });
  }
  return [...out, ...(step ? introOverlapScores(spec, step, data) : [])];
}
/** A label with a capitalised term after its first word (ClusterRole, Kubernetes, SDK, OTEL_RESOURCE_ATTRIBUTES): a shape the words alone do not show. */
const CAPITAL_TERM = { name: 'a capitalised term', has: (l) => /\s\S*[A-Z]/.test(plain(l)) };
/**
 * "Pick the label that shares the most words with the step's intro and question" and "skip it": an answer that restates the screen is a
 * tell when the rights do it more than the wrongs. Per board; a board where no label shares a word, or all share the same number, is chance.
 */
function introOverlapScores(spec, step, { boards, right }) {
  const text = new Set(wordsOf([step.intro, step.show, step.question].filter((t) => typeof t === 'string').join(' ')));
  const shared = spec.choices.map((c) => [...new Set(wordsOf(c.label))].filter((w) => text.has(w)).length);
  const sums = { pick: 0, skip: 0 };
  for (const board of boards) {
    const top = Math.max(...board.map((i) => shared[i]));
    for (const [name, want] of [['pick', true], ['skip', false]]) {
      const chosen = board.filter((i) => (shared[i] === top) === want);
      sums[name] += top === 0 || chosen.length === 0 ? 1 / board.length : chosen.filter((i) => right[i]).length / chosen.length;
    }
  }
  return ['pick', 'skip'].map((name) => ({ name: `${name} the label sharing the most words with the intro and question`, score: sums[name] / boards.length }));
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
const byTell = (spec, step) => furthest(spec, tellScores(spec, step));
const byPair = (spec) => furthest(spec, pairScores(spec));
const report = (p, s) => `${p.id}: ${s.name} scores ${s.score.toFixed(3)} against chance ${(1 / p.spec.draw).toFixed(3)}`;
/** C6 single features further than TELL_BAND from chance, as report lines. */
const tellFlags = (p) => byTell(p.spec, p.step).filter((s) => Math.abs(s.score - 1 / p.spec.draw) > TELL_BAND).map((s) => report(p, s));
/** C6 OR-pairs further than PAIR_BAND from chance, as report lines. */
const pairFlags = (p) => byPair(p.spec).filter((s) => Math.abs(s.score - 1 / p.spec.draw) > PAIR_BAND).map((s) => report(p, s));
/** How many features the printed report lists per question. */
const REPORT_TOP = 3;
/**
 * The advisory report of one pooled question (C6 for a choice, C7 for a sort): `top`, its REPORT_TOP strategies furthest from chance
 * (for a sort, furthest above the uninformed guess) as `{name, score}`, and every strategy past its band as report lines, single
 * features in `singles`, OR-pairs in `pairs`, both in `flagged`. It fails nothing; TELLS=1 prints it for every live pool.
 */
function tellReport(p) {
  if (p.kind === 'choice') {
    const top = furthest(p.spec, [...tellScores(p.spec, p.step), ...pairScores(p.spec)]).slice(0, REPORT_TOP);
    const singles = tellFlags(p);
    const pairs = pairFlags(p);
    return { id: p.id, chance: 1 / p.spec.draw, top, singles, pairs, flagged: [...singles, ...pairs] };
  }
  const { chance, scores } = sortTellScores(p.spec);
  const flagged = sortFlags(p, chance, scores);
  const isPair = (m) => m.includes(' or ');
  return { id: p.id, chance, top: scores.slice(0, REPORT_TOP), singles: flagged.filter((m) => !isPair(m)), pairs: flagged.filter(isPair), flagged };
}
/** The report as one printable line per question. */
const reportLine = (p, r) => `${p.kind === 'choice' ? 'C6' : 'C7'} ${p.level ?? ''} ${r.id} (chance ${r.chance.toFixed(3)}, ${r.flagged.length} past the band): ${r.top.map((s) => `${s.name} ${s.score.toFixed(3)}`).join('; ')}`;

test('C6 and C7 are advisory: the report of a pooled question lists its top features, scored and ordered, and TELLS=1 prints every live one', () => {
  for (const p of good) {
    const r = tellReport(p);
    assert.deepEqual(r.flagged, [], `${p.id}: the clean fixture has nothing past the band`);
    assert.equal(r.top.length, REPORT_TOP, p.id);
    for (const s of r.top) assert.ok(typeof s.name === 'string' && Number.isFinite(s.score), `${p.id} ${s.name}`);
    const away = r.top.map((s) => (p.kind === 'choice' ? Math.abs(s.score - r.chance) : s.score));
    assert.deepEqual(away, [...away].sort((a, b) => b - a), `${p.id}: furthest from chance first`);
  }
  if (process.env.TELLS) for (const p of live) console.log(reportLine(p, tellReport(p)));
});

test('C6 finds and scores pairs: a family of words split over the right answers, each word also on one wrong answer, passes every single feature and is reported as a pair', () => {
  // Four rights and thirty-two wrongs, three shown: a word on one right and one wrong is within the single band, two such words are not within the pair band.
  const family = () => {
    const pool = { id: 'cf4', draw: 3, choices: [] };
    for (let i = 0; i < 4; i++) pool.choices.push({ key: `r${i}`, label: `Answer r${i} ${['alpha', 'beta', 'gamma', 'delta'][i]}`, why: `Right ${i}.`, right: true });
    for (let i = 0; i < 32; i++) pool.choices.push({ key: `w${i}`, label: `Answer w${i}${i < 4 ? ` ${['alpha', 'beta', 'gamma', 'delta'][i]}` : ''}`, why: `Wrong ${i}.` });
    return pool;
  };
  const spec = family();
  const step = { id: 'cf4', kind: 'choice', spec };
  const r = tellReport(step);
  assert.deepEqual(r.singles, [], 'every single feature passes');
  assert.ok(r.pairs.some((m) => /alpha|beta|gamma|delta/.test(m)), `a pair of the family words is reported: ${byPair(spec).slice(0, 2).map((s) => `${s.name} ${s.score.toFixed(3)}`).join('; ')}`);
});

test('C6 folds plurals and skips function words: a family split over error, errors and failures is reported, and function words alone are not', () => {
  // Four rights say error, errors, failure and failures; each form is also on one wrong answer, so exact-word matching sees four harmless
  // words, while folded they are two features on two rights each.
  const pool = { id: 'cf5', draw: 3, choices: [] };
  const forms = ['error', 'errors', 'failure', 'failures'];
  for (let i = 0; i < 4; i++) pool.choices.push({ key: `r${i}`, label: `Answer r${i} ${forms[i]}`, why: `Right ${i}.`, right: true });
  for (let i = 0; i < 32; i++) pool.choices.push({ key: `w${i}`, label: `Answer w${i}${i < 4 ? ` ${forms[i]}` : ''}`, why: `Wrong ${i}.` });
  const found = tellReport({ id: 'cf5', kind: 'choice', spec: pool }).singles;
  assert.ok(found.some((m) => /"(error|failure)"/.test(m)), `the folded family is reported: ${found.join('; ') || 'nothing'}`);
  // Function words on the rights only are not a feature.
  const plainPool = { id: 'cf6', draw: 3, choices: [] };
  for (let i = 0; i < 4; i++) plainPool.choices.push({ key: `r${i}`, label: `The answer r${i} of that`, why: `Right ${i}.`, right: true });
  for (let i = 0; i < 16; i++) plainPool.choices.push({ key: `w${i}`, label: `Answer w${i}`, why: `Wrong ${i}.` });
  assert.deepEqual(tellReport({ id: 'cf6', kind: 'choice', spec: plainPool }).singles, [],'a, the, of and that are skipped');
});

test('C6 finds and scores: a word on every right answer, a word on every wrong answer and a comma on every right answer are reported', () => {
  const marked = withChoice((pool) => { for (const c of pool.choices) if (c.right) c.label = `${c.label} golden`; });
  const markedReport = tellReport(marked[0]);
  assert.ok(markedReport.singles.some((m) => m.includes('golden')), 'a word on every right answer');
  assert.ok(markedReport.top.some((s) => s.name === 'pick word "golden"' && s.score === 1), `it tops the report at a score of 1: ${markedReport.top.map((s) => s.name).join('; ')}`);
  const wrongMarked = withChoice((pool) => { for (const c of pool.choices) if (!c.right) c.label = `${c.label} golden`; });
  assert.ok(tellReport(wrongMarked[0]).singles.some((m) => m.includes('golden')), 'a word on every wrong answer');
  const skipOnly = withChoice((pool) => { for (const c of pool.choices) if (c.key !== 'r1') c.label = `${c.label} golden`; });
  assert.ok(tellReport(skipOnly[0]).singles.some((m) => m.startsWith('cp: skip word "golden"')), 'a word on every answer but one right one is a tell only when skipped');
  const comma = withChoice((pool) => { for (const c of pool.choices) if (c.right) c.label = `${c.label}, so it holds`; });
  assert.ok(tellReport(comma[0]).singles.some((m) => m.includes('mark ","')), 'a comma on every right answer');
});

test('C6 finds and scores shape and echo: a capitalised term on every right answer, and rights that restate the intro, are reported', () => {
  const capital = withChoice((pool) => { for (const c of pool.choices) if (c.right) c.label = `${c.label} Kubernetes`; });
  assert.ok(tellReport(capital[0]).singles.some((m) => m.includes('a capitalised term')), 'a capitalised term on every right answer');
  const wrongCapital = withChoice((pool) => { for (const c of pool.choices) if (!c.right) c.label = `${c.label} Kubernetes`; });
  assert.ok(tellReport(wrongCapital[0]).singles.some((m) => m.includes('a capitalised term')), 'a capitalised term on every wrong answer');
  const [base] = withChoice(() => {});
  const echo = { ...base, step: { ...base.step, intro: base.spec.choices.filter((c) => c.right).map((c) => c.label).join(' ') } };
  assert.ok(tellReport(echo).singles.some((m) => m.includes('sharing the most words with the intro')), 'an intro that restates the right answers');
  assert.deepEqual(tellReport(base).singles.filter((m) => /capitalised|intro and question/.test(m)), [], 'the plain fixture shows neither');
});

test('C8 reads words as C6 does: a folded plural on every right answer fails, and a word also on one wrong answer, or a function word, does not', () => {
  assert.deepEqual(markingWordProblems(BAD['C8 marking word'][0]), ['cp: the word "golden" is on every right answer and on no wrong one'], 'the bad fixture names its word, and only it');
  const folded = withChoice((pool) => { for (const [i, c] of pool.choices.filter((x) => x.right).entries()) c.label = `${c.label} ${i % 2 ? 'errors' : 'error'}`; });
  assert.ok(markingWordProblems(folded[0]).some((m) => m.includes('"error"')), 'error and errors are one word');
  const shared = withChoice((pool) => { for (const c of pool.choices) if (c.right || c === pool.choices.find((x) => !x.right)) c.label = `${c.label} golden`; });
  assert.deepEqual(markingWordProblems(shared[0]), [], 'a word one wrong answer also has');
  const fn = withChoice((pool) => { for (const c of pool.choices) if (c.right) c.label = `${c.label} for the`; });
  assert.deepEqual(markingWordProblems(fn[0]), [], 'function words are skipped');
});

// ---- C7: a generative tell finder over the labels of a pooled sort (advisory, like C6) ----
// The sort twin of C6. Every feature C6 looks for (a word or two-word phrase that two or more labels share, a final word two or
// more share, a punctuation mark) and code formatting is read as a strategy, "an item with this feature goes in bucket X, every
// other item in bucket Y", for every ordered pair of buckets. Each is scored as the mean share of a board's items it places
// right, over every board the pool can make (lib/pool.mjs sortBoards: all of them up to 5,000, else a seeded sample), and is
// reported when it beats the best uninformed guess (always the bucket a board shows most of) by more than TELL_BAND, the band of
// C6 and of test/choice-tells.test.mjs T2. A rule worse than that guess is no tell: its reverse is also scored, as another pair.
// Beyond one word or mark at a time, it also reads the SHAPE of the identifier inside <code> (an upper-case letter, an underscore, a
// call's "()", a dotted name, a shared dotted prefix, a plain lower-case word), any all-caps word, every length cut ("longer than N
// characters") and every OR of two of all these features. And a strategy is reported when it reaches 5 stars (no mistake, through
// lib/scoring.mjs) on more than PERFECT_SHARE of the boards: a rule that sorts a tenth of the boards perfectly is a way to finish
// the level without the concept, however close to the guess it is on average. The hard form of that share, over the blind rules
// of test/sort-tells.test.mjs, still fails the suite there.
/** The most boards of a pool a blind rule may sort without a mistake, as a share of them. */
const PERFECT_SHARE = 0.1;
/** Boards the pair search reads (pairs are many; a seeded sample of this size stands in for all boards). */
const PAIR_BOARDS = 1000;
const identOf = (label) => String(label).match(/<code>(.*?)<\/code>/)?.[1] ?? '';
const capsWordsOf = (label) => plain(label).split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 2 && /[A-Z]/.test(w) && w === w.toUpperCase());
/** The features of the labels of a sort: those of a choice, code formatting, identifier shape, all-caps words and length cuts. */
function sortFeatures(labels) {
  const out = [...tellFeatures(labels)];
  const has = (re) => (l) => re.test(identOf(l));
  if (labels.some((l) => /<code>/.test(l))) out.push({ name: 'code formatting', has: (l) => /<code>/.test(l) });
  out.push(
    { name: 'identifier with an upper-case letter', has: has(/[A-Z]/) },
    { name: 'identifier with an underscore', has: has(/_/) },
    { name: 'identifier with ()', has: has(/\(\)/) },
    { name: 'dotted identifier', has: has(/\./) },
    { name: 'identifier of one plain lower-case word', has: has(/^[a-z][a-z0-9]*$/) },
  );
  const prefixes = new Map();
  for (const l of labels) {
    const id = identOf(l);
    if (id.includes('.')) prefixes.set(id.split('.')[0], (prefixes.get(id.split('.')[0]) ?? 0) + 1);
  }
  for (const [p, n] of prefixes) if (n >= 2) out.push({ name: `identifier prefix "${p}."`, has: (l) => identOf(l).startsWith(`${p}.`) });
  out.push({ name: 'an all-caps word', has: (l) => capsWordsOf(l).length > 0 });
  const caps = new Map();
  for (const l of labels) for (const w of new Set(capsWordsOf(l))) caps.set(w, (caps.get(w) ?? 0) + 1);
  for (const [w, n] of caps) if (n >= 2) out.push({ name: `all-caps word "${w}"`, has: (l) => capsWordsOf(l).includes(w) });
  const lengths = [...new Set(labels.map((l) => plain(l).length))].sort((a, b) => a - b);
  for (const n of lengths.slice(1)) out.push({ name: `length over ${n - 1}`, has: (l) => plain(l).length >= n });
  return out;
}
const STARS = new Map();
/** The stars a run with `wrong` mistakes earns, through the real scorer (memoised). */
function starsFor(wrong) {
  if (!STARS.has(wrong)) STARS.set(wrong, scoreStars({ mistakes: wrong, hintsUsed: 0, elapsedMs: 0 }, { scored: true, scoring: { parMs: null } }));
  return STARS.get(wrong);
}
/** Every strategy's mean accuracy and share of boards sorted for 5 stars, and the uninformed guess's: `{chance, scores: [{name, score, perfect}]}`. */
function sortTellScores(spec) {
  const ids = spec.buckets.map((b) => b.id);
  const shown = Object.values(spec.draw);
  const chance = Math.max(...shown) / shown.reduce((a, b) => a + b, 0);
  const at = new Map(spec.items.map((it, i) => [it, i]));
  const prep = (boards) => boards.map((b) => ({ idx: b.items.map((it) => at.get(it)) }));
  const want = spec.items.map((it) => ids.indexOf(it.bucket));
  const features = sortFeatures(spec.items.map((i) => i.label)).map((f) => ({ name: f.name, h: spec.items.map((it) => (f.has(it.label) ? 1 : 0)) }));
  const run = (h, yes, no, boards) => {
    const ok = h.map((v, i) => ((v ? yes : no) === want[i] ? 1 : 0));
    let total = 0;
    let perfect = 0;
    for (const b of boards) {
      let right = 0;
      for (const i of b.idx) right += ok[i];
      total += right / b.idx.length;
      if (starsFor(b.idx.length - right) === 5) perfect++;
    }
    return { score: total / boards.length, perfect: perfect / boards.length };
  };
  const all = prep(sortBoards(spec));
  const some = prep(sortBoards(spec, { limit: PAIR_BOARDS }));
  const scores = [];
  for (let yes = 0; yes < ids.length; yes++) {
    for (let no = 0; no < ids.length; no++) {
      if (yes === no) continue;
      for (const [a, f] of features.entries()) {
        scores.push({ name: `${f.name} means ${ids[yes]}, any other ${ids[no]}`, ...run(f.h, yes, no, all) });
        for (const g of features.slice(a + 1)) scores.push({ name: `${f.name} or ${g.name} means ${ids[yes]}, any other ${ids[no]}`, ...run(f.h.map((v, i) => v | g.h[i]), yes, no, some) });
      }
    }
  }
  return { chance, scores: scores.sort((a, b) => b.score - a.score) };
}
/**
 * A pair is the best of thousands of ORs chosen after the fact, so its mean may sit further above the guess than a single feature's
 * (the best of a few dozen) before it says anything; the share of boards sorted for 5 stars has the same limit for both. C6 and C7
 * share one PAIR_BAND (declared above), as both read the best of many ORs.
 */
function sortFlags(p, chance, scores) {
  return scores
    .filter((s) => s.score - chance > (s.name.includes(' or ') ? PAIR_BAND : TELL_BAND) || s.perfect > PERFECT_SHARE)
    .map((s) => `${p.id}: ${s.name} scores ${s.score.toFixed(3)} against the uninformed guess ${chance.toFixed(3)} and sorts ${(100 * s.perfect).toFixed(1)}% of the boards for 5 stars`);
}
const withSort = (edit) => {
  const pool = sp();
  edit(pool);
  return pooledSteps(poolFixture({ sort: pool }).play).filter((p) => p.id === 'sp');
};
/** Every C7 report line of a sort pool past its band (the test reads the report, which fails nothing by itself). */
const sortTellFlags = (p) => tellReport(p).flagged;

test('C7 finds and scores: a word, a closing word, a two-word phrase, a comma and code formatting that mark one bucket are reported, whichever bucket', () => {
  const word = withSort((pool) => { for (const it of pool.items) if (it.bucket === 'a') it.label = `${it.label} golden`; });
  assert.ok(sortTellFlags(word[0]).some((m) => m.includes('word "golden" means a')), 'a word on every item of one bucket');
  const other = withSort((pool) => { for (const it of pool.items) if (it.bucket === 'b') it.label = `golden ${it.label}`; });
  assert.ok(sortTellFlags(other[0]).some((m) => m.includes('word "golden" means b')), 'a word on every item of the other bucket');
  const last = withSort((pool) => { for (const it of pool.items) it.label = it.bucket === 'a' ? `${it.label} today` : `${it.label} soon`; });
  assert.ok(sortTellFlags(last[0]).some((m) => m.includes('last word "today"')), 'a closing word that differs by bucket');
  const phrase = withSort((pool) => { for (const it of pool.items) if (it.bucket === 'b') it.label = `${it.label} once more`; });
  assert.ok(sortTellFlags(phrase[0]).some((m) => m.includes('phrase "once more" means b')), 'a phrase on every item of one bucket');
  const comma = withSort((pool) => { for (const it of pool.items) if (it.bucket === 'a') it.label = `${it.label}, then more`; });
  assert.ok(sortTellFlags(comma[0]).some((m) => m.includes('mark ","')), 'a comma on every item of one bucket');
  const code = withSort((pool) => { for (const it of pool.items) if (it.bucket === 'b') it.label = `<code>${it.id}</code>`; });
  assert.ok(sortTellFlags(code[0]).some((m) => m.includes('code formatting means b')), 'code formatting on every item of one bucket');
});

test('C7 finds and scores the shape of the identifier, a length cut, an all-caps word and an OR of two features that mark one bucket are reported', () => {
  // Every item has one identifier in code; only the shape tells the buckets apart (the split the level had at 021833f).
  const shape = withSort((pool) => { for (const it of pool.items) it.label = it.bucket === 'b' ? `<code>sort_${it.id}</code> note` : `<code>${it.id}</code> note`; });
  const shapeProblems = sortTellFlags(shape[0]);
  assert.ok(shapeProblems.some((m) => m.includes('identifier with an underscore means b')), 'an underscore in the identifier of one bucket');
  assert.ok(shapeProblems.some((m) => m.includes('identifier of one plain lower-case word means a')), 'a plain word as the identifier of the other');
  const caps = withSort((pool) => { for (const it of pool.items) it.label = it.bucket === 'b' ? `<code>${it.id}</code> SERVER note` : `<code>${it.id}</code> plain note`; });
  assert.ok(sortTellFlags(caps[0]).some((m) => m.includes('all-caps word "SERVER" means b')), 'an all-caps word on every item of one bucket');
  const cut = withSort((pool) => { for (const it of pool.items) if (it.bucket === 'b') it.label = `${it.label} with a few more words`; });
  assert.ok(sortTellFlags(cut[0]).some((m) => m.includes('length over')), 'longer labels in one bucket');
  const either = withSort((pool) => { for (const it of pool.items) if (it.bucket === 'b') it.label = `${it.label} ${Number(it.id.slice(1)) % 2 ? 'golden' : 'silver'}`; });
  const eitherProblems = sortTellFlags(either[0]);
  assert.ok(eitherProblems.some((m) => / or /.test(m) && m.includes('golden') && m.includes('silver') && m.includes('means b')), 'two words that between them cover one bucket');
});

test('C7 is not fooled by a feature every label has, or by one on a mixed set: the clean fixture and a word on half of each bucket pass', () => {
  assert.deepEqual(sortTellFlags(pooledSteps(poolFixture().play).find((p) => p.id === 'sp')), []);
  const mixed = withSort((pool) => { for (const it of pool.items) if (Number(it.id.slice(1)) % 2 === 1) it.label = `${it.label} golden`; });
  assert.deepEqual(sortTellFlags(mixed[0]), []);
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
