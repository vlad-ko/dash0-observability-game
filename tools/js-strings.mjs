// The string literals of a JavaScript source file, for `tools/level-words.mjs` and the level tests (#391).
// A heuristic scanner, not a parser: it knows strings, templates (nested `${}` included), comments, regular
// expression literals (told from division by the token before the `/`) and import specifiers. A developer tool,
// kept out of the deployed site by .vercelignore.

const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'instanceof', 'do', 'else', 'yield', 'await']);
const REGEX_AFTER_PUNCT = /^[(,=:[!&|?{;+\-*%<>~^]$/;
const SIMPLE_ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };
const WORD_START = /[A-Za-z_$\u0080-￿]/;
const WORD_PART = /[A-Za-z0-9_$\u0080-￿]/;

/**
 * Every string literal and template literal in `src`, in order of appearance: `[{line, pieces}]`. `line` is the
 * 1-based line the literal starts on. `pieces` are the decoded text: one piece for a string, one more piece per
 * `${}` for a template. Literals joined with `+` are one site; a template nested in a `${}` is a site of its own
 * (listed after the template that holds it). Import and export specifiers (`from 'x'`, `import 'x'`, `import('x')`)
 * are not words and are skipped.
 */
export function literalSites(src) {
  const sites = [];
  const newlines = [];
  for (let i = src.indexOf('\n'); i !== -1; i = src.indexOf('\n', i + 1)) newlines.push(i);
  const lineAt = (i) => newlines.filter((n) => n < i).length + 1;

  const skipSpace = (i) => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith('//', i)) {
        const eol = src.indexOf('\n', i);
        i = eol === -1 ? src.length : eol;
      } else if (src.startsWith('/*', i)) {
        const end = src.indexOf('*/', i + 2);
        i = end === -1 ? src.length : end + 2;
      } else return i;
    }
  };

  /** Decode the escape at `src[i]` (the character after the backslash): `{text, end}`. */
  const escape = (i) => {
    const c = src[i];
    if (c === 'x') return { text: String.fromCharCode(parseInt(src.slice(i + 1, i + 3), 16)), end: i + 3 };
    if (c === 'u') {
      if (src[i + 1] === '{') {
        const close = src.indexOf('}', i);
        return { text: String.fromCodePoint(parseInt(src.slice(i + 2, close), 16)), end: close + 1 };
      }
      return { text: String.fromCharCode(parseInt(src.slice(i + 1, i + 5), 16)), end: i + 5 };
    }
    if (c === '\r' && src[i + 1] === '\n') return { text: '', end: i + 2 };
    if (c === '\n' || c === '\r') return { text: '', end: i + 1 };
    return { text: Object.hasOwn(SIMPLE_ESCAPES, c) ? SIMPLE_ESCAPES[c] : c, end: i + 1 };
  };

  /** A quoted string starting at `src[i]`: `{value, end}`. */
  const readString = (i) => {
    const quote = src[i];
    let value = '';
    let j = i + 1;
    while (j < src.length && src[j] !== quote) {
      if (src[j] === '\\') {
        const e = escape(j + 1);
        value += e.text;
        j = e.end;
      } else value += src[j++];
    }
    return { value, end: j + 1 };
  };

  /** A template starting at `src[i]`, appended to `site`; each `${}` starts a new piece. -> the index after it. */
  const readTemplate = (i, site) => {
    let j = i + 1;
    const last = () => site.pieces.length - 1;
    while (j < src.length && src[j] !== '`') {
      if (src[j] === '\\') {
        const e = escape(j + 1);
        site.pieces[last()] += e.text;
        j = e.end;
      } else if (src[j] === '$' && src[j + 1] === '{') {
        site.pieces.push('');
        j = scanCode(j + 2, true);
      } else site.pieces[last()] += src[j++];
    }
    return j + 1;
  };

  /** After a literal ending at `j`: the index of the next literal when it is joined by a single `+`, else -1. */
  const nextJoined = (j) => {
    let k = skipSpace(j);
    if (src[k] !== '+' || src[k + 1] === '+' || src[k + 1] === '=') return -1;
    k = skipSpace(k + 1);
    return src[k] === "'" || src[k] === '"' || src[k] === '`' ? k : -1;
  };

  /** A literal (and the literals joined to it by `+`) starting at `src[i]`: one site. -> the index after it. */
  const readSite = (i) => {
    const site = { line: lineAt(i), pieces: [''] };
    sites.push(site);
    let j = i;
    while (j !== -1) {
      if (src[j] === '`') j = readTemplate(j, site);
      else {
        const s = readString(j);
        site.pieces[site.pieces.length - 1] += s.value;
        j = s.end;
      }
      const next = nextJoined(j);
      if (next === -1) return j;
      j = next;
    }
    return j;
  };

  const skipLiteral = (i) => {
    if (src[i] === '`') return readTemplate(i, { pieces: [''] });
    return readString(i).end;
  };

  /** A regular expression literal starting at `src[i]`: the index after its flags. */
  const skipRegex = (i) => {
    let j = i + 1;
    let inClass = false;
    while (j < src.length && src[j] !== '\n') {
      if (src[j] === '\\') j++;
      else if (src[j] === '[') inClass = true;
      else if (src[j] === ']') inClass = false;
      else if (src[j] === '/' && !inClass) break;
      j++;
    }
    j++;
    while (j < src.length && WORD_PART.test(src[j])) j++;
    return j;
  };

  /** Scan code from `i`; with `stopAtBrace`, until the `}` that closes a `${`. -> the index after it. */
  function scanCode(i, stopAtBrace) {
    let depth = 0;
    let prev = null;
    let prevPrev = null;
    const see = (token) => {
      prevPrev = prev;
      prev = token;
    };
    while (i < src.length) {
      i = skipSpace(i);
      if (i >= src.length) break;
      const c = src[i];
      if (c === "'" || c === '"' || c === '`') {
        const specifier = prev === 'from' || prev === 'import' || (prev === '(' && prevPrev === 'import');
        i = specifier ? skipLiteral(i) : readSite(i);
        see('str');
      } else if (c === '/') {
        if (prev === null || REGEX_AFTER_PUNCT.test(prev) || REGEX_AFTER_WORD.has(prev)) {
          i = skipRegex(i);
          see('regex');
        } else {
          i++;
          see('/');
        }
      } else if (WORD_START.test(c)) {
        let j = i + 1;
        while (j < src.length && WORD_PART.test(src[j])) j++;
        see(src.slice(i, j));
        i = j;
      } else if (/[0-9]/.test(c)) {
        let j = i + 1;
        while (j < src.length && /[\w.]/.test(src[j])) j++;
        see('num');
        i = j;
      } else if (c === '{') {
        depth++;
        see(c);
        i++;
      } else if (c === '}') {
        if (depth === 0 && stopAtBrace) return i + 1;
        depth = Math.max(0, depth - 1);
        see(c);
        i++;
      } else {
        see(c);
        i++;
      }
    }
    return i;
  }

  scanCode(0, false);
  return sites;
}
