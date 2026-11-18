// Helpers for the tests of converted run(ctx) levels (docs/CONTENT.md section 11): edit every word of a content
// file's `run`, then find the words that still show on a screen without the edit.

/** `value` with `EDITED ` in front of every string that is not an id or a key. */
export const editRun = (value, key) => {
  if (Array.isArray(value)) return value.map((x) => editRun(x, key));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, editRun(v, k)]));
  return typeof value === 'string' && key !== 'id' && key !== 'key' ? `EDITED ${value}` : value;
};

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Literals a run level keeps on purpose because they are fixture data (docs/CONTENT.md 11.1): level id -> the literals' text. */
export const RUN_FIXTURES = {};

/** Every string of a content `run` that is not an id or a key: `[{path, text}]`, the path like `run.sort.items[0].why`. */
function entriesOf(value, path, key = '') {
  if (Array.isArray(value)) return value.flatMap((x, i) => entriesOf(x, `${path}[${i}]`, key));
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => entriesOf(v, `${path}.${k}`, k));
  return typeof value === 'string' && key !== 'id' && key !== 'key' ? [{ path, text: value }] : [];
}

const stripWbr = (s) => s.replace(/<wbr\s*\/?>/g, '');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const plain = (s) => norm(s.replace(/<[^>]*>/g, ' '));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LONG = 12;

/**
 * Check the screens a play-through showed (`screens`: strings of HTML or text) against `coreRun`, a content file's `run`,
 * that was edited with `editRun`. Returns `{leaked, unseen, stale, duplicates}`, each empty when all is well:
 * - leaked: words of the real content shown without `EDITED ` in front. A word of 12 characters or more is looked for
 *   in the HTML (raw or escaped, `<wbr>` taken out); a shorter one in the text with the tags taken out, as a whole
 *   word. `kept` (the level's RUN_FIXTURES) are fixture literals the level shows as they are: a word equal to one is
 *   skipped, and they are taken out of the screens before the short-word check only.
 * - duplicates: texts that two entries share. They cannot be told apart on a screen: give them different words.
 * - unseen: paths of entries (not in `unreached`) that never show edited on any screen.
 * - stale: paths listed in `unreached` that do show edited, or that are no entry: the list must not outlive the drivers.
 * `unreached` names the entries the drivers do not reach, by path, for this level.
 */
export function checkWords(coreRun, screens, { unreached = [], kept = [] } = {}) {
  const entries = entriesOf(coreRun, 'run');
  const html = screens.map(stripWbr).join('\n');
  const words = [...new Set(entries.map((e) => e.text))].sort((a, b) => b.length - a.length);
  // Take every edited word out of the screens, longest first (a shorter word can sit inside a longer edited one).
  // Whether a word shows edited is decided against what is left when its turn comes, so an entry that is the start of
  // another is not seen just because the other is. What is left at the end is shown as it is.
  let rest = html;
  const seen = new Map();
  for (const w of words) {
    seen.set(w, [w, escapeHtml(w)].some((f) => rest.includes(`EDITED ${f}`)) || plain(rest).includes(`EDITED ${plain(w)}`));
    for (const f of [w, escapeHtml(w)]) rest = rest.split(`EDITED ${f}`).join('\u0000');
  }
  // A fixture is stripped only for the short words: inside a longer word it must not hide that word leaking.
  let restShort = rest;
  for (const k of kept) restShort = restShort.split(k).join('\u0000');
  const restText = plain(restShort);
  const leaked = words.filter((w) => {
    if (kept.includes(w)) return false;
    if (w.length >= LONG) return [w, escapeHtml(w)].some((f) => rest.includes(f));
    const t = plain(w);
    return t !== '' && [t, escapeHtml(t)].some((f) => new RegExp(`(?<![A-Za-z0-9])${escapeRe(f)}(?![A-Za-z0-9])`).test(restText));
  });
  const paths = entries.map((e) => e.path);
  return {
    leaked,
    unseen: entries.filter((e) => !unreached.includes(e.path) && !seen.get(e.text)).map((e) => e.path),
    stale: unreached.filter((p) => !paths.includes(p) || seen.get(entries.find((e) => e.path === p).text)),
    duplicates: words.filter((w) => entries.filter((e) => e.text === w).length > 1),
  };
}
