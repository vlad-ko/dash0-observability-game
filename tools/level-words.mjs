// Proves a level's words survived a move into its content file (#391, docs/CHANGING-A-LEVEL.md).
//
//   node tools/level-words.mjs <old-level-file> <level-id>
//
// Compares the words in the OLD level file (its string literals) with the words in the level's code now
// (levels/<id>.mjs) plus its content (content/core/levels/<id>.mjs). Words are whitespace-separated tokens
// with tags stripped and fill-ins removed. `lost` is a word the old file had that nothing now has; `added` is
// a word now there that the old file did not have. Exit 1 unless both are empty. A developer tool, kept out of
// the deployed site by .vercelignore.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literalSites } from './js-strings.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILL_IN = /\{\{([a-z][a-z0-9-]*)\}\}/g;
const TAG = /<\/?[A-Za-z][^>]*>/g;

/** The words of one piece of text: tags and fill-ins become spaces, then split on whitespace. */
const tokensOf = (s) => s.replace(TAG, ' ').replace(FILL_IN, ' ').split(/\s+/).filter(Boolean);

/** Every string of the content, as `{text, ids}`: the values of `id` and `key` are ids, the rest is text. */
function contentStrings(node, out = { text: [], ids: [], names: new Set() }, key = '') {
  if (typeof node === 'string') {
    if (key === 'id' || key === 'key') out.ids.push(node);
    else {
      out.text.push(node);
      for (const m of node.matchAll(FILL_IN)) out.names.add(m[1]);
    }
  } else if (Array.isArray(node)) node.forEach((x) => contentStrings(x, out, key));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) contentStrings(v, out, k);
  return out;
}

const literalTokens = (src) => literalSites(src).flatMap((s) => s.pieces.flatMap(tokensOf));

/** A minus B as multisets (each token of B cancels one of A), sorted. */
function minus(a, b) {
  const left = new Map();
  for (const t of b) left.set(t, (left.get(t) ?? 0) + 1);
  const out = [];
  for (const t of a) {
    const n = left.get(t) ?? 0;
    if (n > 0) left.set(t, n - 1);
    else out.push(t);
  }
  return out.sort();
}

/**
 * Compare the words of `oldSrc` with those of `newSrc` plus `content` (the parsed content file).
 * `lost`: old literal words not in (new literals + content text + content ids). `added`: (new literals, minus
 * the fill-in names the content uses, + content text without its ids) not in the old literals. Sorted multisets.
 */
export function wordDiff(oldSrc, newSrc, content) {
  const { text, ids, names } = contentStrings(content);
  const oldWords = literalTokens(oldSrc);
  const newWords = literalTokens(newSrc).filter((t) => !names.has(t));
  const textWords = text.flatMap(tokensOf);
  return {
    lost: minus(oldWords, [...literalTokens(newSrc), ...textWords, ...ids.flatMap(tokensOf)]),
    added: minus([...newWords, ...textWords], oldWords),
  };
}

async function main(argv) {
  const [oldFile, id] = argv;
  if (!oldFile || !id) {
    console.error('usage: node tools/level-words.mjs <old-level-file> <level-id>');
    return 2;
  }
  const oldSrc = readFileSync(resolve(oldFile), 'utf8');
  const newSrc = readFileSync(join(ROOT, 'levels', `${id}.mjs`), 'utf8');
  const content = (await import(pathToFileURL(join(ROOT, 'content', 'core', 'levels', `${id}.mjs`)).href)).default;
  const { lost, added } = wordDiff(oldSrc, newSrc, content);
  console.log(`lost (in ${oldFile}, nowhere now): ${JSON.stringify(lost)}`);
  console.log(`added (now, not in ${oldFile}): ${JSON.stringify(added)}`);
  return lost.length || added.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
