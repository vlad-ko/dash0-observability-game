// Text rules shared by every kind of authored content (#391, docs/FOUNDATION.md §2.12): what a
// string may contain. Pure; each check returns a list of problem phrases (empty is fine) and never
// throws, whatever it is given. Callers put their own path in front of each problem.

/** A kebab-case id of at most 64 characters: the registry's rule, re-exported so content shares it. */
export { isId } from '../registry.mjs';

const CONTROL = /[\u0000-\u001f\u007f]/;
const CONTROL_EXCEPT_LINES = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const EM_DASH = String.fromCharCode(0x2014);

function check(s, control) {
  if (typeof s !== 'string') return ['must be a string'];
  const problems = [];
  if (s !== s.trim()) problems.push('must not start or end with whitespace');
  if (control.test(s)) problems.push('must not contain control characters');
  if (s.includes(EM_DASH)) problems.push('must not contain an em dash');
  return problems;
}

/** Problems with a plain text string: trimmed, no control characters, no em dash. */
export const checkPlain = (s) => check(s, CONTROL);

/** Like `checkPlain`, but newlines and tabs are allowed inside (code samples). */
export const checkCode = (s) => check(s, CONTROL_EXCEPT_LINES);

/** The only tags a trusted HTML field may use (docs/CONTENT.md). */
export const HTML_TAGS = Object.freeze(['p', 'b', 'strong', 'i', 'em', 'code', 'pre', 'br', 'ul', 'ol', 'li', 'table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td']);
/** The only attributes, by tag. */
export const HTML_ATTRIBUTES = Object.freeze({ th: ['scope'], pre: ['data-wrap'], code: ['data-token'] });

// A `<` that starts a tag, a closing tag, a comment or a declaration. Any other `<` is text ("p99 < 1s").
const TAG_START = /<(?=[A-Za-z/!?])/g;
const ATTRIBUTE = /\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>=`]+))?/y;

/** The tag at the start of `s` as `{closing, name, attrs}`, or null when it is not well formed. */
function readTag(s) {
  const head = /^<(\/?)([A-Za-z][A-Za-z0-9]*)/.exec(s);
  if (!head) return null;
  const attrs = [];
  let i = head[0].length;
  for (;;) {
    ATTRIBUTE.lastIndex = i;
    const a = ATTRIBUTE.exec(s);
    if (!a) break;
    attrs.push(a[1].toLowerCase());
    i = ATTRIBUTE.lastIndex;
  }
  return /^\s*\/?>/.test(s.slice(i)) ? { closing: head[1] === '/', name: head[2].toLowerCase(), attrs } : null;
}

/**
 * Problems with a trusted HTML field: the plain rules (newlines are fine), then only the tags and attributes
 * of HTML_TAGS and HTML_ATTRIBUTES. A `<` that does not start a tag and a bare `&` are fine.
 */
export function checkHtml(s) {
  const problems = check(s, CONTROL_EXCEPT_LINES);
  if (typeof s !== 'string') return problems;
  for (const m of s.matchAll(TAG_START)) {
    const tag = readTag(s.slice(m.index));
    if (!tag) {
      problems.push(`has a malformed tag near ${JSON.stringify(s.slice(m.index, m.index + 20))}`);
      continue;
    }
    if (!HTML_TAGS.includes(tag.name)) {
      problems.push(`must not contain the tag <${tag.name}>`);
      continue;
    }
    if (tag.closing && tag.attrs.length) problems.push(`must not give attributes to the closing tag </${tag.name}>`);
    else for (const a of tag.attrs) if (!(HTML_ATTRIBUTES[tag.name] ?? []).includes(a)) problems.push(`must not give <${tag.name}> the attribute ${a}`);
  }
  return problems;
}
