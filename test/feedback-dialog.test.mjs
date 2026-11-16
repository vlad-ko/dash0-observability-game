// Level feedback, the browser half (#370; docs/FOUNDATION.md §2.11): the client that talks to /api/feedback, the kit
// textarea field, the Feedback button and dialog in the level overlay, and how createGame wires them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { click, makeDom, q, qa } from './helpers/dom.mjs';
import { fakeStorage } from './helpers/fake-storage.mjs';
import { createGame } from '../app.mjs';
import { buildRegistry } from '../lib/registry.mjs';
import { createFeedbackClient, outcomeOf } from '../lib/feedback-client.mjs';
import { KINDS, MAX_TEXT } from '../lib/feedback.mjs';
import { field } from '../lib/ui/index.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));
const settle = async () => { for (let i = 0; i < 6; i++) await tick(); };
const res = (status, body) => ({ status, ok: status < 300, json: async () => body });

// ---- the client (A14) ------------------------------------------------------------------------

test('outcomeOf maps every status the endpoint can answer to one outcome the dialog words', () => {
  assert.deepEqual(outcomeOf(201, { v: 1, ok: true, issue: 42 }), { kind: 'sent', issue: 42 });
  assert.deepEqual(outcomeOf(201, { v: 1, ok: true }), { kind: 'failed' }, 'a 201 with no issue number is not a send');
  assert.deepEqual(outcomeOf(201, { v: 1, ok: true, issue: 0 }), { kind: 'failed' });
  assert.deepEqual(outcomeOf(429, { retryAfterS: 600 }), { kind: 'rate-limited', retryAfterS: 600 });
  assert.deepEqual(outcomeOf(429, null), { kind: 'rate-limited', retryAfterS: 60 });
  assert.deepEqual(outcomeOf(503, { error: 'off' }), { kind: 'off' });
  assert.deepEqual(outcomeOf(400, { error: 'bad-request', field: 'text' }), { kind: 'rejected' });
  assert.deepEqual(outcomeOf(413, null), { kind: 'rejected' });
  for (const status of [403, 415, 500, 502, 204]) assert.deepEqual(outcomeOf(status, null), { kind: 'failed' }, String(status));
});

test('status asks GET /api/feedback once however often it is read; anything but {v:1, on:true} is off', async () => {
  const calls = [];
  const on = createFeedbackClient({ fetch: async (url, init) => { calls.push([url, init.method]); return res(200, { v: 1, on: true }); } });
  assert.equal(await on.status(), true);
  assert.equal(await on.status(), true);
  assert.deepEqual(calls, [['/api/feedback', 'GET']]);
  assert.equal(await createFeedbackClient({ fetch: async () => res(200, { v: 2, on: true }) }).status(), false, 'an unknown version is off');
  assert.equal(await createFeedbackClient({ fetch: async () => res(200, { v: 1, on: false }) }).status(), false);
  assert.equal(await createFeedbackClient({ fetch: async () => res(500, null) }).status(), false);
  assert.equal(await createFeedbackClient({ fetch: async () => { throw new TypeError('offline'); } }).status(), false);
});

test('send posts exactly {v, levelId, screen, kind, text} as JSON and resolves, never rejects', async () => {
  let seen;
  const client = createFeedbackClient({ fetch: async (url, init) => { seen = { url, init }; return res(201, { v: 1, ok: true, issue: 7 }); } });
  assert.deepEqual(await client.send({ levelId: 'a', screen: 2, kind: 'bug', text: 'hi' }), { kind: 'sent', issue: 7 });
  assert.equal(seen.url, '/api/feedback');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(seen.init.body), { v: 1, levelId: 'a', screen: 2, kind: 'bug', text: 'hi' });
  const down = createFeedbackClient({ fetch: async () => { throw new TypeError('offline'); } });
  assert.deepEqual(await down.send({ levelId: 'a', screen: 1, kind: 'bug', text: 'hi' }), { kind: 'failed' });
});

// ---- the kit field (A18) ---------------------------------------------------------------------

test('field kind area is a prose textarea: plain input look, rows, maxlength, a described note', () => {
  assert.equal(field({ id: 'fb', label: 'What happened?', kind: 'area', rows: 5, maxLength: 1000, noteHtml: 'n' }),
    '<div class="ui-field"><label class="ui-field-label" for="fb">What happened?</label>' +
    '<textarea class="ui-input" id="fb" rows="5" maxlength="1000" aria-describedby="fb-note"></textarea>' +
    '<p class="ui-note" id="fb-note">n</p></div>');
  assert.match(field({ id: 'fb', label: 'L', kind: 'area' }), /<textarea class="ui-input" id="fb" rows="4"><\/textarea>/, 'no maxlength unless asked');
  assert.throws(() => field({ id: 'fb', label: 'L', maxLength: 10 }), TypeError, 'maxLength is for an area only');
  assert.throws(() => field({ id: 'fb', label: 'L', kind: 'area', maxLength: 0 }), TypeError);
});

// ---- the game --------------------------------------------------------------------------------

const LV = {
  id: 'spans-and-traces', no: '0.1', name: 'Spans and traces', icon: '*', rewardTitle: 'T', mechanics: ['query'],
  run(ctx) {
    ctx.renderStep('<p>one</p>', '<button id="next">Next</button>');
    q('#next').onclick = () => ctx.renderStep('<p>two</p>', '<button data-finish>Finish</button>');
  },
};
const REG = buildRegistry([{ id: 'a0', no: 0, name: 'First act', levels: [LV], boss: null }], { deck: [], nodeIds: [] });

/** routes: "GET /api/feedback" etc. -> response or function(init) -> response. Returns the posted bodies. */
function setup({ on = true, debug = false, post = () => res(201, { v: 1, ok: true, issue: 42 }) } = {}) {
  const dom = makeDom(html);
  const posts = [];
  const gets = [];
  const fetch = async (url, init = {}) => {
    if (url === '/api/feedback' && (init.method ?? 'GET') === 'GET') { gets.push(url); return res(200, { v: 1, on }); }
    if (url === '/api/feedback' && init.method === 'POST') { posts.push(JSON.parse(init.body)); return post(init); }
    return res(404, {});
  };
  const game = createGame({
    registry: REG, deck: [], storage: () => fakeStorage(), document: dom.document, window: { addEventListener() {} },
    now: () => 0, rand: () => 0, reduceMotion: () => true, setTimeout: () => {}, clearTimeout: () => {},
    reportError: (e) => { throw e; }, debug, fetch,
    globeMap: { ACT_REGIONS: {}, LEVEL_COUNTRY: {}, COUNTRY_NAMES: {}, actOf: () => null }, dots: [],
  });
  const focused = [];
  game.focusSoon = (sel) => focused.push(sel);
  return { game, posts, gets, focused, dom };
}
/** The markup's own x-show / :inert expression, evaluated against the game. */
const gate = (game, expr) => new Function('g', `with (g) { return (${expr.replaceAll('&amp;', '&')}); }`)(game);
const msg = () => q('#feedback-msg [data-feedback-text]').textContent;
const type = (text) => { q('#feedback-text').value = text; };
const pick = (kind) => { for (const r of qa('input[name="feedback-kind"]')) r.checked = r.value === kind; };

test('the Feedback button shows only when the server has feedback on', async () => {
  const button = (g) => q('#ov-feedback-open') && gate(g, q('#ov-feedback-open').getAttribute('x-show'));
  const off = setup({ on: false });
  off.game.init(); await settle();
  assert.equal(off.gets.length, 1);
  assert.equal(button(off.game), false);
  const on = setup({ on: true });
  on.game.init(); await settle();
  assert.equal(button(on.game), true);
});

test('Send on screen 2 posts exactly {v, levelId, screen, kind, text}; two quick Send clicks make one request', async () => {
  const { game, posts } = setup();
  game.init(); await settle();
  game.openLevel('spans-and-traces');
  click('#next');
  assert.equal(game.openFeedback(), true);
  assert.equal(game.feedbackOpen, true);
  assert.deepEqual(qa('input[name="feedback-kind"]').map((r) => r.value), [...KINDS]);
  pick('wrong-fact');
  type('  The span is not a trace.  ');
  click('#feedback-send');
  q('#feedback-send').onclick({});
  await settle();
  assert.deepEqual(posts, [{ v: 1, levelId: 'spans-and-traces', screen: 2, kind: 'wrong-fact', text: '  The span is not a trace.  ' }]);
  assert.equal(msg(), 'Sent as issue #42 on GitHub. Thank you.');
  assert.equal(q('#feedback-send').disabled, true, 'a sent note is not sent twice');
});

test('empty text sends nothing and says so; a failure says so and lets the player try again', async () => {
  let reply = res(500, null);
  const { game, posts } = setup({ post: () => reply });
  game.init(); await settle();
  game.openLevel('spans-and-traces');
  game.openFeedback();
  type('   ');
  click('#feedback-send'); await settle();
  assert.equal(posts.length, 0);
  assert.equal(msg(), 'Write a few words first.');
  type('Hello');
  click('#feedback-send'); await settle();
  assert.equal(posts.length, 1);
  assert.equal(msg(), 'Could not send it. Try again later.');
  assert.equal(q('#feedback-send').disabled, false);
  reply = res(429, { retryAfterS: 600 });
  click('#feedback-send'); await settle();
  assert.equal(msg(), 'Too many in a short time. Try again in 10 minutes.');
  reply = res(429, { retryAfterS: 30 });
  click('#feedback-send'); await settle();
  assert.equal(msg(), 'Too many in a short time. Try again in 1 minute.');
  reply = res(503, { error: 'off' });
  click('#feedback-send'); await settle();
  assert.equal(msg(), 'Feedback is off right now.');
  reply = res(400, { error: 'bad-request', field: 'text' });
  click('#feedback-send'); await settle();
  assert.equal(msg(), 'That could not be sent. Check the text and try again.');
});

test('the dialog says the issue is public, offers each kind in plain words, and has no form', async () => {
  const { game } = setup();
  game.init(); await settle();
  game.openLevel('spans-and-traces');
  game.openFeedback();
  const body = q('#feedback-body');
  assert.match(body.textContent, /This becomes a public GitHub issue\. Do not include anything private\./);
  assert.equal(body.querySelectorAll('form').length, 0, 'CSP form-action is none: Send is a click handler');
  assert.equal(qa('input[name="feedback-kind"]').filter((r) => r.hasAttribute('checked')).length, 1, 'one kind starts chosen');
  assert.doesNotMatch(body.textContent, /—/, 'no em dashes');
});

test('debug mode shows the button, sends nothing and says so; Escape closes only the feedback dialog and focus returns to its button', async () => {
  const { game, posts, gets, focused } = setup({ on: false, debug: true });
  game.init(); await settle();
  assert.equal(gets.length, 0, 'debug never asks the server');
  assert.equal(gate(game, q('#ov-feedback-open').getAttribute('x-show')), true);
  game.openLevel('spans-and-traces');
  game.openFeedback();
  type('Hello');
  click('#feedback-send'); await settle();
  assert.equal(posts.length, 0);
  assert.equal(msg(), 'Debug mode: nothing was sent.');
  const overlay = q('.overlay');
  assert.equal(gate(game, overlay.getAttribute(':inert')), true, 'the level behind the dialog is inert');
  assert.equal(game.scrollLocked(), true);
  assert.equal(game.openModalSelector(), '#feedback-modal');
  focused.length = 0;
  game.onEscape({});
  assert.equal(game.feedbackOpen, false);
  assert.equal(game.overlayOpen, true, 'the level stays open');
  assert.deepEqual(focused, ['#ov-feedback-open']);
  assert.equal(q('#feedback-body').innerHTML, '', 'the form is dropped on close');
  assert.equal(gate(game, overlay.getAttribute(':inert')), false);
  game.onEscape({});
  assert.equal(game.overlayOpen, false, 'a second Escape closes the level');
});

test('the textarea limit is the server limit', async () => {
  const { game } = setup();
  game.init(); await settle();
  game.openLevel('spans-and-traces');
  game.openFeedback();
  assert.equal(q('#feedback-text').getAttribute('maxlength'), String(MAX_TEXT));
});

test('feedback cannot open with no level open, and a second open does nothing', async () => {
  const { game } = setup();
  game.init(); await settle();
  assert.equal(game.openFeedback(), false);
  game.openLevel('spans-and-traces');
  assert.equal(game.openFeedback(), true);
  assert.equal(game.openFeedback(), false);
  game.closeFeedback();
  assert.equal(game.feedbackOpen, false);
  assert.equal(parseHTML(html).document.querySelectorAll('#feedback-modal form').length, 0);
});
