// Glossary terms in drawn text (#429 primers, #442 levels, docs/FOUNDATION.md §2.12, §2.13): the one first-use rule.
// A screen draws each glossary term as a kit `term` only at its first use; every later use, and every marker that names
// no term, reads as plain escaped words. Pure string builders, DOM-free.
import { term } from './ui/index.mjs';
import { escapeHtml } from './lesson-kit.mjs';
import { mapGloss, termLookup } from './content/terms.mjs';

/**
 * One screen's term state. `use(shown, ref)` is the HTML for one marker (`ref` is the term id, or null for the short form):
 * a kit `term` with popover id `<prefix>-<n>` at the first resolved use of that term, else the escaped shown text.
 * `glossary` (optional) is what markers resolve against; with none, every marker reads as plain words.
 */
export function createTermScope({ glossary = null, prefix }) {
  const lookup = termLookup(glossary);
  const seen = new Set();
  return {
    use(shown, ref) {
      const found = lookup.resolve(shown, ref);
      if (found === null || seen.has(found.id)) return escapeHtml(shown);
      seen.add(found.id);
      return term({ id: `${prefix}-${seen.size}`, text: shown, name: found.name, definition: found.definition });
    },
  };
}

/**
 * Bound level HTML ready to draw: each gloss span becomes a `term` at its first use on this screen (document order) and
 * plain words after that. HTML with no gloss span comes back unchanged.
 */
export function glossHtml(html, { glossary = null, prefix }) {
  if (typeof html !== 'string' || !html.includes('data-gloss=')) return html;
  const scope = createTermScope({ glossary, prefix });
  return mapGloss(html, (shown, ref) => scope.use(shown, ref));
}
