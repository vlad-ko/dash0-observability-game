// The glossary (#428, docs/CONTENT.md "The glossary"): the content contract, the name lookup and the
// readable doc. Pure: no DOM, no fs. The words live in content/core/glossary/ (one strict-JSON file per
// act, #427); this module only joins, judges and shapes them. docs/GLOSSARY.md is generated from them (tools/build-glossary-doc.mjs).
import { checkPlain, isId } from './content/text-rules.mjs';

export const LIMITS = Object.freeze({ name: 60, definition: 240, topic: 60 });

/** The file name for terms that belong to no act (the game itself): their `act` is null. */
export const GENERAL = 'general';

/** The topics, in the order docs/GLOSSARY.md shows them. A term's topic must be one of these. */
export const TOPIC_ORDER = Object.freeze(['Foundations', 'OpenTelemetry', 'Traces', 'Metrics', 'Logs', 'Collector', 'Reliability', 'Dash0']);

const actOfFile = (name) => (name === GENERAL ? null : name);

const GLOSSARY_KEYS = ['terms'];
const TERM_KEYS = ['id', 'name', 'variants', 'definition', 'act', 'topic'];
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A backtick, an asterisk, a tag, a comment or a Markdown link: text here is shown as written.
const MARKUP = /[`*]|<[A-Za-z/!?]|\]\(/;

// Visit every index, holes included (Array.prototype.forEach skips them): a hole is then judged as undefined.
function forEachIndex(arr, fn) {
  for (let i = 0; i < arr.length; i++) fn(arr[i], i);
}

function checkKeys(problems, obj, allowed, path) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) problems.push(`${path ? `${path}.` : ''}${key}: unknown key`);
  }
}

/** Plain text (lib/content/text-rules.mjs) of 1..max characters with no markup; one problem per field. */
function checkText(problems, path, v, max) {
  const plain = checkPlain(v);
  if (plain.length) return problems.push(`${path}: ${plain[0]}`);
  if (v.length < 1 || v.length > max) return problems.push(`${path}: must be 1-${max} characters`);
  if (MARKUP.test(v)) problems.push(`${path}: must be plain text, without markup`);
}

/** The name or variant at `path` claims `key`; report it when another claim (or this term's own) already holds it. */
function claim(problems, claims, path, text, termId) {
  const key = text.toLowerCase();
  const owner = claims.get(key);
  if (owner !== undefined) return problems.push(`${path}: ${JSON.stringify(text)} is already used by ${JSON.stringify(owner)}`);
  claims.set(key, termId);
}

function checkTerm(problems, path, t, state, actIds) {
  if (!isObject(t)) return problems.push(`${path}: must be an object`);
  checkKeys(problems, t, TERM_KEYS, path);
  const termId = typeof t.id === 'string' ? t.id : '';
  if (!isId(t.id)) problems.push(`${path}.id: must be a kebab-case id of at most 64 characters`);
  else if (state.ids.has(t.id)) problems.push(`${path}.id: duplicate id "${t.id}"`);
  else state.ids.add(t.id);

  const before = problems.length;
  checkText(problems, `${path}.name`, t.name, LIMITS.name);
  if (problems.length === before) claim(problems, state.claims, `${path}.name`, t.name, termId);

  if (!Array.isArray(t.variants)) problems.push(`${path}.variants: must be an array of other spellings`);
  else {
    forEachIndex(t.variants, (v, i) => {
      const at = `${path}.variants[${i}]`;
      const n = problems.length;
      checkText(problems, at, v, LIMITS.name);
      if (problems.length === n) claim(problems, state.claims, at, v, termId);
    });
  }

  checkText(problems, `${path}.definition`, t.definition, LIMITS.definition);
  if (state.checkAct && t.act !== null && !actIds.includes(t.act)) problems.push(`${path}.act: ${JSON.stringify(t.act)} is not an act in the registry`);
  const topicAt = problems.length;
  checkText(problems, `${path}.topic`, t.topic, LIMITS.topic);
  if (problems.length === topicAt && !TOPIC_ORDER.includes(t.topic)) {
    problems.push(`${path}.topic: ${JSON.stringify(t.topic)} is not one of the topics (${TOPIC_ORDER.join(', ')})`);
  }
}

/** Judge every term, `entries` being `[{ path, term }]` in the order they join: ids, names and variants are unique across all of them. */
function checkTerms(problems, entries, actIds, checkAct) {
  const state = { ids: new Set(), claims: new Map(), checkAct };
  for (const { path, term } of entries) checkTerm(problems, path, term, state, actIds);
}

/**
 * Check a glossary against the contract. `actIds` are the registry act ids; a term's `act` is one of them or null
 * (a game term). → the list of problems, each naming its path; empty means clean. Never throws, whatever it is given.
 */
export function validateGlossary(glossary, options) {
  const actIds = Array.isArray(options?.actIds) ? options.actIds : [];
  if (!isObject(glossary)) return ['glossary: must be an object'];
  const problems = [];
  checkKeys(problems, glossary, GLOSSARY_KEYS, '');
  if (!Array.isArray(glossary.terms) || glossary.terms.length < 1) {
    problems.push('terms: must be a non-empty array');
    return problems;
  }
  checkTerms(problems, glossary.terms.map((term, i) => ({ path: `terms[${i}]`, term })), actIds, true);
  return problems;
}

/**
 * Join the per-act files into one glossary: `files` is `[{ name, glossary }]`, `name` being `general` or an act id.
 * Each term gets `act` from its file's name (`general` gives null); the order is the order of `files`, then file order.
 * Never throws; a file or term that is not the right shape is passed on as it is for `validateGlossaryFiles` to report.
 */
export function joinGlossaryFiles(files) {
  const terms = [];
  for (const file of Array.isArray(files) ? files : []) {
    if (!isObject(file) || !Array.isArray(file.glossary?.terms)) continue;
    const act = actOfFile(file.name);
    forEachIndex(file.glossary.terms, (t) => terms.push(isObject(t) ? { ...t, act } : t));
  }
  return { terms };
}

/**
 * Check the per-act files against the contract. → the list of problems, each naming its file and path; empty is clean.
 * Cross-file: ids, names and variants are unique across ALL files. Never throws.
 */
export function validateGlossaryFiles(files, options) {
  const actIds = Array.isArray(options?.actIds) ? options.actIds : [];
  if (!Array.isArray(files) || files.length < 1) return ['files: must be a non-empty array'];
  const problems = [];
  const names = new Set();
  const entries = [];
  forEachIndex(files, (f, i) => {
    if (!isObject(f) || typeof f.name !== 'string') return problems.push(`files[${i}]: must be { name, glossary }`);
    const { name, glossary } = f;
    if (name !== GENERAL && !actIds.includes(name)) problems.push(`${name}: file name must be "general" or an act id in the registry`);
    if (names.has(name)) problems.push(`${name}: more than one file`);
    names.add(name);
    if (!isObject(glossary)) return problems.push(`${name}: glossary must be an object`);
    checkKeys(problems, glossary, GLOSSARY_KEYS, name);
    if (!Array.isArray(glossary.terms) || glossary.terms.length < 1) return problems.push(`${name}.terms: must be a non-empty array`);
    forEachIndex(glossary.terms, (t, j) => {
      const path = `${name}.terms[${j}]`;
      if (isObject(t) && 'act' in t) problems.push(`${path}.act: unknown key (the file name says the act)`);
      entries.push({ path, term: isObject(t) ? { ...t, act: actOfFile(name) } : t });
    });
  });
  // The file name was judged above, so the act each term was given is not judged again.
  checkTerms(problems, entries, actIds, false);
  return problems;
}

/**
 * Every lowercase name and variant mapped to its term id: a `Map`. Callers lowercase what they look up. Meant for a
 * glossary that validates clean; if two terms claimed one key, the first wins.
 */
export function glossaryIndex(glossary) {
  const index = new Map();
  const terms = Array.isArray(glossary?.terms) ? glossary.terms : [];
  for (const t of terms) {
    for (const text of [t.name, ...(Array.isArray(t.variants) ? t.variants : [])]) {
      if (typeof text === 'string' && !index.has(text.toLowerCase())) index.set(text.toLowerCase(), t.id);
    }
  }
  return index;
}

const actLabel = (act) => {
  const m = /^act-(\d+)$/.exec(act);
  return m ? `Act ${m[1]}` : act;
};

/**
 * docs/GLOSSARY.md as text: terms grouped by topic in TOPIC_ORDER (a topic outside it comes after, in the order it first
 * appears), one bullet per term, the terms of a topic in the order given (joined files: general, then the acts).
 */
export function glossaryDoc(glossary) {
  const byTopic = new Map();
  for (const t of glossary.terms) {
    if (!byTopic.has(t.topic)) byTopic.set(t.topic, []);
    byTopic.get(t.topic).push(`- **${t.name}**: ${t.definition}${t.act ? ` (${actLabel(t.act)})` : ''}`);
  }
  const rank = (topic) => (TOPIC_ORDER.includes(topic) ? TOPIC_ORDER.indexOf(topic) : TOPIC_ORDER.length);
  const ordered = [...byTopic].sort(([a], [b]) => rank(a) - rank(b)); // stable: unknown topics keep first-seen order
  const sections = ordered.map(([topic, bullets]) => `## ${topic}\n\n${bullets.join('\n')}\n`);
  return [
    '# Glossary',
    '',
    'This file is generated from the files in `content/core/glossary/` by `node tools/build-glossary-doc.mjs`. Do not edit it by hand: edit a file there, then run the tool. `test/glossary.test.mjs` fails when this file differs from the tool\'s output.',
    '',
    'Terms the game teaches, grouped by topic. Each entry is one or two lines. "(Act N)" is where it is taught; a term with no act belongs to the game itself.',
    '',
    sections.join('\n'),
    'Dash0 product names and descriptions to be checked with the product team before release.',
    '',
  ].join('\n');
}
