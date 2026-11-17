// The strict-JSON content file reader (test/helpers/content-files.mjs, #391).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonModule } from './helpers/content-files.mjs';

const dir = mkdtempSync(join(tmpdir(), 'content-files-'));
const read = (name, text) => {
  const file = join(dir, name);
  writeFileSync(file, text);
  return readJsonModule(file);
};

test('a clean file parses, ignoring leading // lines', () => {
  const r = read('ok.mjs', '// note\n// another\nexport default {"a":1,"b":[{"c":2}]};\n');
  assert.deepEqual(r, { value: { a: 1, b: [{ c: 2 }] }, errors: [] });
});

test('a duplicate key is caught, at any depth', () => {
  assert.deepEqual(read('d1.mjs', 'export default {"a":1,"a":2};').errors, ['duplicate key "a"']);
  assert.deepEqual(read('d2.mjs', 'export default {"x":[{"k":1,"k":2}]};').errors, ['duplicate key "k"']);
});

test('the same key in different objects, or as a string value, is not a duplicate', () => {
  assert.deepEqual(read('s1.mjs', 'export default {"a":{"a":1},"b":[{"a":1},{"a":2}],"c":"a","d":"a"};').errors, []);
});

test('a trailing comma is not strict JSON', () => {
  const r = read('t.mjs', 'export default {"a":1,};');
  assert.equal(r.value, undefined);
  assert.match(r.errors[0], /not strict JSON/);
});

test('a missing or odd wrapper is reported', () => {
  assert.equal(read('w1.mjs', '{"a":1}').value, undefined);
  assert.equal(read('w2.mjs', 'export default {"a":1}').errors.length, 1);
});
