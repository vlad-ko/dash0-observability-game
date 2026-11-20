// The glossary term marker in authored prose (#429, docs/PRIMERS.md "Marking glossary terms"): `[[shown text|term-id]]`,
// or `[[shown text]]`, which resolves through the glossary's name and variants. Pure: no DOM, never throws, whatever it
// is given. This module only reads the marker; the primer validator (lib/primer.mjs) judges whether a term exists and
// the primer view (lib/primer-view.mjs) draws it.
import { glossaryIndex } from '../glossary.mjs';

const OPEN = '[[';
const CLOSE = ']]';

/** True when the text holds a marker delimiter, even a broken one: titles and labels refuse them. */
export const hasMarker = (s) => typeof s === 'string' && (s.includes(OPEN) || s.includes(CLOSE));

function readMarker(inner) {
  if (inner.includes(OPEN)) return { problem: 'a term marker must not be nested inside another' };
  if (/[[\]]/.test(inner)) return { problem: 'a term marker must not hold a bracket' };
  const bars = inner.split('|');
  if (bars.length > 2) return { problem: 'a term marker has at most one bar, between the shown text and the term id' };
  const [shown, ref = null] = bars;
  if (shown.trim() === '') return { problem: 'a term marker has no shown text' };
  if (shown !== shown.trim()) return { problem: 'the shown text of a term marker must not start or end with a space' };
  return { part: { shown, ref } };
}

/**
 * Split text into parts: `{text}` for plain text and `{shown, ref}` for a marker (`ref` is the term id, or null for the
 * short form). → `{ok: true, parts}` or `{ok: false, problem}` (a phrase; callers put their own path in front).
 */
export function parseTerms(text) {
  if (typeof text !== 'string') return { ok: false, problem: 'must be a string' };
  const parts = [];
  let at = 0;
  const plain = (s) => {
    if (s !== '') parts.push({ text: s });
  };
  for (;;) {
    const open = text.indexOf(OPEN, at);
    const close = text.indexOf(CLOSE, at);
    if (open === -1) {
      if (close !== -1) return { ok: false, problem: 'a term marker is closed with no opening' };
      plain(text.slice(at));
      return { ok: true, parts };
    }
    if (close !== -1 && close < open) return { ok: false, problem: 'a term marker is closed with no opening' };
    const end = text.indexOf(CLOSE, open + OPEN.length);
    if (end === -1) return { ok: false, problem: 'a term marker is not closed' };
    const read = readMarker(text.slice(open + OPEN.length, end));
    if (read.problem) return { ok: false, problem: read.problem };
    plain(text.slice(at, open));
    parts.push(read.part);
    at = end + CLOSE.length;
  }
}

/** What a reader sees: each marker replaced by its shown text. Text that does not parse is returned as written. */
export function shownText(text) {
  const r = parseTerms(text);
  return r.ok ? r.parts.map((p) => p.shown ?? p.text).join('') : text;
}

/**
 * The phrase for a marker that names no glossary term (primer and level messages share it; the caller puts its path in
 * front). `ref` is the term id, or null for the short form.
 */
export const markerProblem = (shown, ref) => (ref === null
  ? `the short form [[${shown}]] matches no glossary name or variant`
  : `${JSON.stringify(ref)} is not a term in the glossary`);

// A marker in a level's text, as lib/content/bind.mjs writes it (#442): a neutral span, so the guide and the plain-text
// readers see the shown words only. Content cannot write a span itself (the text rules refuse it), so bind is the only
// producer. The shown text holds no `<`, so `[^<]*` reads it exactly.
const GLOSS = /<span data-gloss="([a-z0-9-]*)">([^<]*)<\/span>/g;

/** The gloss span for a validated marker: `ref` is the term id, or null for the short form. */
export const glossSpan = (shown, ref) => `<span data-gloss="${ref ?? ''}">${shown}</span>`;

/** Text with each gloss span replaced by `fn(shown, ref)` (`ref` null for the short form). */
export const mapGloss = (s, fn) => s.replace(GLOSS, (_, ref, shown) => fn(shown, ref === '' ? null : ref));

/** Text with each gloss span written back as the marker it came from (`[[shown|id]]`, or `[[shown]]`). */
export const markerText = (s) => mapGloss(s, (shown, ref) => (ref === null ? `[[${shown}]]` : `[[${shown}|${ref}]]`));

/** Text with each gloss span replaced by its shown words. Text with no span comes back unchanged. */
export const unwrapGloss = (s) => (typeof s === 'string' ? mapGloss(s, (shown) => shown) : s);

/** The gloss spans of a text, in order: `{shown, ref}` (`ref` null for the short form). */
export const readGloss = (s) => (typeof s === 'string' ? [...s.matchAll(GLOSS)].map((m) => ({ shown: m[2], ref: m[1] === '' ? null : m[1] })) : []);

/** Every gloss span in a bound level whose marker names no glossary term: path-prefixed phrases, [] when all resolve. */
export function checkLevelTerms(level, glossary) {
  const lookup = termLookup(glossary);
  const problems = [];
  const seen = new WeakSet();
  const walk = (node, path) => {
    if (typeof node === 'string') {
      for (const m of readGloss(node)) if (lookup.resolve(m.shown, m.ref) === null) problems.push(`${path}: ${markerProblem(m.shown, m.ref)}`);
      return;
    }
    if (node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) node.forEach((x, i) => walk(x, `${path}[${i}]`));
    else for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(level, '');
  return problems;
}

const lookups = new WeakMap();

/**
 * A resolver for a glossary: `resolve(shown, ref)` is the term for `[[shown|ref]]` (by id) or `[[shown]]` (by name or
 * variant, case-insensitive), or null. One per glossary object. A glossary that is not one resolves nothing.
 */
export function termLookup(glossary) {
  if (glossary === null || typeof glossary !== 'object') return { resolve: () => null };
  const known = lookups.get(glossary);
  if (known) return known;
  const terms = Array.isArray(glossary.terms) ? glossary.terms : [];
  const byId = new Map(terms.map((t) => [t.id, t]));
  const index = glossaryIndex(glossary);
  const lookup = {
    resolve(shown, ref) {
      const id = ref === null || ref === undefined ? index.get(String(shown).toLowerCase()) : ref;
      return byId.get(id) ?? null;
    },
  };
  lookups.set(glossary, lookup);
  return lookup;
}
