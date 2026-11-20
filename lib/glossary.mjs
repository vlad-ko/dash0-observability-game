// The glossary (#428, docs/CONTENT.md "The glossary"): the content contract, the name lookup and the
// readable doc. Pure: no DOM, no fs. The words live in content/core/glossary.mjs as strict JSON; this
// module only judges and shapes them. docs/GLOSSARY.md is generated from them (tools/build-glossary-doc.mjs).
import { checkPlain, isId } from './content/text-rules.mjs';

export const LIMITS = Object.freeze({ name: 60, definition: 240, topic: 60 });

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
  if (t.act !== null && !actIds.includes(t.act)) problems.push(`${path}.act: ${JSON.stringify(t.act)} is not an act in the registry`);
  checkText(problems, `${path}.topic`, t.topic, LIMITS.topic);
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
  const state = { ids: new Set(), claims: new Map() };
  forEachIndex(glossary.terms, (t, i) => checkTerm(problems, `terms[${i}]`, t, state, actIds));
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

/** docs/GLOSSARY.md as text: terms grouped by topic in the order each topic first appears, one bullet per term. */
export function glossaryDoc(glossary) {
  const byTopic = new Map();
  for (const t of glossary.terms) {
    if (!byTopic.has(t.topic)) byTopic.set(t.topic, []);
    byTopic.get(t.topic).push(`- **${t.name}**: ${t.definition}${t.act ? ` (${actLabel(t.act)})` : ''}`);
  }
  const sections = [...byTopic].map(([topic, bullets]) => `## ${topic}\n\n${bullets.join('\n')}\n`);
  return [
    '# Glossary',
    '',
    'This file is generated from `content/core/glossary.mjs` by `node tools/build-glossary-doc.mjs`. Do not edit it by hand: edit the module, then run the tool. `test/glossary.test.mjs` fails when this file differs from the tool\'s output.',
    '',
    'Terms the game teaches, grouped by topic. Each entry is one or two lines. "(Act N)" is where it is taught; a term with no act belongs to the game itself.',
    '',
    sections.join('\n'),
    'Dash0 product names and descriptions to be checked with the product team before release.',
    '',
  ].join('\n');
}
