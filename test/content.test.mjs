// Level copy rules (docs/M1-DESIGN.md §1, §7): every level file names its spec in a
// `// Spec: <https URL>` line, level and card copy has no em dash, and every spec URL,
// in a level file or on a card, points at opentelemetry.io, www.w3.org, prometheus.io, perses.dev, developer.mozilla.org or www.dash0.com (the last for Dash0 product claims).
// The Spec scan is repo-wide over levels/*.mjs and reads every form of the line (#484): `// Spec:`,
// `//Spec:`, `// Specs:`, any case, `// Spec (the answer pools):`, a `Spec:` later in a comment, and a
// Spec line ending in a comma that wraps onto comment lines holding only URLs. GitHub is never a Spec
// host. Every Collector GitHub link (github.com, www.github.com or raw.githubusercontent.com, http or
// https) is pinned to the Collector version. Two things are left alone on purpose: GitHub links to
// other repos (re2, opentelemetry-js-contrib, the spec and proto repos) carry no Collector version,
// and the Docs label is not enforced, because pinned Collector links rightly sit on `// Source` and
// `// Collector contrib docs` lines and on quoted-fact lines too. cards/ and content/ are outside this
// scan (card specUrls are checked below); #498 covers them. The act tests keep only their act-specific
// source checks.
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

/** A Spec marker in any form: `Spec:`, `Specs:`, any case, or `Spec (anything):`. */
const SPEC_MARK = /\bSpecs?(?:\s*\([^)]*\))?:/i;
const urlsIn = (text) => (text.match(/https?:\/\/[^\s,)]+/gi) ?? []).map((u) => u.replace(/[.:;]+$/, ''));

/** A line's comment text: a block-comment line whole, else everything from its first `//`; null if it has none. */
function commentOf(line) {
  if (/^\s*(?:\/\*|\*)/.test(line)) return line;
  const at = line.indexOf('//');
  return at === -1 ? null : line.slice(at);
}

/** A wrapped Spec line's continuation: a comment holding only URLs and commas. */
const isUrlsOnly = (comment) => comment !== null && /^[\s,]*$/.test(comment.replace(/^\s*(?:\/\/|\/\*|\*)/, '').replace(/https?:\/\/[^\s,]+/gi, '')) && urlsIn(comment).length > 0;

/** The URLs after the Spec marker on a file's comment lines (several per line, comma-separated; a line ending in a comma continues on URL-only comment lines). */
function specUrls(src) {
  const lines = src.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const comment = commentOf(lines[i]);
    const m = comment === null ? null : SPEC_MARK.exec(comment);
    if (!m) continue;
    let rest = comment.slice(m.index + m[0].length);
    out.push(...urlsIn(rest));
    while (rest.trim().endsWith(',') && i + 1 < lines.length && isUrlsOnly(commentOf(lines[i + 1]))) {
      rest = commentOf(lines[++i]);
      out.push(...urlsIn(rest));
    }
  }
  return out;
}

const hostOf = (url) => new URL(url).host;

/** The Spec URLs on a host outside SPEC_HOSTS (GitHub included: it is a Docs source, never a Spec one). */
const specHostProblems = (src) => specUrls(src).filter((url) => !SPEC_HOSTS.includes(hostOf(url)));

const REPO = 'open-telemetry/opentelemetry-collector(?:-contrib|-releases)?';
const V = COLLECTOR_VERSION.replaceAll('.', '\\.');
const COLLECTOR_REPO = new RegExp(`^https?://(?:(?:www\\.)?github\\.com|raw\\.githubusercontent\\.com)/${REPO}(?:[/#]|$)`);
const PINNED = new RegExp(`^https?://(?:(?:www\\.)?github\\.com/${REPO}/(?:blob|tree|raw)|raw\\.githubusercontent\\.com/${REPO})/${V}(?:[/#?]|$)`);

/** The Collector GitHub links in a file (matched lowercased) that are not pinned to COLLECTOR_VERSION right after the repo. */
const unpinnedCollectorUrls = (src) =>
  urlsIn(src).filter((url) => COLLECTOR_REPO.test(url.toLowerCase()) && !PINNED.test(url.toLowerCase()));

/** Any other open-telemetry GitHub link (specification, proto, js-contrib, ...) whose ref is a moving branch: the page can change under the claim (#505). */
const OTEL_GITHUB = /^https?:\/\/(?:(?:www\.)?github\.com\/open-telemetry\/[^/]+\/(?:blob|tree|raw)|raw\.githubusercontent\.com\/open-telemetry\/[^/]+)\/(?:main|master|head|refs\/heads\/[^/#?]+)(?:[/#?]|$)/;
const branchLinkedOtelUrls = (src) => urlsIn(src).filter((url) => OTEL_GITHUB.test(url.toLowerCase()));

/** Every file whose copy cites sources: the level files, the card deck and the act primers. */
const SOURCE_FILES = [
  ...LEVEL_FILES.map((f) => `levels/${f}`),
  'cards/deck.mjs',
  ...readdirSync(join(ROOT, 'content/core/primers')).filter((f) => f.endsWith('.mjs')).sort().map((f) => `content/core/primers/${f}`),
];

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

test(`every Collector GitHub source in a level file is pinned to ${COLLECTOR_VERSION}`, () => {
  const found = {};
  for (const f of LEVEL_FILES) {
    const urls = unpinnedCollectorUrls(read(`levels/${f}`));
    if (urls.length > 0) found[f] = urls;
  }
  assert.deepEqual(found, {}, 'unpinned Collector GitHub links');
});

test(`every Collector GitHub source in a card or primer is pinned to ${COLLECTOR_VERSION}, and no open-telemetry GitHub link in any level, card or primer points at a moving branch`, () => {
  assert.ok(SOURCE_FILES.length > 40, `the scan found the source files (${SOURCE_FILES.length})`);
  assert.ok(SOURCE_FILES.includes('cards/deck.mjs') && SOURCE_FILES.some((f) => f.startsWith('content/core/primers/')));
  const found = {};
  for (const f of SOURCE_FILES) {
    const urls = [...unpinnedCollectorUrls(read(f)), ...branchLinkedOtelUrls(read(f))];
    if (urls.length > 0) found[f] = [...new Set(urls)];
  }
  assert.deepEqual(found, {}, 'unpinned open-telemetry GitHub links');
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
    '// Spec: https://opentelemetry.io/docs/concepts/sampling/ , https://opentelemetry.io/docs/collector/transforming-telemetry/ ,',
    '// https://evil.example/wrapped/',
    '// Spec: https://opentelemetry.io/docs/specs/',
    '// https://not-read.example/no-trailing-comma/',
    '// Spec: https://opentelemetry.io/docs/a/ ,',
    '// see https://not-read.example/prose-continuation/',
    '// SPECS: http://evil.example/upper-http/',
    'run(); // Spec: https://evil.example/trailing-comment/',
    '// Docs: HTTP://WWW.GitHub.com/open-telemetry/opentelemetry-collector/blob/main/a.md , http://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/b.md',
    '// Docs: https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector-contrib/v0.164.0/c.md , https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector-contrib/main/d.md',
    '// Docs: https://www.github.com/open-telemetry/opentelemetry-collector-releases/tree/v0.164.0/e , https://www.github.com/open-telemetry/opentelemetry-collector-releases/blob/main/f',
    '// Docs: https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0?plain=1 , https://github.com/open-telemetry/opentelemetry-collector/raw/v0.164.0/g.md',
    '// Docs: https://github.com/open-telemetry/opentelemetry-collector/blob/main?plain=1 , https://github.com/open-telemetry/opentelemetry-collector-contrib/raw/main/h.md',
  ].join('\n');
  assert.deepEqual(specUrls(fixture), [
    'https://opentelemetry.io/docs/collector/',
    'https://opentelemetry.io/docs/concepts/',
    'https://evil.example/otel/',
    'https://no.example/',
    'https://www.w3.org/TR/trace-context/',
    'https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/README.md',
    'https://opentelemetry.io/docs/concepts/sampling/',
    'https://opentelemetry.io/docs/collector/transforming-telemetry/',
    'https://evil.example/wrapped/',
    'https://opentelemetry.io/docs/specs/',
    'https://opentelemetry.io/docs/a/',
    'http://evil.example/upper-http/',
    'https://evil.example/trailing-comment/',
  ]);
  assert.deepEqual(specHostProblems(fixture), [
    'https://evil.example/otel/',
    'https://no.example/',
    'https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/README.md',
    'https://evil.example/wrapped/',
    'http://evil.example/upper-http/',
    'https://evil.example/trailing-comment/',
  ]);
  assert.deepEqual(specHostProblems('// Spec (the answer pools): https://opentelemetry.io/x/ , https://evil.example/y'), ['https://evil.example/y']);
  assert.deepEqual(specHostProblems('// Spec: https://opentelemetry.io/x/ ,\n// https://evil.example/second-line'), ['https://evil.example/second-line']);
  // The live wrapped form: filter-or-sampler's Spec line wraps its third URL onto the next line.
  assert.equal(specUrls(read('levels/filter-or-sampler.mjs')).includes('https://opentelemetry.io/docs/specs/semconv/resource/deployment-environment/'), true);
  assert.deepEqual(unpinnedCollectorUrls(fixture), [
    'https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/README.md',
    'https://github.com/open-telemetry/opentelemetry-collector-contrib',
    'https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/v0.164.0/x.md',
    'HTTP://WWW.GitHub.com/open-telemetry/opentelemetry-collector/blob/main/a.md',
    'https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector-contrib/main/d.md',
    'https://www.github.com/open-telemetry/opentelemetry-collector-releases/blob/main/f',
    'https://github.com/open-telemetry/opentelemetry-collector/blob/main?plain=1',
    'https://github.com/open-telemetry/opentelemetry-collector-contrib/raw/main/h.md',
  ]);
});

test('the branch-link scan flags main, master and HEAD on any open-telemetry repo and passes a tag', () => {
  const fixture = [
    '// https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/protocol/exporter.md',
    '// https://github.com/open-telemetry/opentelemetry-proto/tree/v1.11.1/docs',
    '// https://github.com/open-telemetry/opentelemetry-js-contrib/blob/instrumentation-undici-v0.35.1/packages/instrumentation-undici/README.md',
    '// https://raw.githubusercontent.com/open-telemetry/opentelemetry-js-contrib/Master/README.md',
    '// https://github.com/open-telemetry/opentelemetry-proto/blob/HEAD/README.md',
    '// https://github.com/other-org/repo/blob/main/README.md',
    '// https://github.com/open-telemetry/opentelemetry-specification/blob/main?plain=1',
    '// https://github.com/open-telemetry/opentelemetry-proto/raw/main/README.md',
    '// https://github.com/open-telemetry/opentelemetry-specification/blob/refs/heads/main/README.md',
    '// https://github.com/open-telemetry/opentelemetry-proto/blob/v1.11.1/README.md?plain=1 , https://github.com/open-telemetry/opentelemetry-proto/raw/v1.11.1/README.md',
    '// https://github.com/open-telemetry/opentelemetry-proto/blob/refs/tags/v1.11.1/README.md , https://github.com/open-telemetry/opentelemetry-proto/blob/mainline-v1/README.md',
    '// https://github.com/other-org/repo/raw/main/README.md , https://github.com/other-org/repo/blob/refs/heads/main/README.md , https://github.com/other-org/repo/blob/main?plain=1',
  ].join('\n');
  assert.deepEqual(branchLinkedOtelUrls(fixture), [
    'https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/protocol/exporter.md',
    'https://raw.githubusercontent.com/open-telemetry/opentelemetry-js-contrib/Master/README.md',
    'https://github.com/open-telemetry/opentelemetry-proto/blob/HEAD/README.md',
    'https://github.com/open-telemetry/opentelemetry-specification/blob/main?plain=1',
    'https://github.com/open-telemetry/opentelemetry-proto/raw/main/README.md',
    'https://github.com/open-telemetry/opentelemetry-specification/blob/refs/heads/main/README.md',
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
