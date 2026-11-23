// Level copy rules (docs/M1-DESIGN.md §1, §7): every level file names its spec in a
// `// Spec: <https URL>` line, level and card copy has no em dash, and every spec URL,
// in a level file or on a card, points at opentelemetry.io, www.w3.org, prometheus.io, perses.dev, developer.mozilla.org or www.dash0.com (the last for Dash0 product claims).
// The Spec scan is repo-wide and reads every form of the line (#484): `// Spec:`, `//Spec:`,
// `// Spec (the answer pools):` and a `Spec:` later on a comment line. GitHub is never a Spec host;
// a Collector GitHub source sits on a Docs line pinned to the Collector version. The act tests keep
// only their act-specific source checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECK } from '../cards/deck.mjs';
import { liveRegistry } from '../app.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const LEVEL_FILES = readdirSync(join(ROOT, 'levels'))
  .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs')
  .sort();
const SPEC_HOSTS = ['opentelemetry.io', 'www.w3.org', 'prometheus.io', 'perses.dev', 'developer.mozilla.org', 'www.dash0.com'];

// The Collector version every Collector GitHub source is pinned to. No module exports it; the repo
// states it in test/act-5-exporter-types.test.mjs ("the one pinned version"), docs/M1-DESIGN.md §6
// and the level files' Docs lines.
const COLLECTOR_VERSION = 'v0.164.0';

/** A Spec marker in any form: `Spec:` or `Spec (anything):`, on a comment line. */
const SPEC_MARK = /\bSpec(?:\s*\([^)]*\))?:/;
const isComment = (line) => /^\s*(?:\/\/|\/\*|\*)/.test(line);
const urlsIn = (text) => (text.match(/https:\/\/[^\s,)]+/g) ?? []).map((u) => u.replace(/[.:;]+$/, ''));

/** The https URLs after the Spec marker on a file's comment lines (a line may list several, comma-separated). */
function specUrls(src) {
  return src.split('\n').filter(isComment).flatMap((line) => {
    const m = SPEC_MARK.exec(line);
    return m ? urlsIn(line.slice(m.index + m[0].length)) : [];
  });
}

const hostOf = (url) => new URL(url).host;

/** The Spec URLs on a host outside SPEC_HOSTS (GitHub included: it is a Docs source, never a Spec one). */
const specHostProblems = (src) => specUrls(src).filter((url) => !SPEC_HOSTS.includes(hostOf(url)));

const COLLECTOR_REPO = /^https:\/\/github\.com\/open-telemetry\/opentelemetry-collector(?:-contrib|-releases)?(?:[/#]|$)/;
const PINNED = new RegExp(`^https://github\\.com/open-telemetry/opentelemetry-collector(?:-contrib|-releases)?/(?:blob|tree)/${COLLECTOR_VERSION.replaceAll('.', '\\.')}(?:[/#]|$)`);

/** The Collector GitHub links in a file that are not pinned to COLLECTOR_VERSION (blob or tree, right after the repo). */
const unpinnedCollectorUrls = (src) => urlsIn(src).filter((url) => COLLECTOR_REPO.test(url) && !PINNED.test(url));

test('the level files are the registered levels (nothing scanned is unregistered)', () => {
  const ids = LEVEL_FILES.map((f) => f.replace(/\.mjs$/, '')).sort();
  assert.deepEqual(ids, [...liveRegistry().order].sort());
});

test('every level file has a Spec line, and every Spec line in any form cites only opentelemetry.io, www.w3.org, prometheus.io, perses.dev, developer.mozilla.org or www.dash0.com', () => {
  assert.ok(LEVEL_FILES.length > 30, `the scan found the level files (${LEVEL_FILES.length})`);
  for (const f of LEVEL_FILES) {
    const src = read(`levels/${f}`);
    assert.notEqual(specUrls(src).length, 0, `${f} has no Spec line with an https URL`);
    assert.deepEqual(specHostProblems(src), [], `${f}: Spec line URLs off the allowed hosts`);
  }
});

// Collector GitHub sources found unpinned when the repo-wide check landed (#484). Content, not this
// test, fixes them: each needs its page read at the pinned tag. Exact counts, so a new unpinned link
// fails, and a file whose links are pinned must come off this list.
const UNPINNED_KNOWN = {
  'agent-vs-gateway.mjs': 2,
  'cardinality.mjs': 2,
  'collecting-logs.mjs': 4,
  'distributions.mjs': 7,
  'errors-tripled.mjs': 3,
  'filter-or-sampler.mjs': 1,
  'frontend-rum.mjs': 1,
  'order-matters.mjs': 5,
  'otlp-endpoints.mjs': 6,
  'ottl-and-transforms.mjs': 6,
  'pipelines.mjs': 7,
  'red-and-use.mjs': 3,
  'silence.mjs': 6,
};

test(`every Collector GitHub source in a level file is pinned to ${COLLECTOR_VERSION} (the files listed in UNPINNED_KNOWN excepted, exactly)`, () => {
  const found = {};
  const detail = [];
  for (const f of LEVEL_FILES) {
    const urls = unpinnedCollectorUrls(read(`levels/${f}`));
    if (urls.length === 0) continue;
    found[f] = urls.length;
    detail.push(`${f}: ${urls.join(' ')}`);
  }
  assert.deepEqual(found, UNPINNED_KNOWN, `unpinned Collector GitHub links:\n${detail.join('\n')}`);
});

test('the Spec and pin scans have teeth: a parenthesised Spec line on a disallowed host fails, so do GitHub on a Spec line and an unpinned Collector link', () => {
  const fixture = [
    '// Spec: https://opentelemetry.io/docs/collector/',
    '// Spec (the answer pools): https://opentelemetry.io/docs/concepts/ , https://evil.example/otel/',
    '//Spec: https://no.example/',
    '//   an aside. Spec: https://www.w3.org/TR/trace-context/',
    ' * Spec (pinned README): https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/README.md',
    '// Docs (GitHub, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.164.0/processor/k8sattributesprocessor',
    '// (https://github.com/open-telemetry/opentelemetry-collector-releases/blob/v0.164.0/distributions/otelcol/manifest.yaml: a quote)',
    '// https://github.com/open-telemetry/opentelemetry-collector-contrib (v0.164.0) , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/v0.164.0/x.md',
    '// https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/README.md , https://github.com/open-telemetry/opentelemetry-collector-contribx/blob/main/y',
    "const s = 'Spec: https://evil.example/not-a-comment';",
  ].join('\n');
  assert.deepEqual(specUrls(fixture), [
    'https://opentelemetry.io/docs/collector/',
    'https://opentelemetry.io/docs/concepts/',
    'https://evil.example/otel/',
    'https://no.example/',
    'https://www.w3.org/TR/trace-context/',
    'https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/README.md',
  ]);
  assert.deepEqual(specHostProblems(fixture), [
    'https://evil.example/otel/',
    'https://no.example/',
    'https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/README.md',
  ]);
  assert.deepEqual(specHostProblems('// Spec (the answer pools): https://opentelemetry.io/x/ , https://evil.example/y'), ['https://evil.example/y']);
  assert.deepEqual(unpinnedCollectorUrls(fixture), [
    'https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/README.md',
    'https://github.com/open-telemetry/opentelemetry-collector-contrib',
    'https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/v0.164.0/x.md',
  ]);
});

/** Every content file (level text, primers) under content/, repo-relative (#391). */
const CONTENT_FILES = readdirSync(join(ROOT, 'content'), { recursive: true })
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => `content/${f}`)
  .sort();

test('no em dash in level files, content files or cards', () => {
  assert.ok(CONTENT_FILES.length >= 3, `the scan found the content files (${CONTENT_FILES.length})`);
  for (const f of [...LEVEL_FILES.map((x) => `levels/${x}`), ...CONTENT_FILES, 'cards/deck.mjs']) {
    const lines = read(f).split('\n');
    const hits = lines.map((l, i) => (l.includes('—') ? i + 1 : 0)).filter(Boolean);
    assert.deepEqual(hits, [], `${f}: em dash on lines`);
  }
});

test('every card specUrl is on opentelemetry.io, www.w3.org, prometheus.io, perses.dev, developer.mozilla.org or www.dash0.com', () => {
  for (const c of DECK) {
    assert.equal(SPEC_HOSTS.includes(hostOf(c.specUrl)), true, `${c.id}: ${c.specUrl}`);
  }
});

test('a Dash0 docs Spec line is accepted and lookalike hosts are not', () => {
  const src = '// Spec: https://www.dash0.com/docs/dash0/telemetry/logging/patterns\n';
  const [url] = specUrls(src);
  assert.equal(SPEC_HOSTS.includes(hostOf(url)), true);
  for (const bad of ['https://www.dash0.com.evil.example/', 'https://dash0.com.example/', 'https://evil.example/www.dash0.com/']) {
    assert.equal(SPEC_HOSTS.includes(hostOf(bad)), false, bad);
  }
});

test('the scanners have teeth: Spec line URLs and hosts', () => {
  const src = '// Spec: https://opentelemetry.io/a/#b , https://www.w3.org/TR/x/\n// Docs: https://no.example/\n// not a Spec host: https://no.example/\n';
  assert.deepEqual(specUrls(src), ['https://opentelemetry.io/a/#b', 'https://www.w3.org/TR/x/']);
  assert.deepEqual(specUrls('// Spec: docs/FOUNDATION.md §5'), []);
  assert.equal(SPEC_HOSTS.includes(hostOf('https://opentelemetry.io.evil.example/')), false);
  for (const ok of ['https://perses.dev/perses/docs/api/dashboard/', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS']) assert.equal(SPEC_HOSTS.includes(hostOf(ok)), true, ok);
  for (const bad of ['https://perses.dev.evil.example/', 'https://www.perses.dev/perses/docs/', 'https://perses.dev@evil.example/perses/docs/', 'https://evil.example/developer.mozilla.org/', 'https://mozilla.org/']) assert.equal(SPEC_HOSTS.includes(hostOf(bad)), false, bad);
});

// A penalty is not always a star (at 3+ penalties it may cost none), so player copy says
// "counts as one penalty", never "costs a star". Comment lines are not player copy.
const COST_A_STAR = /\bcosts? (?:a|one|1) star\b/i;
const codeLines = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l));
const COPY_FILES = [
  ...readdirSync(join(ROOT, 'lib/widgets')).filter((f) => f.endsWith('.mjs')).map((f) => `lib/widgets/${f}`),
  ...LEVEL_FILES.map((f) => `levels/${f}`),
  ...CONTENT_FILES,
];

test('no player-facing string in lib/widgets, levels or content says a penalty "costs a star"', () => {
  assert.ok(COPY_FILES.length > 20, 'the scan found the files');
  for (const rel of COPY_FILES) {
    const hit = codeLines(read(rel)).find((l) => COST_A_STAR.test(l));
    assert.equal(hit, undefined, `${rel}: say "counts as one penalty": ${hit?.trim()}`);
  }
});

test('the costs-a-star scanner has teeth: copy lines match, comment lines do not', () => {
  assert.ok(codeLines("x: 'A wrong pick costs a star.',").some((l) => COST_A_STAR.test(l)));
  assert.ok(codeLines("'Each cost one star'").some((l) => COST_A_STAR.test(l)));
  assert.ok(!codeLines('// a wrong pick costs a star').some((l) => COST_A_STAR.test(l)));
  assert.ok(!codeLines("'costs 1 penalty, no star yet'").some((l) => COST_A_STAR.test(l)));
});
