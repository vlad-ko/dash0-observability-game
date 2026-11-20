// The shared content text rules (lib/content/text-rules.mjs, #391).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveRegistry } from '../app.mjs';
import { HTML_KEYS, MAP_KEY } from '../lib/content/keys.mjs';
import { checkCode, checkHtml, checkPlain, isId } from '../lib/content/text-rules.mjs';
import { readGloss, unwrapGloss } from '../lib/content/terms.mjs';

const DASH = String.fromCharCode(0x2014);

test('checkPlain: clean text has no problems', () => {
  assert.deepEqual(checkPlain('A plain sentence, with a comma.'), []);
});

test('checkPlain: leading or trailing whitespace is a problem', () => {
  for (const s of [' x', 'x ', 'x\n']) assert.ok(checkPlain(s).some((p) => p.includes('whitespace')), JSON.stringify(s));
});

test('checkPlain: control characters, including newline and tab inside, are a problem', () => {
  for (const s of ['a\u0000b', 'a\u007fb', 'a\nb', 'a\tb']) assert.ok(checkPlain(s).some((p) => p.includes('control')), JSON.stringify(s));
});

test('checkPlain: an em dash is a problem, an en dash and a hyphen are not', () => {
  assert.ok(checkPlain(`a ${DASH} b`).some((p) => p.includes('em dash')));
  assert.deepEqual(checkPlain('a – b - c'), []);
});

test('checkPlain: a non-string is a problem and never throws', () => {
  for (const v of [undefined, null, 7, {}, []]) assert.deepEqual(checkPlain(v), ['must be a string']);
});

test('checkCode: newlines and tabs inside are allowed, other control characters and an em dash are not', () => {
  assert.deepEqual(checkCode('a\n\tb'), []);
  assert.ok(checkCode('a\u0000b').some((p) => p.includes('control')));
  assert.ok(checkCode(`a${DASH}b`).some((p) => p.includes('em dash')));
  assert.ok(checkCode(' a').some((p) => p.includes('whitespace')));
  assert.deepEqual(checkCode(3), ['must be a string']);
});

test('isId: kebab-case ids of at most 64 characters', () => {
  assert.equal(isId('act-0'), true);
  assert.equal(isId('a'.repeat(64)), true);
  for (const v of ['a'.repeat(65), 'Bad', 'a_b', '-a', 'a-', '', 7, null]) assert.equal(isId(v), false, String(v));
});

// ---- checkHtml: the trusted HTML fields (docs/CONTENT.md) ----

/** Every trusted HTML string of every live play level: `[where, text]`. */
function liveHtmlFields() {
  const out = [];
  const walk = (node, where, key) => {
    if (Array.isArray(node)) node.forEach((x, i) => walk(x, `${where}[${i}]`, key));
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (key === MAP_KEY && typeof v === 'string') out.push([`${where}.${k}`, v]);
        else walk(v, `${where}.${k}`, k);
      }
    } else if (typeof node === 'string' && HTML_KEYS.includes(key)) out.push([where, node]);
  };
  const reg = liveRegistry();
  for (const id of reg.order) if (reg.levels[id].play) walk(reg.levels[id].play, id, '');
  return out;
}

test('checkHtml: the shown text of every live HTML field of every play level passes', () => {
  const fields = liveHtmlFields();
  assert.ok(fields.length > 500, `the corpus is large (${fields.length})`);
  // A marked term is a gloss span (#442), which checkHtml refuses by design: judge the shown words, and hold the spans to intro and show.
  const bad = fields.map(([where, s]) => [where, checkHtml(unwrapGloss(s))]).filter(([, p]) => p.length);
  assert.deepEqual(bad, []);
  const strayed = fields.filter(([where, s]) => readGloss(s).length > 0 && !/\.(intro|show)$/.test(where)).map(([where]) => where);
  assert.deepEqual(strayed, []);
});

test('checkHtml: the allowed tags and attributes pass', () => {
  for (const s of [
    '<p>a</p><b>b</b><strong>c</strong><i>d</i><em>e</em><code>f</code><br><br/>',
    '<ul><li>a</li></ul><ol><li>b</li></ol>',
    '<table><caption>c</caption><thead><tr><th scope="col">h</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>',
    '<pre data-wrap><code data-token="t">x</code></pre>',
    '<PRE data-wrap="">x</PRE>',
  ]) assert.deepEqual(checkHtml(s), [], s);
});

test('checkHtml: a < that starts no tag and a bare & are text', () => {
  for (const s of ['p99 < 1s', 'Kettle & Co', 'a <3 b', '1 < 2 > 1', 'x &amp; y', '5 <= 6', 'a<1']) assert.deepEqual(checkHtml(s), [], s);
});

test('checkHtml: tags, attributes and shapes that could run script or restyle the page are rejected', () => {
  for (const s of [
    '<a href="https://x.example">x</a>',
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '<SCRIPT>x</SCRIPT>',
    '<style>p{}</style>',
    '<iframe src="x"></iframe>',
    '<svg onload=x>',
    '<p style="color:red">x</p>',
    '<p onclick="x">x</p>',
    '<p ONCLICK="x">x</p>',
    '<code class="a">x</code>',
    '<p id="a">x</p>',
    '<p x-data="{}">x</p>',
    '<p @click="x">x</p>',
    '<p :class="x">x</p>',
    '<th scope="col" onclick=1>x</th>',
    '<td scope="col">x</td>',
    '<pre data-token="x">x</pre>',
    '<p/onclick=x>',
    '<p onclick=x',
    '<p',
    '<!-- c -->',
    '<?php ?>',
    '</p class="x">',
    '</>',
    '<div>x</div>',
    '<b>ok</b><a>x</a>',
  ]) assert.ok(checkHtml(s).length > 0, s);
});

test('checkHtml: the plain rules apply, newlines excepted, and a non-string is a problem', () => {
  assert.ok(checkHtml(' x').some((p) => p.includes('whitespace')));
  assert.ok(checkHtml(`a${DASH}b`).some((p) => p.includes('em dash')));
  assert.ok(checkHtml('a\u0000b').some((p) => p.includes('control')));
  assert.deepEqual(checkHtml('<p>a</p>\n<p>b</p>'), []);
  for (const v of [undefined, null, 7, {}]) assert.deepEqual(checkHtml(v), ['must be a string']);
});
