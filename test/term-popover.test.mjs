// How a glossary term opens and closes (lib/term-popover.mjs, #429): hover, keyboard focus and click or tap open its
// definition; Escape closes it and returns focus to the term; a click outside closes it; one is open at a time.
// linkedom has no layout and no focus model, so focus() is recorded and rectangles are stubbed where placement is judged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { term } from '../lib/ui/index.mjs';
import { createTermPopovers } from '../lib/term-popover.mjs';

function setup() {
  const body = [
    term({ id: 't-a', text: 'alpha', name: 'Alpha', definition: 'First term.' }),
    term({ id: 't-b', text: 'beta', name: 'Beta', definition: 'Second term.' }),
  ].map((t) => `<p>${t}</p>`).join('');
  const { window, document } = parseHTML(`<!doctype html><html><body><div id="root">${body}</div><button id="outside">out</button><div id="inside-popup"></div></body></html>`);
  const focused = [];
  window.HTMLElement.prototype.focus = function focus() {
    focused.push(this);
    this.dispatchEvent(new window.Event('focus')); // a real focus() fires the event
  };
  const root = document.getElementById('root');
  const pops = createTermPopovers({ document });
  pops.wire(root);
  const el = (id) => {
    const wrap = root.querySelector(`#${id}`).parentNode;
    return { wrap, button: wrap.querySelector('button'), pop: wrap.querySelector('[role="tooltip"]') };
  };
  const fire = (target, type, init = {}) => {
    const e = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, init);
    target.dispatchEvent(e);
    return e;
  };
  const isOpen = (t) => !t.pop.hasAttribute('hidden');
  return { window, document, root, pops, a: el('t-a'), b: el('t-b'), fire, focused, isOpen, outside: document.getElementById('outside') };
}

test('every definition starts hidden', () => {
  const { a, b, isOpen } = setup();
  assert.deepEqual([isOpen(a), isOpen(b)], [false, false]);
});

test('hover opens the definition and leaving closes it', () => {
  const { a, fire, isOpen } = setup();
  fire(a.wrap, 'mouseenter');
  assert.equal(isOpen(a), true);
  fire(a.wrap, 'mouseleave');
  assert.equal(isOpen(a), false);
});

test('keyboard focus opens the definition and moving focus away closes it', () => {
  const { a, fire, isOpen } = setup();
  fire(a.button, 'focus');
  assert.equal(isOpen(a), true);
  fire(a.button, 'blur', { relatedTarget: null });
  assert.equal(isOpen(a), false);
});

test('a click opens it when nothing else did, and it stays after the pointer leaves; a second click closes it', () => {
  const { a, fire, isOpen } = setup();
  fire(a.button, 'click');
  assert.equal(isOpen(a), true);
  fire(a.wrap, 'mouseleave');
  assert.equal(isOpen(a), true, 'a tap that opened it keeps it open');
  fire(a.button, 'click');
  assert.equal(isOpen(a), false);
});

test('moving focus away unpins a card a click opened', () => {
  const { a, fire, isOpen } = setup();
  fire(a.button, 'focus');
  fire(a.button, 'click');
  fire(a.wrap, 'mouseleave');
  assert.equal(isOpen(a), true, 'control: pinned, so it outlives the pointer and still has focus');
  fire(a.button, 'blur', { relatedTarget: null });
  assert.equal(isOpen(a), false);
});

test('a click while hovering keeps it open past the pointer leaving, instead of toggling it shut', () => {
  const { a, fire, isOpen } = setup();
  fire(a.wrap, 'mouseenter');
  fire(a.button, 'click');
  assert.equal(isOpen(a), true);
  fire(a.wrap, 'mouseleave');
  assert.equal(isOpen(a), true);
});

test('Escape closes a definition opened by focus and returns focus to the term', () => {
  const { a, fire, isOpen, focused, outside } = setup();
  fire(a.button, 'focus');
  const e = fire(outside, 'keydown', { key: 'Escape' });
  assert.equal(isOpen(a), false);
  assert.equal(e.defaultPrevented, true);
  assert.ok(focused.at(-1) === a.button, 'focus went to the term button');
});

test('Escape closes a definition a click pinned and returns focus to the term', () => {
  const { a, fire, isOpen, focused, outside } = setup();
  fire(a.button, 'click');
  fire(outside, 'keydown', { key: 'Escape' });
  assert.equal(isOpen(a), false);
  assert.ok(focused.at(-1) === a.button);
});

test('Escape closes a definition only hover opened and leaves focus where it was', () => {
  const { a, fire, isOpen, focused, outside } = setup();
  fire(a.wrap, 'mouseenter');
  const e = fire(outside, 'keydown', { key: 'Escape' });
  assert.equal(isOpen(a), false);
  assert.equal(e.defaultPrevented, true, 'still swallowed, so the primer stays open');
  assert.equal(focused.length, 0, 'the term did not take focus');
});

test('focus going back to the term after Escape does not open it again', () => {
  const { a, fire, isOpen } = setup();
  fire(a.button, 'focus');
  fire(a.button, 'keydown', { key: 'Escape' });
  assert.equal(isOpen(a), false, 'the focus() the Escape did fires a focus event, which must be ignored');
  fire(a.button, 'blur', { relatedTarget: null });
  fire(a.button, 'focus');
  assert.equal(isOpen(a), true, 'a later real focus opens it again');
});

test('Escape with nothing open does nothing, so the page behind still sees it', () => {
  const { fire, root, focused } = setup();
  const e = fire(root, 'keydown', { key: 'Escape' });
  assert.equal(e.defaultPrevented, false);
  assert.equal(focused.length, 0);
});

test('Escape that closes a definition does not reach the page (the primer stays open)', () => {
  const { a, fire, window, outside } = setup();
  let seen = 0;
  window.addEventListener('keydown', () => seen++);
  fire(outside, 'keydown', { key: 'Escape' });
  assert.equal(seen, 1, 'control: an Escape with nothing open reaches the window');
  fire(a.wrap, 'mouseenter');
  fire(outside, 'keydown', { key: 'Escape' });
  assert.equal(seen, 1, 'it stopped at the document');
  fire(outside, 'keydown', { key: 'Enter' });
  assert.equal(seen, 2, 'other keys pass');
});

test('a click outside closes it; a click inside the definition does not', () => {
  const { a, fire, isOpen, outside } = setup();
  fire(a.button, 'click');
  fire(a.pop, 'click');
  assert.equal(isOpen(a), true);
  fire(outside, 'click');
  assert.equal(isOpen(a), false);
});

test('a pointerdown outside closes it (iOS sends no click for a tap on plain text); inside the card or on the term it does not', () => {
  const { a, fire, isOpen, outside } = setup();
  fire(a.button, 'click');
  fire(a.pop, 'pointerdown');
  fire(a.button, 'pointerdown');
  assert.equal(isOpen(a), true);
  fire(outside, 'pointerdown');
  assert.equal(isOpen(a), false);
});

test('a pointerdown then click on the term toggles it once, as before', () => {
  const { a, fire, isOpen } = setup();
  fire(a.button, 'pointerdown');
  fire(a.button, 'click');
  assert.equal(isOpen(a), true);
  fire(a.button, 'pointerdown');
  fire(a.button, 'click');
  assert.equal(isOpen(a), false);
});

test('only one definition is open at a time, whichever way the second opens', () => {
  const { a, b, fire, isOpen } = setup();
  fire(a.wrap, 'mouseenter');
  fire(b.wrap, 'mouseenter');
  assert.deepEqual([isOpen(a), isOpen(b)], [false, true]);
  fire(a.button, 'click');
  assert.deepEqual([isOpen(a), isOpen(b)], [true, false]);
  fire(b.button, 'focus');
  assert.deepEqual([isOpen(a), isOpen(b)], [false, true]);
  fire(a.button, 'click');
  fire(b.button, 'click');
  assert.deepEqual([isOpen(a), isOpen(b)], [false, true], 'a tap on a second term closes the first');
});

test('wiring a redrawn body forgets what was open in the old one, and Escape is no longer swallowed', () => {
  const { a, fire, root, pops, document } = setup();
  fire(a.wrap, 'mouseenter');
  root.innerHTML = '<p>gone</p>';
  pops.wire(root);
  const e = fire(document.getElementById('outside'), 'keydown', { key: 'Escape' });
  assert.equal(e.defaultPrevented, false);
});

test('closeAll closes the open definition (the primer closing) and Escape is no longer swallowed', () => {
  const { a, fire, pops, isOpen, outside } = setup();
  fire(a.button, 'click');
  pops.closeAll();
  assert.equal(isOpen(a), false);
  assert.equal(fire(outside, 'keydown', { key: 'Escape' }).defaultPrevented, false);
  pops.closeAll();
});

test('wiring the same body twice does not double the behaviour', () => {
  const { a, fire, pops, root, isOpen } = setup();
  pops.wire(root);
  fire(a.button, 'click');
  assert.equal(isOpen(a), true, 'two click handlers would toggle it shut');
});

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

test('placement: a definition that would overflow the right edge is moved left, inside the body with a margin', () => {
  const { a, fire, root, document } = setup();
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 320, configurable: true });
  root.getBoundingClientRect = () => rect(0, 0, 320, 600);
  a.wrap.getBoundingClientRect = () => rect(250, 100, 40, 20);
  a.pop.getBoundingClientRect = () => rect(250, 120, 200, 60);
  fire(a.wrap, 'mouseenter');
  assert.equal(a.pop.style.getPropertyValue('left'), '-138px', 'right edge at 320 - 8');
});

test('placement: one wider than the body is capped to the body width less margins', () => {
  const { a, fire, root, document } = setup();
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 320, configurable: true });
  root.getBoundingClientRect = () => rect(16, 0, 288, 600);
  a.wrap.getBoundingClientRect = () => rect(20, 100, 40, 20);
  a.pop.getBoundingClientRect = () => rect(20, 120, 400, 60);
  fire(a.wrap, 'mouseenter');
  assert.equal(a.pop.style.getPropertyValue('max-width'), '272px');
});

test('placement: a definition that fits is not moved, and an earlier shift is cleared', () => {
  const { a, fire, root, document } = setup();
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 320, configurable: true });
  root.getBoundingClientRect = () => rect(0, 0, 320, 600);
  a.wrap.getBoundingClientRect = () => rect(250, 100, 40, 20);
  a.pop.getBoundingClientRect = () => rect(250, 120, 200, 60);
  fire(a.wrap, 'mouseenter');
  fire(a.wrap, 'mouseleave');
  a.pop.getBoundingClientRect = () => rect(250, 120, 60, 60);
  fire(a.wrap, 'mouseenter');
  assert.equal(a.pop.style.getPropertyValue('left'), '');
  assert.equal(a.pop.hasAttribute('style'), false, 'no empty style attribute is left behind');
});

test('placement: with no room below inside the body it opens above', () => {
  const { a, fire, root, document } = setup();
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 320, configurable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: 600, configurable: true });
  root.getBoundingClientRect = () => rect(0, 0, 320, 600);
  a.wrap.getBoundingClientRect = () => rect(20, 560, 40, 20);
  a.pop.getBoundingClientRect = () => rect(20, 580, 200, 60);
  fire(a.wrap, 'mouseenter');
  assert.equal(a.pop.getAttribute('data-side'), 'above');
  fire(a.wrap, 'mouseleave');
  a.wrap.getBoundingClientRect = () => rect(20, 100, 40, 20);
  a.pop.getBoundingClientRect = () => rect(20, 120, 200, 60);
  fire(a.wrap, 'mouseenter');
  assert.equal(a.pop.hasAttribute('data-side'), false);
});
