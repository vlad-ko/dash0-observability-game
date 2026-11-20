// Joining a content file to a level's logic (lib/content/bind.mjs, #391, docs/CONTENT.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindLevel, bindRunLevel, bindText, ContentError } from '../lib/content/bind.mjs';

const DASH = String.fromCharCode(0x2014);

const skeleton = () => ({
  id: 'lv',
  no: '1.1',
  cards: ['card-a'],
  play: {
    prefix: 'p',
    steps: [
      { qid: 'p-q1', choice: { id: 'c1', choices: [{ key: 'a', keep: true }, { key: 'b', right: true }] } },
      { qid: 'p-q2', spot: { id: 's1', target: 'config', helps: { hints: false }, faults: ['l2'] } },
    ],
  },
});

const text = () => ({
  id: 'lv',
  name: 'Level',
  sub: 'Sub',
  rewardTitle: 'Title',
  play: {
    finish: 'You did the thing well.',
    steps: [
      {
        intro: 'Intro {{n}}',
        question: 'Q?',
        choice: { id: 'c1', choices: [{ key: 'b', label: 'Bee {{n}}', why: 'Because.' }, { key: 'a', label: 'Ay', why: 'No.' }, { key: 'c', label: 'Cee', why: 'Never.' }] },
      },
      { intro: 'I2', question: 'Q2', spot: { id: 's1', lines: [{ id: 'l1', text: 'one' }, { id: 'l2', text: 'two' }], whyNot: { l1: 'Not <b>this</b>.' }, explain: 'E' } },
    ],
  },
});

const bind = (t, s = skeleton(), vars = { n: 7 }) => bindText(t, s, { vars });
const only = (r) => {
  assert.deepEqual(r.errors, []);
  return r.value;
};

test('bind: text from the content, answers and wiring from the logic, joined by id', () => {
  const v = only(bind(text()));
  assert.equal(v.name, 'Level');
  assert.equal(v.no, '1.1');
  assert.deepEqual(v.cards, ['card-a']);
  const [s1, s2] = v.play.steps;
  assert.equal(s1.qid, 'p-q1');
  assert.equal(s1.intro, 'Intro 7');
  assert.deepEqual(s1.choice.choices, [
    { key: 'b', right: true, label: 'Bee 7', why: 'Because.' },
    { key: 'a', keep: true, label: 'Ay', why: 'No.' },
    { key: 'c', label: 'Cee', why: 'Never.' },
  ]);
  assert.deepEqual(s2.spot.faults, ['l2']);
  assert.equal(s2.spot.lines.length, 2);
  assert.equal(v.play.finish, 'You did the thing well.');
});

test('bind: array order comes from the content, not the logic', () => {
  const s = skeleton();
  s.play.steps[0].choice.choices.reverse();
  assert.deepEqual(only(bind(text(), s)).play.steps[0].choice.choices.map((c) => c.key), ['b', 'a', 'c']);
});

test('bind: a logic element with no content partner is an error', () => {
  const s = skeleton();
  s.play.steps[0].choice.choices.push({ key: 'zzz', right: false });
  const { errors } = bind(text(), s);
  assert.ok(errors.some((e) => /"zzz" is in the logic and has no text/.test(e)), errors.join('\n'));
});

test('bind: the steps must be the same on both sides, in the same order', () => {
  const swapped = text();
  swapped.play.steps.reverse();
  assert.ok(bind(swapped).errors.some((e) => /steps differ/.test(e)));
  const wrongWidget = text();
  wrongWidget.play.steps[0].choice.id = 'other';
  assert.ok(bind(wrongWidget).errors.some((e) => /steps differ/.test(e)));
  const fewer = text();
  fewer.play.steps.pop();
  assert.ok(bind(fewer).errors.some((e) => /steps differ/.test(e)));
});

test('bind: text in the logic is an error, except inside a fixture subtree', () => {
  const s = skeleton();
  s.play.steps[0].choice.choices[0].label = 'oops';
  s.name = 'oops';
  const errors = bind(text(), s).errors.filter((e) => /text in the logic file/.test(e));
  assert.equal(errors.length, 2);
  assert.ok(errors.some((e) => e.endsWith('play.steps[0].choice.choices[0].label')));
  const ok = skeleton();
  ok.play.steps[1].spot.reference = { text: 'a grader reads this', label: 'x' };
  ok.play.steps[1].spot.given = [{ title: 't' }];
  assert.deepEqual(bind(text(), ok).errors, []);
});

test('bind: content may hold only allowlisted keys, and only strings at the leaves', () => {
  const t = text();
  t.play.steps[0].choice.choices[0].right = true;
  t.play.steps[0].choice.choices[1].count = 3;
  const errors = bind(t).errors;
  assert.ok(errors.some((e) => /choices\[0\]\.right: "right" is not a content key/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /choices\[1\]\.count: "count" is not a content key/.test(e)));
});

test('bind: a number, a boolean or null where text belongs is an error, never coerced', () => {
  for (const bad of [5, true, null]) {
    const t = text();
    t.play.steps[0].question = bad;
    const errors = bind(t).errors;
    assert.ok(errors.some((e) => /question: must be a string/.test(e)), `${bad}: ${errors.join('\n')}`);
  }
  const t = text();
  t.play.steps[0].choice.choices[0].key = 5;
  assert.ok(bind(t).errors.some((e) => /key: must be a string/.test(e)));
});

test('bind: a container that is a string, or text that is an object, is an error', () => {
  const t = text();
  t.play.steps[0].choice.choices = 'nope';
  t.play.steps[1].intro = { a: 1 };
  const errors = bind(t).errors;
  assert.ok(errors.some((e) => /choices: must be an object or an array/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /intro: must be a string/.test(e)));
});

test('bind: two leaves for one key, and an id that disagrees, are errors', () => {
  const t = text();
  t.id = 'other';
  t.play.steps[0].choice.choices[0].key = 'a';
  const errors = bind(t).errors;
  assert.ok(errors.some((e) => /logic says "lv", content says "other"/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /appears twice/.test(e)));
});

test('bind: duplicate identities on either side are errors', () => {
  const t = text();
  t.play.steps[1].spot.lines.push({ id: 'l1', text: 'again' });
  assert.ok(bind(t).errors.some((e) => /"l1" appears twice/.test(e)));
  const s = skeleton();
  s.play.steps[0].choice.choices.push({ key: 'a' });
  assert.ok(bind(text(), s).errors.some((e) => /\(logic\): "a" appears twice/.test(e)));
});

test('bind: an element on both sides with no id or key cannot be joined', () => {
  const s = skeleton();
  s.play.steps[1].spot.lines = [{ nothing: 1 }];
  assert.ok(bind(text(), s).errors.some((e) => /needs an id or a key/.test(e)));
});

test('bind: a value on one side only is taken whole', () => {
  const v = only(bind(text()));
  assert.deepEqual(v.play.steps[1].spot.lines, [{ id: 'l1', text: 'one' }, { id: 'l2', text: 'two' }]);
  assert.deepEqual(v.play.steps[1].spot.whyNot, { l1: 'Not <b>this</b>.' });
});

test('bind: a step is found by its widget key and id together, so a sort step is not a choice step', () => {
  const t = text();
  t.play.steps[0] = { intro: 'I', question: 'Q', sort: { id: 'c1', items: [{ id: 'x', label: 'X' }] } };
  const errors = bind(t).errors;
  assert.ok(errors.some((e) => /the steps differ: logic has \[choice:c1, spot:s1\], content has \[sort:c1, spot:s1\]/.test(e)), errors.join('\n'));
});

test('bind: a container in the content cannot meet a plain value in the logic, and the content never wins', () => {
  const s = skeleton();
  s.play.steps[1].spot.lines = 'not a list';
  const r = bind(text(), s);
  assert.ok(r.errors.some((e) => /spot\.lines: set in both the logic and the content/.test(e)), r.errors.join('\n'));
  assert.notDeepEqual(r.value.play.steps[1].spot.lines, text().play.steps[1].spot.lines);
});

test('bind: finish may hold line breaks, like code; other plain fields may not', () => {
  const t = text();
  t.play.finish = 'First line.\nSecond line.';
  assert.deepEqual(bind(t).errors, []);
  t.name = 'Two\nlines';
  assert.ok(bind(t).errors.some((e) => /name must not contain control characters/.test(e)));
});

test('bind: fill-ins are filled, a missing or unused var is an error, an id holds none', () => {
  assert.ok(bind(text(), skeleton(), {}).errors.some((e) => /\{\{n\}\} has no value/.test(e)));
  assert.ok(bind(text(), skeleton(), { n: 1, spare: 2 }).errors.some((e) => /var "spare" is never used/.test(e)));
  const t = text();
  t.play.steps[0].choice.choices[0].key = '{{n}}';
  assert.ok(bind(t).errors.some((e) => /an id must not hold a fill-in/.test(e)));
});

test('bind: filled text is checked by the text rules for its field', () => {
  const t = text();
  t.play.finish = ' padded ';
  t.play.steps[0].intro = 'see <a href="x">here</a>';
  t.play.steps[0].choice.choices[1].why = `a ${DASH} b`;
  t.play.steps[1].spot.whyNot.l1 = '<script>x</script>';
  t.play.steps[1].spot.lines[0].text = '<a & b>';
  const errors = bind(t).errors;
  assert.ok(errors.some((e) => /finish must not start or end with whitespace/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /intro must not contain the tag <a>/.test(e)));
  assert.ok(errors.some((e) => /why must not contain an em dash/.test(e)));
  assert.ok(errors.some((e) => /whyNot\.l1 must not contain the tag <script>/.test(e)));
  assert.equal(errors.some((e) => /lines\[0\]\.text/.test(e)), false, 'a plain field is not parsed as HTML');
});

test('bind: a value that fills into HTML is checked after the fill', () => {
  const r = bind(text(), skeleton(), { n: '<img src=x>' });
  assert.ok(r.errors.some((e) => /intro must not contain the tag <img>/.test(e)), r.errors.join('\n'));
});

test('bind: reports every problem at once, and bindLevel throws one ContentError with all of them and the level id', () => {
  const t = text();
  t.play.steps[0].question = 3;
  t.play.steps[1].intro = `x ${DASH} y`;
  const s = skeleton();
  s.name = 'oops';
  const found = bind(t, s).errors;
  assert.ok(found.length >= 3, found.join('\n'));
  let thrown;
  try {
    bindLevel(t, s, { vars: { n: 7 } });
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof ContentError);
  assert.equal(thrown.levelId, 'lv');
  assert.deepEqual(thrown.errors, found);
  assert.match(thrown.message, /level lv/);
  for (const e of found) assert.ok(thrown.message.includes(e));
});

test('bind: a logic without a kebab-case id cannot be bound', () => {
  const s = skeleton();
  s.id = 'Bad Id';
  assert.throws(() => bindLevel(text(), s, { vars: { n: 1 } }), ContentError);
});

test('bind: the result shares nothing with the inputs', () => {
  const s = skeleton();
  const t = text();
  const v = only(bind(t, s));
  v.play.steps[0].choice.choices[0].why = 'changed';
  v.play.steps[1].spot.lines[0].text = 'changed';
  v.play.steps[1].spot.faults.push('l1');
  v.cards.push('x');
  assert.equal(t.play.steps[0].choice.choices[0].why, 'Because.');
  assert.equal(t.play.steps[1].spot.lines[0].text, 'one');
  assert.deepEqual(s.play.steps[1].spot.faults, ['l2']);
  assert.deepEqual(s.cards, ['card-a']);
});

test('bind: every string in the result is from the content or from the logic, none invented', () => {
  const t = text();
  let i = 0;
  const marked = (o) => (typeof o === 'string' ? `M${i++}` : Array.isArray(o) ? o.map(marked) : Object.fromEntries(Object.entries(o).map(([k, x]) => [k, k === 'id' || k === 'key' ? x : marked(x)])));
  const m = marked(t);
  const leaves = (o, out = []) => (typeof o === 'string' ? out.push(o) : Array.isArray(o) ? o.forEach((x) => leaves(x, out)) : o && typeof o === 'object' && Object.values(o).forEach((x) => leaves(x, out)), out);
  const built = leaves(only(bindText(m, skeleton(), { vars: {} })));
  const logic = new Set(leaves(skeleton()));
  const markers = leaves(m).filter((x) => /^M\d+$/.test(x));
  assert.ok(markers.length > 10);
  for (const x of markers) assert.ok(built.includes(x), `${x} was dropped`);
  for (const x of built) assert.ok(logic.has(x) || /^M\d+$/.test(x) || leaves(m).includes(x), `${x} appeared from nowhere`);
});

// ---- run(ctx) levels: the free-mode `run` entry, slots and bindRunLevel (#391) ----------------------------

const runSkeleton = () => ({
  id: 'rl',
  no: '1.1',
  cards: [],
  run: { sort: { id: 's', helps: { hints: false }, items: [{ id: 'a', bucket: 'x' }, { id: 'b', bucket: 'y' }] }, picks: [{ key: 'p2', right: true }] },
});
const runText = () => ({
  id: 'rl',
  name: 'Run level',
  sub: 'Sub',
  rewardTitle: 'Runner',
  run: {
    sortIntro: 'Sort {{n}} things.',
    sort: {
      id: 's',
      buckets: [{ id: 'x', label: 'Ex' }, { id: 'y', label: 'Why' }],
      items: [{ id: 'b', label: 'Bee', whyNot: { x: 'Not <b>x</b>.' } }, { id: 'a', label: 'Ay' }],
    },
    picks: [{ key: 'p1', label: 'One', says: 'No.' }, { key: 'p2', label: 'Two', says: 'Yes.' }],
    sentTo: '{{where}} accepted the test span.',
    stories: [['charge', 'payments', 'It failed.']],
  },
});
const bindRun = (t = runText(), s = runSkeleton(), o = { vars: { n: 2 }, slots: ['where'] }) => bindText(t, s, o);

test('run: entries join by id and key, content order wins, stories are taken whole', () => {
  const v = only(bindRun());
  assert.deepEqual(v.run.sort.items, [
    { id: 'b', bucket: 'y', label: 'Bee', whyNot: { x: 'Not <b>x</b>.' } },
    { id: 'a', bucket: 'x', label: 'Ay' },
  ]);
  assert.deepEqual(v.run.sort.helps, { hints: false });
  assert.deepEqual(v.run.picks.map((p) => [p.key, p.right, p.says]), [['p1', undefined, 'No.'], ['p2', true, 'Yes.']]);
  assert.equal(v.run.sortIntro, 'Sort 2 things.');
  assert.deepEqual(v.run.stories, [['charge', 'payments', 'It failed.']]);
});

test('run: a slot stays in the output as {{name}}', () => {
  assert.equal(only(bindRun()).run.sentTo, '{{where}} accepted the test span.');
});

test('run: slot rules', () => {
  assert.ok(bindRun(runText(), runSkeleton(), { vars: { n: 2 } }).errors.includes('run.sentTo: fill-in {{where}} has no value'));
  assert.ok(bindRun(runText(), runSkeleton(), { vars: { n: 2 }, slots: ['where', 'host'] }).errors.includes('slot "host" is never used: remove it from slots, or write {{host}} in the copy'));
  assert.ok(bindRun(runText(), runSkeleton(), { vars: { n: 2, where: 'x' }, slots: ['where'] }).errors.includes('"where" is both a var and a slot'));
  const t = runText();
  t.name = 'Run {{where}}';
  assert.ok(bindRun(t).errors.some((e) => e.startsWith('name: slot {{where}} may only be used under run')));
  assert.ok(bindRun(runText(), runSkeleton(), { vars: { n: '{{where}}' }, slots: ['where'] }).errors.includes('var "n" must not contain "{{" when slots are declared'));
});

test('run: logic-only keys and non-strings are refused', () => {
  for (const k of ['right', 'bucket', 'answer', 'kind', 'steps']) {
    const t = runText();
    t.run.picks[0][k] = true;
    const { errors } = bindRun(t);
    assert.ok(errors.some((e) => e.startsWith(`run.picks[0].${k}:`) && /belongs in the logic/.test(e)), `${k}: ${errors.join('\n')}`);
  }
  const t = runText();
  t.run.picks[0].label = 3;
  assert.ok(bindRun(t).errors.some((e) => e.startsWith('run.picks[0].label:') && /must be a string/.test(e)));
});

test('run: an entry name is lowerCamelCase', () => {
  const t = runText();
  t.run['sort-intro'] = 'x';
  assert.ok(bindRun(t).errors.some((e) => /run\.sort-intro: a run entry name is lowerCamelCase/.test(e)));
});

test('run: the HTML check runs after the fill-ins', () => {
  assert.ok(bindRun(runText(), runSkeleton(), { vars: { n: '<img src=x>' }, slots: ['where'] }).errors.some((e) => e.startsWith('run.sortIntro ') && /must not contain the tag <img>/.test(e)));
  const t = runText();
  t.run.picks[0].says = 'See <a href="x">this</a>.';
  assert.ok(bindRun(t).errors.some((e) => /run\.picks\[0\]\.says must not contain the tag <a>/.test(e)));
  const u = runText();
  u.run.sentTo = '<b class="{{where}}">x</b>';
  assert.ok(bindRun(u).errors.some((e) => /run\.sentTo must not give <b> the attribute class/.test(e)));
});

test('run: a slot inside a tag is an error, even in an allowed attribute', () => {
  const t = runText();
  t.run.sentTo = '<code data-token="{{where}}">x</code>';
  const { errors } = bindRun(t);
  assert.ok(errors.some((e) => e.startsWith('run.sentTo ') && /slot/.test(e) && /inside a tag/.test(e)), errors.join('\n'));
  const gt = runText();
  gt.run.sentTo = '<code data-token="a>b {{where}}">x</code>';
  assert.ok(bindRun(gt).errors.some((e) => /inside a tag/.test(e)), 'a > inside a quoted value does not end the tag');
  const ok = runText();
  ok.run.sentTo = 'p99 < {{where}} and <b>bold</b>';
  assert.deepEqual(bindRun(ok).errors, []);
});

test('run: the logic holds plain data only under run', () => {
  for (const odd of [/x/, new Date(0), new Set(), new Map()]) {
    const s = runSkeleton();
    s.run.picks[0].extra = odd;
    const { errors } = bindRun(runText(), s);
    assert.ok(errors.some((e) => e.startsWith('run.picks[0].extra:') && /plain data/.test(e)), `${odd.constructor.name}: ${errors.join('\n')}`);
  }
});

test('run: the content has a run entry exactly when the logic has one', () => {
  const noLogicRun = runSkeleton();
  delete noLogicRun.run;
  assert.ok(bindText(runText(), noLogicRun, { vars: { n: 2 }, slots: ['where'] }).errors.includes('run: the content has a run entry and the logic has none: add run to the logic, or remove it from the content'));
  const noContentRun = runText();
  delete noContentRun.run;
  assert.ok(bindText(noContentRun, runSkeleton(), { vars: {} }).errors.includes('run: the logic has a run entry and the content has none: add run to the content, or remove it from the logic'));
});

test('run: only the top-level run entry is free; deeper it is not a content key', () => {
  const t = { id: 'lv', name: 'L', sub: 'S', rewardTitle: 'R', play: { steps: [{ run: { a: 'b' }, choice: { id: 'c1', choices: [] } }] } };
  const { errors } = bindText(t, { id: 'lv', play: { steps: [{ choice: { id: 'c1', choices: [] } }] } });
  assert.ok(errors.some((e) => /play\.steps\[0\]\.run: "run" is not a content key/.test(e)), errors.join('\n'));
});

test('bindRunLevel: returns the meta and a run(ctx) that hands the bound words to screens', () => {
  const calls = [];
  const screens = (ctx, say) => calls.push([ctx, say]);
  const opts = { vars: { n: 2 }, slots: ['where'], screens };
  const text = runText();
  const level = bindRunLevel(text, runSkeleton(), opts);
  assert.equal(typeof level.run, 'function');
  assert.deepEqual(Object.keys(level).sort(), ['cards', 'id', 'name', 'no', 'rewardTitle', 'run', 'sub']);
  const ctx = {};
  level.run(ctx);
  assert.equal(calls[0][0], ctx);
  assert.equal(calls[0][1].sortIntro, 'Sort 2 things.');
  calls[0][1].sortIntro = 'changed';
  calls[0][1].sort.items.pop();
  assert.equal(text.run.sortIntro, 'Sort {{n}} things.');
  assert.equal(text.run.sort.items.length, 2);
  const again = bindRunLevel(runText(), runSkeleton(), opts);
  again.run(ctx);
  assert.equal(calls[1][1].sortIntro, 'Sort 2 things.');
  assert.equal(calls[1][1].sort.items.length, 2);
  const none = runText();
  delete none.run;
  assert.throws(() => bindRunLevel(none, runSkeleton(), opts), (e) => e instanceof ContentError && /rl/.test(e.message) && /needs a run object/.test(e.message));
  assert.throws(() => bindRunLevel(runText(), runSkeleton(), { vars: { n: 2 }, slots: ['where'] }), TypeError);
});

test('bindRunLevel: every run(ctx) of one level gets its own copy of the words', () => {
  const seen = [];
  const level = bindRunLevel(runText(), runSkeleton(), { vars: { n: 2 }, slots: ['where'], screens: (ctx, say) => seen.push(say) });
  level.run({});
  seen[0].sortIntro = 'changed';
  seen[0].sort.items.pop();
  level.run({});
  assert.notEqual(seen[0], seen[1]);
  assert.equal(seen[1].sortIntro, 'Sort 2 things.');
  assert.equal(seen[1].sort.items.length, 2);
});

// ---- glossary term markers (#442, docs/CONTENT.md "Marking glossary terms in a level") ----

const withStep = (patch) => {
  const t = text();
  Object.assign(t.play.steps[0], patch);
  return t;
};
const gloss = (shown, ref = '') => `<span data-gloss="${ref}">${shown}</span>`;
const AT_INTRO = 'play.steps[0].intro';

test('terms: a marker in an intro becomes a gloss span, and the fill-ins around it still fill', () => {
  const v = only(bind(withStep({ intro: 'One <b>[[series|time-series]]</b> per {{n}} [[metric]]' })));
  assert.equal(v.play.steps[0].intro, `One <b>${gloss('series', 'time-series')}</b> per 7 ${gloss('metric')}`);
  assert.equal(v.play.steps[0].question, 'Q?');
});

test('terms: a marker in a show is read like one in an intro', () => {
  const t = text();
  t.play.steps[1].show = 'See [[span]].';
  const v = only(bind(t));
  assert.equal(v.play.steps[1].show, `See ${gloss('span')}.`);
});

test('terms: markers inside code and pre are literal text, not terms', () => {
  const v = only(bind(withStep({ intro: 'Run <code>[[ -f x ]]</code> then [[span]]' })));
  assert.equal(v.play.steps[0].intro, `Run <code>[[ -f x ]]</code> then ${gloss('span')}`);
  const p = only(bind(withStep({ intro: '<pre>if [[ -f a ]]; then x; fi</pre> and [[span]]' })));
  assert.equal(p.play.steps[0].intro, `<pre>if [[ -f a ]]; then x; fi</pre> and ${gloss('span')}`);
});

test('terms: a marker in a label, question, bucket label, finish or name is refused with its path; code and spot text are literal', () => {
  const refuse = 'must not contain a glossary term marker (only intro, show and answer feedback mark terms)';
  const cases = [
    ['play.steps[0].choice.choices[0].label', (t) => { t.play.steps[0].choice.choices[0].label = 'Bee [[span]]'; }],
    ['play.steps[0].question', (t) => { t.play.steps[0].question = 'Which [[span]]?'; }],
    ['play.steps[2].sort.buckets[0].label', (t) => { t.play.steps[2].sort.buckets[0].label = 'The [[span]] bucket'; }],
    ['play.finish', (t) => { t.play.finish = 'You did the [[span]] well.'; }],
    ['name', (t) => { t.name = 'The [[span]]'; }],
  ];
  for (const [path, edit] of cases) {
    const t = text();
    t.play.steps.push({ intro: 'I3', question: 'Q3', sort: { id: 'so1', buckets: [{ id: 'k1', label: 'Kay' }], items: [{ id: 'i1', label: 'It' }] } });
    const s = skeleton();
    s.play.steps.push({ qid: 'p-q3', sort: { id: 'so1', buckets: [{ id: 'k1' }], items: [{ id: 'i1', bucket: 'k1' }] } });
    edit(t);
    const { errors } = bind(t, s);
    assert.ok(errors.some((e) => e.startsWith(path) && e.includes(refuse)), `${path}: ${JSON.stringify(errors)}`);
  }
  const t = text();
  t.play.steps[1].spot.lines[0].text = 'log [[1,2]]';
  assert.deepEqual(bind(t).errors, []);
  const c = text();
  c.play.steps[1].spot.lines[0].code = '[[ -f a ]]';
  assert.deepEqual(bind(c).errors.filter((e) => e.includes('marker')), []);
});

test('terms: answer feedback marks terms: why, whyNot, explain, hint and closing bind to gloss spans', () => {
  const t = text();
  t.play.steps[0].choice.choices[0].why = 'A [[span]] is a [[trace|trace]] part.';
  t.play.steps[1].spot.whyNot.l1 = 'Not <b>[[span]]</b>.';
  t.play.steps[1].spot.explain = 'See [[metric]].';
  t.play.steps[1].spot.hint = 'Try the [[span]].';
  t.play.steps[1].spot.closing = 'The [[trace]] again.';
  const v = only(bind(t));
  assert.equal(v.play.steps[0].choice.choices[0].why, `A ${gloss('span')} is a ${gloss('trace', 'trace')} part.`);
  assert.equal(v.play.steps[1].spot.whyNot.l1, `Not <b>${gloss('span')}</b>.`);
  assert.equal(v.play.steps[1].spot.explain, `See ${gloss('metric')}.`);
  assert.equal(v.play.steps[1].spot.hint, `Try the ${gloss('span')}.`);
  assert.equal(v.play.steps[1].spot.closing, `The ${gloss('trace')} again.`);
});

test('terms: a marker in feedback is judged by the text rules on its shown words', () => {
  const t = text();
  t.play.steps[0].choice.choices[0].why = `A [[span]] ${DASH} dash.`;
  const { errors } = bind(t);
  assert.ok(errors.some((e) => e.startsWith('play.steps[0].choice.choices[0].why') && e.includes('em dash')), JSON.stringify(errors));
});

// Rewritten for phase 4: this test said a marker under run is refused "until run reads them"; run now reads them in the
// entries the logic lists, so the refusal moves to the entries it does not list (the tests below).
const RUN_OPTS = (terms) => ({ vars: { n: 2 }, slots: ['where'], terms });
const NOT_LISTED = 'term markers are read under run only in the entries the logic lists in terms';

test('terms: a listed run entry turns a marker into a gloss span, in the long and the short form', () => {
  const t = runText();
  t.run.sortIntro = 'Sort {{n}} [[spans|span]] and a [[trace]], then {{where}}.';
  const { value, errors } = bindRun(t, runSkeleton(), RUN_OPTS(['sortIntro']));
  assert.deepEqual(errors, []);
  assert.equal(value.run.sortIntro, `Sort 2 ${gloss('spans', 'span')} and a ${gloss('trace')}, then {{where}}.`);
});

test('terms: a marker in a run entry the logic does not list is refused with the entry path', () => {
  const t = runText();
  t.run.sentTo = '{{where}} saw a [[span]].';
  for (const terms of [undefined, [], ['sortIntro']]) {
    const { errors } = bindRun(t, runSkeleton(), RUN_OPTS(terms));
    assert.ok(errors.some((e) => e === `run.sentTo: ${NOT_LISTED}`), `${terms}: ${JSON.stringify(errors)}`);
  }
});

test('terms: a marker below the top of run is refused even when its entry is listed', () => {
  const t = runText();
  t.run.picks[0].says = 'No, a [[span]].';
  t.run.stories[0][2] = 'It [[span]] failed.';
  t.run.picks[0].sortIntro = 'Same name as a listed entry, a [[span]].'; // a nested key that shares a listed entry's name
  const { errors } = bindRun(t, runSkeleton(), RUN_OPTS(['picks', 'stories', 'sortIntro']));
  assert.ok(errors.some((e) => e.startsWith('run.picks[0].says:') && e.includes(NOT_LISTED)), JSON.stringify(errors));
  assert.ok(errors.some((e) => e.startsWith('run.stories[0][2]:') && e.includes(NOT_LISTED)), JSON.stringify(errors));
  assert.ok(errors.some((e) => e.startsWith('run.picks[0].sortIntro:') && e.includes(NOT_LISTED)), JSON.stringify(errors));
});

test('terms: terms must name top-level string entries of run, each error with its name', () => {
  const bad = (terms) => bindRun(runText(), runSkeleton(), RUN_OPTS(terms)).errors;
  for (const name of ['nope', 'sort', 'picks', 'stories']) {
    assert.ok(bad([name]).includes(`terms: "${name}" is not a prose entry of run (a top-level string)`), `${name}: ${JSON.stringify(bad([name]))}`);
  }
  assert.deepEqual(bad(['sortIntro', 'sentTo']), []);
});

test('terms: code regions inside a listed run entry stay literal', () => {
  const t = runText();
  t.run.sortIntro = 'Run <code>[[ -f x ]]</code> then [[span]] with {{n}}.';
  const { value, errors } = bindRun(t, runSkeleton(), RUN_OPTS(['sortIntro']));
  assert.deepEqual(errors, []);
  assert.equal(value.run.sortIntro, `Run <code>[[ -f x ]]</code> then ${gloss('span')} with 2.`);
});

test('terms: a listed run entry is judged on its shown words and a broken marker is an error at the entry', () => {
  const t = runText();
  t.run.sortIntro = `A [[span]] ${DASH} dash.`;
  const { errors } = bindRun(t, runSkeleton(), RUN_OPTS(['sortIntro']));
  assert.ok(errors.some((e) => e.startsWith('run.sortIntro') && e.includes('em dash')), JSON.stringify(errors));
  const u = runText();
  u.run.sortIntro = 'A [[<b>x</b>|span]].';
  assert.ok(bindRun(u, runSkeleton(), RUN_OPTS(['sortIntro'])).errors.some((e) => e.startsWith('run.sortIntro:')));
});

test('terms: broken markers are one error each at the field', () => {
  for (const intro of ['[[a', 'a]]', '[[ a|span]]', '[[<b>x</b>|span]]', '[[a &amp; b|span]]', '[[{{n}}|span]]', '[[a|Not An Id]]', '{{[[n]]}}']) {
    const { errors } = bind(withStep({ intro }));
    assert.equal(errors.length, 1, `${intro}: ${JSON.stringify(errors)}`);
    assert.ok(errors[0].startsWith(AT_INTRO), errors[0]);
  }
});

test('terms: a fill-in that wraps a marker is refused', () => {
  const { errors } = bind(withStep({ intro: '{{[[n]]}}' }));
  assert.deepEqual(errors, [`${AT_INTRO}: a fill-in must not wrap a term marker`]);
});

test('terms: a marker inside a tag is refused by the tag scan', () => {
  const { errors } = bind(withStep({ intro: '<th scope="[[col]]">a</th>' }));
  assert.deepEqual(errors, [`${AT_INTRO}: a term marker must not be inside a tag`]);
});

test('terms: the HTML rules judge the shown text, not the span', () => {
  const bad = bind(withStep({ intro: '[[x|span]] <a>y</a>' }));
  assert.ok(bad.errors.some((e) => e.includes('must not contain the tag <a>')), JSON.stringify(bad.errors));
  assert.deepEqual(bind(withStep({ intro: '<b>[[series|time-series]]</b>' })).errors, []);
});
