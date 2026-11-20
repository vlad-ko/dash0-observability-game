// Joins a content file's text to a level's logic (#391, docs/CONTENT.md). Generic: no widget knowledge beyond the
// key lists in keys.mjs. Pure; `bindText` never throws, `bindLevel` throws one ContentError holding every problem.
//
// Merge rules. Content mirrors the widget spec's shape and carries text and the ids it joins on.
// Objects: the union of the keys. A key on both sides must be an identity key (id, key) with equal values, or an
// object or array on both sides; two leaves for one key are an error. Arrays on both sides join by `id ?? key`
// (a step's identity is its widget key plus the widget's id): content order wins, logic may annotate a subset, a
// logic element with no content partner is an error, and `steps` must list the same identities on both sides.
// A value on one side only is taken whole. The result shares nothing with either input.
//
// A run(ctx) level's words live under one top-level key, `run` (free mode: named lowerCamelCase entries holding
// strings, objects and lists; no logic-only keys; every string may hold HTML and is checked as HTML after its
// fill-ins; the content has `run` exactly when the logic does). `bindRunLevel` hands the bound `run`
// to the level's screen code as `say`. Slots (`slots: [...]`) are fill-ins only the code can answer: they stay in
// the bound text as `{{name}}`, are checked with a stand-in, and are filled by `fillSlots` at run time.
import { CONTAINER_KEYS, CONTENT_KEYS, FIXTURE_KEYS, IDENTITY_KEYS, LOGIC_ONLY_KEYS, MAP_KEY, MARKER_FREE_KEYS, MARKER_KEYS, PLAIN_KEYS, RUN_KEY, STEP_TYPE_KEYS, TEXT_KEYS } from './keys.mjs';
import { fill } from './placeholders.mjs';
import { glossSpan, hasMarker, parseTerms } from './terms.mjs';
import { checkCode, checkHtml, checkPlain, isId } from './text-rules.mjs';

/** Thrown by `bindLevel`: `levelId` and every problem in `errors`; the message lists them all. */
export class ContentError extends Error {
  constructor(levelId, errors) {
    super(`content of level ${levelId} has ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n- ${errors.join('\n- ')}`);
    this.name = 'ContentError';
    this.levelId = levelId;
    this.errors = errors;
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v === 'object' ? 'an object' : `a ${typeof v}`);
const has = (o, k) => Object.hasOwn(o, k);
const clone = (v) => (Array.isArray(v) ? v.map(clone) : isObject(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
const join = (path, key) => (path ? `${path}.${key}` : key);
const SLOT_FILL = /\{\{([a-z][a-z0-9-]*)\}\}/g;
/** A tag as `checkHtml` reads it: a `>` inside a quoted attribute value does not end it. */
const TAG_SPAN = /<[A-Za-z/!?](?:"[^"]*"|'[^']*'|[^>"'])*>/g;
const RUN_ENTRY_NAME = /^[a-z][a-zA-Z0-9]*$/;
/** True when a `{{` is inside a tag of `text`. Only slots can remain in text whose vars are filled. */
const slotInTag = (text) => [...text.matchAll(TAG_SPAN)].some((m) => m[0].includes('{{'));
/** What a slot is checked as: any plain word. A slot used as a tag or attribute name is an error; a slot anywhere else inside a tag is caught by `slotInTag`. */
const SLOT_STAND_IN = 'x';

/** The identity of an element of an array, or undefined. `steps` elements are `<widget key>:<widget id>`. */
function identityOf(el, inSteps) {
  if (!isObject(el)) return undefined;
  if (inSteps) {
    const type = STEP_TYPE_KEYS.find((k) => has(el, k));
    const id = type && isObject(el[type]) ? el[type].id : undefined;
    return typeof id === 'string' ? `${type}:${id}` : undefined;
  }
  const v = el.id ?? el.key;
  return typeof v === 'string' ? v : undefined;
}

// ---- content: shape, fill-ins, text rules --------------------------------------------------------------

function checkText(value, key, path, errors) {
  // `code` and `finish` may hold line breaks (six live levels write a multi-line finish).
  const problems = key === 'code' || key === 'finish' ? checkCode(value) : PLAIN_KEYS.includes(key) ? checkPlain(value) : checkHtml(value);
  for (const p of problems) errors.push(`${path} ${p}`);
}

/** A fresh copy of the content with its {{name}} fill-ins filled; every problem goes to `errors`, every used name to `used`. */
function readContent(node, key, path, ctx) {
  const { errors } = ctx;
  if (Array.isArray(node)) {
    const seen = new Set();
    for (const el of node) {
      const id = identityOf(el, false);
      if (id !== undefined && seen.has(id)) errors.push(`${path}: "${id}" appears twice`);
      seen.add(id);
    }
    return node.map((x, i) => readContent(x, key, `${path}[${i}]`, ctx));
  }
  if (isObject(node)) {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const at = join(path, k);
      if (key === MAP_KEY) {
        out[k] = leaf(v, MAP_KEY, at, ctx);
      } else if (k === RUN_KEY && path === '') {
        if (!isObject(v)) errors.push(`${at}: must be an object of named entries, not ${kindOf(v)}`);
        else out[k] = readRun(v, at, 0, ctx);
      } else if (!CONTENT_KEYS.includes(k) || k === RUN_KEY) {
        errors.push(`${at}: "${k}" is not a content key (text, ids and containers only)`);
      } else if (CONTAINER_KEYS.includes(k)) {
        if (v === null || typeof v !== 'object') errors.push(`${at}: must be an object or an array, not ${kindOf(v)}`);
        else out[k] = readContent(v, k, at, ctx);
      } else if (k === MAP_KEY) {
        if (!isObject(v)) errors.push(`${at}: must be an object mapping a key to text, not ${kindOf(v)}`);
        else out[k] = readContent(v, MAP_KEY, at, ctx);
      } else {
        out[k] = leaf(v, k, at, ctx);
      }
    }
    return out;
  }
  errors.push(`${path}: must be an object or an array`);
  return node;
}

// ---- glossary term markers (#442) ----------------------------------------------------------------------------
// `[[shown|term-id]]` and `[[shown]]` are read in a play step's intro and show only. Bind checks the syntax and writes each
// marker as a neutral gloss span (lib/content/terms.mjs); whether the term exists is judged against the glossary by
// `checkLevelTerms` (test/level-terms.test.mjs), not here: this module never imports the glossary (docs/CONTENT.md section 5.1).
const CODE_REGION = /<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi;
const NOT_SHOWN = /[<>&]|\{\{/;

/** `v` cut into code regions (`<pre>`, `<code>`: literal, never read for markers) and the text between them. */
function segmentsOf(v) {
  const out = [];
  let at = 0;
  for (const m of v.matchAll(CODE_REGION)) {
    if (m.index > at) out.push({ code: false, text: v.slice(at, m.index) });
    out.push({ code: true, text: m[0] });
    at = m.index + m[0].length;
  }
  if (at < v.length) out.push({ code: false, text: v.slice(at) });
  return out;
}

const markerOutsideCode = (v) => segmentsOf(v).some((s) => !s.code && hasMarker(s.text));

/** The segments of `v` with each text segment parsed into `parts`, or `{problem}` (a phrase) for the first broken marker. */
function readMarkers(v) {
  const segments = segmentsOf(v);
  for (const seg of segments) {
    if (seg.code) continue;
    if ([...seg.text.matchAll(TAG_SPAN)].some((m) => hasMarker(m[0]))) return { problem: 'a term marker must not be inside a tag' };
    const parsed = parseTerms(seg.text);
    if (!parsed.ok) return { problem: parsed.problem };
    for (const p of parsed.parts) {
      if (p.shown === undefined) continue;
      if (NOT_SHOWN.test(p.shown)) return { problem: 'the shown text of a term marker must not hold <, >, & or {{' };
      if (p.ref !== null && !isId(p.ref)) return { problem: `the term id ${JSON.stringify(p.ref)} must be kebab-case (lowercase words joined by hyphens)` };
    }
    seg.parts = parsed.parts;
  }
  return { segments };
}

function leaf(v, key, at, { vars, slots, errors, used }) {
  if (typeof v !== 'string') {
    errors.push(`${at}: must be a string, not ${kindOf(v)}${key === 'id' || key === 'key' ? '' : ' (numbers and answer flags belong in the logic file)'}`);
    return v;
  }
  if (!MARKER_KEYS.includes(key) && !MARKER_FREE_KEYS.includes(key) && markerOutsideCode(v)) {
    errors.push(`${at}: must not contain a glossary term marker (only intro and show mark terms)`);
  }
  if (IDENTITY_KEYS.includes(key)) {
    if (v.includes('{{')) errors.push(`${at}: an id must not hold a fill-in`);
    return v;
  }
  // A slot outside `run` is an error of its own (and its text is left alone, so it is the only error).
  const own = { ...vars };
  for (const [, name] of v.matchAll(SLOT_FILL)) {
    if (slots.includes(name) && !has(vars, name)) {
      errors.push(`${at}: slot {{${name}}} may only be used under run`);
      own[name] = `{{${name}}}`;
    }
  }
  if (MARKER_KEYS.includes(key)) {
    const read = readMarkers(v);
    if (read.problem) errors.push(`${at}: ${read.problem}`);
    else if (read.segments.some((s) => s.parts?.some((p) => p.shown !== undefined))) {
      // The text rules judge what the reader sees: the shown words, code regions as written.
      const seen = read.segments.map((s) => (s.code ? s.text : s.parts.map((p) => p.shown ?? p.text).join(''))).join('');
      const filled = fill(seen, own, at);
      const before = errors.length;
      errors.push(...filled.errors);
      for (const name of filled.used) used.add(name);
      checkText(filled.text, key, at, errors);
      // Fill-in values are never read for markers: each plain part and code region is filled on its own.
      const part = (s) => fill(s, own, at).text;
      const shownOf = (s) => (s.code ? part(s.text) : s.parts.map((p) => (p.shown === undefined ? part(p.text) : p.shown)).join(''));
      // A fill-in that opens before a marker and closes after it was checked as a whole but binds as two halves.
      if (read.segments.map(shownOf).join('') !== filled.text) {
        if (errors.length === before) errors.push(`${at}: a fill-in must not wrap a term marker`);
        return v;
      }
      return read.segments.map((s) => (s.code ? part(s.text) : s.parts.map((p) => (p.shown === undefined ? part(p.text) : glossSpan(p.shown, p.ref))).join(''))).join('');
    }
  }
  const filled = fill(v, own, at);
  errors.push(...filled.errors);
  for (const name of filled.used) used.add(name);
  checkText(filled.text, key === MAP_KEY ? 'why' : key, at, errors);
  return filled.text;
}

/** An entry of `run` (free mode): strings, objects and lists, no logic-only keys; every string may hold HTML and is checked as HTML after its fill-ins. */
function readRun(node, path, depth, ctx) {
  const { errors } = ctx;
  if (Array.isArray(node)) {
    const seen = new Set();
    for (const el of node) {
      const id = identityOf(el, false);
      if (id !== undefined && seen.has(id)) errors.push(`${path}: "${id}" appears twice`);
      seen.add(id);
    }
    return node.map((x, i) => readRun(x, `${path}[${i}]`, depth + 1, ctx));
  }
  if (isObject(node)) {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const at = join(path, k);
      if (depth === 0 && !RUN_ENTRY_NAME.test(k)) errors.push(`${at}: a run entry name is lowerCamelCase (letters and digits, starting with a lowercase letter)`);
      if (LOGIC_ONLY_KEYS.includes(k)) errors.push(`${at}: "${k}" belongs in the logic file`);
      else out[k] = IDENTITY_KEYS.includes(k) ? leaf(v, k, at, ctx) : readRun(v, at, depth + 1, ctx);
    }
    return out;
  }
  if (typeof node === 'string') return runString(node, path, ctx);
  errors.push(`${path}: must be a string, not ${kindOf(node)}`);
  return node;
}

/**
 * One string under `run`: vars filled, slots kept as `{{name}}`. The HTML check reads the text with each slot
 * replaced by a stand-in, after the fill-ins (a var may not smuggle in a tag).
 */
function runString(v, at, { vars, slots, errors, used, usedSlots }) {
  if (markerOutsideCode(v)) errors.push(`${at}: term markers are not read under run yet`);
  const kept = fill(v, { ...vars, ...Object.fromEntries(slots.map((n) => [n, `{{${n}}}`])) }, at);
  errors.push(...kept.errors);
  for (const name of kept.used) {
    used.add(name);
    if (slots.includes(name)) usedSlots.add(name);
  }
  const probe = fill(v, { ...vars, ...Object.fromEntries(slots.map((n) => [n, SLOT_STAND_IN])) }, at);
  for (const p of checkHtml(probe.text)) errors.push(`${at} ${p}`);
  // A slot is a runtime value: never inside a tag, not even in an attribute the HTML check allows.
  if (slotInTag(kept.text)) errors.push(`${at} must not hold a slot inside a tag (a slot goes in text, not in markup)`);
  return kept.text;
}

// ---- logic: no text outside a fixture ----------------------------------------------------------------------

function checkLogic(node, path, inFixture, errors) {
  if (Array.isArray(node)) return node.forEach((x, i) => checkLogic(x, `${path}[${i}]`, inFixture, errors));
  if (!isObject(node)) return undefined;
  // `clone` and `merge` copy plain objects only: a RegExp, Date, Set or Map anywhere in the logic would silently
  // become `{}`. Only `run` is checked here, because a play level's logic is guarded by the fingerprint diff
  // (tools/level-fingerprint.mjs) on every content move. A function under `run` is kept by reference, not copied.
  const proto = Object.getPrototypeOf(node);
  if (proto !== Object.prototype && proto !== null && /^run([.[]|$)/.test(path)) {
    errors.push(`${path}: the logic's run holds plain data only (strings, numbers, booleans, lists, objects), not an object of type ${node.constructor?.name ?? 'unknown'}`);
    return undefined;
  }
  for (const [k, v] of Object.entries(node)) {
    if (!inFixture && TEXT_KEYS.includes(k)) errors.push(`text in the logic file: ${join(path, k)}`);
    else checkLogic(v, join(path, k), inFixture || FIXTURE_KEYS.includes(k), errors);
  }
  return undefined;
}

// ---- merge ----------------------------------------------------------------------------------------------------

function mergeArrays(logic, content, path, inSteps, errors) {
  const side = (list, name) => {
    const ids = list.map((el) => identityOf(el, inSteps));
    const bad = ids.findIndex((id) => id === undefined);
    if (bad !== -1) {
      errors.push(`${path}[${bad}] (${name}): needs ${inSteps ? 'a widget with an id' : 'an id or a key'} to be joined`);
      return null;
    }
    if (name === 'logic') {
      const seen = new Set();
      for (const id of ids) {
        if (seen.has(id)) errors.push(`${path} (logic): "${id}" appears twice`);
        seen.add(id);
      }
    }
    return ids;
  };
  const lids = side(logic, 'logic');
  const cids = side(content, 'content');
  if (!lids || !cids) return clone(content);
  if (inSteps && (lids.length !== cids.length || lids.some((id, i) => id !== cids[i]))) {
    errors.push(`${path}: the steps differ: logic has [${lids.join(', ')}], content has [${cids.join(', ')}]`);
    return clone(content);
  }
  const partner = new Map(cids.map((id, i) => [id, content[i]]));
  lids.forEach((id, i) => {
    if (!partner.has(id)) errors.push(`${path}: "${id}" is in the logic and has no text in the content`);
  });
  const byId = new Map(lids.map((id, i) => [id, logic[i]]));
  return content.map((el, i) => (byId.has(cids[i]) ? merge(byId.get(cids[i]), el, `${path}[${cids[i]}]`, errors) : clone(el)));
}

function merge(logic, content, path, errors) {
  if (Array.isArray(logic) && Array.isArray(content)) return mergeArrays(logic, content, path, /(^|\.)steps$/.test(path), errors);
  if (isObject(logic) && isObject(content)) {
    const out = {};
    for (const k of new Set([...Object.keys(logic), ...Object.keys(content)])) {
      const at = join(path, k);
      if (!has(content, k)) out[k] = clone(logic[k]);
      else if (!has(logic, k)) out[k] = clone(content[k]);
      else if (IDENTITY_KEYS.includes(k)) {
        if (logic[k] !== content[k]) errors.push(`${at}: logic says ${JSON.stringify(logic[k])}, content says ${JSON.stringify(content[k])}`);
        out[k] = logic[k];
      } else if (typeof logic[k] === 'object' && logic[k] !== null && typeof content[k] === 'object' && content[k] !== null) {
        out[k] = merge(logic[k], content[k], at, errors);
      } else {
        errors.push(`${at}: set in both the logic and the content; one place only`);
      }
    }
    return out;
  }
  errors.push(`${path}: the logic has ${kindOf(logic)} and the content has ${kindOf(content)}`);
  return clone(content);
}

/**
 * Join `text` (the parsed content file) to `skeleton` (the level's logic). `vars` are the figures the fill-ins
 * name, filled now. `slots` are names of fill-ins only the level's code can answer (ctx, session, page): they stay
 * in the bound text as `{{name}}` for `fillSlots` to fill at run time, and are allowed only under `run`.
 * -> `{value, errors}`: the merged level and every problem found (value is not usable when there are errors).
 */
export function bindText(text, skeleton, { vars = {}, slots = [] } = {}) {
  const errors = [];
  const used = new Set();
  const usedSlots = new Set();
  if (!isObject(text)) return { value: clone(skeleton), errors: ['content must be an object'] };
  for (const name of slots) if (has(vars, name)) errors.push(`"${name}" is both a var and a slot`);
  if (slots.length) {
    for (const [name, v] of Object.entries(vars)) {
      if (typeof v === 'string' && v.includes('{{')) errors.push(`var "${name}" must not contain "{{" when slots are declared`);
    }
  }
  // `run` is the words of a run(ctx) level: both sides have it or neither does.
  if (has(text, RUN_KEY) && !(isObject(skeleton) && has(skeleton, RUN_KEY))) errors.push(`${RUN_KEY}: the content has a run entry and the logic has none: add run to the logic, or remove it from the content`);
  if (!has(text, RUN_KEY) && isObject(skeleton) && has(skeleton, RUN_KEY)) errors.push(`${RUN_KEY}: the logic has a run entry and the content has none: add run to the content, or remove it from the logic`);
  checkLogic(skeleton, '', false, errors);
  const content = readContent(text, '', '', { vars, slots, errors, used, usedSlots });
  for (const name of Object.keys(vars)) if (!used.has(name)) errors.push(`var "${name}" is never used by the content`);
  for (const name of slots) if (!usedSlots.has(name)) errors.push(`slot "${name}" is never used: remove it from slots, or write {{${name}}} in the copy`);
  return { value: merge(skeleton, content, '', errors), errors };
}

const levelIdOf = (skeleton) => (isObject(skeleton) && isId(skeleton.id) ? skeleton.id : '(no id)');

/** `bindText` for a level: the merged level, or one ContentError naming the level (by `skeleton.id`) with every problem. */
export function bindLevel(text, skeleton, opts = {}) {
  const id = levelIdOf(skeleton);
  const { value, errors } = bindText(text, skeleton, opts);
  if (id === '(no id)') errors.unshift('the logic needs a kebab-case id');
  if (errors.length) throw new ContentError(id, errors);
  return value;
}

/**
 * `bindLevel` for a run(ctx) level: the level's meta plus `run(ctx)`, which calls `screens(ctx, say)` where `say` is
 * the bound `run` entry of the content. `opts` are `bindLevel`'s (`vars`, `slots`) and `screens`. Each call binds
 * afresh and each `run(ctx)` gets its own copy of `say`, so a level that mutates `say` changes nothing else, not
 * even its next play. TypeError without a `screens` function.
 */
export function bindRunLevel(text, skeleton, { screens, ...opts } = {}) {
  if (typeof screens !== 'function') throw new TypeError('bindRunLevel needs a screens(ctx, say) function');
  if (!isObject(text) || !isObject(text.run)) throw new ContentError(levelIdOf(skeleton), ['the content needs a run object (the words of a run(ctx) level)']);
  const { run: say, ...meta } = bindLevel(text, skeleton, opts);
  return { ...meta, run: (ctx) => screens(ctx, clone(say)) };
}
