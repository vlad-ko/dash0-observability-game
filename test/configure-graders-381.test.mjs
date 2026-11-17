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
import { newConfigureState, runConfigure, validateConfigureSpec } from '../lib/widgets/configure-it.mjs';
import { STEP_TYPES } from '../lib/play.mjs';
import { answerTokens, withholds } from '../lib/guide/context.mjs';
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
  const marker = '  load_balancing:\n';
  assert.equal(AGW.reference.includes(marker), true, 'the reference defines load_balancing');
  const service = AGW.reference.replace(marker, `${marker}    routing_key: service\n`);
  assert.equal(service.includes('routing_key: service'), true, 'the wrong key was injected');
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

test('the explain of agw-config and col-config leaves the later answers to their own steps', () => {
  const agw = plain(AGW.explain);
  assert.equal(/traceID|every span of a trace goes/.test(agw), false, agw);
  const col = plain(COL.explain);
  assert.equal(/multiline|operators/.test(col), false, col);
  assert.equal(col.includes('include') && col.includes('start_at'), true);
});

test('withhold: a configure spec may list [key, value] pairs for the Guide; anything else is a spec problem', () => {
  assert.deepEqual(validateConfigureSpec(AGW), []);
  assert.deepEqual(AGW.withhold, [['routing_key', 'traceID'], ['routing_key', 'service']]);
  for (const bad of [[], 'routing_key', [['routing_key']], [['routing_key', '']], [['a', 'b', 'c']], [[1, 2]]]) {
    assert.equal(validateConfigureSpec({ ...AGW, withhold: bad }).some((p) => p.startsWith('withhold')), true, JSON.stringify(bad));
  }
});

test('the Guide withholds the settings a later step asks on its config step, though the reference no longer writes them', () => {
  const tokens = (spec) => answerTokens(STEP_TYPES.configure, spec);
  assert.equal(withholds('Set routing_key to traceID.', tokens(AGW)), true);
  assert.equal(withholds('Set routing_key to traceID.', tokens({ ...AGW, withhold: undefined })), false, 'it is the withhold list that does it');
  assert.equal(withholds('Set start_at to beginning and use a regex_parser operator.', tokens(COL)), true);
  assert.equal(withholds('Set start_at to beginning and use a regex_parser operator.', tokens({ ...COL, withhold: undefined })), false);
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
  assert.notEqual(lastOnly.html, tradeoffHint(BUDGET, {}, 1).html, 'a tier 2 that repeats tier 1 costs a hint for nothing');
  assert.equal(lastOnly.html, '<p>Your picks fit the cap, but 1 of the needs is not kept yet.</p>', 'what the plan lacks, from the evaluation');
  assert.equal(/Look again|customer|attribute|counter/i.test(plain(lastOnly.html)), false, 'no knob is named');
  const over = tradeoffHint(BUDGET, { ...right, customer: 'nothing', requests: 'route-status-tier' }, 2);
  assert.deepEqual(over.hinted.map((x) => x.knob), ['requests', 'requests'], 'a wrong knob that has a decoy is hinted first');
});
