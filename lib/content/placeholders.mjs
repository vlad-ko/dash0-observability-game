// Fill-ins (#391, docs/CONTENT.md; the module keeps its name): `{{name}}` in a content string is replaced by the level's
// figure of that name, so a number lives in the logic and the copy never disagrees with it. Pure.
//
// Grammar: `{{`, a name `[a-z][a-z0-9-]*`, `}}`. Any other `{{` is an error. A lone `}}` is plain text.
// One pass: an inserted value is never scanned again.

const NAME = /^\{\{([a-z][a-z0-9-]*)\}\}/;

/**
 * Fill the `{{name}}` fill-ins of `str` from `vars` (name to string or finite number). `path` prefixes each error.
 * -> `{text, used, errors}`: `used` is the set of names found. A fill-in that cannot be filled stays in
 * `text` as written and is an error; it is never replaced by an empty string.
 */
export function fill(str, vars, path = '') {
  const errors = [];
  const used = new Set();
  const at = path ? `${path}: ` : '';
  let text = '';
  let i = 0;
  while (i < str.length) {
    const open = str.indexOf('{{', i);
    if (open === -1) break;
    text += str.slice(i, open);
    const m = NAME.exec(str.slice(open));
    if (!m) {
      errors.push(`${at}malformed fill-in near ${JSON.stringify(str.slice(open, open + 20))}`);
      text += '{{';
      i = open + 2;
      continue;
    }
    const [whole, name] = m;
    used.add(name);
    const v = Object.hasOwn(vars, name) ? vars[name] : undefined;
    if (v === undefined) {
      errors.push(`${at}fill-in {{${name}}} has no value`);
      text += whole;
    } else if (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) {
      text += String(v);
    } else {
      errors.push(`${at}fill-in {{${name}}} must be a string or a finite number, not ${typeof v}`);
      text += whole;
    }
    i = open + whole.length;
  }
  return { text: text + str.slice(i), used, errors };
}

/**
 * `fill` for a level's code (#391): the text of a run(ctx) level holds `{{name}}` slots for values only the code
 * knows (the ctx, the session, the page). Throws, never prints an empty string, when a slot has no value, a value
 * names no slot in `str`, or a value is not a string or a finite number. One pass, like `fill`.
 */
export function fillSlots(str, values) {
  const r = fill(str, values);
  for (const name of Object.keys(values)) {
    if (!r.used.has(name)) throw new Error(`"${name}" is not a slot of this text: ${JSON.stringify(str.slice(0, 60))}`);
  }
  if (r.errors.length) {
    const missing = [...r.used].find((name) => !Object.hasOwn(values, name) || values[name] === undefined);
    if (missing !== undefined) throw new Error(`slot {{${missing}}} has no value in ${JSON.stringify(str.slice(0, 60))}`);
    throw new Error(r.errors[0]);
  }
  return r.text;
}
