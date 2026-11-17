// Joining a content file to a level's logic (lib/content/bind.mjs, #391, docs/CONTENT.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindLevel, bindText, ContentError } from '../lib/content/bind.mjs';

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

test('bind: placeholders are filled, a missing or unused var is an error, an id holds none', () => {
  assert.ok(bind(text(), skeleton(), {}).errors.some((e) => /\{\{n\}\} has no value/.test(e)));
  assert.ok(bind(text(), skeleton(), { n: 1, spare: 2 }).errors.some((e) => /var "spare" is never used/.test(e)));
  const t = text();
  t.play.steps[0].choice.choices[0].key = '{{n}}';
  assert.ok(bind(t).errors.some((e) => /an id must not hold a placeholder/.test(e)));
});

test('bind: filled text is checked by the text rules for its field', () => {
  const t = text();
  t.play.finish = ' padded ';
  t.play.steps[0].intro = 'see <a href="x">here</a>';
  t.play.steps[0].choice.choices[1].why = 'a — b';
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
  t.play.steps[1].intro = 'x — y';
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
