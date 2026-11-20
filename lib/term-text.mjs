// Glossary terms in drawn text (#429 primers, #442 levels, docs/FOUNDATION.md §2.12, §2.14): the one first-use rule.
// A screen draws each glossary term as a kit `term` only at its first use; every later use, and every marker that names
// no term, reads as plain escaped words. Pure string builders, DOM-free.
import { term } from './ui/index.mjs';
import { escapeHtml } from './lesson-kit.mjs';
import { mapGloss, termLookup } from './content/terms.mjs';

/**
 * One screen's term state. `use(shown, ref, owner)` is the HTML for one marker (`ref` is the term id, or null for the short
 * form): a kit `term` with popover id `<prefix>-<n>` at the first resolved use of that term while it is not on the screen,
 * else the escaped shown text. `owner` names what drew the term (the body, or a feedback element); `release(owner)` gives
 * back the terms that owner drew, because its text was replaced, so they may be drawn again. The popover number only goes
 * up, so an id is never reused. `glossary` (optional) is what markers resolve against; with none, every marker reads as
 * plain words.
 */
export function createTermScope({ glossary = null, prefix }) {
  const lookup = termLookup(glossary);
  const drawnBy = new Map(); // term id -> owner, for the terms on the screen now
  let numbered = 0;
  return {
    use(shown, ref, owner = null) {
      const found = lookup.resolve(shown, ref);
      if (found === null || drawnBy.has(found.id)) return escapeHtml(shown);
      drawnBy.set(found.id, owner);
      numbered += 1;
      return term({ id: `${prefix}-${numbered}`, text: shown, name: found.name, definition: found.definition });
    },
    release(owner) {
      for (const [id, by] of [...drawnBy]) if (by === owner) drawnBy.delete(id);
    },
  };
}

/**
 * `html` with each gloss span drawn through `scope` as `owner`'s text: a `term` at its first use on the screen and plain
 * words after that. HTML with no gloss span (or no string) comes back unchanged.
 */
export function glossWith(html, scope, owner = null) {
  if (typeof html !== 'string' || !html.includes('data-gloss=')) return html;
  return mapGloss(html, (shown, ref) => scope.use(shown, ref, owner));
}

/**
 * Bound level HTML ready to draw: each gloss span becomes a `term` at its first use on this screen (document order) and
 * plain words after that. HTML with no gloss span comes back unchanged.
 */
export function glossHtml(html, { glossary = null, prefix }) {
  return glossWith(html, createTermScope({ glossary, prefix }));
}
