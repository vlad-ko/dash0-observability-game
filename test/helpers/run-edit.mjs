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
 * that was edited with `editRun`. Returns `{leaked, unseen, stale}`, each empty when all is well:
 * - leaked: words of the real content shown without `EDITED ` in front. A word of 12 characters or more is looked for
 *   in the HTML (raw or escaped, `<wbr>` taken out); a shorter one in the text with the tags taken out, as a whole
 *   word. `kept` (the level's RUN_FIXTURES) are fixture literals the level shows as they are: skipped.
 * - unseen: paths of entries (not in `unreached`) that never show edited on any screen.
 * - stale: paths listed in `unreached` that do show edited, or that are no entry: the list must not outlive the drivers.
 * `unreached` names the entries the drivers do not reach, by path, for this level.
 */
export function checkWords(coreRun, screens, { unreached = [], kept = [] } = {}) {
  const entries = entriesOf(coreRun, 'run');
  const html = screens.map(stripWbr).join('\n');
  const text = plain(html);
  const shownEdited = (w) => [w, escapeHtml(w)].some((f) => html.includes(`EDITED ${f}`)) || text.includes(`EDITED ${plain(w)}`);
  const words = [...new Set(entries.map((e) => e.text))].sort((a, b) => b.length - a.length);
  // Take every edited word out of the screens, longest first (a short word can sit inside a longer edited one), and the
  // fixtures: what is left is shown as it is.
  let rest = html;
  for (const w of words) for (const f of [w, escapeHtml(w)]) rest = rest.split(`EDITED ${f}`).join('\u0000');
  for (const k of kept) rest = rest.split(k).join('\u0000');
  const restText = plain(rest);
  const leaked = words.filter((w) => {
    if (kept.includes(w)) return false;
    if (w.length >= LONG) return [w, escapeHtml(w)].some((f) => rest.includes(f));
    const t = plain(w);
    return t !== '' && [t, escapeHtml(t)].some((f) => new RegExp(`(?<![A-Za-z0-9])${escapeRe(f)}(?![A-Za-z0-9])`).test(restText));
  });
  const paths = entries.map((e) => e.path);
  return {
    leaked,
    unseen: entries.filter((e) => !unreached.includes(e.path) && !shownEdited(e.text)).map((e) => e.path),
    stale: unreached.filter((p) => !paths.includes(p) || shownEdited(entries.find((e) => e.path === p).text)),
  };
}
