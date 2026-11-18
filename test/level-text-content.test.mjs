// A converted level keeps its words in content/core/levels/<id>.mjs and its answers in levels/<id>.mjs
// (#391, docs/CONTENT.md): the file set, the wrapper, the wiring, and that the content really drives the level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { liveRegistry } from '../app.mjs';
import { bindText } from '../lib/content/bind.mjs';
import { createLevelContext } from '../lib/level-context.mjs';
import { validatePlay } from '../lib/play.mjs';
import { contentFileText, extractLevelText } from '../tools/extract-level-text.mjs';
import { literalSites } from '../tools/js-strings.mjs';
import { readJsonModule } from './helpers/content-files.mjs';
import { makeDom } from './helpers/dom.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'content', 'core', 'levels');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.mjs')).sort();
const IDS = FILES.map((f) => f.replace(/\.mjs$/, ''));
const load = (id) => import(pathToFileURL(join(ROOT, 'levels', `${id}.mjs`)).href);
/** A content file's object (parsed as strict JSON, so no import is needed). */
const CORE_OF = (id) => readJsonModule(join(DIR, `${id}.mjs`)).value;
// A content file has `play` (a play level) or `run` (a run(ctx) level, docs/CONTENT.md section 11), never both.
const RUN_IDS = IDS.filter((id) => CORE_OF(id).run !== undefined);
const PLAY_IDS = IDS.filter((id) => CORE_OF(id).play !== undefined);
/** Literals a run level keeps on purpose because they are fixture data (docs/CONTENT.md 11.1): level id -> the literal's text. */
const RUN_FIXTURES = {};
const readLogic = (id) => readFileSync(join(ROOT, 'levels', `${id}.mjs`), 'utf8');

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

test('every content file is for a play level or a run level, never both, and baggage is a run level', () => {
  assert.ok(RUN_IDS.includes('baggage'), `run levels: ${RUN_IDS.join(', ')}`);
  assert.deepEqual([...PLAY_IDS, ...RUN_IDS].sort(), IDS, 'every content file has play or run');
  assert.deepEqual(PLAY_IDS.filter((id) => RUN_IDS.includes(id)), [], 'no content file has both');
  const reg = liveRegistry();
  for (const id of IDS) {
    const isPlay = Boolean(reg.levels[id]?.play);
    assert.equal(CORE_OF(id).play !== undefined, isPlay, `${id}: a content file has play exactly when the level is a play level`);
    assert.equal(CORE_OF(id).run !== undefined, !isPlay, `${id}: a content file has run exactly when the level is a run level`);
  }
});

test('each content file is named after its level id, a registered level, and its own id says so', () => {
  const reg = liveRegistry();
  for (const id of IDS) {
    assert.ok(reg.levels[id], `${id} is a registered level`);
    // A play level exactly when its content has `play`; a run level has a run function.
    assert.equal(Boolean(reg.levels[id].play), CORE_OF(id).play !== undefined, `${id}: play level exactly when its content has play`);
    if (RUN_IDS.includes(id)) assert.equal(typeof reg.levels[id].run, 'function', `${id} is a run level`);
    assert.equal(CORE_OF(id).id, id);
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
  for (const id of PLAY_IDS) {
    const mod = await load(id);
    const core = (await import(pathToFileURL(join(DIR, `${id}.mjs`)).href)).default;
    assert.deepEqual(mod.default, mod.withText(core), id);
    assert.deepEqual(validatePlay(mod.default.play).errors, [], id);
  }
});

test('each converted run level is withText of its content file: the same level, with a run function and no play', async () => {
  for (const id of RUN_IDS) {
    const mod = await load(id);
    const core = (await import(pathToFileURL(join(DIR, `${id}.mjs`)).href)).default;
    const { run: defaultRun, ...defaultRest } = mod.default;
    const built = mod.withText(core);
    const { run: builtRun, ...builtRest } = built;
    assert.deepEqual(defaultRest, builtRest, id);
    assert.equal(typeof defaultRun, 'function', id);
    assert.equal(typeof builtRun, 'function', id);
    assert.equal(mod.default.play, undefined, id);
    assert.equal(built.play, undefined, id);
  }
});

/** `value` with `EDITED ` in front of every string that is not an id or a key. */
const editRun = (value, key) => {
  if (Array.isArray(value)) return value.map((x) => editRun(x, key));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, editRun(v, k)]));
  return typeof value === 'string' && key !== 'id' && key !== 'key' ? `EDITED ${value}` : value;
};
const firstPage = (level) => {
  const dom = makeDom();
  const ctx = createLevelContext({
    level,
    ovBody: dom.body,
    ovActions: dom.actions,
    now: () => Date.UTC(2026, 0, 1),
    shuffle: (a) => a,
    reduceMotion: true,
    onFinish: () => {},
    signal: new AbortController().signal,
    reportError: (e) => {
      throw e;
    },
    telemetry: null,
  });
  level.run(ctx);
  return `${dom.body.innerHTML}${dom.actions.innerHTML}`;
};

test('editing a run level\'s words shows on its first screen, and withText leaves its input as it was given', async () => {
  for (const id of RUN_IDS) {
    const mod = await load(id);
    const core = CORE_OF(id);
    assert.ok(!firstPage(mod.withText(core)).includes('EDITED'), `${id}: the content file itself has no EDITED`);
    const edited = { ...core, name: `EDITED ${core.name}`, run: editRun(core.run) };
    const given = structuredClone(edited);
    const level = mod.withText(edited);
    assert.ok(firstPage(level).includes('EDITED'), `${id}: an edited word shows on the first screen`);
    assert.equal(level.name, `EDITED ${core.name}`, `${id}: the edited name shows`);
    assert.deepEqual(edited, given, `${id}: withText left its input as it was given`);
  }
});

test('a run level\'s code holds no prose literal: its words are say.<name> reads (docs/CONTENT.md 11.1)', () => {
  const PROSE = [/[A-Za-z]\s+[A-Za-z]/, /^[A-Z][a-z]+[.:?!]?$/];
  for (const id of RUN_IDS) {
    const kept = new Set(RUN_FIXTURES[id] ?? []);
    const sites = literalSites(readLogic(id)).map((s) => s.pieces.join(' ').replace(/<[^>]*>/g, ' ').trim());
    const prose = sites.filter((t) => PROSE.some((re) => re.test(t)) && !kept.has(t));
    assert.deepEqual(prose, [], `${id}: these literals move to content/core/levels/${id}.mjs, or are fixture data (RUN_FIXTURES)`);
    for (const t of kept) assert.ok(sites.includes(t), `${id}: RUN_FIXTURES entry "${t}" is no longer in the file`);
  }
});

test('a run level reads exactly the names its content defines, as say.<name>', () => {
  for (const id of RUN_IDS) {
    const code = readLogic(id).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const read = new Set([...code.matchAll(/\bsay\.([a-z][a-zA-Z0-9]*)\b/g)].map((m) => m[1]));
    assert.deepEqual([...read].sort(), Object.keys(CORE_OF(id).run).sort(), id);
  }
});

// New text for a field, keeping the field's fill-ins: a {{name}} used only there must stay used.
const FILL_IN = /\{\{[a-z][a-z0-9-]*\}\}/g;
const editText = (text, original) => [text, ...(original.match(FILL_IN) ?? [])].join(' ');
// The built field starts with the edited words and has every fill-in filled; with none in the original, it is exactly the words.
const assertEdited = (built, text, original, at) => {
  assert.ok(built.startsWith(text), `${at}: ${built}`);
  assert.ok(!built.includes('{{'), `${at}: a fill-in left unfilled: ${built}`);
  if (original.match(FILL_IN) === null) assert.equal(built, text, at);
};

test('changing the content changes the level, and withText does not touch what it is given', async () => {
  for (const id of PLAY_IDS) {
    const mod = await load(id);
    const core = (await import(pathToFileURL(join(DIR, `${id}.mjs`)).href)).default;
    const edited = structuredClone(core);
    edited.name = editText('An edited name', core.name);
    edited.play.finish = editText('An edited finish text for this level.', core.play.finish);
    edited.play.steps[0].intro = editText('An edited intro for the first step.', core.play.steps[0].intro);
    const given = structuredClone(edited);
    const level = mod.withText(edited);
    assertEdited(level.name, 'An edited name', core.name, `${id} name`);
    assertEdited(level.play.finish, 'An edited finish text for this level.', core.play.finish, `${id} finish`);
    assertEdited(level.play.steps[0].intro, 'An edited intro for the first step.', core.play.steps[0].intro, `${id} intro`);
    assert.equal(level.id, id);
    assert.deepEqual(edited, given, `${id}: withText left its input as it was given`);
    level.play.steps[0].intro = 'changed after the build';
    assert.equal(edited.play.steps[0].intro, given.play.steps[0].intro, `${id}: the level shares nothing with its input`);
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
  for (const id of PLAY_IDS) {
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
