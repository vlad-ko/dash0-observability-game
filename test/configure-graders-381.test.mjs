// #381: a Configure it task promises only what its grader checks, and a hint does not hand out a later answer.
// The checker (COLLECTOR_SCHEMA) does not model component settings, so a step that says "starts" or "Bearer" while
// it accepts a config without them is a task that over-promises: the fix is the task text, pinned here against the
// real grader (the accepted config is named, so a future per-setting grader makes the first half of each test go red
// on purpose and the promise can come back).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTS } from '../levels/index.mjs';
import { escapeHtml } from '../lib/lesson-kit.mjs';
import { hintFor } from '../lib/widgets/configure-it-help.mjs';
import { newConfigureState, runConfigure } from '../lib/widgets/configure-it.mjs';
import { hintFor as tradeoffHint } from '../lib/widgets/trade-off-help.mjs';

const levels = ACTS.flatMap((a) => [...a.levels, ...(a.boss ? [a.boss] : [])]);
const stepOf = (levelId, widget, id) => levels.find((l) => l.id === levelId).play.steps.find((s) => s[widget]?.id === id);
const configOf = (levelId, id) => stepOf(levelId, 'configure', id).configure;
const plain = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&#39;/g, "'");
const outcome = (spec, text) => runConfigure(spec, newConfigureState(), text).outcome;

const AGW = configOf('agent-vs-gateway', 'agw-config');
const TVW = configOf('two-vendors-one-weekend', 'tvw-config');
const COL = configOf('collecting-logs', 'col-config');
const OTLP = configOf('otlp-endpoints', 'otlp-config');

const withExporter = (spec, id, body) => spec.reference.replace(new RegExp(`  ${id}:\\n(    .*\\n)*`), body);

test('agw-config: the task does not promise the Collector starts, because an empty or wrongly routed load_balancing passes', () => {
  const bare = AGW.reference.replace(/  load_balancing:\n(    .*\n)*/, '  load_balancing:\n');
  const service = AGW.reference.replace('routing_key: traceID', 'routing_key: service');
  assert.equal(outcome(AGW, bare), 'right', 'the gap: an empty load_balancing has no resolver and passes');
  assert.equal(outcome(AGW, service), 'right', 'the gap: routing_key service is the wrong answer of the next question and passes');
  const task = plain(stepOf('agent-vs-gateway', 'configure', 'agw-config').question);
  assert.equal(/\bstart/i.test(task), false, task);
  assert.equal(/<code>load_balancing<\/code>/.test(stepOf('agent-vs-gateway', 'configure', 'agw-config').question), true, 'the graded wiring is still named');
});

test('tvw-config: the task does not ask for a Bearer header, because an empty exporter, a bare token and a query parameter pass', () => {
  const dash0 = (body) => withExporter(TVW, 'otlp_grpc/dash0', `  otlp_grpc/dash0:\n${body}`);
  assert.equal(outcome(TVW, dash0('')), 'right', 'the gap: no endpoint, no header');
  assert.equal(outcome(TVW, dash0('    endpoint: ${env:DASH0_ENDPOINT}\n    headers:\n      Authorization: ${env:DASH0_AUTH_TOKEN}\n')), 'right', 'the gap: no Bearer');
  assert.equal(outcome(TVW, dash0('    endpoint: ${env:DASH0_ENDPOINT}?token=${env:DASH0_AUTH_TOKEN}\n')), 'right', 'the gap: the token in the URL');
  const task = plain(stepOf('two-vendors-one-weekend', 'configure', 'tvw-config').question);
  assert.equal(/Bearer|Authorization|header/i.test(task), false, task);
});

test('tier 3 of col-config and agw-config applies a config without the settings of the later questions', () => {
  const col = hintFor(COL, newConfigureState(), '', 3).apply;
  for (const w of ['multiline', 'line_start_pattern', 'operators', 'regex_parser', 'severity']) assert.equal(col.includes(w), false, `col-config tier 3 writes ${w}`);
  const agw = hintFor(AGW, newConfigureState(), '', 3).apply;
  assert.equal(agw.includes('routing_key'), false, 'agw-config tier 3 writes routing_key');
  for (const spec of [COL, AGW]) assert.equal(outcome(spec, hintFor(spec, newConfigureState(), '', 3).apply), 'right', `${spec.id}: the applied config still passes`);
});

test('otlp-config tier 1 stops at the rule: it does not say to make each list name the exporter', () => {
  const t = plain(hintFor(OTLP, newConfigureState(), '', 1, { e: escapeHtml }).html);
  assert.equal(/make each list|name it/i.test(t), false, t);
  assert.equal(/already defined/i.test(t), false, t);
});

// ---- 3.5 cdn-budget tier 2 ----

const BUDGET = stepOf('cardinality', 'tradeoff', 'cdn-budget').tradeoff;

test('cdn-budget tier 2: on the two-option customer knob a wrong pick has no decoy, so it does not name the knob; the next wrong knob is used, else tier 1', () => {
  const right = { ...BUDGET.answer };
  const lastOnly = tradeoffHint(BUDGET, { ...right, customer: 'nothing' }, 2);
  assert.deepEqual(lastOnly.hinted, []);
  assert.equal(lastOnly.html, tradeoffHint(BUDGET, {}, 1).html, 'only the two-option knob is wrong: the tier 1 text');
  assert.equal(lastOnly.html.includes('Look again at'), false);
  const two = tradeoffHint(BUDGET, { ...right, customer: 'nothing', served: 'none' }, 2);
  assert.deepEqual([...new Set(two.hinted.map((x) => x.knob))], ['served'], 'a later wrong knob with a decoy is hinted instead');
});
