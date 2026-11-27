// The browser loads main.mjs and follows every relative import, static and dynamic. It cannot resolve node:
// specifiers or bare package names (CSP, no build step), while node --test can, so walk the graph and fail on both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = /(?:\bimport|\bexport)\s(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function walk(entry) {
  const seen = new Set();
  const files = [];
  const bad = [];
  const rel = (f) => path.relative(ROOT, f);
  const visit = (file, chain) => {
    if (seen.has(file)) return;
    seen.add(file);
    files.push(rel(file));
    const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // doc comments quote imports
    for (const m of src.matchAll(SPEC)) {
      const spec = m[1] ?? m[2];
      if (!spec.startsWith('.') && !spec.startsWith('/')) {
        bad.push([...chain, file].map(rel).join(' -> ') + ' -> ' + spec);
        continue;
      }
      const target = path.resolve(path.dirname(file), spec);
      if (!fs.existsSync(target)) {
        bad.push([...chain, file].map(rel).join(' -> ') + ' -> ' + spec + ' (missing)');
        continue;
      }
      if (target.endsWith('.mjs') || target.endsWith('.js')) visit(target, [...chain, file]);
    }
  };
  visit(entry, []);
  return { files, bad };
}

test('the browser import graph from main.mjs has no node: or bare specifiers', () => {
  const { files, bad } = walk(path.join(ROOT, 'main.mjs'));
  assert.deepEqual(bad, [], 'not loadable in a browser:\n' + bad.join('\n'));
  assert.ok(files.includes('levels/connect-to-dash0.mjs'), 'the walker follows static imports');
});

test('the walker sees the vendored modules', () => {
  const { files } = walk(path.join(ROOT, 'main.mjs'));
  assert.ok(files.some((f) => f.startsWith('vendor/')), 'vendor/ files are in the graph');
});
