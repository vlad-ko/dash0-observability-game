// Act primers (#389, docs/FOUNDATION.md §2.12, docs/PRIMERS.md): the content contract, the single
// status rule, the tile words and the per-screen view. Pure: no DOM, no storage. The content lives
// in content/core/primers/<act-id>.mjs as strict JSON; this module only judges and shapes it.
import { checkCode, checkPlain, isId } from './content/text-rules.mjs';

export const BLOCK_TYPES = Object.freeze(['paragraph', 'list', 'link', 'callout', 'code']);
export const LINK_KINDS = Object.freeze(['docs', 'otel', 'video', 'article', 'claap']);
export const AUDIENCES = Object.freeze(['public', 'internal']);
export const CALLOUT_TONES = Object.freeze(['note', 'tip', 'warning']);
/** Hosts a link kind must point at (the host or any subdomain); kinds not listed may use any https host. */
export const KIND_HOSTS = Object.freeze({
  docs: Object.freeze(['dash0.com']),
  otel: Object.freeze(['opentelemetry.io']),
  claap: Object.freeze(['claap.io']),
});
export const LIMITS = Object.freeze({
  title: 80,
  placeholderNote: 300,
  overviewBlocks: 6,
  chapters: 12,
  chapterBlocks: 20,
  sources: 10,
  paragraph: 600,
  listItems: 10,
  listItem: 200,
  callout: 400,
  code: 2000,
  linkLabel: 120,
  url: 500,
});
export const PLACEHOLDER_PREFIX = 'PLACEHOLDER';

const PRIMER_KEYS = ['act', 'placeholder', 'placeholderNote', 'title', 'overview', 'chapters'];
const CHAPTER_KEYS = ['id', 'title', 'blocks', 'sources'];
const LINK_KEYS = ['kind', 'label', 'url', 'audience'];
const BLOCK_KEYS = {
  paragraph: ['type', 'text'],
  list: ['type', 'items', 'ordered'],
  link: ['type', ...LINK_KEYS],
  callout: ['type', 'tone', 'text'],
  code: ['type', 'text', 'wrap'],
};
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Visit every index, holes included (Array.prototype.forEach skips them): a hole is then judged as undefined.
function forEachIndex(arr, fn) {
  for (let i = 0; i < arr.length; i++) fn(arr[i], i);
}

// The `actIds` option, whatever the caller passed.
const actIdsOf = (options) => (Array.isArray(options?.actIds) ? options.actIds : []);

/** A clean string (lib/content/text-rules.mjs) of 1..max characters; one error per field. */
function checkText(errors, path, v, max, { multiline = false } = {}) {
  const problems = (multiline ? checkCode : checkPlain)(v);
  if (problems.length) return errors.push(`${path}: ${problems[0]}`);
  if (v.length < 1 || v.length > max) return errors.push(`${path}: must be 1-${max} characters`);
}

function checkKeys(errors, obj, allowed, path) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) errors.push(`${path ? `${path}.` : ''}${key}: unknown key`);
  }
}

function hostOk(hostname, domains) {
  return domains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

/** One link (a link block, or a source, which has no `type`). */
function checkLink(errors, path, link) {
  checkText(errors, `${path}.label`, link.label, LIMITS.linkLabel);
  const kindOk = LINK_KINDS.includes(link.kind);
  if (!kindOk) errors.push(`${path}.kind: must be one of ${LINK_KINDS.join(', ')}`);
  const audienceOk = AUDIENCES.includes(link.audience);
  if (!audienceOk) errors.push(`${path}.audience: must be one of ${AUDIENCES.join(', ')}`);
  else if (link.kind === 'claap' && link.audience !== 'internal') errors.push(`${path}.audience: a claap link must be internal`);
  checkUrl(errors, `${path}.url`, link.url, kindOk ? link.kind : null);
}

function checkUrl(errors, path, value, kind) {
  if (typeof value !== 'string' || value.length > LIMITS.url || checkPlain(value).length > 0) {
    return errors.push(`${path}: must be a clean string of at most ${LIMITS.url} characters`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return errors.push(`${path}: must be a URL`);
  }
  if (url.protocol !== 'https:') return errors.push(`${path}: must be https`);
  if (url.username || url.password) return errors.push(`${path}: must not carry a username or password`);
  const domains = kind ? KIND_HOSTS[kind] : undefined;
  if (domains && !hostOk(url.hostname, domains)) errors.push(`${path}: a ${kind} link must be on ${domains.join(' or ')}`);
}

function checkBlock(errors, path, block) {
  if (!isObject(block)) return errors.push(`${path}: must be an object`);
  if (!BLOCK_TYPES.includes(block.type)) return errors.push(`${path}.type: must be one of ${BLOCK_TYPES.join(', ')}`);
  checkKeys(errors, block, BLOCK_KEYS[block.type], path);
  if (block.type === 'paragraph') checkText(errors, `${path}.text`, block.text, LIMITS.paragraph);
  else if (block.type === 'callout') {
    if (!CALLOUT_TONES.includes(block.tone)) errors.push(`${path}.tone: must be one of ${CALLOUT_TONES.join(', ')}`);
    checkText(errors, `${path}.text`, block.text, LIMITS.callout);
  } else if (block.type === 'code') {
    checkText(errors, `${path}.text`, block.text, LIMITS.code, { multiline: true });
    if (block.wrap !== undefined && typeof block.wrap !== 'boolean') errors.push(`${path}.wrap: must be a boolean`);
  } else if (block.type === 'list') {
    if (block.ordered !== undefined && typeof block.ordered !== 'boolean') errors.push(`${path}.ordered: must be a boolean`);
    if (!Array.isArray(block.items) || block.items.length < 1 || block.items.length > LIMITS.listItems) {
      errors.push(`${path}.items: must be 1-${LIMITS.listItems} items`);
    } else forEachIndex(block.items, (item, i) => checkText(errors, `${path}.items[${i}]`, item, LIMITS.listItem));
  } else checkLink(errors, path, block);
}

function checkBlocks(errors, path, blocks, max) {
  if (!Array.isArray(blocks) || blocks.length < 1 || blocks.length > max) return errors.push(`${path}: must be 1-${max} blocks`);
  forEachIndex(blocks, (b, i) => checkBlock(errors, `${path}[${i}]`, b));
}

function checkChapter(errors, path, chapter, seen) {
  if (!isObject(chapter)) return errors.push(`${path}: must be an object`);
  checkKeys(errors, chapter, CHAPTER_KEYS, path);
  if (!isId(chapter.id)) errors.push(`${path}.id: must be a kebab-case id of at most 64 characters`);
  else if (seen.has(chapter.id)) errors.push(`${path}.id: duplicate chapter id "${chapter.id}"`);
  else seen.add(chapter.id);
  checkText(errors, `${path}.title`, chapter.title, LIMITS.title);
  checkBlocks(errors, `${path}.blocks`, chapter.blocks, LIMITS.chapterBlocks);
  if (!Array.isArray(chapter.sources) || chapter.sources.length < 1 || chapter.sources.length > LIMITS.sources) {
    return errors.push(`${path}.sources: must be 1-${LIMITS.sources} links`);
  }
  forEachIndex(chapter.sources, (s, i) => {
    const at = `${path}.sources[${i}]`;
    if (!isObject(s)) return errors.push(`${at}: must be an object`);
    checkKeys(errors, s, LINK_KEYS, at);
    checkLink(errors, at, s);
  });
}

/**
 * Check one primer against the contract. `actIds` are the registry act ids. → `{ok, errors}`; every
 * error names its path; never throws, whatever it is given.
 */
export function validatePrimer(primer, options) {
  const actIds = actIdsOf(options);
  const errors = [];
  if (!isObject(primer)) return { ok: false, errors: ['primer: must be an object'] };
  checkKeys(errors, primer, PRIMER_KEYS, '');
  if (!actIds.includes(primer.act)) errors.push(`act: ${JSON.stringify(primer.act)} is not an act in the registry`);
  if (typeof primer.placeholder !== 'boolean') errors.push('placeholder: must be a boolean');
  const note = primer.placeholderNote;
  if (primer.placeholder === true) {
    checkText(errors, 'placeholderNote', note, LIMITS.placeholderNote);
    if (typeof note === 'string' && !note.startsWith(PLACEHOLDER_PREFIX)) errors.push(`placeholderNote: must start with ${PLACEHOLDER_PREFIX}`);
  } else if (primer.placeholder === false && note !== undefined) {
    errors.push('placeholderNote: only a placeholder primer carries a note');
  }
  checkText(errors, 'title', primer.title, LIMITS.title);
  checkBlocks(errors, 'overview', primer.overview, LIMITS.overviewBlocks);
  if (!Array.isArray(primer.chapters) || primer.chapters.length < 1 || primer.chapters.length > LIMITS.chapters) {
    errors.push(`chapters: must be 1-${LIMITS.chapters} chapters`);
  } else {
    const seen = new Set();
    forEachIndex(primer.chapters, (c, i) => checkChapter(errors, `chapters[${i}]`, c, seen));
  }
  return { ok: errors.length === 0, errors };
}

/** Check a list of primers: each one, plus one primer per act. → `{ok, errors}`; never throws. */
export function validatePrimers(list, options) {
  const actIds = actIdsOf(options);
  if (!Array.isArray(list)) return { ok: false, errors: ['primers: must be an array'] };
  const errors = [];
  const seen = new Set();
  forEachIndex(list, (p, i) => {
    errors.push(...validatePrimer(p, { actIds }).errors.map((e) => `primers[${i}].${e}`));
    if (isObject(p)) {
      if (seen.has(p.act)) errors.push(`primers[${i}].act: duplicate primer for act "${p.act}"`);
      seen.add(p.act);
    }
  });
  return { ok: errors.length === 0, errors };
}

/**
 * Keep the valid primers, keyed by act (a frozen null-prototype map of frozen copies), and report
 * the rest. `registry` is the built registry (§2.4); a broken primer never reaches the player.
 * → `{byAct, errors}`.
 */
export function buildPrimers(list, registry) {
  const actIds = (registry?.acts ?? []).map((a) => a.id);
  const byAct = Object.create(null);
  const errors = [];
  if (!Array.isArray(list)) return { byAct: Object.freeze(byAct), errors: ['primers: must be an array'] };
  forEachIndex(list, (p, i) => {
    const r =validatePrimer(p, { actIds });
    if (!r.ok) return errors.push(...r.errors.map((e) => `primers[${i}].${e}`));
    if (byAct[p.act]) return errors.push(`primers[${i}].act: duplicate primer for act "${p.act}"`);
    byAct[p.act] = deepFreeze(structuredClone(p));
  });
  return { byAct: Object.freeze(byAct), errors };
}

function deepFreeze(v) {
  if (v !== null && typeof v === 'object') Object.values(v).forEach(deepFreeze);
  return Object.freeze(v);
}

/**
 * The one status rule. `stored` is the act's saved entry or undefined. Only chapters that still
 * exist count (a renamed chapter is unread, a removed one is ignored).
 * → `{status: 'new'|'reading'|'read'|'skipped', read, total}`.
 */
export function primerStatus(primer, stored) {
  const total = primer.chapters.length;
  if (!stored) return { status: 'new', read: 0, total };
  const ids = new Set(primer.chapters.map((c) => c.id));
  const read = [...new Set(stored.read ?? [])].filter((id) => ids.has(id)).length;
  if (read === total) return { status: 'read', read, total };
  if (read >= 1) return { status: 'reading', read, total };
  if (stored.skipped) return { status: 'skipped', read, total };
  return { status: 'reading', read, total };
}

/** The hub tile for a status: `{text, tone, isNew, label}` (tone is a chip tone). */
export function primerTile({ status, read, total }) {
  let text;
  let tone = 'neutral';
  if (status === 'new') {
    text = 'New';
    tone = 'attention';
  } else if (status === 'skipped') text = 'Skipped';
  else if (status === 'read') {
    text = 'Read';
    tone = 'success';
  } else text = `${read} of ${total} ${total === 1 ? 'chapter' : 'chapters'} read`;
  return { text, tone, isNew: status === 'new', label: `Act primer: ${text}` };
}

const linkView = (l) => ({ ...l, internal: l.audience === 'internal' });
const blockView = (b) => (b.type === 'link' ? linkView(b) : { ...b });

/**
 * What one screen shows: -1 is the overview, 0..N-1 the chapters. `then` and `thenName` (the level
 * to start after the last chapter) are optional; the last chapter's button reads "Start: <thenName>"
 * only when both are given, else "Done". → null for a screen out of range.
 */
export function primerView(primer, screen, options) {
  const { then, thenName } = isObject(options) ? options : {};
  const total = primer.chapters.length;
  if (screen === -1) {
    return { screen, title: primer.title, blocks: primer.overview.map(blockView), buttons: ['familiar', 'proceed'] };
  }
  if (!Number.isInteger(screen) || screen < 0 || screen >= total) return null;
  const c = primer.chapters[screen];
  const last = screen === total - 1;
  return {
    screen,
    id: c.id,
    title: c.title,
    position: `Chapter ${screen + 1} of ${total}`,
    blocks: c.blocks.map(blockView),
    sources: c.sources.map(linkView),
    next: !last ? 'Next' : then && thenName ? `Start: ${thenName}` : 'Done',
  };
}
