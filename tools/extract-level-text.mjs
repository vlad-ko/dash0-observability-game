// Prints every content-allowlisted text field of a level as a content file (#391, docs/CONTENT.md):
// `node tools/extract-level-text.mjs <level-id>`. Text only, in the order the level
// shows it, each element carrying the id or key it joins on; answers, figures and wiring stay in the level file.
// Values print as they are today, so a `${...}` in old copy appears as its result: put `{{name}}` back by hand. Every level is converted, so it prints a level's text in the
// merged order (the logic's keys first): use it to check a level's words or to start the content file of a new level.
// A developer tool, kept out of the deployed site by .vercelignore.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONTAINER_KEYS, IDENTITY_KEYS, MAP_KEY, STEP_TYPE_KEYS, TEXT_KEYS } from '../lib/content/keys.mjs';
import { isId } from '../lib/content/text-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// The text and the joining ids inside `node`, or undefined when it holds none. Identity keys come first.
function pick(node) {
  if (Array.isArray(node)) {
    const list = node.map((x) => pick(x)).filter((x) => x !== undefined);
    return list.length ? list : undefined;
  }
  if (!isObject(node)) return undefined;
  const out = {};
  for (const k of IDENTITY_KEYS) if (typeof node[k] === 'string') out[k] = node[k];
  let found = false;
  for (const [k, v] of Object.entries(node)) {
    if (IDENTITY_KEYS.includes(k)) continue;
    if (k === MAP_KEY && isObject(v)) out[k] = { ...v };
    else if (TEXT_KEYS.includes(k) && typeof v === 'string') out[k] = v;
    else if (CONTAINER_KEYS.includes(k)) {
      const inner = pick(v);
      if (inner === undefined) continue;
      out[k] = inner;
    } else continue;
    found = true;
  }
  return found ? out : undefined;
}

/** The content object of a level (its default export), in the shape bindLevel reads. */
export function extractLevelText(level) {
  const out = { id: level.id };
  for (const k of ['name', 'sub', 'rewardTitle']) if (typeof level[k] === 'string') out[k] = level[k];
  if (level.play) {
    const steps = level.play.steps.map((step) => {
      const s = {};
      for (const k of ['intro', 'question', 'show', 'code']) if (typeof step[k] === 'string') s[k] = step[k];
      const type = STEP_TYPE_KEYS.find((k) => k in step);
      s[type] = pick(step[type]) ?? { id: step[type].id };
      return s;
    });
    out.play = { finish: level.play.finish, steps };
  }
  return out;
}

/** The text of a content file for `level`: a header comment, then `export default` and the object as JSON. */
export function contentFileText(level) {
  return `// Text of levels/${level.id}.mjs (docs/CONTENT.md).\nexport default ${JSON.stringify(extractLevelText(level), null, 2)};\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const id = process.argv[2];
  if (!isId(id)) {
    console.error('usage: node tools/extract-level-text.mjs <level-id>');
    process.exit(2);
  }
  const mod = await import(pathToFileURL(join(ROOT, 'levels', `${id}.mjs`)).href);
  process.stdout.write(contentFileText(mod.default));
}
