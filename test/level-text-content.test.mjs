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
import { codeOnly, literalSites } from '../tools/js-strings.mjs';
import { readJsonModule } from './helpers/content-files.mjs';
import { makeDom } from './helpers/dom.mjs';
import { checkWords, editRun, RUN_FIXTURES } from './helpers/run-edit.mjs';

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

test('every content file is for a play level or a run level, never both, and baggage and Act 0 are run levels', () => {
  for (const id of ['baggage', 'monitoring-vs-observability', 'the-pager', 'the-signals', 'why-opentelemetry']) assert.ok(RUN_IDS.includes(id), `${id} is a run level; run levels: ${RUN_IDS.join(', ')}`);
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

test('each converted play level is withText of its content file, and its play validates', async () => {
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

// A literal that may be a word a player sees: prose (letter, space, letter), one capitalised word, or anything with a
// letter in it that is not id-like (`bag-next`, `#bag-next`, `only-if-copied`). Tags are taken out first.
const PROSE = [/[A-Za-z]\s+[A-Za-z]/, /^[A-Z][a-z]+[.:?!]?$/];
// Id-like also covers a CSS selector made of those and attribute selectors (`[data-ask]`, `input[name=" "]`).
const ID_LIKE = /^(?:[#.]?[a-z0-9-]+)?(?:\[[a-z-]+(?:=(?:"[^"]*"|'[^']*'|[^\]]*))?\])*$/;
const textOf = (pieces, glue) => pieces.join(glue).replace(/<[^>]*>/g, ' ').trim();
// Prose is read with a space where a template had a `${}`; the id test with nothing there (`its-q-${n}-feedback`).
const looksVisible = (s) => PROSE.some((re) => re.test(textOf(s.pieces, ' '))) || (/[A-Za-z]/.test(textOf(s.pieces, '')) && !ID_LIKE.test(textOf(s.pieces, '')));
/** The literals of `src` that look like visible words and are not in `kept`, as text. */
const proseLiterals = (src, kept = []) =>
  literalSites(src)
    .filter((s) => looksVisible(s) && !kept.includes(textOf(s.pieces, ' ')))
    .map((s) => textOf(s.pieces, ' '));

test('a run level\'s code holds no prose literal: its words are say.<name> reads (docs/CONTENT.md 11.1)', () => {
  for (const id of RUN_IDS) {
    const kept = RUN_FIXTURES[id] ?? [];
    assert.deepEqual(proseLiterals(readLogic(id), kept), [], `${id}: these literals move to content/core/levels/${id}.mjs, or are fixture data (RUN_FIXTURES)`);
    const texts = literalSites(readLogic(id)).map((s) => s.pieces.join(' ').replace(/<[^>]*>/g, ' ').trim());
    for (const t of kept) assert.ok(texts.includes(t), `${id}: RUN_FIXTURES entry "${t}" is no longer in the file`);
  }
});

test('the prose check flags a visible literal that has no letter-space-letter: markup-only words, numbers with a unit, an arrow', () => {
  const src = "const a = ['<code>tenant.tier</code>', 'Sort 5 items.', 'Next \\u2192', 'Baggage', 'bag-next', '#bag-next', 'ok', '2.5'];";
  assert.deepEqual(proseLiterals(src), ['tenant.tier', 'Sort 5 items.', 'Next →', 'Baggage']);
  assert.deepEqual(proseLiterals(src, ['tenant.tier']), ['Sort 5 items.', 'Next →', 'Baggage'], 'a kept fixture is not flagged');
});

test('the prose check lets CSS attribute selectors and template ids through', () => {
  const src = "const a = ['[data-ask]', 'input[name=\" \"]', `its-q-${n}-feedback`, 'button[data-pick]'];";
  assert.deepEqual(proseLiterals(src), []);
});

// The screens below are built from `editRun(run)`, whatever mark it puts on an entry, so these tests hold for it.
const CLEAN = { leaked: [], unseen: [], stale: [] };

test('checkWords: a word shown without its edit, a word never shown edited, and a stale unreached entry are each reported', () => {
  const run = { a: 'A long enough sentence.', b: 'Dash0', c: { id: 'x', label: 'Another long sentence.' }, d: 'Never reached here.' };
  const e = editRun(run);
  const shown = [e.a, `${e.b} and ${e.c.label}`];
  assert.deepEqual(checkWords(run, shown, { unreached: ['run.d'] }), CLEAN);
  assert.deepEqual(checkWords(run, [...shown, 'A long enough sentence.'], { unreached: ['run.d'] }).leaked, ['A long enough sentence.'], 'a long word without the edit');
  assert.deepEqual(checkWords(run, [...shown, '<p>Dash0</p>'], { unreached: ['run.d'] }).leaked, ['Dash0'], 'a short word without the edit');
  assert.deepEqual(checkWords(run, [...shown, '<p>Dash0</p>'], { unreached: ['run.d'], kept: ['Dash0'] }).leaked, [], 'a fixture is skipped');
  assert.deepEqual(checkWords(run, [...shown, 'Dash01'], { unreached: ['run.d'] }).leaked, [], 'a short word is matched as a whole word');
  assert.deepEqual(checkWords(run, shown.slice(0, 1), { unreached: ['run.d'] }).unseen, ['run.b', 'run.c.label'], 'words never shown edited, by path');
  assert.deepEqual(checkWords(run, [...shown, e.d], { unreached: ['run.d'] }).stale, ['run.d'], 'an entry listed as unreached that is shown');
  assert.deepEqual(checkWords(run, shown, { unreached: ['run.d', 'run.zzz'] }).stale, ['run.zzz'], 'an unreached path that is no entry');
});

test('checkWords: a <wbr> inside a word is ignored', () => {
  const run = { l: '<code>experiment.variant=redesign-B</code>' };
  assert.deepEqual(checkWords(run, [editRun(run).l.replace('experiment.', 'experiment.<wbr>')]), CLEAN);
});

test('checkWords: an entry that is the start of another is not seen because the other is', () => {
  const run = { a: 'Check', b: 'Check the span.' };
  const e = editRun(run);
  assert.deepEqual(checkWords(run, [e.b]).unseen, ['run.a'], 'only the longer one is shown');
  assert.deepEqual(checkWords(run, [e.b, e.a]), CLEAN, 'both are shown');
});

test('checkWords: two entries with the same words are told apart, each must show edited', () => {
  const run = { a: 'Same sentence here.', b: 'Same sentence here.' };
  const e = editRun(run);
  assert.deepEqual(checkWords(run, [e.a]).unseen, ['run.b'], 'only one of the two is shown');
  assert.deepEqual(checkWords(run, [e.a, e.b]), CLEAN, 'both are shown');
});

test('checkWords: an entry with fill-ins is seen when shown edited with its values in, and leaks when shown unedited', () => {
  const run = { chip: '{{label}} {{step-pct}} percent', other: 'Another long sentence.' };
  const e = editRun(run);
  const chip = (mark) => `<span>${mark}Which service? 25 percent</span>`;
  assert.deepEqual(checkWords(run, [chip('EDITED0 '), e.other]), CLEAN, 'shown edited, values filled in');
  assert.deepEqual(checkWords(run, [e.other]).unseen, ['run.chip'], 'never shown');
  assert.deepEqual(checkWords(run, [chip(''), e.other]).leaked, [run.chip], 'shown without its edit');
  assert.deepEqual(checkWords(run, [chip(''), e.other], { unreached: ['run.chip'] }).stale, [], 'an unreached entry that is not shown edited is not stale');
  assert.deepEqual(checkWords(run, [chip('EDITED0 '), e.other], { unreached: ['run.chip'] }).stale, ['run.chip'], 'an unreached entry that is shown edited is stale');
});

test('checkWords: a fill-in value that holds an inline tag is matched too, marked and unmarked', () => {
  const run = { set: 'Set {{attr}} on the root span.' };
  const e = editRun(run);
  const shown = (mark) => `<p>${mark}Set <code>x</code> on the root span.</p>`;
  assert.deepEqual(checkWords(run, [shown('EDITED0 ')]), CLEAN, 'shown edited, the tag in the value');
  assert.deepEqual(checkWords(run, [shown('EDITED0 '), shown('')]).leaked, [run.set], 'a second copy without its edit leaks');
  assert.deepEqual(checkWords(run, [shown('')]).leaked, [run.set], 'shown only without its edit');
  const withAttr = (mark) => `<p>${mark}Set <code data-token="x">x</code> on the root span.</p>`;
  assert.deepEqual(checkWords(run, [withAttr('EDITED0 ')]), CLEAN, 'shown edited, a tag with an attribute in the value');
  assert.deepEqual(checkWords(run, [withAttr('EDITED0 '), withAttr('')]).leaked, [run.set], 'a second copy without its edit leaks, the tag having an attribute');
  assert.equal(e.set, 'EDITED0 Set {{attr}} on the root span.');
});

test('checkWords: a fixture inside a longer word does not hide that word leaking', () => {
  const long = 'Set tenant.tier on the root span';
  const e = editRun({ a: long });
  assert.deepEqual(checkWords({ a: long }, [long], { kept: ['tenant.tier'] }).leaked, [long], 'the long word shown without its edit');
  assert.deepEqual(checkWords({ a: long }, [e.a, 'tenant.tier'], { kept: ['tenant.tier'] }).leaked, [], 'the fixture shown on its own is fine');
});

test('editRun marks every entry of run with its own number, in the order checkWords reads them, and leaves ids and keys', () => {
  assert.deepEqual(editRun({ a: 'x', b: { id: 'i', l: 'y' }, c: [{ key: 'k', t: 'z' }, 'w'] }), { a: 'EDITED0 x', b: { id: 'i', l: 'EDITED1 y' }, c: [{ key: 'k', t: 'EDITED2 z' }, 'EDITED3 w'] });
});

test('a run level reads exactly the names its content defines, as say.<name>, in code only', () => {
  for (const id of RUN_IDS) {
    const read = new Set([...codeOnly(readLogic(id)).matchAll(/\bsay\.([a-z][a-zA-Z0-9]*)\b/g)].map((m) => m[1]));
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
