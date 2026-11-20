// The glossary terms marked in level text (#442, docs/CONTENT.md "Marking glossary terms in a level"): every marker in a
// live level names a term. Bind checks the syntax; existence is checked here, against the glossary, so bind never imports it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveRegistry } from '../app.mjs';
import { bindLevel } from '../lib/content/bind.mjs';
import { GLOSSARY } from '../content/core/glossary/index.mjs';
import { checkLevelTerms, readGloss } from '../lib/content/terms.mjs';
import { extractLevelText } from '../tools/extract-level-text.mjs';

const gloss = (shown, ref = '') => `<span data-gloss="${ref}">${shown}</span>`;
const SMALL = { terms: [{ id: 'span', name: 'Span', variants: [], definition: 'One unit of work.', act: 'a0', topic: 'Traces' }] };

const spansIn = (node) => {
  if (typeof node === 'string') return readGloss(node).length;
  if (node === null || typeof node !== 'object') return 0;
  return Object.values(node).reduce((n, v) => n + spansIn(v), 0);
};

test('every term marker in every live level names a glossary term', () => {
  const reg = liveRegistry();
  const problems = [];
  let marked = 0;
  for (const id of reg.order) {
    problems.push(...checkLevelTerms(reg.levels[id], GLOSSARY).map((p) => `${id}.${p}`));
    marked += spansIn(reg.levels[id]);
  }
  assert.deepEqual(problems, []);
  assert.ok(marked >= 2, `the corpus marks at least two terms (${marked})`);
});

test('checkLevelTerms: an unknown id and an unmatched short form are named with their path, in the primer wording', () => {
  const level = { play: { steps: [{ intro: `Read ${gloss('x', 'nope')} and ${gloss('Mystery')} and ${gloss('span', 'span')}` }, { show: gloss('Span') }] } };
  assert.deepEqual(checkLevelTerms(level, SMALL), [
    'play.steps[0].intro: "nope" is not a term in the glossary',
    'play.steps[0].intro: the short form [[Mystery]] matches no glossary name or variant',
  ]);
});

test('extractLevelText writes a marked term back as its marker, so an extracted level binds again', async () => {
  const reg = liveRegistry();
  const text = extractLevelText(reg.levels.cardinality);
  assert.ok(text.play.steps[0].intro.includes('<b>[[series|time-series]]</b>'), text.play.steps[0].intro);
  assert.ok(text.play.steps[0].intro.includes('A [[metric]] keeps'));
  assert.equal(JSON.stringify(text).includes('data-gloss'), false);
});

test('cardinality marks a term in a wrong answer and in a hint: the proof content of answer feedback (glossary sense only)', () => {
  const steps = liveRegistry().levels.cardinality.play.steps;
  const sum = steps[0].choice.choices.find((c) => c.key === 'sum');
  assert.deepEqual(readGloss(sum.why), [{ shown: 'attribute', ref: null }]);
  assert.deepEqual(readGloss(steps[1].spot.hint), [{ shown: 'label', ref: null }]);
});

test('readGloss does not read a span with no shown text as a term', () => {
  assert.deepEqual(readGloss('<span data-gloss="span"></span>'), []);
});

test('a level extracted from its bound form binds back to the same words and spans', () => {
  const logic = { id: 't', play: { prefix: 'p', steps: [{ qid: 'q', choice: { id: 'c', choices: [{ key: 'a', right: true }] } }] } };
  const words = {
    id: 't',
    play: { finish: 'Done.', steps: [{ intro: 'One <b>[[series|time-series]]</b> and a [[metric]].', question: 'Q?', choice: { id: 'c', choices: [{ key: 'a', label: 'A', why: 'W.' }] } }] },
  };
  const bound = bindLevel(words, logic);
  assert.equal(readGloss(bound.play.steps[0].intro).length, 2, 'control: the bound intro holds two gloss spans');
  const again = bindLevel(extractLevelText(bound), logic);
  assert.equal(again.play.steps[0].intro, bound.play.steps[0].intro);
});

test('extractLevelText writes a marker in answer feedback back as [[...]] and leaves no gloss span anywhere', () => {
  const level = {
    id: 't',
    play: {
      finish: 'Done.',
      steps: [{
        intro: 'I',
        question: 'Q?',
        spot: {
          id: 's',
          lines: [{ id: 'l1', text: 'one' }],
          whyNot: { l1: `Not ${gloss('span', 'span')}.` },
          explain: `See ${gloss('Trace')}.`,
          hint: `Try ${gloss('series', 'time-series')}.`,
          closing: `Again ${gloss('span', 'span')}.`,
        },
      }, {
        intro: 'I2',
        question: 'Q2?',
        choice: { id: 'c', choices: [{ key: 'a', label: 'A', why: `A ${gloss('span', 'span')} here.` }] },
      }],
    },
  };
  const text = extractLevelText(level);
  assert.equal(text.play.steps[0].spot.whyNot.l1, 'Not [[span|span]].');
  assert.equal(text.play.steps[0].spot.explain, 'See [[Trace]].');
  assert.equal(text.play.steps[0].spot.hint, 'Try [[series|time-series]].');
  assert.equal(text.play.steps[0].spot.closing, 'Again [[span|span]].');
  assert.equal(text.play.steps[1].choice.choices[0].why, 'A [[span|span]] here.');
  assert.equal(JSON.stringify(text).includes('data-gloss'), false);
});

test('checkLevelTerms: a level with no span has no problem, and a glossary that is not one resolves nothing', () => {
  assert.deepEqual(checkLevelTerms({ intro: 'plain <b>text</b>', n: 3, list: [null, 'x'] }, SMALL), []);
  assert.deepEqual(checkLevelTerms({ intro: gloss('span', 'span') }, null), ['intro: "span" is not a term in the glossary']);
});
