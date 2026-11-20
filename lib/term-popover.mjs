// The behaviour of a glossary term (#429, lib/ui/term.mjs, docs/DESIGN-SYSTEM.md "term"): the WAI-ARIA tooltip pattern.
// The definition opens on hover, keyboard focus and click or tap; Escape closes it and returns focus to the term; a click
// outside closes it; one is open at a time. Listeners are added with addEventListener and the card is placed with CSSOM
// (`style.setProperty`) and a `data-side` attribute, so none of it needs `unsafe-inline`. Browser code with the document
// injected: no top-level window or document access, importable under `node --test`.

const MARGIN = 8; // the card keeps this far from the edge of the body it sits in

/**
 * `createTermPopovers({document})` → `{wire(root), closeAll()}`. Call `wire(root)` after drawing markup that holds terms
 * into `root` (the scrolling body they sit in: the card stays inside it); wiring a body again after a redraw forgets what
 * was open in the old one. `closeAll()` closes the open definition (call it when the primer closes).
 */
export function createTermPopovers({ document: doc }) {
  let open = null; // { wrap, button, pop, root, hovered, focused, pinned }
  let listening = false;
  let ignoreFocus = false; // the focus() Escape does must not open the card it just closed
  const wired = new WeakSet();

  const attached = (el) => doc.documentElement.contains(el);

  function close() {
    if (open === null) return;
    open.pop.setAttribute('hidden', '');
    open = null;
  }

  // Closed when nothing holds it open: not hovered, not focused, not pinned by a click or tap.
  function settle() {
    if (open !== null && !open.hovered && !open.focused && !open.pinned) close();
  }

  // The nearest ancestor of the term, below the body, that scrolls or clips (a sticky side column): it would cut the card off.
  function clipper(wrap, root) {
    const win = doc.defaultView;
    if (typeof win?.getComputedStyle !== 'function') return null;
    for (let el = wrap.parentElement; el && el !== root; el = el.parentElement) {
      const s = win.getComputedStyle(el);
      if ([s.overflowX, s.overflowY].some((v) => v && v !== 'visible')) return el;
    }
    return null;
  }

  // Whether a box between the term and the body cuts off what overflows it (overflow hidden or clip, as the kit's lesson card
  // does): a card inside it cannot be scrolled to, and the box may be too short for the card above or below the term.
  function cuts(wrap, root) {
    const win = doc.defaultView;
    if (typeof win?.getComputedStyle !== 'function') return false;
    for (let el = wrap.parentElement; el && el !== root; el = el.parentElement) {
      const s = win.getComputedStyle(el);
      if ([s.overflowX, s.overflowY].some((v) => v === 'hidden' || v === 'clip')) return true;
    }
    return false;
  }

  // A card in a box that cuts leaves it: fixed to the viewport, so no ancestor clips it, and placed from the term's rectangle
  // and kept inside the body. A fixed box's origin is the viewport unless an ancestor (a backdrop filter) takes that part, so
  // the origin is measured, not assumed.
  function placeFixed({ wrap, pop, root }) {
    const view = doc.documentElement;
    pop.style.setProperty('position', 'fixed');
    pop.style.setProperty('left', '0px');
    pop.style.setProperty('top', '0px');
    pop.style.setProperty('bottom', 'auto');
    const origin = pop.getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();
    const lo = Math.max(0, rootBox.left) + MARGIN;
    const hi = Math.min(view.clientWidth || rootBox.right, rootBox.right) - MARGIN;
    if (hi > lo) pop.style.setProperty('max-width', `${hi - lo}px`);
    const r = pop.getBoundingClientRect();
    const term = wrap.getBoundingClientRect();
    const left = hi > lo ? Math.max(lo, Math.min(term.left, hi - r.width)) : term.left;
    const floor = Math.min(view.clientHeight || rootBox.bottom, rootBox.bottom) - MARGIN;
    const ceiling = Math.max(0, rootBox.top) + MARGIN;
    const above = term.bottom + r.height > floor && term.top - r.height >= ceiling;
    if (above) pop.setAttribute('data-side', 'above');
    pop.style.setProperty('left', `${left - origin.left}px`);
    pop.style.setProperty('top', `${(above ? term.top - r.height : term.bottom) - origin.top}px`);
  }

  // Keep the card inside its body and inside any clipping ancestor of the term: capped to that width, nudged left to fit,
  // above the term when there is no room below.
  function place({ wrap, pop, root }) {
    for (const p of ['left', 'top', 'bottom', 'position', 'max-width']) pop.style.removeProperty(p);
    pop.removeAttribute('data-side');
    if (pop.getAttribute('style') === '') pop.removeAttribute('style'); // a reset leaves an empty attribute behind
    if (typeof pop.getBoundingClientRect !== 'function' || typeof root.getBoundingClientRect !== 'function') return;
    if (typeof wrap.getBoundingClientRect === 'function' && cuts(wrap, root)) return placeFixed({ wrap, pop, root });
    const view = doc.documentElement;
    const rootBox = root.getBoundingClientRect();
    const clip = clipper(wrap, root);
    const clipBox = clip && typeof clip.getBoundingClientRect === 'function' ? clip.getBoundingClientRect() : rootBox;
    const bounds = {
      left: Math.max(rootBox.left, clipBox.left),
      right: Math.min(rootBox.right, clipBox.right),
      top: Math.max(rootBox.top, clipBox.top),
      bottom: Math.min(rootBox.bottom, clipBox.bottom),
    };
    const lo = Math.max(0, bounds.left) + MARGIN;
    const hi = Math.min(view.clientWidth || bounds.right, bounds.right) - MARGIN;
    if (!(hi > lo)) return;
    let r = pop.getBoundingClientRect();
    if (r.width > hi - lo) {
      pop.style.setProperty('max-width', `${hi - lo}px`);
      r = pop.getBoundingClientRect();
    }
    let dx = 0;
    if (r.right > hi) dx = hi - r.right;
    if (r.left + dx < lo) dx = lo - r.left;
    if (dx !== 0) pop.style.setProperty('left', `${dx}px`);
    const bottom = Math.min(view.clientHeight || bounds.bottom, bounds.bottom) - MARGIN;
    const top = Math.max(0, bounds.top) + MARGIN;
    if (r.bottom > bottom && wrap.getBoundingClientRect().top - r.height >= top) pop.setAttribute('data-side', 'above');
  }

  // Open this term's card (closing any other) and return its state.
  function show(parts) {
    if (open !== null && open.wrap === parts.wrap) return open;
    close();
    parts.pop.removeAttribute('hidden');
    place(parts);
    open = { ...parts, hovered: false, focused: false, pinned: false };
    return open;
  }

  function listen() {
    if (listening) return;
    listening = true;
    // Escape closes the card and stops there, so the primer behind it stays open; with no card open the key is not touched.
    doc.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || open === null) return;
      if (!attached(open.wrap)) {
        open = null;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const { button, focused, pinned } = open;
      close();
      // Focus goes back to the term only when the card was the keyboard's or a click's; one hover opened leaves focus where it was.
      if (!focused && !pinned) return;
      ignoreFocus = true;
      try {
        button.focus();
      } finally {
        ignoreFocus = false;
      }
    });
    // pointerdown as well as click: iOS Safari sends no click for a tap on plain text.
    const outside = (e) => {
      if (open !== null && !open.wrap.contains(e.target)) close();
    };
    doc.addEventListener('pointerdown', outside);
    doc.addEventListener('click', outside);
    // A fixed card does not move with the body, so it follows the term when the body scrolls.
    doc.addEventListener('scroll', () => {
      if (open !== null && open.pop.style.getPropertyValue('position') === 'fixed') place(open);
    }, true);
  }

  function wire(root) {
    if (open !== null && !attached(open.wrap)) open = null;
    listen();
    for (const wrap of root.querySelectorAll('[data-term]')) {
      if (wired.has(wrap)) continue;
      wired.add(wrap);
      const button = wrap.querySelector('button');
      const pop = wrap.querySelector('[role="tooltip"]');
      if (!button || !pop) continue;
      const parts = { wrap, button, pop, root };
      const mine = () => open !== null && open.wrap === wrap;
      wrap.addEventListener('mouseenter', () => {
        show(parts).hovered = true;
      });
      wrap.addEventListener('mouseleave', () => {
        if (!mine()) return;
        open.hovered = false;
        settle();
      });
      button.addEventListener('focus', () => {
        if (!ignoreFocus) show(parts).focused = true;
      });
      button.addEventListener('blur', (e) => {
        if (!mine() || (e.relatedTarget && wrap.contains(e.relatedTarget))) return;
        open.focused = false;
        open.pinned = false;
        settle();
      });
      // A click keeps a card open that hover or focus opened, and a second click closes it: a tap on a touch screen opens
      // it (the emulated mouseenter may have already) and the next tap shuts it.
      button.addEventListener('click', () => {
        if (mine() && open.pinned) close();
        else show(parts).pinned = true;
      });
    }
  }

  return { wire, closeAll: close };
}
