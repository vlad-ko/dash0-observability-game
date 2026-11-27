// (#509 P5) the answer key stays on the server. lib/dash0-task/scenario.mjs and grade.mjs must not be imported by a
// level, a widget, lib/play.mjs or main.mjs, nor be reachable from main.mjs through any chain of imports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_ONLY = ['lib/dash0-task/scenario.mjs', 'lib/dash0-task/grade.mjs'];
// Static and dynamic relative imports and re-exports.
const IMPORT = /(?:import|export)\b[^'";]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g;
const importsIn = (text, rel) => [...text.matchAll(IMPORT)].map((m) => relative(ROOT, resolve(ROOT, dirname(rel), m[1] ?? m[2] ?? m[3])));
const importsOf = (rel) => importsIn(readFileSync(join(ROOT, rel), 'utf8'), rel);
const filesUnder = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : e.name.endsWith('.mjs') ? [join(dir, e.name)] : []));

test('no level, widget, lib/play.mjs or main.mjs imports the scenario or grading module', () => {
  const browser = [...filesUnder('levels'), ...filesUnder('lib/widgets'), 'lib/play.mjs', 'main.mjs'];
  assert.ok(browser.length > 20, 'the scan covers the levels and widgets');
  for (const file of browser) {
    for (const target of importsOf(file)) assert.ok(!SERVER_ONLY.includes(target), `${file} imports ${target}`);
  }
});

test('the scenario and grading modules are not reachable from main.mjs through any chain of imports', () => {
  const seen = new Set();
  const stack = ['main.mjs'];
  while (stack.length) {
    const rel = stack.pop();
    if (seen.has(rel) || rel.startsWith('vendor/')) continue;
    seen.add(rel);
    stack.push(...importsOf(rel));
  }
  assert.ok(seen.size > 100, 'the walk covers the game');
  for (const target of SERVER_ONLY) assert.ok(!seen.has(target), `${target} is reachable from main.mjs`);
});

test('the walk can see an import: it finds the one api function that does import them', () => {
  const found = importsOf('api/dash0-task.mjs');
  for (const target of SERVER_ONLY) assert.ok(found.includes(target), `${target} is imported by the task function`);
});

test('the scan reads every import shape: static, multi-line, re-export, side-effect and dynamic', () => {
  const text = [
    "import { a } from '../lib/dash0-task/grade.mjs';",
    "import {\n  b,\n  c,\n} from '../lib/dash0-task/scenario.mjs';",
    "export * from '../lib/dash0-task/grade.mjs';",
    "import '../lib/dash0-task/scenario.mjs';",
    "const m = await import('../lib/dash0-task/grade.mjs');",
  ].join('\n');
  assert.deepEqual(importsIn(text, 'levels/x.mjs'), [
    'lib/dash0-task/grade.mjs',
    'lib/dash0-task/scenario.mjs',
    'lib/dash0-task/grade.mjs',
    'lib/dash0-task/scenario.mjs',
    'lib/dash0-task/grade.mjs',
  ]);
});
