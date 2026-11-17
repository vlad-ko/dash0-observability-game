// The act primer contract (lib/primer.mjs, #389, docs/FOUNDATION.md §2.12): validation,
// the single status rule, the tile words and the screen view. Fixtures only; the shipped
// primers are checked in test/primers-content.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrimers, primerStatus, primerTile, primerView, validatePrimer, validatePrimers, LIMITS } from '../lib/primer.mjs';

const ACT_IDS = ['a0', 'a1'];
const otel = (label = 'OpenTelemetry docs') => ({ kind: 'otel', label, url: 'https://opentelemetry.io/docs/', audience: 'public' });
const chapter = (id, extra = {}) => ({
  id,
  title: `Chapter ${id}`,
  blocks: [{ type: 'paragraph', text: `About ${id}.` }],
  sources: [otel()],
  ...extra,
});
const P0 = () => ({
  act: 'a0',
  placeholder: false,
  title: 'Act zero',
  overview: [{ type: 'paragraph', text: 'The overview.' }],
  chapters: [
    chapter('c-one', {
      blocks: [
        { type: 'paragraph', text: 'First.' },
        { type: 'link', kind: 'docs', label: 'Team notes', url: 'https://www.dash0.com/docs/', audience: 'internal' },
        { type: 'link', kind: 'otel', label: 'Spec', url: 'https://opentelemetry.io/docs/', audience: 'public' },
      ],
    }),
    chapter('c-two'),
    chapter('c-three'),
  ],
});
const check = (p) => validatePrimer(p, { actIds: ACT_IDS });
const errorsOf = (p) => check(p).errors;
const mutate = (fn) => {
  const p = P0();
  fn(p);
  return p;
};

test('a valid primer passes with no errors', () => {
  assert.deepEqual(check(P0()), { ok: true, errors: [] });
});

const BAD = {
  'block type video-embed': [(p) => (p.chapters[0].blocks[0].type = 'video-embed'), 'chapters[0].blocks[0].type'],
  'empty title': [(p) => (p.title = ''), 'title'],
  'missing title': [(p) => delete p.title, 'title'],
  'http url': [(p) => (p.chapters[0].sources[0].url = 'http://opentelemetry.io/docs/'), '.url'],
  'url with credentials': [(p) => (p.chapters[0].sources[0].url = 'https://u:p@opentelemetry.io/'), '.url'],
  'unknown act': [(p) => (p.act = 'a9'), 'act'],
  'no chapters': [(p) => (p.chapters = []), 'chapters'],
  'no sources': [(p) => (p.chapters[1].sources = []), 'chapters[1].sources'],
  'placeholder without note': [(p) => (p.placeholder = true), 'placeholderNote'],
  'note on a final primer': [(p) => (p.placeholderNote = 'PLACEHOLDER: x'), 'placeholderNote'],
  'note not starting PLACEHOLDER': [
    (p) => {
      p.placeholder = true;
      p.placeholderNote = 'draft only';
    },
    'placeholderNote',
  ],
  'note with PLACEHOLDER not at the start': [
    (p) => {
      p.placeholder = true;
      p.placeholderNote = 'Draft, PLACEHOLDER until reviewed';
    },
    'placeholderNote',
  ],
  'username only in the url': [(p) => (p.chapters[0].sources[0].url = 'https://u@opentelemetry.io/'), '.url'],
  'lookalike host': [(p) => (p.chapters[0].sources[0].url = 'https://evilopentelemetry.io/docs/'), '.url'],
  'unknown key chapter': [(p) => (p.chapter = []), 'chapter'],
  'duplicate chapter id': [(p) => (p.chapters[1].id = 'c-one'), 'chapters[1].id'],
  'claap link marked public': [(p) => (p.chapters[0].sources[0] = { kind: 'claap', label: 'Call', url: 'https://app.claap.io/x', audience: 'public' }), '.audience'],
  'otel url on example.com': [(p) => (p.chapters[0].sources[0].url = 'https://example.com/docs/'), '.url'],
  'audience team': [(p) => (p.chapters[0].sources[0].audience = 'team'), '.audience'],
  'list of 11 items': [(p) => (p.overview = [{ type: 'list', items: Array.from({ length: 11 }, (_, i) => `item ${i}`) }]), '.items'],
  'em dash in a paragraph': [(p) => (p.overview = [{ type: 'paragraph', text: `a ${String.fromCharCode(0x2014)} b` }]), '.text'],
  'paragraph of 601 characters': [(p) => (p.overview = [{ type: 'paragraph', text: 'x'.repeat(601) }]), '.text'],
};
for (const [name, [fn, path]] of Object.entries(BAD)) {
  test(`invalid: ${name} names ${path}`, () => {
    const r = check(mutate(fn));
    assert.equal(r.ok, false);
    assert.ok(
      r.errors.some((e) => e.includes(path)),
      `${path} in ${JSON.stringify(r.errors)}`,
    );
  });
}

test('limits: a paragraph of exactly 600 characters, a list of 10 items and a claap link marked internal pass', () => {
  const p = mutate((x) => {
    x.overview = [
      { type: 'paragraph', text: 'x'.repeat(600) },
      { type: 'list', items: Array.from({ length: 10 }, (_, i) => `item ${i}`), ordered: true },
    ];
    x.chapters[0].sources[0] = { kind: 'claap', label: 'Call', url: 'https://app.claap.io/x', audience: 'internal' };
  });
  assert.deepEqual(errorsOf(p), []);
  assert.equal(LIMITS.paragraph, 600);
});

test('hosts: an uppercase host and a subdomain pass for their kind', () => {
  for (const url of ['https://OpenTelemetry.IO/docs/', 'https://www.opentelemetry.io/docs/']) {
    assert.deepEqual(errorsOf(mutate((p) => (p.chapters[0].sources[0].url = url))), [], url);
  }
});

test('array holes are errors naming their path, never a throw', () => {
  // A real hole (spread would fill it with undefined): the array is one longer than its last element.
  const holey = (...items) => {
    const a = [...items];
    a.length += 1;
    return a;
  };
  assert.equal(1 in holey('a'), false);
  const withHole = (fn, path) => {
    const r = check(mutate(fn));
    assert.equal(r.ok, false, path);
    assert.ok(r.errors.some((e) => e.includes(path)), `${path} in ${JSON.stringify(r.errors)}`);
  };
  withHole((p) => (p.chapters = holey(chapter('c-one'))), 'chapters[1]');
  withHole((p) => (p.chapters[0].blocks = holey({ type: 'paragraph', text: 'x' })), 'chapters[0].blocks[1]');
  withHole((p) => (p.chapters[0].sources = holey(otel())), 'chapters[0].sources[1]');
  withHole((p) => (p.overview = [{ type: 'list', items: holey('a') }]), 'overview[0].items[1]');
});

test('options and views never throw on a null options argument', () => {
  assert.equal(validatePrimer(P0(), null).ok, false, 'no act ids means the act is unknown');
  assert.equal(validatePrimers([P0()], null).ok, false);
  assert.equal(primerView(P0(), 2, null).next, 'Done');
});

test('block shapes: callout tone, code and list keys are checked', () => {
  const bad = (block, path) => {
    const e = errorsOf(mutate((p) => (p.overview = [block])));
    assert.ok(e.some((m) => m.includes(path)), `${path} in ${JSON.stringify(e)}`);
  };
  bad({ type: 'callout', tone: 'loud', text: 'x' }, 'overview[0].tone');
  bad({ type: 'callout', tone: 'note', text: '' }, 'overview[0].text');
  bad({ type: 'code', text: '' }, 'overview[0].text');
  bad({ type: 'code', text: 'x', wrap: 'yes' }, 'overview[0].wrap');
  bad({ type: 'list', items: ['a'], ordered: 1 }, 'overview[0].ordered');
  bad({ type: 'paragraph', text: ' padded ' }, 'overview[0].text');
  bad({ type: 'paragraph', text: 'x', extra: 1 }, 'overview[0].extra');
  assert.deepEqual(errorsOf(mutate((p) => (p.overview = [{ type: 'callout', tone: 'tip', text: 'x' }, { type: 'code', text: 'a\nb', wrap: true }]))), []);
});

test('every fault is reported at once, each naming its path', () => {
  const p = mutate((x) => {
    x.title = '';
    x.act = 'a9';
    x.chapters[0].sources[0].url = 'http://opentelemetry.io/';
  });
  assert.equal(errorsOf(p).length, 3);
});

test('null and a string are not primers and never throw', () => {
  for (const v of [null, 'x', 7, [], undefined]) assert.equal(check(v).ok, false);
});

test('validatePrimers: a duplicate act names the act', () => {
  const r = validatePrimers([P0(), P0()], { actIds: ACT_IDS });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('act') && e.includes('a0')));
  assert.equal(validatePrimers([P0()], { actIds: ACT_IDS }).ok, true);
  assert.equal(validatePrimers('x', { actIds: ACT_IDS }).ok, false);
});

test('buildPrimers: one primer per act, a deep-frozen copy that is not the input', () => {
  const input = P0();
  const twin = P0();
  const { byAct, errors } = buildPrimers([input, twin], { acts: [{ id: 'a0' }] });
  assert.deepEqual(Object.keys(byAct), ['a0']);
  assert.ok(errors.some((e) => e.includes('act') && e.includes('a0')), JSON.stringify(errors));
  assert.notEqual(byAct.a0, input);
  assert.ok(Object.isFrozen(byAct.a0.chapters[0].sources[0]));
  assert.ok(Object.isFrozen(byAct.a0.overview));
  input.title = 'changed later';
  assert.equal(byAct.a0.title, 'Act zero');
});

test('buildPrimers keeps the valid, drops the invalid, freezes byAct and reports', () => {
  const broken = { ...P0(), act: 'a1', title: '' };
  const { byAct, errors } = buildPrimers([P0(), broken], { acts: [{ id: 'a0' }, { id: 'a1' }] });
  assert.deepEqual(Object.keys(byAct), ['a0']);
  assert.ok(Object.isFrozen(byAct));
  assert.ok(errors.length >= 1);
});

const stored = (e) => e;
test('status: a repeated stored id counts once', () => {
  assert.deepEqual(primerStatus(P0(), stored({ seen: true, skipped: false, read: ['c-one', 'c-one'] })), { status: 'reading', read: 1, total: 3 });
});
test('status: no entry is new', () => {
  assert.deepEqual(primerStatus(P0(), undefined), { status: 'new', read: 0, total: 3 });
});
test('status: seen with nothing read is reading 0 of 3', () => {
  assert.deepEqual(primerStatus(P0(), stored({ seen: true, skipped: false, read: [] })), { status: 'reading', read: 0, total: 3 });
});
test('status: only current chapter ids count', () => {
  assert.deepEqual(primerStatus(P0(), stored({ seen: true, skipped: false, read: ['c-one', 'c-gone'] })), { status: 'reading', read: 1, total: 3 });
});
test('status: all but one chapter read is still reading', () => {
  assert.deepEqual(primerStatus(P0(), stored({ seen: true, skipped: false, read: ['c-one', 'c-three'] })), { status: 'reading', read: 2, total: 3 });
});
test('status: every chapter read is read', () => {
  assert.equal(primerStatus(P0(), stored({ seen: true, skipped: false, read: ['c-one', 'c-two', 'c-three'] })).status, 'read');
});
test('status: skipped with nothing read is skipped; with a chapter read it is reading', () => {
  assert.equal(primerStatus(P0(), stored({ seen: true, skipped: true, read: [] })).status, 'skipped');
  assert.deepEqual(primerStatus(P0(), stored({ seen: true, skipped: true, read: ['c-one'] })), { status: 'reading', read: 1, total: 3 });
});

test('tile: words, tones and the label', () => {
  const p = P0();
  const tile = (e) => primerTile(primerStatus(p, e));
  assert.deepEqual(tile(undefined), { text: 'New', tone: 'attention', isNew: true, label: 'Act primer: New' });
  assert.equal(tile({ seen: true, skipped: true, read: [] }).text, 'Skipped');
  assert.equal(tile({ seen: true, skipped: true, read: [] }).isNew, false);
  const one = tile({ seen: true, skipped: false, read: ['c-one'] });
  assert.equal(one.text, '1 of 3 chapters read');
  assert.equal(one.label, 'Act primer: 1 of 3 chapters read');
  assert.equal(one.isNew, false);
  assert.deepEqual(tile({ seen: true, skipped: false, read: ['c-one', 'c-two', 'c-three'] }), { text: 'Read', tone: 'success', isNew: false, label: 'Act primer: Read' });
});

test('tile: a one-chapter primer says "chapter", not "chapters"', () => {
  assert.equal(primerTile({ status: 'reading', read: 0, total: 1 }).text, '0 of 1 chapter read');
});

test('view: the overview is screen -1 with the two buttons', () => {
  const v = primerView(P0(), -1, {});
  assert.equal(v.screen, -1);
  assert.equal(v.title, 'Act zero');
  assert.deepEqual(v.buttons, ['familiar', 'proceed']);
  assert.deepEqual(v.blocks, [{ type: 'paragraph', text: 'The overview.' }]);
});

test('view: chapters carry position, next label and sources', () => {
  const p = P0();
  const first = primerView(p, 0, {});
  assert.equal(first.position, 'Chapter 1 of 3');
  assert.equal(first.next, 'Next');
  assert.equal(first.title, 'Chapter c-one');
  assert.equal(first.id, 'c-one');
  assert.equal(first.sources.length, 1);
  assert.equal(primerView(p, 1, { then: 'lv', thenName: 'Level' }).next, 'Next');
  assert.equal(primerView(p, 2, {}).next, 'Done');
  assert.equal(primerView(p, 2, { then: 'lv' }).next, 'Done', 'no level name, no "Start: undefined"');
  assert.equal(primerView(p, 2, { then: 'lv', thenName: 'Monitoring vs observability' }).next, 'Start: Monitoring vs observability');
});

test('view: out-of-range screens are null', () => {
  assert.equal(primerView(P0(), 3, {}), null);
  assert.equal(primerView(P0(), -2, {}), null);
});

test('view: a link is internal exactly when its audience is internal', () => {
  const v = primerView(P0(), 0, {});
  const links = v.blocks.filter((b) => b.type === 'link');
  assert.deepEqual(links.map((l) => l.internal), [true, false]);
  assert.equal(v.sources[0].internal, false);
  const claap = mutate((p) => (p.chapters[0].sources[0] = { kind: 'claap', label: 'Call', url: 'https://app.claap.io/x', audience: 'internal' }));
  assert.equal(primerView(claap, 0, {}).sources[0].internal, true);
});
