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
