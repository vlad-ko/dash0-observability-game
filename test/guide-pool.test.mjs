// Ask the guide on an answer pool (#390): the guide is told the board the player sees and never the pool, and the
// reply filter withholds every right answer of the pool, drawn or not. lib/guide/context.mjs, api/guide.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveRegistry } from '../app.mjs';
import { createGuide } from '../api/guide.mjs';
import { createLimiter } from '../lib/guide/limit.mjs';
import { answerTokens, findStep, stepContext, withholds } from '../lib/guide/context.mjs';
import { drawChoiceBoard, drawSortBoard } from '../lib/pool.mjs';
import { runPlay, STEP_TYPES, validatePlay } from '../lib/play.mjs';
import { buildRegistry } from '../lib/registry.mjs';
import { FIXTURE_CARD } from './fixtures/fixture-level.mjs';
import { CP, IDENT, REV, SP, poolFixture, sp } from './fixtures/pool-fixtures.mjs';

const KEY = 'sk-ant-test-key-0123456789';
const URL_ = 'https://game.test/api/guide';
const NEUTRAL = 'Re-read what the question asks.';
const LIVE = liveRegistry();
const sortWithHints = () => ({ ...sp(), helps: { hints: true } });
const POOLED = buildRegistry([{ id: 'a', no: 0, levels: [poolFixture({ sort: sortWithHints() })], boss: null }], {
  deck: [FIXTURE_CARD], nodeIds: [], play: { validatePlay, runPlay },
}).levels['pool-fixture'];
const REGISTRY = { levels: { ...LIVE.levels, 'pool-fixture': POOLED } };

const keys = (board) => board.choices.map((c) => c.key);
const label = (key) => CP.choices.find((c) => c.key === key).label;
const STEP = { intro: 'An intro', question: 'Which one?' };

function setup(reply = NEUTRAL) {
  const calls = [];
  const fetch = async (url, init) => (calls.push(JSON.parse(init.body)), Response.json({ content: [{ type: 'text', text: reply }] }));
  const guide = createGuide({ env: { ANTHROPIC_API_KEY: KEY }, fetch, now: () => 1_000_000, log: () => {}, limiter: createLimiter({ now: () => 1_000_000 }), registry: REGISTRY });
  return { guide, calls };
}
const post = (payload) =>
  new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.5' }, body: JSON.stringify(payload) });
const ask = async (guide, over = {}) => {
  const res = await guide.POST(post({ v: 1, levelId: 'pool-fixture', stepId: 'cp', question: 'What does this mean?', ...over }));
  return { status: res.status, json: await res.json() };
};
const optionLines = (system) => system.split('\n').filter((l) => l.startsWith('Option: '));

test('G1 stepContext on a drawn board lists exactly the board and none of the rest of the pool', () => {
  const board = drawChoiceBoard(CP, REV);
  const lines = stepContext({ name: 'L' }, { type: STEP_TYPES.choice, spec: board, step: STEP });
  const options = lines.filter((l) => l.startsWith('Option: '));
  assert.equal(options.length, 3);
  const joined = lines.join('\n');
  for (const c of CP.choices) assert.equal(joined.includes(c.label.replace('Answer ', '')), keys(board).includes(c.key), c.key);
});

test('G1 stepContext refuses a whole pool: handing it the pool would list every answer', () => {
  assert.throws(() => stepContext({ name: 'L' }, { type: STEP_TYPES.choice, spec: CP, step: STEP }), TypeError);
  assert.throws(() => stepContext({ name: 'L' }, { type: STEP_TYPES.sort, spec: SP, step: STEP }), TypeError);
});

test('G2 a pooled step needs a valid shown: missing, the wrong size, an unknown key, a repeat or not a list are 400 on shown', async () => {
  for (const shown of [undefined, [], ['r1', 'w1'], ['r1', 'w1', 'w2', 'w3'], ['r1', 'w1', 'nope'], ['r1', 'w1', 'w1'], 'r1', [1, 2, 3], { 0: 'r1' }]) {
    const { guide, calls } = setup();
    const res = await ask(guide, shown === undefined ? {} : { shown });
    assert.equal(res.status, 400, JSON.stringify(shown));
    assert.deepEqual(res.json, { ok: false, error: 'bad-request', field: 'shown' }, JSON.stringify(shown));
    assert.equal(calls.length, 0);
  }
});

test('G2 a fixed step takes no shown', async () => {
  const { guide, calls } = setup();
  const res = await ask(guide, { levelId: 'resources', stepId: 'res-pod', shown: ['a', 'b'] });
  assert.equal(res.status, 400);
  assert.deepEqual(res.json, { ok: false, error: 'bad-request', field: 'shown' });
  assert.equal(calls.length, 0);
  const plain = await ask(guide, { levelId: 'resources', stepId: 'res-pod' });
  assert.equal(plain.status, 200);
});

test('G2 a valid shown: the model is told exactly that board, and the answer is still withheld from the reply', async () => {
  const { guide, calls } = setup();
  const res = await ask(guide, { shown: ['r2', 'w3', 'w5'] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { ok: true, hint: NEUTRAL });
  const options = optionLines(calls[0].system);
  assert.deepEqual(options, ['w3', 'w5', 'r2'].map(label).map((l) => `Option: ${l}`).sort());
  assert.equal(options.length, 3);
  for (const c of CP.choices.filter((x) => !['r2', 'w3', 'w5'].includes(x.key))) assert.ok(!calls[0].system.includes(c.label), `${c.key} is not on the board`);
});

test('G2 a pooled sort is told its drawn items, and an over-sized or foreign shown is refused', async () => {
  const board = drawSortBoard(sortWithHints(), IDENT);
  const shown = board.items.map((i) => i.id);
  const { guide, calls } = setup();
  const res = await ask(guide, { stepId: 'sp', shown });
  assert.equal(res.status, 200);
  assert.equal(calls[0].system.split('\n').filter((l) => l.startsWith('Item: ')).length, 5);
  const bad = await ask(guide, { stepId: 'sp', shown: [...shown, 'a4'] });
  assert.equal(bad.status, 400);
  assert.equal((await ask(guide, { stepId: 'sp', shown: ['a1', 'b1', 'a2', 'b2', 'zz'] })).status, 400);
});

test('G3 the reply filter withholds every right answer of the pool, drawn or not, whatever was shown', async () => {
  for (const shown of [['r1', 'w1', 'w2'], ['r2', 'w3', 'w5']]) {
    for (const right of ['r1', 'r2', 'r3']) {
      const { guide } = setup(`I think it is ${label(right)}, so go with that.`);
      const res = await ask(guide, { shown });
      assert.deepEqual(res.json, { ok: false, error: 'withheld' }, `${right} with ${shown}`);
    }
  }
});

test('G3 answerTokens of a pool are one set whatever the board: every right is in it, no wrong one is', () => {
  const found = findStep(POOLED, 'cp');
  const tokens = answerTokens(found.type, found.spec, found.step);
  for (const right of ['r1', 'r2', 'r3']) assert.equal(withholds(`It is ${label(right)}.`, tokens), true, right);
  for (const wrong of ['w1', 'w4', 'w6']) assert.equal(withholds(`It is ${label(wrong)}.`, tokens), false, wrong);
  const sort = findStep(POOLED, 'sp');
  const sortTokens = answerTokens(sort.type, sort.spec, sort.step);
  assert.ok(sortTokens.pairs.some(([item]) => item === 'item a5'), 'an item the board left out is still withheld');
});
