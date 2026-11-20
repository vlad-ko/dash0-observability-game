// Kit term (docs/DESIGN-SYSTEM.md "Components"): a glossary term inside running text, with its definition in place.
// A button styled as inline text, described (aria-describedby) by a tooltip that is always in the DOM and hidden
// until lib/term-popover.mjs opens it (the WAI-ARIA tooltip pattern). Pure string builder; DOM-free.

import { opts, text, token } from './check.mjs';

/**
 * `<span class="ui-term" data-term>` around the control (`text`, what the reader sees) and its popover (`name` in bold,
 * then `definition`). `id` is the popover's id, unique in the document. All text params are escaped.
 */
export function term(args) {
  const { id, text: shown, name, definition } = opts('term', args, ['id', 'text', 'name', 'definition']);
  token('term', id, 'id');
  const t = text('term', shown, 'text');
  const n = text('term', name, 'name');
  const d = text('term', definition, 'definition');
  return `<span class="ui-term" data-term><button type="button" class="ui-term-btn" aria-describedby="${id}">${t}</button>` +
    `<span class="ui-term-pop" id="${id}" role="tooltip" hidden><b class="ui-term-name">${n}</b>: ${d}</span></span>`;
}
