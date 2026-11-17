// Reads a content file (`// comment` lines, then `export default {...};`, docs/PRIMERS.md) as strict JSON.
// JSON.parse silently keeps the last of two equal keys, so this also scans for duplicates.
import { readFileSync } from 'node:fs';

// Duplicate keys within one object, as `duplicate key "k"` messages. Expects text JSON.parse accepted.
function duplicateKeys(json) {
  const errors = [];
  const stack = [];
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (ch === '{') stack.push(new Set());
    else if (ch === '[') stack.push(null);
    else if (ch === '}' || ch === ']') stack.pop();
    else if (ch === '"') {
      let j = i + 1;
      while (json[j] !== '"') j += json[j] === '\\' ? 2 : 1;
      const key = JSON.parse(json.slice(i, j + 1));
      i = j;
      let k = j + 1;
      while (/\s/.test(json[k])) k++;
      const keys = stack[stack.length - 1];
      if (json[k] === ':' && keys) {
        if (keys.has(key)) errors.push(`duplicate key ${JSON.stringify(key)}`);
        keys.add(key);
      }
    }
  }
  return errors;
}

/**
 * Parse a content file. `path` is a file path or URL. → `{value, errors}`: `value` is the parsed
 * object (undefined when the wrapper or the JSON is bad), `errors` lists every problem found.
 */
export function readJsonModule(path) {
  const body = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('//'))
    .join('\n');
  const m = /^\s*export default (\{[\s\S]*\});\s*$/.exec(body);
  if (!m) return { value: undefined, errors: ['must be `export default {...};` after leading // lines'] };
  let value;
  try {
    value = JSON.parse(m[1]);
  } catch (e) {
    return { value: undefined, errors: [`not strict JSON: ${e.message}`] };
  }
  return { value, errors: duplicateKeys(m[1]) };
}
