// Joins a content file's text to a level's logic (#391, docs/CONTENT.md). Generic: no widget knowledge beyond the
// key lists in keys.mjs. Pure; `bindText` never throws, `bindLevel` throws one ContentError holding every problem.
//
// Merge rules. Content mirrors the widget spec's shape and carries text and the ids it joins on.
// Objects: the union of the keys. A key on both sides must be an identity key (id, key) with equal values, or an
// object or array on both sides; two leaves for one key are an error. Arrays on both sides join by `id ?? key`
// (a step's identity is its widget key plus the widget's id): content order wins, logic may annotate a subset, a
// logic element with no content partner is an error, and `steps` must list the same identities on both sides.
// A value on one side only is taken whole. The result shares nothing with either input.
import { CONTAINER_KEYS, CONTENT_KEYS, FIXTURE_KEYS, IDENTITY_KEYS, MAP_KEY, PLAIN_KEYS, STEP_TYPE_KEYS, TEXT_KEYS } from './keys.mjs';
import { fill } from './placeholders.mjs';
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

// ---- content: shape, placeholders, text rules --------------------------------------------------------------

function checkText(value, key, path, errors) {
  const problems = key === 'code' ? checkCode(value) : PLAIN_KEYS.includes(key) ? checkPlain(value) : checkHtml(value);
  for (const p of problems) errors.push(`${path} ${p}`);
}

/** A fresh copy of the content with placeholders filled; every problem goes to `errors`, every used name to `used`. */
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
      } else if (!CONTENT_KEYS.includes(k)) {
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

function leaf(v, key, at, { vars, errors, used }) {
  if (typeof v !== 'string') {
    errors.push(`${at}: must be a string, not ${kindOf(v)}${key === 'id' || key === 'key' ? '' : ' (numbers and answer flags belong in the logic file)'}`);
    return v;
  }
  if (IDENTITY_KEYS.includes(key)) {
    if (v.includes('{{')) errors.push(`${at}: an id must not hold a placeholder`);
    return v;
  }
  const filled = fill(v, vars, at);
  errors.push(...filled.errors);
  for (const name of filled.used) used.add(name);
  checkText(filled.text, key === MAP_KEY ? 'why' : key, at, errors);
  return filled.text;
}

// ---- logic: no text outside a fixture ----------------------------------------------------------------------

function checkLogic(node, path, inFixture, errors) {
  if (Array.isArray(node)) return node.forEach((x, i) => checkLogic(x, `${path}[${i}]`, inFixture, errors));
  if (!isObject(node)) return undefined;
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
 * Join `text` (the parsed content file) to `skeleton` (the level's logic). `vars` are the figures the placeholders
 * name. -> `{value, errors}`: the merged level and every problem found (value is not usable when there are errors).
 */
export function bindText(text, skeleton, { vars = {} } = {}) {
  const errors = [];
  const used = new Set();
  if (!isObject(text)) return { value: clone(skeleton), errors: ['content must be an object'] };
  checkLogic(skeleton, '', false, errors);
  const content = readContent(text, '', '', { vars, errors, used });
  for (const name of Object.keys(vars)) if (!used.has(name)) errors.push(`var "${name}" is never used by the content`);
  return { value: merge(skeleton, content, '', errors), errors };
}

/** `bindText` for a level: the merged level, or one ContentError naming the level (by `skeleton.id`) with every problem. */
export function bindLevel(text, skeleton, opts = {}) {
  const id = isObject(skeleton) && isId(skeleton.id) ? skeleton.id : '(no id)';
  const { value, errors } = bindText(text, skeleton, opts);
  if (id === '(no id)') errors.unshift('the logic needs a kebab-case id');
  if (errors.length) throw new ContentError(id, errors);
  return value;
}
