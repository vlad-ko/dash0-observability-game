// lib/service-view.mjs: the simulated Dash0 service view of the span kinds hunt (level 2.2):
// requests per service from SERVER spans, the map edges, and the hunt's flag verdicts.
// Asserts strings, numbers, booleans and nulls only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flagSpan, newHunt, requestRates, serviceView, withKind } from '../lib/service-view.mjs';
import { CONTENT } from '../levels/span-kinds.mjs';

const sp = (spanId, service, kind, parentId = null) => ({
  spanId, traceId: 'a'.repeat(32), name: `op ${spanId}`, service, kind, startMs: 0, endMs: 10, status: 'UNSET',
  attributes: {}, events: [], parentId, links: [],
});

test('requestRates counts only SERVER spans, lists every service with a span and omits the rest', () => {
  const spans = [
    sp('0000000000000001', 'a', 'SERVER'), sp('0000000000000002', 'a', 'SERVER'), sp('0000000000000003', 'a', 'CLIENT'),
    sp('0000000000000004', 'a', 'CONSUMER'), sp('0000000000000005', 'a', 'INTERNAL'), sp('0000000000000006', 'b', 'INTERNAL'),
  ];
  assert.deepEqual(requestRates(spans, { perMin: 7 }), [{ service: 'a', perMin: 14 }, { service: 'b', perMin: 0 }]);
  assert.deepEqual(requestRates([], { perMin: 7 }), [], 'a service with no spans is absent, never 0');
});

test('requestRates refuses a perMin that is not a finite number of at least 0', () => {
  const spans = [sp('0000000000000001', 'a', 'SERVER')];
  assert.throws(() => requestRates(spans, { perMin: Number.NaN }), TypeError);
  assert.throws(() => requestRates(spans, { perMin: -1 }), TypeError);
  assert.throws(() => requestRates(spans, { perMin: Infinity }), TypeError);
  assert.deepEqual(requestRates(spans, { perMin: 0 }), [{ service: 'a', perMin: 0 }]);
});

test('withKind returns copies, never changes its input, and answers null for an unknown span or kind', () => {
  const spans = [sp('0000000000000001', 'a', 'INTERNAL')];
  const out = withKind(spans, '0000000000000001', 'SERVER');
  assert.equal(out[0].kind, 'SERVER');
  assert.equal(spans[0].kind, 'INTERNAL', 'the input is untouched');
  assert.equal(withKind(spans, 'ffffffffffffffff', 'SERVER'), null);
  assert.equal(withKind(spans, '0000000000000001', 'FOO'), null);
});

test('serviceView: the level\'s spans show payments at 0 and firing; the fix shows 20 and not firing; an unknown service is null', () => {
  const { spans, culprit, perMin, watch } = CONTENT.steps[0].hunt;
  const before = serviceView(spans, { perMin, watch });
  assert.equal(before.watched, 0);
  assert.equal(before.firing, true);
  const after = serviceView(withKind(spans, culprit, 'SERVER'), { perMin, watch });
  assert.equal(after.watched, 20);
  assert.equal(after.firing, false);
  const ghost = serviceView(spans, { perMin, watch: 'ghost' });
  assert.equal(ghost.watched, null);
  assert.equal(ghost.firing, null);
});

test('flagSpan: a decoy is wrong once and a repeat after, the culprit is right, then everything is closed', () => {
  const spans = [sp('0000000000000001', 'a', 'SERVER'), sp('0000000000000002', 'b', 'INTERNAL')];
  const frozen = JSON.stringify(spans);
  const st0 = newHunt();
  const w = flagSpan(spans, '0000000000000002', st0, '0000000000000001');
  assert.equal(w.outcome, 'wrong');
  assert.equal(st0.flagged.length, 0, 'the state passed in is untouched');
  const again = flagSpan(spans, '0000000000000002', w.state, '0000000000000001');
  assert.equal(again.outcome, 'repeat');
  const right = flagSpan(spans, '0000000000000002', w.state, '0000000000000002');
  assert.equal(right.outcome, 'right');
  assert.equal(right.state.solved, true);
  assert.equal(flagSpan(spans, '0000000000000002', right.state, '0000000000000001').outcome, 'closed');
  assert.equal(flagSpan(spans, '0000000000000002', st0, 'ffffffffffffffff').outcome, 'unknown');
  assert.equal(JSON.stringify(spans), frozen, 'the spans are untouched');
});
