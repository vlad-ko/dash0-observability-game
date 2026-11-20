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

  // Keep the card inside its body and inside any clipping ancestor of the term: capped to that width, nudged left to fit,
  // above the term when there is no room below.
  function place({ wrap, pop, root }) {
    pop.style.removeProperty('left');
    pop.style.removeProperty('max-width');
    pop.removeAttribute('data-side');
    if (pop.getAttribute('style') === '') pop.removeAttribute('style'); // a reset leaves an empty attribute behind
    if (typeof pop.getBoundingClientRect !== 'function' || typeof root.getBoundingClientRect !== 'function') return;
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
