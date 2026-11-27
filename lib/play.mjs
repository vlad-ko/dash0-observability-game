// Declarative levels (docs/DECLARATIVE-LEVELS.md §3, §5): the step types, validatePlay and
// runPlay. A level's `play` is plain data; the registry copies and freezes it and builds
// `run` from runPlay. The only home of the Next/Finish gating; the step frame (step, lesson,
// question, actions and the buttons) is the UI kit's (lib/ui, #158), and each step type's
// `wide` decides the step's width. Penalties live in each widget's mount, never here (PI1).
// No timers, no module state (PI2). DOM-free at import.
// The registry never imports this file (widgets import isId from it): app.mjs passes the kit.

import { checkKeys, isId } from './registry.mjs';
import { guideAllowed } from './guide/context.mjs';
import { guidePanelHtml, mountGuidePanel } from './guide/panel.mjs';
import { actions, codeBlock, finishButton, nextButton, prose, question, step as kitStep } from './ui/index.mjs';
import { drawChoiceBoard, drawSortBoard, shownOf, validateChoicePool, validateSortPool } from './pool.mjs';
import { choiceHtml, mountChoice, validateChoiceSpec } from './widgets/choice.mjs';
import { newSortState, validateSortSpec } from './widgets/sort-it.mjs';
import { sortHelps, validateSortHelps } from './widgets/sort-it-help.mjs';
import { renderSort, mountSort } from './widgets/sort-it-view.mjs';
import { checkBuild, newBuildState, validateBuildSpec } from './widgets/build-it.mjs';
import { renderBuild, mountBuild } from './widgets/build-it-view.mjs';
import { buildHelps, buildReason, validateBuildHelps } from './widgets/build-it-help.mjs';
import { newIncident, validateScenario } from './widgets/incident.mjs';
import { incidentLesson, renderIncident, mountIncident } from './widgets/incident-view.mjs';
import { newSpotState, validateSpotSpec } from './widgets/spot-it.mjs';
import { renderSpot, mountSpot } from './widgets/spot-it-view.mjs';
import { spotHelps, validateSpotHelps } from './widgets/spot-it-help.mjs';
import { newTradeoffState, validateTradeoffSpec } from './widgets/trade-off.mjs';
import { renderTradeoff, mountTradeoff } from './widgets/trade-off-view.mjs';
import { tradeoffHelps, validateTradeoffHelps } from './widgets/trade-off-help.mjs';
import { newQueryState, validateQuerySpec } from './widgets/query-it.mjs';
import { renderQuery, mountQuery } from './widgets/query-it-view.mjs';
import { queryHelps, validateQueryHelps } from './widgets/query-it-help.mjs';
import { newConfigureState, validateConfigureSpec } from './widgets/configure-it.mjs';
import { renderConfigure, mountConfigure } from './widgets/configure-it-view.mjs';
import { configureHelps, validateConfigureHelps } from './widgets/configure-it-help.mjs';
import { validateDash0Spec } from './widgets/dash0-task.mjs';
import { mountDash0Task, renderDash0 } from './widgets/dash0-task-view.mjs';

const TOKEN = /^[A-Za-z][\w-]*$/;
const MIN_FINISH = 10;
const PLAY_KEYS = ['prefix', 'steps', 'finish'];
const STEP_KEYS = ['intro', 'question', 'show', 'code', 'qid'];
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isToken = (v) => typeof v === 'string' && TOKEN.test(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const has = (o, k) => Object.hasOwn(o, k);

const q = (v) => JSON.stringify(v);
/** Unknown-key problems: `spec` against `keys`, then each object in `groups[name]` (a list, or an object's values) against its keys. */
function unknownKeys(spec, keys, groups = {}) {
  const problems = [];
  if (!isObject(spec)) return problems;
  checkKeys(problems, spec, keys, 'spec');
  for (const [field, [allowed, name]] of Object.entries(groups)) {
    const list = spec[field];
    const entries = Array.isArray(list) ? list.map((x, i) => [i, x]) : isObject(list) ? Object.entries(list) : [];
    for (const [k, x] of entries) if (isObject(x)) checkKeys(problems, x, allowed, name(x, k));
  }
  return problems;
}
const SORT_KEYS = { buckets: [['id', 'label'], (b) => `bucket ${q(b.id)}`], items: [['id', 'label', 'bucket', 'why', 'whyNot'], (x) => `item ${q(x.id)}`] };
const SPAN_KEYS = ['spanId', 'traceId', 'name', 'service', 'kind', 'status', 'startMs', 'endMs', 'parentId', 'links', 'attributes', 'events'];
const LOG_KEYS = ['id', 'timeMs', 'severity', 'service', 'body', 'traceId', 'spanId', 'attributes'];
const BUILD_KEYS = {
  spans: [SPAN_KEYS, (x, i) => `span ${i}`],
  logs: [LOG_KEYS, (x, i) => `log ${i}`],
  answer: [['parentId', 'kind', 'status', 'links'], (x, id) => `answer ${id}`],
};
const SPOT_KEYS = { lines: [['id', 'text'], (l) => `line ${q(l.id)}`] };
const TRADEOFF_KEYS = {
  knobs: [['id', 'label', 'options'], (k) => `knob ${q(k.id)}`],
  needs: [['id', 'label'], (n) => `need ${q(n.id)}`],
};
const SCENARIO_KEYS = {
  views: [['id', 'label', 'costMin', 'html', 'kind'], (v) => `view ${q(v.id)}`],
  hypotheses: [['id', 'label', 'right', 'why'], (h) => `hypothesis ${q(h.id)}`],
};

/** Step types named in the design but not built yet: key -> the widget that will add it. None now. */
export const RESERVED = Object.freeze({});

/**
 * The live step types. Each: `key`; `mechanic` (a MECHANICS value, null for choice);
 * `surface` ('game' or 'dash0': where the step happens; the kit step shows it as a chip and `data-surface`, #509); `labelled` (a question is required and render gets labelledBy); `wide` (the step is
 * --layout-wide, for a board with a side column, else --layout-narrow; #158); optional
 * `lesson(intro) -> html` (the lesson card's body, from the step's intro; default: the intro);
 * `reason` (a string, or a function of the spec: the start of the sentence that says why Next or Finish is disabled, "<reason> to continue."; it names Check only on a board that has one); `idOf(spec)`; optional `hints(spec) -> boolean` (whether the mount shows a Hint button, decided the way the
 * mount decides it; absent for a type with no Hint button, choice (its 50/50 is not a Hint button); the how-to-play
 * help reads it through validatePlay's `hintless`);
 * `validate(spec) -> string[]` (pure, never throws); `render(ctx, spec, {labelledBy}) -> html`;
 * `mount(ctx, spec, {onDone})`, which calls onDone() once when the step is solved. Optional `draw(ctx, spec) -> board`
 * (choice and sort only, #390): a spec that states `draw` is an answer pool, and runPlay draws one board from it each
 * time the step is shown; every other member then gets the board, never the pool (lib/pool.mjs).
 */
export const STEP_TYPES = Object.freeze({
  choice: {
    key: 'choice',
    surface: 'game',
    reason: 'Pick the right answer',
    mechanic: null,
    labelled: true,
    wide: false,
    idOf: (spec) => spec.id,
    validate(spec) {
      if (!isObject(spec)) return ['spec: not an object'];
      const problems = [];
      checkKeys(problems, spec, ['id', 'choices', 'draw'], 'spec');
      if (!isId(spec.id)) problems.push(`spec id ${JSON.stringify(spec.id) ?? String(spec.id)} is not kebab-case`);
      if (Array.isArray(spec.choices) && spec.choices.length < 2) problems.push('needs at least 2 choices');
      return [...problems, ...(has(spec, 'draw') ? validateChoicePool(spec) : validateChoiceSpec(spec.choices))];
    },
    draw: (ctx, spec) => drawChoiceBoard(spec, ctx.shuffle),
    render: (ctx, spec, { labelledBy }) => choiceHtml(ctx, spec.choices, { id: spec.id, labelledBy }),
    mount: (ctx, spec, { onDone }) => mountChoice(ctx, spec.choices, { id: spec.id, onRight: onDone }),
  },
  sort: {
    key: 'sort',
    surface: 'game',
    reason: 'Sort every item',
    mechanic: 'sort',
    wide: true,
    labelled: true,
    idOf: (spec) => spec.id,
    validate(spec) {
      const pooled = isObject(spec) && has(spec, 'draw');
      const problems = [...unknownKeys(spec, ['id', 'buckets', 'items', 'helps', 'hint', 'draw'], SORT_KEYS), ...(pooled ? [] : validateSortSpec(spec))];
      if (problems.length) return problems;
      return pooled ? validateSortPool(spec) : validateSortHelps(spec);
    },
    draw: (ctx, spec) => drawSortBoard(spec, ctx.shuffle),
    render: (ctx, spec, { labelledBy }) =>
      renderSort(spec, newSortState(spec), { escapeHtml: ctx.escapeHtml, labelledBy }),
    hints: (spec) => sortHelps(spec).hints,
    mount: (ctx, spec, { onDone }) => mountSort(ctx, spec, { onComplete: onDone }),
  },
  build: {
    key: 'build',
    surface: 'game',
    reason: buildReason,
    mechanic: 'build',
    wide: true,
    labelled: false,
    idOf: (spec) => spec.id,
    validate(spec) {
      const problems = [
        ...unknownKeys(spec, ['id', 'spans', 'edit', 'answer', 'logs', 'hint', 'explain', 'helps', 'closing'], BUILD_KEYS),
        ...validateBuildSpec(spec),
      ];
      if (problems.length) return problems;
      const helps = validateBuildHelps(spec);
      if (helps.length) return helps;
      return checkBuild(spec, newBuildState(spec)).ok
        ? ['the given state already passes Check, so there is nothing to do']
        : [];
    },
    render: (ctx, spec) => renderBuild(spec, newBuildState(spec), { escapeHtml: ctx.escapeHtml }),
    hints: (spec) => buildHelps(spec).hints,
    mount: (ctx, spec, { onDone }) => mountBuild(ctx, spec, { onComplete: onDone }),
  },
  incident: {
    key: 'incident',
    surface: 'game',
    reason: 'Name the cause',
    mechanic: 'incident',
    wide: true,
    labelled: false,
    lesson: incidentLesson,
    idOf: (spec) => spec.id,
    validate(spec) {
      const keys = ['id', 'alert', 'budget', 'views', 'hypotheses', 'answerAfterViews', 'hint'];
      const nested = [];
      if (isObject(spec)) {
        if (isObject(spec.alert)) checkKeys(nested, spec.alert, ['title', 'html'], 'alert');
        if (isObject(spec.budget)) checkKeys(nested, spec.budget, ['startPct', 'burnPctPerMin'], 'budget');
      }
      return [...unknownKeys(spec, keys, SCENARIO_KEYS), ...nested, ...validateScenario(spec)];
    },
    render: (ctx, spec) => renderIncident(spec, newIncident(spec), { escapeHtml: ctx.escapeHtml }),
    hints: () => true,
    mount: (ctx, spec, { onDone }) => mountIncident(ctx, spec, { onComplete: onDone }),
  },
  spot: {
    key: 'spot',
    surface: 'game',
    reason: 'Pick every line that matches and press Check',
    mechanic: 'spot',
    wide: true,
    labelled: true,
    idOf: (spec) => spec.id,
    validate(spec) {
      const problems = [...unknownKeys(spec, ['id', 'target', 'lines', 'faults', 'whyNot', 'explain', 'helps', 'hint'], SPOT_KEYS), ...validateSpotSpec(spec)];
      return problems.length ? problems : validateSpotHelps(spec);
    },
    render: (ctx, spec, { labelledBy }) =>
      renderSpot(spec, newSpotState(spec), { escapeHtml: ctx.escapeHtml, labelledBy }),
    hints: (spec) => spotHelps(spec).hints,
    mount: (ctx, spec, { onDone }) => mountSpot(ctx, spec, { onComplete: onDone }),
  },
  tradeoff: {
    key: 'tradeoff',
    surface: 'game',
    reason: 'Pick a plan that fits and press Check',
    mechanic: 'tradeoff',
    wide: true,
    labelled: true,
    idOf: (spec) => spec.id,
    validate(spec) {
      const keys = ['id', 'unit', 'unitOne', 'cap', 'knobs', 'needs', 'answer', 'whyNot', 'explain', 'helps', 'hint'];
      const options = [];
      if (isObject(spec) && Array.isArray(spec.knobs)) {
        for (const k of spec.knobs) {
          const list = isObject(k) && Array.isArray(k.options) ? k.options : [];
          for (const o of list) if (isObject(o)) checkKeys(options, o, ['id', 'label', 'cost', 'keeps'], `option ${q(o.id)} of knob ${q(k.id)}`);
        }
      }
      const found = [...unknownKeys(spec, keys, TRADEOFF_KEYS), ...options, ...validateTradeoffSpec(spec)];
      return found.length ? found : validateTradeoffHelps(spec);
    },
    hints: (spec) => tradeoffHelps(spec).hints,
    render: (ctx, spec, { labelledBy }) =>
      renderTradeoff(spec, newTradeoffState(spec), { escapeHtml: ctx.escapeHtml, labelledBy }),
    mount: (ctx, spec, { onDone }) => mountTradeoff(ctx, spec, { onComplete: onDone }),
  },
  query: {
    key: 'query',
    surface: 'game',
    reason: 'Run a query that passes',
    mechanic: 'query',
    wide: true,
    labelled: true,
    idOf: (spec) => spec.id,
    validate(spec) {
      const problems = [...unknownKeys(spec, ['id', 'dataset', 'at', 'reference', 'given', 'hint', 'explain', 'helps']), ...validateQuerySpec(spec)];
      return problems.length ? problems : validateQueryHelps(spec);
    },
    render: (ctx, spec, { labelledBy }) =>
      renderQuery(spec, newQueryState(spec), { escapeHtml: ctx.escapeHtml, labelledBy }),
    hints: (spec) => queryHelps(spec).hints,
    mount: (ctx, spec, { onDone }) => mountQuery(ctx, spec, { onComplete: onDone }),
  },
  configure: {
    key: 'configure',
    surface: 'game',
    reason: 'Fix the config and press Check',
    mechanic: 'configure',
    wide: true,
    labelled: true,
    idOf: (spec) => spec.id,
    validate(spec) {
      const problems = [...unknownKeys(spec, ['id', 'schema', 'given', 'reference', 'target', 'uses', 'extensions', 'forbids', 'withhold', 'hint', 'explain', 'helps']), ...validateConfigureSpec(spec)];
      return problems.length ? problems : validateConfigureHelps(spec);
    },
    render: (ctx, spec, { labelledBy }) =>
      renderConfigure(spec, newConfigureState(), { escapeHtml: ctx.escapeHtml, labelledBy }),
    hints: (spec) => configureHelps(spec).hints,
    mount: (ctx, spec, { onDone }) => mountConfigure(ctx, spec, { onComplete: onDone }),
  },
  // The one In Dash0 type (#509): the player does a task in the real Dash0, the task server checks it. runPlay leaves it out
  // when ctx.dash0Task is not available; it has no mechanic, no Hint button and no Ask the guide.
  dash0: {
    key: 'dash0',
    surface: 'dash0',
    reason: 'Do the task in Dash0 and press Check',
    mechanic: null,
    wide: false,
    labelled: false,
    idOf: (spec) => spec.id,
    validate: validateDash0Spec,
    render: (ctx, spec) => renderDash0(ctx, spec),
    mount: (ctx, spec, { onDone }) => mountDash0Task(ctx, spec, { onDone }),
  },
});

const keysOf = (types) => Object.keys(types);
const typeKeysOf = (types) => [...keysOf(types), ...Object.keys(RESERVED)];
const typeOf = (types, step) => types[keysOf(types).find((k) => has(step, k))];

/** What is wrong with `v` as plain data, as `{path, what}`; objects, arrays, strings, finite numbers, booleans, null. */
function nonPlain(v, path = '', stack = new Set()) {
  const at = (k) => (/^\d+$/.test(k) && Array.isArray(v) ? `${path}[${k}]` : path ? `${path}.${k}` : k);
  const bad = (what) => [{ path: path || 'play', what }];
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return [];
  if (typeof v === 'number') return Number.isFinite(v) ? [] : bad(`the number ${v}`);
  if (typeof v !== 'object') return bad(v === undefined ? 'undefined' : `a ${typeof v}`);
  if (stack.has(v)) return bad('circular');
  const proto = Object.getPrototypeOf(v);
  if (proto !== (Array.isArray(v) ? Array.prototype : Object.prototype) && proto !== null) {
    return bad(`a ${Object.prototype.toString.call(v).slice(8, -1)}, not plain data`);
  }
  stack.add(v);
  const out = [];
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) if (!(i in v)) out.push({ path: at(String(i)), what: 'a hole in an array' });
  }
  for (const k of Reflect.ownKeys(v)) {
    if (Array.isArray(v) && k === 'length') continue;
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (typeof k === 'symbol') out.push({ path: path || 'play', what: 'a symbol key' });
    else if (d.get || d.set) out.push({ path: at(k), what: 'an accessor' });
    else out.push(...nonPlain(d.value, at(k), stack));
  }
  stack.delete(v);
  return out;
}

/** The problems of step `n` (1-based), pushed to `errors`; marks its ids in `seen`. */
function checkStep(errors, step, n, seen, types) {
  const LIVE_KEYS = keysOf(types);
  const TYPE_KEYS = typeKeysOf(types);
  const at = `step ${n}`;
  if (!isObject(step)) return void errors.push(`${at} must be an object`);
  checkKeys(errors, step, [...STEP_KEYS, ...TYPE_KEYS], at, [], (k, w, tail) => `${w}: unknown key ${k}${tail}`);
  const keys = Object.keys(step).filter((k) => TYPE_KEYS.includes(k));
  if (keys.length === 0) return void errors.push(`${at} has no step type (one of ${LIVE_KEYS.join(', ')})`);
  if (keys.length > 1) return void errors.push(`${at} has two step types (${keys.map((k) => JSON.stringify(k)).join(', ')})`);
  const [key] = keys;
  if (has(RESERVED, key)) {
    return void errors.push(`${at}: step type "${key}" is reserved for ${RESERVED[key]} and not available yet`);
  }
  const type = types[key];
  const spec = step[key];
  const id = isObject(spec) && typeof spec.id === 'string' ? spec.id : '?';
  const of = `${at} (${key} "${id}")`;
  if (!isText(step.intro)) errors.push(`${at}: intro must be text`);
  if (step.question !== undefined && !isText(step.question)) errors.push(`${at}: question must be text`);
  else if (step.question === undefined && type.labelled) errors.push(`${of}: needs a question`);
  for (const k of ['show', 'code']) {
    if (step[k] !== undefined && typeof step[k] !== 'string') errors.push(`${at}: ${k} must be a string`);
  }
  if (step.qid !== undefined && !isToken(step.qid)) errors.push(`${at}: qid must be a plain token`);
  for (const p of type.validate(spec)) errors.push(`${of}: ${p}`);
  const claim = (kind, name) => {
    const by = seen[kind].get(name);
    if (by === undefined) seen[kind].set(name, n);
    else errors.push(`${at}: ${kind} id "${name}" is already used by step ${by}`);
  };
  if (id !== '?') claim('widget', id);
  if (isText(step.question)) {
    const heading = step.qid ?? (id === '?' ? undefined : `${id}-q`);
    if (isToken(heading)) claim('heading', heading);
  }
  return undefined;
}

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * The finish text is shown whether or not the In Dash0 steps ran (a level without a task server plays as a game-only level, #509),
 * so it may not refer to one: not the phrase "In Dash0" (the step's chip), nor a dash0 step's id or task id. Pure.
 */
function finishProblems(play, types) {
  if (typeof play.finish !== 'string' || !Array.isArray(play.steps)) return [];
  const problems = [];
  const names = (spec, ...keys) => keys.map((k) => spec[k]).filter((v) => typeof v === 'string' && v !== '');
  if (/\bin dash0\b/i.test(play.finish) && play.steps.some((s) => isObject(s) && typeOf(types, s)?.surface === 'dash0')) {
    problems.push('play.finish refers to an In Dash0 step ("In Dash0"): the text is the same whether or not the task ran, so it may not mention it');
  }
  for (const step of play.steps) {
    const type = isObject(step) ? typeOf(types, step) : undefined;
    if (type?.surface !== 'dash0' || !isObject(step[type.key])) continue;
    for (const name of names(step[type.key], 'id', 'task')) {
      if (new RegExp(`(?<![\\w-])${escapeRe(name)}(?![\\w-])`, 'i').test(play.finish)) {
        problems.push(`play.finish refers to the In Dash0 step "${name}": the text is the same whether or not the task ran, so it may not mention it`);
      }
    }
  }
  return problems;
}

/**
 * Every problem with a level's `play`, as `{errors, mechanics, widgets, hintless, surfaces}`. `mechanics` are the steps'
 * mechanics in order of first appearance; `widgets` the same for every step type, choice included;
 * `hintless` the widgets that can have a Hint button (not choice, whose 50/50 is not one) and none of whose steps shows
 * a Hint button (each type's `hints(spec)` mirrors its mount); `surfaces` the steps' surfaces, in order of first appearance.
 * The three lists above come from 'game' steps only: an In Dash0 step adds no mechanic, widget or help to the level (#509).
 * A level needs a 'game' step, and step 1 is never 'dash0'. Pure; never throws, never stops at the first.
 * `types` is for tests (a fixture type); the game always uses STEP_TYPES.
 */
export function validatePlay(play, types = STEP_TYPES) {
  const none = (errors) => ({ errors, mechanics: [], widgets: [], hintless: [], surfaces: [] });
  try {
    if (!isObject(play)) return none(['play must be an object']);
    const plain = nonPlain(play);
    if (plain.length) {
      return none(plain.map((p) => `play must be plain data: ${p.path} is ${p.what}; write run(ctx) for custom behaviour`));
    }
    const errors = [];
    checkKeys(errors, play, PLAY_KEYS, 'play');
    if (play.prefix !== undefined && !isToken(play.prefix)) errors.push('play.prefix must be a plain token');
    if (typeof play.finish !== 'string' || play.finish.length <= MIN_FINISH) {
      errors.push(`play.finish must be reward text longer than ${MIN_FINISH} characters`);
    }
    if (!Array.isArray(play.steps) || play.steps.length === 0) {
      errors.push('play.steps must be a non-empty array');
      return none(errors);
    }
    const seen = { widget: new Map(), heading: new Map() };
    const mechanics = [];
    const widgets = [];
    const surfaces = [];
    const hinted = new Set();
    play.steps.forEach((step, i) => {
      checkStep(errors, step, i + 1, seen, types);
      const type = isObject(step) ? typeOf(types, step) : undefined;
      if (!type) return;
      if (!surfaces.includes(type.surface)) surfaces.push(type.surface);
      if (type.surface === 'dash0') {
        if (i === 0) errors.push('step 1 cannot be In Dash0: a level opens in the game');
        return;
      }
      if (type.mechanic && !mechanics.includes(type.mechanic)) mechanics.push(type.mechanic);
      if (!widgets.includes(type.key)) widgets.push(type.key);
      const spec = step[type.key];
      if (isObject(spec) && type.hints?.(spec)) hinted.add(type.key);
    });
    if (surfaces.length > 0 && !surfaces.includes('game')) errors.push('play needs at least one step in the game');
    errors.push(...finishProblems(play, types));
    return { errors, mechanics, widgets, hintless: widgets.filter((w) => types[w].hints && !hinted.has(w)), surfaces };
  } catch {
    return none(['play could not be read']);
  }
}

/**
 * Ask the guide's panel: into the side column's `[data-guide-slot]` on a board, else after the widget (a choice step).
 * `shown` is what a pooled step's board shows (lib/pool.mjs shownOf), sent with every question; undefined for a fixed step.
 */
function mountPanel(ctx, { levelId, stepId, signal, shown }) {
  const slot = ctx.ovBody.querySelector('[data-guide-slot]');
  const host = slot ?? ctx.ovBody.querySelector('.ui-step') ?? ctx.ovBody;
  let root = slot;
  if (!slot) {
    root = host.ownerDocument.createElement('div');
    host.append(root);
  }
  root.innerHTML = guidePanelHtml();
  return mountGuidePanel(ctx, root, { levelId, stepId, signal, shown });
}

/**
 * Play `level` (a built registry level with `play`) on `ctx`: each step is one kit step
 * (wide when its type is) holding the lesson card (ctx.speech), an optional lead-in (prose)
 * and code, the question and the widget, with Next (Finish on the last) in the actions bar,
 * disabled until the widget calls onDone. Finish awards `level.cards`. One closure per run:
 * reopening a level starts at step 1.
 */
export function runPlay(level, ctx, types = STEP_TYPES) {
  const { finish, prefix = level.id } = level.play;
  // The In Dash0 steps run only when the task server can take them, decided once when the level opens (#509): when it
  // cannot (signed out, server off, ?mode=debug) they are left out and the level plays as a game-only level, its last
  // game step showing Finish. Validation guarantees step 1 is in the game, so the filtered run is never empty.
  const dash0 = Boolean(ctx.dash0Task?.available?.());
  const steps = level.play.steps.filter((s) => dash0 || typeOf(types, s).surface !== 'dash0');
  // A level that leaves its In Dash0 steps out says so (D7): the task ids go to ctx.dash0Task.skip with the cause ('off' or
  // 'signed-out'), which remembers them and shows the notice. Without a ctx.dash0Task (?mode=debug, no fetch) nothing is said.
  const left = dash0 ? [] : level.play.steps.filter((s) => typeOf(types, s).surface === 'dash0');
  if (left.length > 0 && ctx.dash0Task) {
    ctx.dash0Task.skip?.(left.map((s) => s[typeOf(types, s).key].task).filter((t) => typeof t === 'string'), ctx.dash0Task.reason?.() ?? 'off');
  }
  // One AbortController per step (Ask the guide, #17): Next and close abort it, so a pending reply is
  // never drawn or charged on another step.
  let stepAbort = null;
  ctx.signal?.addEventListener?.('abort', () => stepAbort?.abort(), { once: true });
  const show = (i) => {
    stepAbort?.abort();
    stepAbort = new AbortController();
    const stepSignal = stepAbort.signal;
    const step = steps[i];
    const type = typeOf(types, step);
    // An answer pool (#390) is drawn once per showing, here and nowhere else: the board is fixed for this showing, so
    // render, mount, the 50/50, hints and the guide all see the same one. Drawing in render and in mount would mismatch.
    const pooled = type.draw !== undefined && has(step[type.key], 'draw');
    const spec = pooled ? type.draw(ctx, step[type.key]) : step[type.key];
    const last = i === steps.length - 1;
    // The level clock stops while the player is in Dash0, so par covers the game steps only and a level's par is the same
    // whether or not the In Dash0 steps ran (docs/FOUNDATION.md §2.1).
    if (type.surface === 'dash0') ctx.pauseClock?.();
    else ctx.resumeClock?.();
    const qid = step.qid ?? `${type.idOf(spec)}-q`;
    const labelledBy = step.question != null && type.labelled ? qid : undefined;
    const lead = step.show == null ? '' : prose(step.show);
    const code = step.code == null ? '' : codeBlock(step.code);
    const heading = step.question == null ? '' : question({ id: qid, html: step.question });
    const why = typeof type.reason === 'function' ? type.reason(spec) : type.reason;
    const body = `${ctx.speech(type.lesson ? type.lesson(step.intro) : step.intro)}${lead}${code}${heading}${type.render(ctx, spec, { labelledBy })}`;
    ctx.renderStep(
      kitStep({ surface: type.surface, wide: type.wide, bodyHtml: body }),
      actions({ wide: type.wide, buttonsHtml: last ? finishButton(`${prefix}-finish`, `${why} to finish the level.`) : nextButton(`${prefix}-next`, `${why} to continue.`) }),
    );
    const btn = ctx.ovActions.querySelector(`#${prefix}-${last ? 'finish' : 'next'}`);
    btn.onclick = last ? () => ctx.finish({ text: finish, cards: level.cards }) : () => show(i + 1);
    let panel = null;
    let solved = false; // a widget may call onDone while it mounts, before the panel exists
    type.mount(ctx, spec, {
      onDone: () => {
        solved = true;
        panel?.disable();
        btn.disabled = false;
        return btn;
      },
    });
    if (ctx.guide?.configured && guideAllowed(type, spec)) {
      panel = mountPanel(ctx, { levelId: level.id, stepId: type.idOf(spec), signal: stepSignal, shown: pooled ? shownOf(spec) : undefined });
      if (solved) panel.disable();
    }
  };
  show(0);
}
