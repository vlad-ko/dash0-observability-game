// Blind strategies must not pick the right answer of a multiple-choice question much more often
// than chance (the choice twin of test/sort-tells.test.mjs). Each rule ignores what the options
// mean and uses only how they look: the longest, the shortest, the one without a "so ..." or
// "because ..." tail. Questions come from the live registry and from the answer tables the
// hand-written levels export in CONTENT, so a level that passes its options to choiceHtml from a
// module-level array is covered too.
//
// An answer pool (#390) is a question with a `draw`: it lists more answers than one showing uses, so a rule is scored
// over every board the pool can make (lib/pool.mjs choiceBoards), each board equally likely, and chance is 1 over the
// number of answers shown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveRegistry } from '../app.mjs';
import { ACTS } from '../levels/index.mjs';
import { choiceBoards } from '../lib/pool.mjs';
import { runPlay, validatePlay } from '../lib/play.mjs';
import { buildRegistry } from '../lib/registry.mjs';
import { FIXTURE_CARD } from './fixtures/fixture-level.mjs';
import { cp, fiftyPool, pick, poolFixture } from './fixtures/pool-fixtures.mjs';

const plain = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ');
const isLabelled = (v) => Array.isArray(v) && v.length >= 2 && v.every((c) => c && typeof c === 'object' && typeof c.label === 'string');
const isQuestion = (v) => isLabelled(v) && v.filter((c) => c.right).length === 1;
/** A pooled question: labelled options, at least one right, and the whole number of them one showing draws. */
const isPool = (v, o) => isLabelled(v) && Number.isInteger(o.draw) && v.some((c) => c.right);

/**
 * Every choice question as { level, choices } (a pool also has `draw`): any array of labelled options with exactly one
 * right one, or a pool. `fixtures` (built registry levels) are read as well, after the live ones.
 */
async function allQuestions(fixtures = []) {
  const out = [];
  const seen = new Set();
  const read = (id, roots) => {
    const walk = (o) => {
      if (!o || typeof o !== 'object' || seen.has(o)) return;
      seen.add(o);
      for (const [k, v] of Object.entries(o)) {
        const pool = k === 'choices' && isPool(v, o);
        if (k === 'choices' && (isQuestion(v) || pool)) {
          const key = `${id}|${v.map((c) => c.label).join('|')}`; // the registry holds frozen copies of CONTENT
          if (!seen.has(key)) out.push({ level: id, choices: v, ...(pool ? { draw: o.draw } : {}) });
          seen.add(key);
        }
        else walk(v);
      }
    };
    for (const root of roots) walk(root);
  };
  for (const act of ACTS) {
    for (const level of [...act.levels, ...(act.boss ? [act.boss] : [])]) {
      const mod = await import(`../levels/${level.id}.mjs`);
      read(level.id, [mod.CONTENT, mod.default.play]);
    }
  }
  for (const level of fixtures) read(level.id, [level.play]);
  return out;
}

/** The registry levels of the pooled fixture level. */
const fixtureLevels = (levelOpts) =>
  Object.values(
    buildRegistry([{ id: 'a', no: 0, levels: [poolFixture(levelOpts)], boss: null }], { deck: [FIXTURE_CARD], nodeIds: [], play: { validatePlay, runPlay } }).levels,
  );
/** How many answers one showing of `q` shows. */
const shownOf = (q) => q.draw ?? q.choices.length;
/** The boards (lists of choices) one showing of `q` may be, each equally likely: the question itself when it is fixed. */
const boardsOf = (q) => (q.draw === undefined ? [q.choices] : choiceBoards({ draw: q.draw, choices: q.choices }).map((b) => b.choices));

// Code formatting is read off the raw label, before plain() strips the tags.
const CODE = /<code>|`/;
const TAIL = /\bso\b|\b(because|since)\b/i;
const ABSOLUTE = /\b(always|never|only|every|each|all|any|none|nothing|just)\b/i;
const DODGE = /^(it holds|ask first|nowhere|leave it|it does not matter|it cannot|(the answer|it) depends)\b/i;
const maxOf = (labels) => Math.max(...labels.map((x) => x.length));

// Each strategy (given the plain labels, then the raw ones) marks the options it would pick and picks one of them at random (all, when it marks none).
const STRATEGIES = {
  longest: (labels) => labels.map((l) => l.length === maxOf(labels)),
  shortest: (labels) => labels.map((l) => l.length === Math.min(...labels.map((x) => x.length))),
  // The middle length: neither the longest nor the shortest option (a two-option question has none, so every option is marked).
  middle: (labels) => {
    const [lo, hi] = [Math.min(...labels.map((x) => x.length)), maxOf(labels)];
    return labels.map((l) => l.length > lo && l.length < hi);
  },
  // The options whose label has code formatting (<code> or backticks); all of them, when none or all are marked.
  code: (_labels, raw) => raw.map((l) => CODE.test(l)),
  noTail: (labels) => labels.map((l) => !TAIL.test(l)),
  // Skip the options with an absolute word (always, never, only, every, each, all, any, none, nothing, just).
  noAbsolute: (labels) => labels.map((l) => !ABSOLUTE.test(l)),
  // Skip the dodges: options that open by refusing to answer or by backing the claim as it stands.
  noDodge: (labels) => labels.map((l) => !DODGE.test(l)),
  // Skip both the absolutes and the dodges (the audit's rule).
  noAbsoluteNoDodge: (labels) => labels.map((l) => !ABSOLUTE.test(l) && !DODGE.test(l)),
  longestNoTail: (labels) => {
    const ok = labels.map((l) => !TAIL.test(l));
    const pool = ok.some(Boolean) ? ok : ok.map(() => true);
    const top = Math.max(...labels.map((l, i) => (pool[i] ? l.length : -1)));
    return labels.map((l, i) => pool[i] && l.length === top);
  },
};

/** Expected first-try score of a strategy on one board: 1 over the number it marks when the right answer is marked, else 0. */
function boardScore(choices, mark) {
  const labels = choices.map((c) => plain(c.label));
  let m = mark(labels, choices.map((c) => c.label));
  if (!m.some(Boolean)) m = m.map(() => true);
  const right = choices.findIndex((c) => c.right);
  return m[right] ? 1 / m.filter(Boolean).length : 0;
}

/** Expected first-try score of a strategy over the questions; a pool scores the mean over its boards. */
const score = (qs, mark) =>
  qs.reduce((sum, q) => {
    const boards = boardsOf(q);
    return sum + boards.reduce((s, board) => s + boardScore(board, mark), 0) / boards.length;
  }, 0);

const BAND = 3; // points a blind rule may sit above or below chance: a rule far below is the same tell, read backwards
/** How far a rule may stray from chance on ONE pooled question before the advisory T2 report names it, as a share of a question. */
const QUESTION_BAND = 0.15;

/** The strategies whose score over `qs` is further from chance than the band, as report lines. */
function strayed(qs) {
  const chance = qs.reduce((s, q) => s + 1 / shownOf(q), 0);
  return Object.entries(STRATEGIES)
    .map(([name, mark]) => [name, score(qs, mark)])
    .filter(([, got]) => Math.abs(got - chance) > BAND)
    .map(([name, got]) => `${name}: ${got.toFixed(1)} of ${qs.length} first try (chance ${chance.toFixed(1)}, band ${(chance - BAND).toFixed(1)} to ${(chance + BAND).toFixed(1)})`);
}

// The fixed questions and the pooled ones are summed apart, each at BAND: a pool is held to chance in expectation (its own sum),
// and the fixed set cannot hide behind it, nor a pool behind the fixed set.
test('no blind option-shape rule strays from chance by more than a few points over the fixed questions, either way', async () => {
  const all = await allQuestions();
  const qs = all.filter((q) => q.draw === undefined);
  // The floor comes from the registry, so pooling a level never edits it: every declarative choice step without `draw` must be found
  // here (the scan also reads run levels, so it may find more), and the fixed and pooled sets must add up to what was scanned.
  const steps = Object.values(liveRegistry().levels).flatMap((l) => (l.play?.steps ?? []).filter((s) => s.choice));
  const declaredFixed = steps.filter((s) => s.choice.draw === undefined).length;
  assert.ok(declaredFixed > 0, 'the registry has fixed choice steps');
  const declaredPooled = steps.length - declaredFixed;
  assert.ok(qs.length >= declaredFixed, `found ${qs.length} fixed questions, the registry declares ${declaredFixed}`);
  assert.equal(all.length - qs.length, declaredPooled, 'every pooled step is scanned, and nothing else counts as pooled');
  // Run levels keep their questions in code and content, not in `play.steps`; the scan reads them too, and about half must stay found.
  const runLevels = Object.values(liveRegistry().levels).filter((l) => !l.play?.steps).length;
  assert.ok(qs.length - declaredFixed >= Math.floor(runLevels / 2), `found ${qs.length - declaredFixed} run-level questions across ${runLevels} run levels`);
  const chance = qs.reduce((s, q) => s + 1 / shownOf(q), 0);
  if (process.env.TELLS) for (const [name, mark] of Object.entries(STRATEGIES)) console.log(`TELLS fixed ${name} ${score(qs, mark).toFixed(1)} of ${qs.length} (chance ${chance.toFixed(1)})`);
  if (process.env.TELLS) {
    for (const q of qs.filter((x) => x.choices.length === 3)) {
      const lens = q.choices.map((c) => plain(c.label).length);
      const mine = lens[q.choices.findIndex((c) => c.right)];
      if (mine > Math.min(...lens) && mine < Math.max(...lens)) console.log(`TELLS middle-right ${q.level} ${lens.join('/')} ${q.choices.map((c) => `${c.right ? '*' : ''}${plain(c.label)}`).join(' | ')}`);
    }
  }
  assert.deepEqual(strayed(qs), []);
});

test('no blind option-shape rule strays from chance by more than a few points over the pooled questions, in expectation', async () => {
  const qs = (await allQuestions()).filter((q) => q.draw !== undefined);
  assert.ok(qs.length >= 3, `found ${qs.length} pooled questions`);
  const chance = qs.reduce((s, q) => s + 1 / shownOf(q), 0);
  if (process.env.TELLS) for (const [name, mark] of Object.entries(STRATEGIES)) console.log(`TELLS pooled ${name} ${score(qs, mark).toFixed(2)} of ${qs.length} (chance ${chance.toFixed(2)})`);
  assert.deepEqual(strayed(qs), []);
  // The same sum has teeth: ten pools whose right answers are the longest are far outside it.
  assert.ok(strayed(Array.from({ length: 10 }, () => longRights(12))).length > 0);
});

/** The three-option boards of the questions, each as { choices, share }: a fixed question is one board, a pool shares one over its boards. */
const threeOptionBoards = (qs) =>
  qs.filter((q) => shownOf(q) === 3).flatMap((q) => boardsOf(q).map((choices, _i, all) => ({ choices, share: 1 / all.length })));

/** The share of the three-option questions whose right answer is the shortest, the middle and the longest, as { shortest, middle, longest, total }. */
function lengthRanks(qs) {
  const boards = threeOptionBoards(qs);
  const rank = { shortest: 0, middle: 0, longest: 0 };
  for (const { choices, share } of boards) {
    const lens = choices.map((c) => plain(c.label).length);
    const mine = lens[choices.findIndex((c) => c.right)];
    if (mine <= Math.min(...lens)) rank.shortest += share;
    else if (mine >= Math.max(...lens)) rank.longest += share;
    else rank.middle += share;
  }
  return { ...rank, total: boards.reduce((s, b) => s + b.share, 0) };
}

test('the right option is not concentrated at one length rank: shortest, middle and longest each hold at most 45% of the three-option questions', async () => {
  const { total, ...rank } = lengthRanks(await allQuestions());
  if (process.env.TELLS) console.log(`TELLS ranks ${JSON.stringify(rank)} of ${total}`);
  for (const [name, n] of Object.entries(rank)) assert.ok(n <= 0.45 * total, `${name}: ${n.toFixed(2)} of ${total.toFixed(2)} three-option questions`);
});

/** Every incident board's hypotheses, as { level, hypotheses }, from the live registry. */
async function allIncidentBoards() {
  const out = [];
  for (const act of ACTS) {
    for (const level of [...act.levels, ...(act.boss ? [act.boss] : [])]) {
      const mod = await import(`../levels/${level.id}.mjs`);
      const scenarios = (mod.default.play?.steps ?? []).filter((st) => st.incident).map((st) => st.incident);
      if (!scenarios.length && mod.CONTENT?.scenario) scenarios.push(mod.CONTENT.scenario);
      for (const scenario of scenarios) if (scenario?.hypotheses) out.push({ level: level.id, hypotheses: scenario.hypotheses });
    }
  }
  return out;
}

/** Length rank of the right hypothesis: how many labels are strictly longer (0 = the longest). */
const rankFromLongest = (hyps) => {
  const lens = hyps.map((h) => plain(h.label).length);
  return lens.filter((n) => n > lens[hyps.findIndex((h) => h.right)]).length;
};

test('the right incident cause is not concentrated at one length rank: no length rank holds more than the rounded-up chance plus 1 of the incident boards', async () => {
  const boards = await allIncidentBoards();
  assert.ok(boards.length >= 8, `found ${boards.length} incident boards`);
  const ranks = {};
  for (const b of boards) {
    const r = rankFromLongest(b.hypotheses);
    ranks[r] = (ranks[r] ?? 0) + 1;
  }
  const chance = boards.reduce((s, b) => s + 1 / b.hypotheses.length, 0);
  if (process.env.TELLS) console.log(`TELLS incident ranks from longest ${JSON.stringify(ranks)} of ${boards.length} (one rank by chance ${chance.toFixed(1)})`);
  const limit = Math.ceil(chance) + 1; // the band scales with the board count: one rank may hold a board or two more than chance
  for (const [r, n] of Object.entries(ranks)) assert.ok(n <= limit, `rank ${r} from the longest holds the right cause in ${n} of ${boards.length} boards (chance ${chance.toFixed(1)}, limit ${limit})`);
});

test('the scorer has teeth: a question whose right option is the longest and has no tail is caught', () => {
  const qs = [{ choices: [{ label: 'a' }, { label: 'b' }, { label: 'a much longer right option', right: true }] }];
  assert.equal(score(qs, STRATEGIES.longest), 1);
  assert.equal(score(qs, STRATEGIES.longestNoTail), 1);
});

// ---- answer pools (#390) ----

/** A pooled question whose every right answer is `extra` characters longer than every wrong one. */
function longRights(extra) {
  const q = cp();
  for (const c of q.choices) c.label = c.right ? `${c.label}${'x'.repeat(extra)}` : c.label;
  return { level: 'fixture', draw: q.draw, choices: q.choices };
}

test('T1 a pool whose right answers are the longest is caught: the longest rule scores 1 and the band flags it', () => {
  const qs = Array.from({ length: 10 }, () => longRights(12));
  assert.equal(score(qs, STRATEGIES.longest), 10);
  assert.ok(strayed(qs).some((line) => /^longest: 10\.0 of 10 first try/.test(line)), strayed(qs).join('\n'));
});

test('T1 a pool of equal-length answers scores exactly chance on every rule, and a fixed question is unchanged', () => {
  const clean = [{ level: 'fixture', draw: 3, choices: cp().choices }, { level: 'fixture', draw: 4, choices: fiftyPool().choices }];
  for (const [name, mark] of Object.entries(STRATEGIES)) assert.ok(Math.abs(score(clean, mark) - (1 / 3 + 1 / 4)) < 1e-9, name);
  const fixed = [{ choices: [{ label: 'a' }, { label: 'b' }, { label: 'a much longer right option', right: true }] }];
  assert.equal(score(fixed, STRATEGIES.shortest), 0);
});

/** T2 advice: every rule that sits further than QUESTION_BAND from chance on ONE pooled question, as report lines. Fails nothing. */
function questionAdvice(q) {
  const chance = 1 / q.draw;
  return Object.entries(STRATEGIES)
    .map(([name, mark]) => ({ name, got: score([q], mark) }))
    .filter(({ got }) => Math.abs(got - chance) > QUESTION_BAND)
    .map(({ name, got }) => `${q.level} ${name}: ${got.toFixed(2)} against chance ${chance.toFixed(2)}, ${(Math.abs(got - chance) - QUESTION_BAND).toFixed(2)} past the band`);
}

test('T2 is advisory: TELLS=1 prints each live pooled question past 0.15 of chance on a rule, and the report finds a planted case', async () => {
  const pooled = (await allQuestions()).filter((q) => q.draw !== undefined);
  if (process.env.TELLS) for (const q of pooled) for (const line of questionAdvice(q)) console.log(`TELLS T2 ${line}`);
  // The report has teeth: a pool whose right answers are the longest is named, with the rule and the overshoot.
  const planted = questionAdvice(longRights(12));
  assert.ok(planted.some((line) => /^fixture longest: 1\.00 against chance 0\.33, 0\.52 past the band$/.test(line)), planted.join('\n'));
  // A clean pool is not named.
  assert.deepEqual(questionAdvice({ level: 'fixture', draw: 3, choices: cp().choices }), []);
});

test('T3 every pooled step is found as a question: the live registry, and the fixture level', async () => {
  const live = Object.values(liveRegistry().levels).flatMap((l) => (l.play?.steps ?? []).filter((s) => s.choice?.draw !== undefined));
  assert.equal((await allQuestions()).filter((q) => q.draw !== undefined).length, live.length);
  const levels = fixtureLevels();
  const stepCount = levels.flatMap((l) => l.play.steps).filter((s) => s.choice?.draw !== undefined).length;
  assert.equal(stepCount, 2);
  const found = (await allQuestions(levels)).filter((q) => q.level === 'pool-fixture');
  assert.equal(found.length, stepCount);
  assert.ok(found.every((q) => Number.isInteger(q.draw)));
});

test('T4 no pooled question has more boards than the scorer can walk', async () => {
  const pooled = [...(await allQuestions()), ...(await allQuestions(fixtureLevels()))].filter((q) => q.draw !== undefined);
  for (const q of pooled) assert.ok(boardsOf(q).length <= 20000, `${q.level}: ${boardsOf(q).length} boards`);
});

test('a pool counts in the length ranks by shares: a pool whose right answer is always the longest holds a full share at longest', () => {
  const ranks = lengthRanks([longRights(12)]);
  assert.ok(Math.abs(ranks.total - 1) < 1e-9);
  assert.ok(Math.abs(ranks.longest - 1) < 1e-9);
  assert.ok(Math.abs(lengthRanks([{ level: 'fixture', draw: 3, choices: [pick('r', 'one', true), ...Array.from({ length: 5 }, (_, i) => pick(`w${i}`, `w${i}${'y'.repeat(i)}`))] }]).total - 1) < 1e-9);
});
