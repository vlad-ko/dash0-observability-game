// The act primer pop-up and zone bodies (#389, #410, docs/FOUNDATION.md §2.12): one screen of lib/primer.mjs primerView
// (the pop-up) or primerZoneView (the zone) drawn as HTML with the kit helpers only (prose, codeBlock, note, chip, eyebrow,
// button, step, split), so no `ui-` class is written here. Everything the primer says is escaped text; a link is a classless
// anchor. Pure string builder, DOM-free. The app writes the result into `#primer-body` (pop-up) or `#primer-zone-body` (zone),
// both x-ignore nodes.
import { button, chip, codeBlock, eyebrow, note, prose, split, step } from './ui/index.mjs';
import { escapeHtml } from './lesson-kit.mjs';

/** The words on a link's kind chip, one per kind in lib/primer.mjs LINK_KINDS. */
export const KIND_LABELS = Object.freeze({
  docs: 'Dash0 docs',
  otel: 'OpenTelemetry',
  video: 'Video',
  article: 'Article',
  claap: 'Claap',
});

/** The callout tones: the label and the chip tone each one wears. */
export const CALLOUT_LOOK = Object.freeze({
  note: { label: 'Note', tone: 'neutral' },
  tip: { label: 'Tip', tone: 'hint' },
  warning: { label: 'Warning', tone: 'attention' },
});

export const INTERNAL_LABEL = 'Dash0 team only';

// A link is only drawn as one for an https address; anything else (cannot happen for a validated primer) is plain text.
function isHttps(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function linkHtml(l) {
  const label = escapeHtml(l.label);
  const a = isHttps(l.url)
    ? `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    : label;
  const kind = chip({ text: KIND_LABELS[l.kind] ?? 'Link' });
  const internal = l.internal ? ` ${chip({ text: INTERNAL_LABEL, tone: 'attention' })}` : '';
  return `${a} ${kind}${internal}`;
}

const PROSE_TYPES = new Set(['paragraph', 'list', 'link']);

function proseHtml(b) {
  if (b.type === 'paragraph') return `<p>${escapeHtml(b.text)}</p>`;
  if (b.type === 'list') {
    const tag = b.ordered === true ? 'ol' : 'ul';
    return `<${tag}>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</${tag}>`;
  }
  return `<p>${linkHtml(b)}</p>`;
}

function otherHtml(b) {
  if (b.type === 'code') return codeBlock(b.text, { wrap: b.wrap === true });
  const look = CALLOUT_LOOK[b.tone] ?? CALLOUT_LOOK.note;
  return note(`${chip({ text: look.label, tone: look.tone })} ${escapeHtml(b.text)}`);
}

/** Blocks in order; a run of paragraphs, lists and links shares one prose wrapper. */
function blocksHtml(blocks) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length > 0) out.push(prose(run.join('')));
    run = [];
  };
  for (const b of blocks) {
    if (PROSE_TYPES.has(b.type)) run.push(proseHtml(b));
    else {
      flush();
      out.push(otherHtml(b));
    }
  }
  flush();
  return out.join('');
}

/**
 * The body of one screen. `view` is lib/primer.mjs primerView's result (never null here); `draft` adds a
 * neutral "Draft" chip first, for a placeholder primer.
 */
export function primerBodyHtml(view, { draft = false } = {}) {
  const parts = [];
  if (draft) parts.push(`<p>${chip({ text: 'Draft', tone: 'neutral', dashed: true })}</p>`);
  if (view.position) parts.push(eyebrow(view.position));
  parts.push(blocksHtml(view.blocks));
  if (Array.isArray(view.sources) && view.sources.length > 0) {
    parts.push(eyebrow('Sources'));
    parts.push(prose(`<ul>${view.sources.map((s) => `<li>${linkHtml(s)}</li>`).join('')}</ul>`));
  }
  return parts.join('');
}

// One row of the chapter list: the chapter on show is plain bold text, the others jump there; a read one wears a "Read" chip.
function chapterItemHtml(c) {
  const mark = c.read ? ` ${chip({ text: 'Read', tone: 'success' })}` : '';
  if (c.current) return `<li aria-current="step"><b>${escapeHtml(c.title)}</b>${mark}</li>`;
  return `<li>${button({ id: `primer-go-${c.index}`, label: c.title, variant: 'ghost' })}${mark}</li>`;
}

/**
 * The primer zone body for one chapter: a wide step, the chapter (primerBodyHtml) in the main column and beside it the
 * chapter list. `zoneView` is lib/primer.mjs primerZoneView's result (never null here).
 */
export function primerZoneHtml(zoneView, { draft = false } = {}) {
  const side = `<nav aria-label="Chapters">${prose(`<p><b>${escapeHtml(zoneView.primerTitle)}</b></p><ol>${zoneView.chapters.map(chapterItemHtml).join('')}</ol>`)}</nav>`;
  return step({ wide: true, bodyHtml: split({ mainHtml: primerBodyHtml(zoneView, { draft }), sideHtml: side }) });
}
