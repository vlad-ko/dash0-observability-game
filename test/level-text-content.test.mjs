// A converted level keeps its words in content/core/levels/<id>.mjs and its answers in levels/<id>.mjs
// (#391, docs/CONTENT.md): the file set, the wrapper, the wiring, and that the content really drives the level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { liveRegistry } from '../app.mjs';
import { bindText } from '../lib/content/bind.mjs';
import { validatePlay } from '../lib/play.mjs';
import { contentFileText, extractLevelText } from '../tools/extract-level-text.mjs';
import { readJsonModule } from './helpers/content-files.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'content', 'core', 'levels');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.mjs')).sort();
const IDS = FILES.map((f) => f.replace(/\.mjs$/, ''));
const load = (id) => import(pathToFileURL(join(ROOT, 'levels', `${id}.mjs`)).href);

test('there are converted levels to check (the pilot has at least two)', () => {
  assert.ok(FILES.length >= 2, FILES.join(', '));
  assert.ok(IDS.includes('good-alerts') && IDS.includes('cardinality'));
});

test('each content file is a header, then one strict JSON object, with no repeated key', () => {
  for (const f of FILES) {
    const r = readJsonModule(join(DIR, f));
    assert.deepEqual(r.errors, [], f);
    assert.ok(r.comments.length >= 1 && r.comments.every((c) => !c.startsWith('// Spec:')), `${f}: header comments, none a Spec line`);
    assert.equal(typeof r.value, 'object', f);
  }
});

test('each content file is named after its level id, a registered play level, and its own id says so', () => {
  const reg = liveRegistry();
  for (const id of IDS) {
    assert.ok(reg.levels[id], `${id} is a registered level`);
    assert.ok(reg.levels[id].play, `${id} is a play level`);
    assert.equal(readJsonModule(join(DIR, `${id}.mjs`)).value.id, id);
  }
});

test('each converted level imports exactly its own content file and exports withText', async () => {
  for (const id of IDS) {
    const src = readFileSync(join(ROOT, 'levels', `${id}.mjs`), 'utf8');
    const imports = [...src.matchAll(/^import .* from '(\.\.\/content\/[^']+)';$/gm)].map((m) => m[1]);
    assert.deepEqual(imports, [`../content/core/levels/${id}.mjs`], id);
    assert.match(src, /^export default withText\(CORE\);$/m, id);
    const mod = await load(id);
    assert.equal(typeof mod.withText, 'function', id);
  }
});

test('each converted level is withText of its content file, and its play validates', async () => {
  for (const id of IDS) {
    const mod = await load(id);
    const core = (await import(pathToFileURL(join(DIR, `${id}.mjs`)).href)).default;
    assert.deepEqual(mod.default, mod.withText(core), id);
    assert.deepEqual(validatePlay(mod.default.play).errors, [], id);
  }
});

test('changing the content changes the level, and withText does not touch what it is given', async () => {
  for (const id of IDS) {
    const mod = await load(id);
    const core = (await import(pathToFileURL(join(DIR, `${id}.mjs`)).href)).default;
    const edited = structuredClone(core);
    edited.name = 'An edited name';
    edited.play.finish = 'An edited finish text for this level.';
    edited.play.steps[0].intro = 'An edited intro for the first step.';
    const given = structuredClone(edited);
    const level = mod.withText(edited);
    assert.equal(level.name, 'An edited name', id);
    assert.equal(level.play.finish, 'An edited finish text for this level.', id);
    assert.equal(level.play.steps[0].intro, 'An edited intro for the first step.', id);
    assert.equal(level.id, id);
    assert.deepEqual(edited, given, `${id}: withText left its input as it was given`);
    level.play.steps[0].intro = 'changed after the build';
    assert.equal(edited.play.steps[0].intro, 'An edited intro for the first step.', `${id}: the level shares nothing with its input`);
  }
});

test('the extract tool reproduces a converted level without fill-ins byte for byte', async () => {
  const mod = await load('good-alerts');
  assert.equal(contentFileText(mod.default), readFileSync(join(DIR, 'good-alerts.mjs'), 'utf8'));
});

test('the extracted text of every live play level binds with no errors (any live copy can move to a content file)', () => {
  const reg = liveRegistry();
  const played = reg.order.map((id) => reg.levels[id]).filter((l) => l.play);
  assert.ok(played.length >= 40, `the corpus is large (${played.length})`);
  for (const level of played) {
    const { errors } = bindText(extractLevelText(level), { id: level.id });
    assert.deepEqual(errors, [], level.id);
  }
});

const COPY_KEY = /^\s*'?(intro|question|show|label|why|whyNot|explain|hint|finish|name|sub|rewardTitle|text|html|title|unit|closing)'?\s*:/;

test('the logic file holds no copy: no text key on any code line', () => {
  for (const id of IDS) {
    const lines = readFileSync(join(ROOT, 'levels', `${id}.mjs`), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l));
    const hit = lines.find((l) => COPY_KEY.test(l));
    assert.equal(hit, undefined, `${id}: copy belongs in content/core/levels/${id}.mjs: ${hit?.trim()}`);
  }
});

test('a converted level refuses an answer flag in its content, naming the level and the key', async () => {
  const mod = await load('good-alerts');
  const core = (await import(pathToFileURL(join(DIR, 'good-alerts.mjs')).href)).default;
  const bad = structuredClone(core);
  bad.play.steps[1].choice.choices[2].right = true;
  assert.throws(() => mod.withText(bad), /good-alerts[\s\S]*choices\[2\]\.right: "right" is not a content key/);
});
