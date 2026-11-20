// The one way a widget says how an answer went (#442, docs/FOUNDATION.md §2.14): kit setFeedback, with the glossary terms
// marked in the text drawn through the ctx first. The text goes into `el`, so `el` owns the terms it draws and gives them
// back when its text is replaced. With no ctx.gloss (a stub ctx, a level outside the app) the text is drawn as given.
import { setFeedback } from '../ui/index.mjs';

/**
 * Show `html` (trusted authored HTML) in the feedback region `el` with `tone`, glossing its terms on the screen first and
 * wiring them once drawn. `opts` is setFeedback's ({scroll}).
 */
export function tell(ctx, el, tone, html, opts) {
  setFeedback(el, tone, typeof ctx.gloss === 'function' ? ctx.gloss(html, el) : html, opts);
  ctx.wireTerms?.();
}
