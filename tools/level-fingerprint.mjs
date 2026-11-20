// Writes the canonical exports of every level in levels/index.mjs ACTS, so a refactor that moves
// copy out of a level file (#391) can prove nothing a player sees changed: run it before and after
// into two directories and `diff -r` them.
//
//   node tools/level-fingerprint.mjs <outdir>       one <level-id>.json per level
//   node tools/level-fingerprint.mjs <file>.json    one file, every level under its id
//   node tools/level-fingerprint.mjs --shown <dir>  the same with each glossary marker (#442) replaced by its shown words,
//                                                   so a PR that marks terms proves no word changed: diff --shown output
//
// Canonical form: object keys sorted, arrays in order, a function as "[function]". Not a build
// step: a developer tool, kept out of the deployed site by .vercelignore.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unwrapGloss } from '../lib/content/terms.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Deterministic text for any level export. Compact unless `indent` is given (a number of spaces
 * or a string), which puts one entry per line so a diff points at the changed line.
 */
export function canonical(value, indent = '') {
  const step = typeof indent === 'number' ? ' '.repeat(indent) : indent;
  return render(value, step, '', new Set());
}

function render(value, step, pad, path) {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return String(value);
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(`[${value}]`);
    case 'bigint':
      return JSON.stringify(`[bigint ${value}]`);
    case 'undefined':
      return JSON.stringify('[undefined]');
    case 'function':
      return JSON.stringify('[function]');
    case 'symbol':
      return JSON.stringify('[symbol]');
    default:
  }
  if (path.has(value)) throw new Error('canonical: a cycle in the value');
  path.add(value);
  try {
    if (value instanceof RegExp) return JSON.stringify(`[regexp ${value}]`);
    if (value instanceof Date) return JSON.stringify(`[date ${value.toISOString()}]`);
    const inner = step ? pad + step : '';
    const join_ = (parts, open, close) => {
      if (parts.length === 0) return open + close;
      return step ? `${open}\n${parts.map((p) => inner + p).join(',\n')}\n${pad}${close}` : `${open}${parts.join(',')}${close}`;
    };
    if (Array.isArray(value)) return join_(value.map((v) => render(v, step, inner, path)), '[', ']');
    if (value instanceof Set) return join_([...value].map((v) => render(v, step, inner, path)), '[', ']');
    const entries = value instanceof Map ? [...value.entries()].map(([k, v]) => [String(k), v]) : Object.entries(value);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return join_(entries.map(([k, v]) => `${JSON.stringify(k)}:${step ? ' ' : ''}${render(v, step, inner, path)}`), '{', '}');
  } finally {
    path.delete(value);
  }
}

/**
 * `value` with each gloss span (a glossary term marked in a level's text, #442) replaced by its shown words, deep through
 * arrays and plain objects; anything else is returned as it is. A marking PR proves no word changed by a zero diff of
 * `--shown` output, while the plain output keeps the spans.
 */
export function shownValue(value) {
  if (typeof value === 'string') return unwrapGloss(value);
  if (Array.isArray(value)) return value.map(shownValue);
  const proto = value !== null && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
  if (proto === Object.prototype || proto === null) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shownValue(v)]));
  return value;
}

/** The ids of every level (and boss) in the registry, in play order. */
async function levelIds() {
  const { ACTS } = await import(pathToFileURL(join(ROOT, 'levels', 'index.mjs')).href);
  return ACTS.flatMap((a) => [...a.levels, ...(a.boss ? [a.boss] : [])]).map((l) => l.id);
}

/** Every export of levels/<id>.mjs (default included) as canonical text. */
async function fingerprintOf(id, shown) {
  const ns = await import(pathToFileURL(join(ROOT, 'levels', `${id}.mjs`)).href);
  return `${canonical(shown ? shownValue({ ...ns }) : { ...ns }, 2)}\n`;
}

/** Writes <id>.json per level into `dir`; returns the ids written. `shown` unwraps gloss spans (see shownValue). */
export async function writeFingerprints(dir, { shown = false } = {}) {
  mkdirSync(dir, { recursive: true });
  const ids = await levelIds();
  for (const id of ids) writeFileSync(join(dir, `${id}.json`), await fingerprintOf(id, shown));
  return ids;
}

/** Writes every level under its id into one JSON file; returns the ids written. */
export async function writeFingerprintFile(file, { shown = false } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  const ids = await levelIds();
  const all = {};
  for (const id of ids) all[id] = (await import(pathToFileURL(join(ROOT, 'levels', `${id}.mjs`)).href));
  const level = (ns) => (shown ? shownValue({ ...ns }) : { ...ns });
  writeFileSync(file, `${canonical(Object.fromEntries(Object.entries(all).map(([k, ns]) => [k, level(ns)])), 2)}\n`);
  return ids;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const shown = args.includes('--shown');
  const out = args.find((a) => a !== '--shown');
  if (!out) {
    process.stderr.write('usage: node tools/level-fingerprint.mjs [--shown] <outdir | file.json>\n');
    process.exit(2);
  }
  const ids = out.endsWith('.json') ? await writeFingerprintFile(out, { shown }) : await writeFingerprints(out, { shown });
  process.stdout.write(`fingerprinted ${ids.length} levels into ${out}\n`);
}
