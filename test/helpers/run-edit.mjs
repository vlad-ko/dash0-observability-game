// Helpers for the tests of converted run(ctx) levels (docs/CONTENT.md section 11): edit every word of a content
// file's `run`, then find the words that still show on a screen without the edit.

/**
 * `run` with `EDITED<n> ` in front of every string that is not an id or a key, n counting the entries in the order
 * `checkWords` reads them (depth first, lists in order, objects in key order). Each entry has its own mark, so two
 * entries with the same words, or one that starts like another, can still be told apart on a screen.
 */
export function editRun(run) {
  let n = 0;
  const walk = (value, key) => {
    if (Array.isArray(value)) return value.map((x) => walk(x, key));
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
    return typeof value === 'string' && key !== 'id' && key !== 'key' ? `EDITED${n++} ${value}` : value;
  };
  return walk(run, '');
}

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
const FILL_IN = /\{\{[a-z][a-z0-9-]*\}\}/;
/**
 * A regex for `s` where each `{{name}}` (a fill-in or slot, filled on the screen) is a short run of text that may hold
 * inline tags, with or without attributes, such as `<code data-token="x">x</code>` (a value is words, maybe marked up; the bound of 80 keeps a search of a whole
 * page fast): the fixed parts are matched as written.
 * With `trim`, a fill-in at the start or end of `s` is left out (it adds nothing to a search that has no mark to anchor
 * on); a `s` that is only fill-ins then matches nothing.
 */
function pattern(s, flags = '', trim = false, capture = false) {
  const parts = s.split(FILL_IN);
  if (trim) {
    if (parts[0] === '') parts.shift();
    if (parts.length && parts[parts.length - 1] === '') parts.pop();
    if (parts.length === 0) return /(?!)/;
  }
  const unit = '(?:[^<>]|<\\/?[a-z]+(?:\\s[^<>]*)?>){1,80}?';
  return new RegExp(parts.map(escapeRe).join(capture ? `(${unit})` : unit), flags);
}

/**
 * Check the screens a play-through showed (`screens`: strings of HTML or text) against `coreRun`, a content file's `run`,
 * that was edited with `editRun`. Returns `{leaked, unseen, stale}`, each empty when all is well:
 * - leaked: words of the real content shown without their `EDITED<n> ` mark. A word of 12 characters or more is looked for
 *   in the HTML (raw or escaped, `<wbr>` taken out); a shorter one in the text with the tags taken out, as a whole
 *   word. `kept` (the level's RUN_FIXTURES) are fixture literals the level shows as they are: a word equal to one is
 *   skipped, and they are taken out of the screens before the short-word check only.
 *   An entry with `{{name}}` fill-ins matches any text where each one is, in all three checks.
 * - unseen: paths of entries (not in `unreached`) that never show with their own mark on any screen.
 * - stale: paths listed in `unreached` that do show edited, or that are no entry: the list must not outlive the drivers.
 * `unreached` names the entries the drivers do not reach, by path, for this level.
 */
export function checkWords(coreRun, screens, { unreached = [], kept = [] } = {}) {
  const entries = entriesOf(coreRun, 'run');
  const html = screens.map(stripWbr).join('\n');
  const words = [...new Set(entries.map((e) => e.text))].sort((a, b) => b.length - a.length);
  const mark = (i) => `EDITED${i} `;
  // An entry is seen when it shows with its own mark (so a duplicate, or an entry that starts another, is judged on its
  // own). Take every marked entry out of the screens, longest first (a shorter word can sit inside a longer edited
  // one): what is left is shown as it is. Entries without fill-ins go first, so a value that is the text of another
  // entry is taken out as that entry; an entry with fill-ins then leaves its values in `rest` (between separators, the
  // captures joined by a space, since two neighbouring wildcards split a value at any space), where they are leak-checked.
  const text = plain(html);
  // An entry with `{{name}}` fill-ins is matched with any text where each one is (its values are on the screen).
  const seen = entries.map((e, i) => [e.text, escapeHtml(e.text)].some((f) => pattern(`${mark(i)}${f}`).test(html)) || pattern(`${mark(i)}${plain(e.text)}`).test(text));
  let rest = html;
  const order = entries.map((_, i) => i).sort((a, b) => FILL_IN.test(entries[a].text) - FILL_IN.test(entries[b].text) || entries[b].text.length - entries[a].text.length);
  for (const i of order) {
    for (const f of [entries[i].text, escapeHtml(entries[i].text)]) {
      rest = rest.replace(pattern(`${mark(i)}${f}`, 'g', false, true), (m, ...g) => `\u0000${g.slice(0, -2).join(' ')}\u0000`);
    }
  }
  // A fixture is stripped only for the short words: inside a longer word it must not hide that word leaking.
  let restShort = rest;
  for (const k of kept) restShort = restShort.split(k).join('\u0000');
  const restText = plain(restShort);
  const leaked = words.filter((w) => {
    if (kept.includes(w)) return false;
    if (w.length >= LONG) return [w, escapeHtml(w)].some((f) => pattern(f, '', true).test(rest));
    const t = plain(w);
    return t !== '' && [t, escapeHtml(t)].some((f) => new RegExp(`(?<![A-Za-z0-9])${pattern(f, '', true).source}(?![A-Za-z0-9])`).test(restText));
  });
  const paths = entries.map((e) => e.path);
  return {
    leaked,
    unseen: entries.filter((e, i) => !unreached.includes(e.path) && !seen[i]).map((e) => e.path),
    stale: unreached.filter((p) => !paths.includes(p) || seen[paths.indexOf(p)]),
  };
}
