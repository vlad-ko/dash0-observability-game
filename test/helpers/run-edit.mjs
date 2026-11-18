// Helpers for the tests of converted run(ctx) levels (docs/CONTENT.md section 11): edit every word of a content
// file's `run`, then find the words that still show on a screen without the edit.

/** `value` with `EDITED ` in front of every string that is not an id or a key. */
export const editRun = (value, key) => {
  if (Array.isArray(value)) return value.map((x) => editRun(x, key));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, editRun(v, k)]));
  return typeof value === 'string' && key !== 'id' && key !== 'key' ? `EDITED ${value}` : value;
};

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Every string of a content `run` that is not an id or a key. */
function wordsOf(value, key = '') {
  if (Array.isArray(value)) return value.flatMap((x) => wordsOf(x, key));
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => wordsOf(v, k));
  return typeof value === 'string' && key !== 'id' && key !== 'key' ? [value] : [];
}

/**
 * The words of `coreRun` (12 characters or more) that show somewhere in `screens` (strings of HTML or text) without
 * `EDITED ` in front, raw or HTML-escaped: a level that plays words other than the ones it was given.
 */
export function unprefixedWords(coreRun, screens) {
  const words = [...new Set(wordsOf(coreRun))].filter((w) => w.length >= 12).sort((a, b) => b.length - a.length);
  // Take every edited word out of the screens, longest first (a short word can sit inside a longer edited one);
  // a word still there is one that was shown without its edit.
  let rest = screens.join('\n');
  for (const w of words) for (const form of [w, escapeHtml(w)]) rest = rest.split(`EDITED ${form}`).join('\u0000');
  return words.filter((w) => [w, escapeHtml(w)].some((form) => rest.includes(form)));
}
