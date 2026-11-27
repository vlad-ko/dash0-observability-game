// The ctx a level's run() receives (docs/FOUNDATION.md §2.6). One implementation,
// used by the app and the play-through harness alike.
import { escapeHtml, shuffle as kitShuffle, speech } from './lesson-kit.mjs';
import { scoreStars } from './scoring.mjs';
import { createTermScope, glossWith } from './term-text.mjs';

const BODY_OWNER = 'body'; // the owner of the terms renderStep draws; feedback owners are their elements

/**
 * Create the ctx for one open level. `level.id` is captured now, so a stale finish
 * can never credit another level; `finish` is a no-op once done or once `signal`
 * aborts (the overlay closed). A throwing `onFinish` or a broken clock goes to
 * `reportError` and never strands the player. `glossary` (the joined glossary) and `termPops` (lib/term-popover.mjs)
 * draw and wire the glossary terms a level's text marks (#442); with neither, a marked term reads as plain words.
 * `dash0Task` (#509, docs/FOUNDATION.md §2.6) is the In Dash0 task facade the app builds from lib/dash0-task/client.mjs, or null
 * (?mode=debug, no fetch): without it a play level leaves its In Dash0 steps out.
 */
export function createLevelContext({
  level,
  ovBody,
  ovActions,
  now = Date.now,
  shuffle = kitShuffle,
  reduceMotion = false,
  onFinish,
  signal,
  reportError = console.error,
  telemetry = null,
  guide = null,
  onWidget = null,
  glossary = null,
  termPops = null,
  dash0Task = null,
}) {
  if (!level || typeof level.id !== 'string') throw new TypeError('level.id is required');
  if (!ovBody || !ovActions) throw new TypeError('ovBody and ovActions are required');
  if (typeof onFinish !== 'function') throw new TypeError('onFinish must be a function');
  if (typeof reportError !== 'function') throw new TypeError('reportError must be a function');
  if (onWidget !== null && typeof onWidget !== 'function') throw new TypeError('onWidget must be a function');
  if (!signal || typeof signal.aborted !== 'boolean') throw new TypeError('signal is required');

  const levelId = level.id;
  // reportError must never strand the player, even if it throws itself.
  const report = (e) => {
    try {
      reportError(e);
    } catch {
      // nothing left to tell
    }
  };
  // A clock reading that throws, is not finite or is out of Date's range is reported
  // and becomes NaN, which counts as no elapsed time and no date.
  const readClock = () => {
    try {
      const t = now();
      if (Number.isFinite(t) && !Number.isNaN(new Date(t).getTime())) return t;
      report(new Error(`level "${levelId}": clock gave a non-finite or out-of-range time`));
    } catch (e) {
      report(e);
    }
    return NaN;
  };
  const startedAt = readClock();
  // The level clock stops while the player is in Dash0 (#509): `paused` is the time the clock was last stopped (null while it
  // runs), `pausedMs` what earlier stops added up to. Par is elapsed minus both, so it covers the game steps only.
  let paused = null;
  let pausedMs = 0;
  let mistakes = 0;
  let hintsUsed = 0;
  let finished = false;
  let screens = 0; // renderStep calls so far: the screen the player is on (feedback names it)
  // The terms on the screen now (#442): renderStep opens a scope per screen, and feedback drawn through ctx.gloss shares it,
  // so a term is a control only at its first use on the screen. Before the first screen nothing is drawn as a term.
  let scope = createTermScope({ glossary: null, prefix: 'lvterm-0' });
  const guideListeners = new Set();
  signal.addEventListener?.('abort', () => guideListeners.clear(), { once: true });

  return {
    /** The screens drawn so far: 0 before the first renderStep, then one more per call (1-based, the screen on show). */
    get screen() {
      return screens;
    },
    renderStep(bodyHtml, actionsHtml) {
      screens += 1;
      // A glossary term in the body (#442) is a control at its first use on this screen; the open definition of the screen
      // being replaced closes first, and the new body is wired once drawn. The actions are never glossed.
      if (!signal.aborted) termPops?.closeAll();
      scope = createTermScope({ glossary, prefix: `lvterm-${screens}` });
      ovBody.innerHTML = glossWith(bodyHtml, scope, BODY_OWNER);
      ovActions.innerHTML = actionsHtml || '';
      if (!signal.aborted) termPops?.wire(ovBody);
      ovBody.scrollTop = 0;
    },
    /**
     * Answer feedback or help text (#442): `html` with its gloss spans drawn as terms on this screen. A term already on the
     * screen stays plain words. `owner` names the element the text goes into: its earlier terms are given back first, as that
     * text is being replaced. Draw the result into the owner, then call wireTerms.
     */
    gloss(html, owner) {
      scope.release(owner);
      return glossWith(html, scope, owner);
    },
    /** Give back the terms `owner` drew, when its text is emptied or hidden without being replaced. */
    release(owner) {
      scope.release(owner);
    },
    /** Wire the terms drawn since the last wire; always the card body, the box a definition must stay inside. It does nothing once the signal has aborted. */
    wireTerms() {
      if (!signal.aborted) termPops?.wire(ovBody);
    },
    /** Stop the level clock (an In Dash0 step is on screen). Does nothing when it is already stopped. */
    pauseClock() {
      if (finished || paused !== null) return;
      const t = readClock();
      if (Number.isFinite(t)) paused = t;
    },
    /** Start the level clock again; the time since pauseClock does not count. Does nothing when it runs. */
    resumeClock() {
      if (paused === null) return;
      const t = readClock();
      if (Number.isFinite(t)) pausedMs += Math.max(0, t - paused);
      paused = null;
    },
    speech,
    escapeHtml,
    shuffle: (arr) => shuffle([...arr]),
    mistake() {
      mistakes += 1;
    },
    hint() {
      hintsUsed += 1;
    },
    // One answered guide question costs one hint (owner choice, #17): the same accounting as
    // hint(), then the boards are told so they show it.
    askedGuide() {
      if (finished) return;
      hintsUsed += 1;
      for (const fn of [...guideListeners]) {
        try {
          fn();
        } catch (e) {
          report(e);
        }
      }
    },
    /**
     * Say which widget the step on screen shows ('choice', 'sort', ...; the How to play modal follows
     * it, #316). Each widget's mount calls it. Nothing after the signal aborts; a throwing onWidget is reported.
     */
    widget(key) {
      if (signal.aborted || onWidget === null) return;
      try {
        onWidget(key);
      } catch (e) {
        report(e);
      }
    },
    /** Listen for answered guide questions; returns the function that stops listening. */
    onGuideHint(fn) {
      if (signal.aborted || typeof fn !== 'function') return () => {};
      guideListeners.add(fn);
      return () => guideListeners.delete(fn);
    },
    // Build the result first; latch only once nothing else can throw, so an
    // unexpected throw leaves finish retryable instead of stranding the player.
    finish(opts) {
      if (finished || signal.aborted) return null;
      const { text: rawText, cards } = opts ?? {};
      const kept = Array.isArray(cards) ? [...cards] : [];
      let text = '';
      try { text = rawText == null ? '' : String(rawText); } catch (e) { report(e); }
      const t = readClock();
      const stopped = pausedMs + (paused !== null && Number.isFinite(t) ? Math.max(0, t - paused) : 0);
      const elapsedMs = Number.isFinite(t - startedAt) ? Math.max(0, t - startedAt - stopped) : 0;
      const stars = scoreStars({ mistakes, hintsUsed, elapsedMs }, level);
      const result = { stars, cards: kept, text };
      const at = Number.isFinite(t) ? new Date(t).toISOString() : null;
      finished = true;
      try {
        onFinish(levelId, { ...result, cards: [...kept], at, mistakes, hintsUsed });
      } catch (e) {
        report(e);
      }
      return result;
    },
    /** The level's injected clock (ms), NaN when it gave nothing usable: for a widget that times something itself. */
    now: readClock,
    reduceMotion: !!reduceMotion,
    // The telemetry facade (docs/FOUNDATION.md §2.6), or null when the app has none.
    telemetry: telemetry ?? null,
    // The guide status the app passes (docs/FOUNDATION.md §2.6), or null; unused until the panel.
    guide: guide ?? null,
    // The In Dash0 task facade (docs/FOUNDATION.md §2.6), or null.
    dash0Task: dash0Task ?? null,
    ovBody,
    ovActions,
    signal,
  };
}
