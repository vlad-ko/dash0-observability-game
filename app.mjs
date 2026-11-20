// The hub game: progress, the globe, level cards, the level overlay and the reward
// card (adapted from R's app.mjs; docs/FOUNDATION.md §5 F5). A plain object, no Alpine
// import: main.mjs registers it as Alpine.data('game') and tests call it directly.
// Everything from the browser (storage, document, window, clock, timers) comes in `deps`.
//
// Level HTML is rendered into #ov-body / #ov-actions inside an x-ignore wrapper. x-ignore
// only stops Alpine walking the initial markup: Alpine 3.14.1's mutation observer still
// initialises nodes a level adds later (it never checks ancestors for x-ignore), so level
// markup must not use Alpine attributes (x-*, @*, :*). test/levels-play.test.mjs checks.
import { DECK } from './cards/deck.mjs';
import { DOTS } from './hub/globe-data.mjs';
import { GAME_SUMMARY, GLOBE_LOOP } from './hub/about.mjs';
import { badgeViews } from './hub/badges.mjs';
import { COMING_SOON } from './hub/coming-soon.mjs';
import { ACT_REGIONS, actOfCountry, COUNTRY_NAMES, islandDots, LEVEL_COUNTRY } from './hub/globe-map.mjs';
import { NODE_IDS } from './hub/map-data.mjs';
import { ACTS } from './levels/index.mjs';
import { shuffle as kitShuffle } from './lib/lesson-kit.mjs';
import { endSentence } from './lib/text.mjs';
import { globeState } from './lib/globe.mjs';
import { freshlyLit, igniteView, litText } from './lib/globe-ignite.mjs';
import { dotStates, globeCaption, globeLabel, globeLegend, globeLines, globeTarget } from './lib/globe-view.mjs';
import { HELP_KEY, hideHelp, readHiddenHelp } from './lib/help-prefs.mjs';
import { howToView } from './lib/how-to-play.mjs';
import { buildPrimers, firstUnread, primerEyebrow as eyebrowOf, primerStatus, primerTile as tileOf, primerView as viewOf, primerZoneView as zoneViewOf } from './lib/primer.mjs';
import { PRIMER_KEY, readPrimers, recordPrimer } from './lib/primer-prefs.mjs';
import { primerBodyHtml, primerZoneHtml } from './lib/primer-view.mjs';
import { createTermPopovers } from './lib/term-popover.mjs';
import { createGuideClient } from './lib/guide/client.mjs';
import { createAccountClient } from './lib/account/client.mjs';
import { ACCOUNT_UNAVAILABLE, accountHtml, boardHtml, nudgeText, starsText } from './lib/account/board-view.mjs';
import { NICK_RE } from './lib/account/nickname.mjs';
import { setFeedback } from './lib/ui/index.mjs';
import { escapeHtml } from './lib/lesson-kit.mjs';
import { trapTab } from './lib/modal-focus.mjs';
import { focusFirst } from './lib/widgets/focus.mjs';
import { createLevelContext } from './lib/level-context.mjs';
import { cardTotals, emptyProgress, mergeProgress, recordCompletion, registryIds, starTotals } from './lib/progress.mjs';
import { MAX_STARS } from './lib/scoring.mjs';
import { runPlay, validatePlay } from './lib/play.mjs';
import { buildRegistry } from './lib/registry.mjs';
import { createFeedbackClient } from './lib/feedback-client.mjs';
import { createFeedbackDialog } from './lib/feedback-dialog.mjs';
import { createSaveDialog } from './lib/save-dialog.mjs';
import { loadProgress, saveProgress, STORAGE_KEY } from './lib/storage.mjs';
import { continueView, hubActs } from './lib/hub-view.mjs';
import { levelState, lockReason } from './lib/unlock.mjs';

// ?mode=debug shows the globe with everything finished (#309): a progress where every level is done.
function allDone(registry) {
  const progress = { ...emptyProgress(), levels: {} };
  for (const id of registry.order) progress.levels[id] = { stars: 0, at: null };
  return progress;
}

// A star row always shows MAX_STARS glyphs: `n` filled, the rest empty.
const starGlyphs = (n) => '★'.repeat(n) + '☆'.repeat(MAX_STARS - n);

/**
 * The shipped registry: levels/index.mjs checked against the deck and the `lights` ids.
 * `acts` / `deck` default to the real ones; tests pass fixtures through the same checks.
 */
export function liveRegistry(acts = ACTS, deck = DECK) {
  return buildRegistry(acts, { deck, nodeIds: NODE_IDS, play: { validatePlay, runPlay } });
}

// Player-facing text for every non-null game.notice (§4 Absence).
export const NOTICES = Object.freeze({
  corrupt:
    'Your saved progress could not be read, so this is a fresh start. The old data is kept as a backup the next time you finish a level.',
  future:
    'Your progress was saved by a newer version of the game. Reload the page to get it; nothing is saved from this tab until then.',
  unavailable:
    'This browser is not letting the game save (private mode or full storage). Progress lasts until you close the tab.',
});

// The wait before the one retry after a 429 is capped here.
const MAX_RETRY_S = 60;
// GET /api/account itself failed: said for everyone, including a browser that never signed in.
const ACCOUNT_LOAD_FAILED = 'Sign-in and the leaderboard are unavailable right now; your progress is still saved in this browser.';
const ACCOUNT_LIMITED = 'Too many changes just now. Wait up to an hour and try again.';
const SYNC_PAUSED = 'Saving to your account is paused for a moment; your progress is safe in this browser';

// The hideHelp key of the sign-in nudge (its own "Don't ask again").
export const NUDGE_KEY = 'signin-nudge';

// What `?signin=` says (main.mjs strips it after reading it); any other value says nothing.
export const SIGNIN_NOTICES = Object.freeze({
  failed: 'Sign-in did not work. Try again.',
  domain: 'Sign-in is for @dash0.com Google accounts only.',
  cancelled: 'Sign-in was cancelled.',
  unavailable: 'Sign-in is unavailable right now. Your progress is still saved in this browser.',
});

// Nickname refusals (POST /api/account 400 or 409).
const NICK_ERRORS = Object.freeze({
  taken: 'That nickname is taken.',
  format: 'Use 3 to 20 letters, digits, - or _, starting with a letter or digit.',
  reserved: 'That nickname is not available.',
  blocked: 'That nickname is not available.',
});

// The glyph that leads an act row and a level's status, per state; a shape as well as a colour (aria-hidden: the words carry the state).
const ACT_MARKS = Object.freeze({ saved: '\u2713', current: '\u25B6', incident: '!', open: '\u25CB', locked: '\uD83D\uDD12', soon: '\u00B7' });
const LEVEL_MARKS = Object.freeze({ done: '\u2713', open: '\u25B6', locked: '\uD83D\uDD12' });
const LEVEL_WORDS = Object.freeze({ done: 'Play again', open: 'Start', locked: 'Locked' });

// Screen-reader wording for each levelState.
const STATE_LABELS = Object.freeze({
  locked: 'locked',
  open: 'ready to play',
  done: 'done, play again',
});

// <input> types that take no text: Escape on them still closes the level.
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file']);

/**
 * The kit modals (index.html `.ui-modal`), the one list scrollLocked, openModalSelector, dialogOpen, the overlay's
 * inert binding and onEscape all derive from (#378). Table order is the Tab-trap priority (openModalSelector: the first
 * open entry wins). A new kit modal is one entry here plus its markup (test/modals-table.test.mjs checks they agree).
 *  - id: the modal's element id; flag: the game state that shows it; close: the game method that closes it.
 *  - overLevel: it sits over an open level, so it is not a dialogOpen (the level already is) and it makes `.overlay` inert.
 *  - escape: its place in the Escape order (lowest first, after the reward card); the Escape order differs from the
 *    Tab-trap order (About closes before How to play), so it is its own field; needsLevel: it only closes on Escape
 *    while a level is open (How to play opens beside the level; the level's own Escape closes it last).
 */
export const MODALS = Object.freeze([
  { id: 'feedback-modal', flag: 'feedbackOpen', close: 'closeFeedback', overLevel: true, escape: 1, needsLevel: false },
  { id: 'howto-modal', flag: 'howToOpen', close: 'closeHowTo', overLevel: true, escape: 6, needsLevel: true },
  { id: 'save-modal', flag: 'saveOpen', close: 'closeSave', overLevel: false, escape: 3, needsLevel: false },
  { id: 'board-modal', flag: 'boardOpen', close: 'closeBoard', overLevel: false, escape: 4, needsLevel: false },
  { id: 'account-modal', flag: 'accountOpen', close: 'closeAccount', overLevel: false, escape: 5, needsLevel: false },
  { id: 'about-modal', flag: 'aboutOpen', close: 'closeAbout', overLevel: false, escape: 2, needsLevel: false },
  { id: 'primer-modal', flag: 'primerOpen', close: 'closePrimer', overLevel: false, escape: 7, needsLevel: false },
].map((m) => Object.freeze(m)));
const ESCAPE_ORDER = Object.freeze([...MODALS].sort((a, b) => a.escape - b.escape));

/** True when `el` is (inside) a text-entry control: textarea, select, contenteditable or a text-like input. */
function isTyping(el) {
  if (!el || typeof el.closest !== 'function') return false;
  const field = el.closest('input, textarea, select, [contenteditable]');
  if (field === null) return false;
  const tag = field.localName;
  if (tag === 'input') return !NON_TEXT_INPUTS.has((field.getAttribute('type') || 'text').toLowerCase());
  if (tag === 'textarea' || tag === 'select') return true;
  return field.getAttribute('contenteditable').toLowerCase() !== 'false';
}

const NUDGE_MS = 2600;
const CONFETTI = 40;
const STEP_CONTROLS = ['button', 'input', 'select', 'textarea'].map((t) => `#ov-body ${t}`).join(','); // the step's controls, for leaveHowTo
const FOCUS_FRAMES = 10; // focusSoon waits at most this many frames for its target to be shown

/**
 * The Alpine component data for the hub. deps: { registry (§2.4), storage (getter for a
 * Storage), document, window?, deck?, globe? ((host, view) → Promise of a globe handle or
 * null; lib/globe-render.mjs mountGlobe in the browser), globeMap? ({ACT_REGIONS,
 * LEVEL_COUNTRY, COUNTRY_NAMES, actOf}), dots?, comingSoon? (acts shown but not playable, hub/coming-soon.mjs), now?, rand?, reduceMotion? (() → boolean), reportError?,
 * primers? (the act primers, content/core/primers; none by default, main.mjs passes PRIMERS; an invalid one has no tile and is reported once),
 * glossary? (the joined glossary, content/core/glossary; main.mjs passes GLOSSARY. The primers' term markers (#429) must name its terms, else the primer is invalid; the primer shows each term's definition in place. Default null: markers are only syntax-checked and read as plain words),
 * fetch? (the page's fetch: asks GET /api/guide once at init whether the guide is on; without it there is no guide), telemetry? (lib/telemetry.mjs facade; completions emit a level.complete span), setTimeout?, clearTimeout?, debug? (boolean, ?mode=debug: every level opens, nothing is saved) }. Without `globe` the hub shows the globe's text fallback.
 */
export function createGame(deps) {
  const {
    registry,
    storage,
    document: doc,
    window: win = null,
    deck = DECK,
    globe: mountGlobe = null,
    globeMap = { ACT_REGIONS, LEVEL_COUNTRY, COUNTRY_NAMES, actOf: actOfCountry },
    dots = [...DOTS, ...islandDots()],
    comingSoon = COMING_SOON,
    now = Date.now,
    rand = Math.random,
    reduceMotion = () => false,
    reportError = (e) => console.error(e),
    setTimeout: later = globalThis.setTimeout,
    clearTimeout: cancel = globalThis.clearTimeout,
    // Next animation frame (focusSoon's retry); falls back to a timer where there is none.
    raf = (fn) => (win && typeof win.requestAnimationFrame === 'function' ? win.requestAnimationFrame(fn) : later(fn, 16)),
    // Is the element laid out (not display:none)? An environment with no layout API counts as rendered.
    rendered = (el) => typeof el.getClientRects !== 'function' || el.getClientRects().length > 0,
    debug = false,
    primers = [],
    glossary = null,
    telemetry = null,
    play = null, // lib/play-telemetry.mjs (docs/GAME-EVENTS.md): the owner's play events, never the player's lab
    fetch: request = null,
    signin = null, // the `?signin=` value main.mjs read once (and stripped from the URL)
  } = deps;
  const report = (e) => {
    try {
      reportError(e);
    } catch {
      // nothing left to tell
    }
    try {
      play?.error(e);
    } catch {
      // play events never get in the way
    }
  };
  const cardFront = Object.fromEntries(deck.map((c) => [c.id, c.front]));
  // Ask the guide (#17): the status is fetched once, at init; a level opened before it arrives, or when it
  // failed, has no panel. ?mode=debug is no exception, so the panel can be tried locally.
  const guideClient = typeof request === 'function' ? createGuideClient({ fetch: request }) : null;
  // The account client (#273): without a fetch, or in debug, the game never asks and nothing changes.
  const accountClient = typeof request === 'function' && debug !== true ? createAccountClient({ fetch: request }) : null;
  // Level feedback (#370): without a fetch, or in debug, the game never asks the server (debug still shows the button, and never sends).
  const feedbackClient = typeof request === 'function' && debug !== true ? createFeedbackClient({ fetch: request }) : null;
  let feedbackDialog = null;
  let liveCtx = null; // the open level's ctx, read for the screen the player is on
  let syncing = null; // the running sync chain
  let syncAgain = false; // a sync was asked for while one ran
  let nudgeShown = false; // the sign-in nudge shows at most once per page session
  let retrying = false; // a 429 retry is scheduled or running (one per pause)
  let nudgeAsked = 0; // bumps on every nudge request, so a stale leaderboard answer is dropped
  let dontAsk = false; // "Don't ask again" for this visit, even when storage refused the write
  const loaded = loadProgress(storage, registry);
  // The open level's AbortController; aborting it makes that ctx's finish a no-op.
  let session = null;
  let nudgeTimer = null;
  let saveDialog = null;
  // The drawn globe's handle, outside the component so Alpine never proxies three.js objects;
  // `mounts` counts mount requests, so a mount that resolves after a newer one (or after the
  // hub was hidden) is disposed instead of kept.
  let globe = null;
  let mounts = 0;
  // What the last completion freshly lit, until Back to the map plays it; and an ignite asked
  // for before the globe finished loading.
  let pendingLit = null;
  let queuedIgnite = null;
  // How to play cards: the widget keys whose card was closed or hidden since the page loaded.
  // Close lasts until reload; Don't show again also lands here, so a blocked or full storage
  // (or debug, which writes nothing) still hides the card for this visit.
  const seenHelp = new Set();
  const NO_HOW_TO = Object.freeze({ topics: Object.freeze([]) });
  // Act primers (#389): built once, the valid ones by act; a broken one has no tile and is reported once. seenPrimers is the
  // acts whose primer opened this visit (it pops by itself at most once), also when storage is blocked or in debug.
  const primerBuild = buildPrimers(primers, registry, glossary);
  if (primerBuild.errors.length > 0) report(new Error(`act primers: ${primerBuild.errors.join('; ')}`));
  const seenPrimers = new Set();
  // The definitions of the glossary terms a primer marks (#429): wired after each draw, closed when the primer closes.
  const termPops = createTermPopovers({ document: doc });

  return {
    debug: debug === true,
    rewardDebug: false,
    progress: loaded.progress,
    notice: loaded.status === 'fresh' || loaded.status === 'ok' ? null : loaded.status,
    acts: [
      ...registry.acts.map((a) => ({
        id: a.id,
        no: a.no,
        name: a.name,
        title: `Act ${a.no}: ${a.name}`,
        sub: a.sub,
        ids: [...a.levelIds, ...(a.bossId ? [a.bossId] : [])],
        soon: false,
        teaser: a.teaser,
        badges: badgeViews(a.badges),
      })),
      ...comingSoon.map((a) => ({
        id: a.id,
        no: a.no,
        name: a.name,
        title: `Act ${a.no}: ${a.name}`,
        sub: a.sub,
        ids: [],
        soon: true,
        teaser: a.teaser,
        badges: [],
      })),
    ].sort((a, b) => a.no - b.no),
    overlayOpen: false,
    overlayTitle: '',
    overlayNo: '',
    currentLevelId: null,
    actOverrides: {}, // act id -> bool: the player's fold choice, memory only (never stored)
    openedFrom: 'card', // who opened the current level: 'card' or 'continue' (returnTarget)
    nudgeId: null,
    rewardOpen: false,
    aboutOpen: false,
    saveOpen: false,
    feedbackOn: false, // the server has feedback on (GET /api/feedback, asked once at init)
    feedbackOpen: false,
    aboutSummary: GAME_SUMMARY,
    aboutLoop: GLOBE_LOOP,
    howTo: NO_HOW_TO,
    howToOpen: false,
    howToAuto: false, // the card opened by itself as the level started: closing it returns to the step, not the header button (#351)
    howToFlagKey: null, // a type that turned up mid-level with an unseen guide: the header button says so (#321)
    helpRev: 0, // bumped when another tab changes the stored help choices (onStorage)
    howToNote: '', // the polite announcement of that flag
    howToKey: null, // the widget of the step on screen: the one guide the modal shows (#316)
    primerOpen: false, // the entry pop-up (the overview, always screen -1)
    primerZoneOpen: false, // the full-screen zone of chapters; never open together with the pop-up
    primerActId: null,
    primerScreen: -1, // -1 the pop-up's overview, 0..N-1 the zone's chapters
    primerThen: null, // the level to start when the player leaves the primer forward (set when a level opened it)
    primerFrom: 'card', // who asked for that level: 'card' or 'continue'
    primerOpener: null, // the selector focus goes back to on close
    primerRev: 0, // bumped on every primer write and when another tab changes the stored primers (onStorage)
    rewardTitle: '',
    rewardText: '',
    rewardStars: null,
    rewardCards: [],
    globeFallback: false,
    // Sign-in and saved progress (#273). account.state: 'unknown' until GET /api/account answers, then
    // 'unconfigured' | 'signedOut' | 'signedIn' | 'unavailable'. Nothing shows unless signedOut or signedIn.
    account: { state: 'unknown', nick: '', listed: false },
    accountStars: null, // the server's stars for this player; null before the first write (say "no stars yet", never 0)
    accountRank: null,
    accountKnown: false, // true only while accountStars / accountRank are the server's current answer (a sync succeeded and none failed since)
    accountEpoch: 0, // bumped when the session ends, so an answer to an older session is dropped
    accountNotice: '', // text when the account could not be reached; progress is still saved here
    signinStatus: debug !== true && (Object.hasOwn(SIGNIN_NOTICES, signin) || signin === 'new') ? signin : null,
    signinNudgeOpen: false,
    signinNudgeText: '',
    boardOpen: false,
    board: { state: 'loading', size: 0, top: [], me: null },
    accountOpen: false,
    confirmDelete: false,
    litNote: '', // "Germany is now lit: The signals.": the polite announcement and the fallback's first line

    init() {
      win?.addEventListener('storage', (e) => this.onStorage(e));
      // Leaving the page (or entering the back/forward cache) frees the WebGL context.
      win?.addEventListener('pagehide', (e) => {
        this.hideGlobe();
        // Every pagehide ends the open play (a page that goes to the back/forward cache may never be
        // seen again); pageshow starts a fresh play if it comes back mid-level.
        play?.abandon();
        play?.flush({ final: true });
      });
      win?.addEventListener('pageshow', (e) => {
        if (e?.persisted) {
          this.showGlobe();
          if (session) play?.begin(this.currentLevelId);
        }
      });
      doc.addEventListener?.('visibilitychange', () => {
        if (doc.visibilityState === 'hidden') play?.flush({ final: true });
      });
      play?.init();
      this.showGlobe();
      guideClient?.status();
      feedbackClient?.status().then((on) => { this.feedbackOn = on; });
      this.loadAccount();
    },
    // Alpine calls this when the component is torn down.
    destroy() {
      this.hideGlobe();
    },

    // ---------- account (#273) ----------
    // True when the account UI shows: configured (the server said so), not debug.
    get accountEnabled() {
      return !this.debug && (this.account.state === 'signedOut' || this.account.state === 'signedIn');
    },
    get signedIn() {
      return !this.debug && this.account.state === 'signedIn';
    },
    // "Signed in as <nick>" for the hub, '' otherwise.
    signedInText() {
      return this.signedIn ? `Signed in as ${this.account.nick}` : '';
    },
    // The hub's account line: the server's stars and rank, only while known and current (nothing while the
    // first sync is in flight or after one failed); "no stars yet" when the server has none, never 0.
    accountSummary() {
      if (!this.signedIn || !this.accountKnown) return '';
      return this.accountRank === null ? starsText(this.accountStars) : `${starsText(this.accountStars)}, #${this.accountRank}`;
    },
    // The notice for `?signin=`: the welcome (`new`, a profile just made) needs the nickname, so it waits for
    // GET /api/account; `ok` (a returning player) says nothing. It claims a board place only for a known star.
    signinNoticeText() {
      if (this.signinStatus === null) return '';
      if (this.signinStatus !== 'new') return SIGNIN_NOTICES[this.signinStatus];
      if (!this.signedIn) return '';
      if (!this.account.listed) return `Signed in as ${this.account.nick}.`;
      if (!this.accountKnown) return `Signed in as ${this.account.nick}. Change your nickname or hide yourself in Account.`; // stars unknown: promise nothing
      const onBoard = this.accountKnown && Number.isInteger(this.accountStars) && this.accountStars >= 1;
      return onBoard
        ? `You're on the leaderboard as ${this.account.nick}. Change your nickname or hide yourself in Account.`
        : `You'll appear on the leaderboard as ${this.account.nick} once you earn a star. Change your nickname or hide yourself in Account.`;
    },
    dismissSigninNotice() {
      this.signinStatus = null;
      this.focusSoon('#save-open'); // the dismissed notice held focus; the Save code button in the header is stable
    },
    // GET /api/account, once per page (init); the only request an anonymous or unconfigured visit makes.
    async loadAccount() {
      if (!accountClient) return;
      const res = await accountClient.account();
      if (res.state === 'unavailable') {
        this.account = { state: 'unavailable', nick: '', listed: false };
        this.accountNotice = ACCOUNT_LOAD_FAILED;
        return;
      }
      this.account = { state: res.state, nick: res.nick ?? '', listed: res.listed ?? false };
      if (res.state === 'signedIn') await this.syncProgress();
    },
    // POST this browser's progress to the account and save the merged answer locally (saveProgress).
    // One at a time; a request that arrives mid-sync runs once more after it. Never when not signed in.
    syncProgress() {
      if (!accountClient || !this.signedIn) return Promise.resolve();
      if (syncing) {
        syncAgain = true;
        return syncing;
      }
      syncing = (async () => {
        do {
          syncAgain = false;
          await this.syncOnce();
        } while (syncAgain && this.signedIn);
      })().finally(() => {
        syncing = null;
      });
      return syncing;
    },
    // True when the session an answer was asked under has ended (sign-out, delete, 401): drop that answer.
    staleAnswer(epoch) {
      return epoch !== this.accountEpoch || !this.signedIn;
    },
    async syncOnce() {
      const epoch = this.accountEpoch;
      const res = await accountClient.syncProgress(this.progress);
      if (this.staleAnswer(epoch)) return; // signed out or deleted while it was in flight
      this.accountKnown = false; // current only once this answer is ok
      if (res.state === 'signedOut') {
        this.endAccountSession();
        return;
      }
      if (res.state === 'limited') {
        this.accountNotice = SYNC_PAUSED; // the local copy is already saved; one retry after the wait
        if (!retrying) {
          retrying = true;
          later(async () => {
            try {
              await this.syncProgress();
            } finally {
              retrying = false;
            }
          }, Math.min(res.retryAfterS, MAX_RETRY_S) * 1000);
        }
        return;
      }
      if (res.state !== 'ok') {
        this.accountNotice = ACCOUNT_UNAVAILABLE; // the local copy is already saved
        return;
      }
      this.accountNotice = '';
      this.accountKnown = true;
      this.accountStars = res.stars;
      this.accountRank = res.rank;
      const saved = saveProgress(storage, res.progress, registry);
      if (saved.saved) {
        this.progress = saved.progress;
        this.refreshGlobe();
      } else this.notice = saved.reason;
    },

    // The nudge after a win: signed out, not debug, once per page session, not hidden. It waits for the
    // leaderboard so its copy is complete (debug has no account client, so it never gets here); a failed board gives the plain "Sign in to save your progress".
    async maybeSigninNudge() {
      if (!accountClient || this.account.state !== 'signedOut' || nudgeShown || dontAsk) return;
      if (readHiddenHelp(storage).hidden.has(NUDGE_KEY)) return;
      nudgeShown = true;
      const ask = ++nudgeAsked;
      const board = await accountClient.leaderboard();
      if (ask !== nudgeAsked || !this.rewardOpen || this.account.state !== 'signedOut') return;
      this.signinNudgeText = nudgeText(board);
      this.signinNudgeOpen = true;
    },
    // Not now: gone for this page session (the flag already says so).
    dismissSigninNudge() {
      nudgeAsked++;
      this.signinNudgeOpen = false;
      this.focusSoon(this.rewardFocus()); // the nudge's own button held focus
    },
    // Don't ask again: stored under hideHelp, and always hidden for this visit.
    hideSigninNudge() {
      dontAsk = true;
      if (!this.debug) hideHelp(storage, [NUDGE_KEY]);
      this.dismissSigninNudge();
    },

    // The board modal (#board-modal draws into #board-body): the top 10 and "You: N stars, #r".
    async openBoard() {
      if (!this.accountEnabled || this.dialogOpen()) return false;
      this.board = { state: 'loading', size: 0, top: [], me: null };
      this.boardOpen = true;
      this.renderBoard();
      this.focusSoon('#board-title');
      const res = await accountClient.leaderboard();
      if (!this.boardOpen) return true;
      this.board = res;
      this.renderBoard();
      return true;
    },
    renderBoard() {
      const host = doc.getElementById('board-body');
      if (host) host.innerHTML = boardHtml(this.board);
    },
    closeBoard() {
      if (!this.boardOpen) return;
      this.boardOpen = false;
      this.focusSoon('#board-open');
    },

    // The account modal (#account-modal draws into #account-body): nickname, listing, sign out, delete.
    openAccount() {
      if (!this.signedIn || this.dialogOpen()) return false;
      this.confirmDelete = false;
      this.accountOpen = true;
      this.renderAccount();
      this.focusSoon('#account-title');
      return true;
    },
    closeAccount() {
      if (!this.accountOpen) return;
      this.accountOpen = false;
      this.confirmDelete = false;
      this.focusSoon('#account-open');
    },
    renderAccount() {
      const host = doc.getElementById('account-body');
      if (!host) return;
      host.innerHTML = accountHtml({ nick: this.account.nick, listed: this.account.listed, confirmDelete: this.confirmDelete });
      const on = (id, fn) => {
        const el = host.querySelector(`#${id}`);
        if (el) el.onclick = fn;
      };
      on('account-nick-save', () => this.saveNickname(host.querySelector('#account-nick')?.value ?? ''));
      on('account-listed', () => this.setListing(host.querySelector('#account-listed')?.checked === true));
      on('account-signout', () => this.signOut());
      on('account-delete', () => {
        this.confirmDelete = true;
        this.renderAccount();
        this.focusSoon('#account-delete-no'); // the Delete button is gone; land on the least destructive choice
      });
      on('account-delete-no', () => {
        this.confirmDelete = false;
        this.renderAccount();
        this.focusSoon('#account-delete');
      });
      on('account-delete-yes', () => this.deleteAccount());
    },
    accountSay(tone, text) {
      const el = doc.getElementById('account-feedback');
      if (el) setFeedback(el, tone, escapeHtml(text));
    },
    // A refused account action: a lost session closes the modal; anything else is said in place.
    accountRefused(res) {
      if (res.state === 'signedOut') {
        this.endAccountSession();
        return;
      }
      if (res.state === 'limited') {
        this.accountSay('error', ACCOUNT_LIMITED);
        return;
      }
      const why = res.state === 'taken' ? 'taken' : res.state === 'invalid' ? res.reason : null;
      this.accountSay('error', why === null ? ACCOUNT_UNAVAILABLE : NICK_ERRORS[why] ?? NICK_ERRORS.format);
    },
    endAccountSession() {
      this.account = { state: 'signedOut', nick: '', listed: false };
      this.accountEpoch++;
      this.accountKnown = false;
      this.accountStars = null;
      this.accountRank = null;
      this.accountNotice = '';
      // The opener (#account-open) is hidden once signed out: focus the board button, else Save code.
      if (!this.accountOpen) return;
      this.accountOpen = false;
      this.confirmDelete = false;
      this.focusSoon(this.accountEnabled ? '#board-open' : '#save-open');
    },
    async saveNickname(nick) {
      const trimmed = String(nick).trim();
      if (!NICK_RE.test(trimmed)) return this.accountSay('error', NICK_ERRORS.format); // no request; reserved and blocked names are the server's
      const epoch = this.accountEpoch;
      const res = await accountClient.setNickname(trimmed);
      if (this.staleAnswer(epoch)) return;
      if (res.state !== 'ok') return this.accountRefused(res);
      this.account = { ...this.account, nick: res.nick ?? String(nick).trim() };
      this.accountSay('success', 'Nickname saved.');
    },
    async setListing(listed) {
      const epoch = this.accountEpoch;
      const res = await accountClient.setListing(listed);
      if (this.staleAnswer(epoch)) return;
      if (res.state !== 'ok') {
        const box = doc.getElementById('account-listed');
        if (box) box.checked = this.account.listed === true; // the server did not accept the click
        return this.accountRefused(res);
      }
      this.account = { ...this.account, listed: res.listed ?? listed };
      this.accountSay('success', this.account.listed ? 'You are on the leaderboard.' : 'You are hidden from the leaderboard.');
    },
    async signOut() {
      const epoch = this.accountEpoch;
      const res = await accountClient.signOut();
      if (this.staleAnswer(epoch)) return;
      if (res.state !== 'ok') return this.accountRefused(res);
      this.endAccountSession();
    },
    async deleteAccount() {
      const epoch = this.accountEpoch;
      const res = await accountClient.deleteAccount();
      if (this.staleAnswer(epoch)) return;
      if (res.state !== 'ok') return this.accountRefused(res);
      this.endAccountSession();
    },

    // ---------- derived ----------
    get hasLevels() {
      return registry.order.length > 0;
    },
    get stars() {
      return starTotals(this.progress, registry);
    },
    get cards() {
      return cardTotals(this.progress, registry);
    },
    noticeText() {
      return this.notice ? NOTICES[this.notice] ?? '' : '';
    },
    level(id) {
      return registry.levels[id];
    },
    // The one debug override: a known level the rules lock is open (lib/unlock.mjs is untouched).
    levelState(id) {
      const state = levelState(id, this.progress, registry);
      return this.debug && state === 'locked' && Object.hasOwn(registry.levels, id) ? 'open' : state;
    },
    // A class string, never a mixed :class array (Alpine renders "[object Object]").
    levelClasses(id) {
      return this.levelState(id) + (this.isNextUp(id) ? ' next' : '') + (this.nudgeId === id ? ' nudge' : '');
    },
    // ---------- continue ----------
    // The Continue button, read fresh each time (lib/hub-view.mjs): null in debug, when all is done, with no levels.
    continueView() {
      return continueView(registry, this.progress, { debug: this.debug });
    },
    continueLabel() {
      return this.continueView()?.label ?? '';
    },
    // Recomputed on the click, never taken from what was drawn; refused behind a dialog like any card.
    continueNext() {
      const next = this.continueView();
      return next !== null && this.openLevel(next.levelId, 'continue') !== false; // openLevel refuses behind a dialog
    },
    // The one card Continue would open (the Next up chip and class); none in debug.
    isNextUp(id) {
      return this.continueView()?.levelId === id;
    },
    levelLabel(id) {
      const l = registry.levels[id];
      const head = l.kind === 'boss' ? 'Incident' : l.no;
      const sub = l.sub ? ` ${endSentence(l.sub)}` : '';
      return `${head}: ${endSentence(l.name)}${sub} ${STATE_LABELS[this.levelState(id)]}${this.isNextUp(id) ? ', next up' : ''}`;
    },
    // The card subtitle: the lock reason while nudged, else the level's sub.
    levelSub(id) {
      return this.nudgeId === id ? this.lockText(id) : registry.levels[id].sub;
    },
    lockText(id) {
      const why = lockReason(id, this.progress, registry);
      if (why === null) return '';
      if (why.kind === 'act') {
        const act = registry.acts.find((a) => a.id === why.actId);
        return `Finish "${act.name || act.id}" first to unlock this act.`;
      }
      if (why.kind === 'boss') {
        const names = why.remaining.map((r) => `"${registry.levels[r].name}"`).join(', ');
        return `Finish ${names} first to take on this incident.`;
      }
      return 'This level is not available in this version.';
    },
    starText(id) {
      return starGlyphs(this.progress.levels[id]?.stars ?? 0);
    },
    starSummary() {
      const { earned, max } = this.stars;
      return `${earned} of ${max} stars`;
    },
    // ---------- globe ----------
    // The progress the globe reads: the real one, or in ?mode=debug every level done. Cards, stars and storage never see it.
    globeProgress() {
      return this.debug ? allDone(registry) : this.progress;
    },
    mapState() {
      return globeState(registry, this.globeProgress(), globeMap, comingSoon);
    },
    // The globe's accessible name: levels done, regions lit, any open incident.
    mapLabel() {
      return globeLabel(this.mapState());
    },
    // The one-line story under the globe ('' when no act has a region).
    captionText() {
      return globeCaption(registry, this.mapState())?.text ?? '';
    },
    // The map key: one entry per kind of dot drawn now (lib/globe-view.mjs globeLegend).
    globeLegend() {
      if (globeCaption(registry, this.mapState()) === null) return [];
      return globeLegend(dotStates(this.mapState(), dots, globeMap.actOf), dots, globeMap.actOf);
    },
    // The swatch class of a key entry: the incident key reuses the pulse swatch, the dark key the plain one.
    legendKeyClass(e) {
      const swatch = e.key === 'incident' ? 'pulse' : e.key === 'dark' ? '' : e.key;
      return swatch ? `globe-key ${swatch}` : 'globe-key';
    },
    // The text fallback (no WebGL): one line per act with its region and progress.
    globeLines() {
      const lines = globeLines(registry, this.mapState());
      return this.litNote ? [this.litNote, ...lines] : lines;
    },
    // What the renderer draws: a DOT state per dot and the rotation facing the current act.
    globeView() {
      return {
        states: dotStates(this.mapState(), dots, globeMap.actOf),
        target: globeTarget(registry, this.globeProgress(), dots, globeMap.actOf),
      };
    },
    // Draw the globe into .globe-stage (once; the fallback stays once shown). Never while a
    // level covers the hub (a back/forward cache restore can ask then); closing it mounts.
    showGlobe() {
      if (globe || this.globeFallback || this.hubCovered()) return;
      const host = doc.querySelector('.globe-stage');
      if (!mountGlobe || !host) {
        this.globeFallback = true;
        return;
      }
      const token = ++mounts;
      const failed = (e) => {
        if (e) report(e);
        this.hideGlobe();
        this.globeFallback = true;
      };
      Promise.resolve()
        .then(() => mountGlobe(host, { ...this.globeView(), dots, reduced: !!reduceMotion(), onFail: () => failed() }))
        .then(
          (handle) => {
            if (token !== mounts) handle?.dispose();
            else if (handle) {
              globe = handle;
              if (queuedIgnite) handle.ignite(queuedIgnite.view, queuedIgnite.states);
              queuedIgnite = null;
            }
            else failed();
          },
          (e) => (token === mounts ? failed(e) : report(e)),
        );
    },
    // A level or the primer zone covers the hub (the globe is not drawn behind either).
    hubCovered() {
      return this.overlayOpen || this.primerZoneOpen;
    },
    // Stop the loop and free the WebGL context (a level or the primer zone covers the hub, or the page goes).
    hideGlobe() {
      mounts++;
      queuedIgnite = null;
      globe?.dispose();
      globe = null;
    },
    refreshGlobe() {
      if (!globe) return;
      const view = this.globeView();
      globe.update(view.states, view.target);
    },

    // ---------- dialogs ----------
    // The one answer to "is a dialog open": the hub goes inert and openLevel / openAbout
    // refuse while it is true. The over-a-level modals (How to play, feedback) are left out on purpose: they only
    // open over a level, which already counts.
    dialogOpen() {
      return this.overlayOpen || this.rewardOpen || this.primerZoneOpen || MODALS.some((m) => !m.overLevel && this[m.flag]);
    },
    // The level overlay is inert while a modal over it is open (the :inert binding in index.html).
    overlayInert() {
      return MODALS.some((m) => m.overLevel && this[m.flag]);
    },
    hubInert() {
      return this.dialogOpen();
    },
    // ---------- act folds (lib/hub-view.mjs hubActs) ----------
    // The row of a registry act (real progress, also in debug), or undefined for a coming-soon or unknown id.
    actRow(id) {
      return hubActs(registry, this.progress, { debug: this.debug, overrides: this.actOverrides }).find((r) => r.id === id);
    },
    // Folded or not: a registry act by its row, a coming-soon act unfolded unless toggled, an unknown id never.
    actExpanded(id) {
      const row = this.actRow(id);
      if (row !== undefined) return row.expanded;
      if (!this.acts.some((a) => a.id === id)) return false;
      return Object.hasOwn(this.actOverrides, id) ? this.actOverrides[id] === true : true;
    },
    // aria-expanded needs the string: Alpine drops an attribute bound to false.
    actExpandedAttr(id) {
      return this.actExpanded(id) ? 'true' : 'false';
    },
    // The act heading's one line: "Act 2: Traces, 2 of 8", "..., saved, 4 of 4", "Act 7: Later, coming soon".
    actLine(act) {
      if (act.soon) return `${act.title}, coming soon`;
      // No break inside "2 of 4": the count stays on one line when the title wraps.
      return (this.actRow(act.id)?.line ?? act.title).replace(/(\d+) of (\d+)$/, '$1\u00a0of\u00a0$2');
    },
    // One state per act row, for its mark and look: soon, saved, incident, current (the act Continue points into), open, locked (debug opens it).
    actState(act) {
      if (act.soon) return 'soon';
      const status = this.actRow(act.id)?.status ?? 'open';
      if (status === 'saved') return 'saved';
      if (status === 'locked') return this.debug ? 'open' : 'locked';
      if (status === 'incident') return 'incident';
      if (this.continueView() !== null && act.ids.includes(this.continueView().levelId)) return 'current';
      return status;
    },
    actMark(act) {
      return ACT_MARKS[this.actState(act)];
    },
    // The level status text with its leading glyph: "\u2713 Play again", "\u25B6 Start", "lock Locked".
    levelStatusText(id) {
      const state = this.levelState(id);
      return `${LEVEL_MARKS[state]} ${LEVEL_WORDS[state]}`;
    },
    // Fold or unfold one act (memory only, debug included); returns whether it is now expanded.
    toggleAct(id) {
      if (!this.acts.some((a) => a.id === id)) return false;
      const next = !this.actExpanded(id);
      this.actOverrides = { ...this.actOverrides, [id]: next };
      // Opening an act the player has never opened a primer for shows its overview, once (never on a fold).
      if (next && this.primerNew(id)) this.openPrimer(id, { opener: `#act-toggle-${id}` });
      return next;
    },
    // The About dialog: the game summary and one entry per act (live and coming soon), from act data.
    aboutActs() {
      return this.acts.map((a) => ({ id: a.id, title: a.title, sub: a.sub, teaser: a.teaser, soon: a.soon, badges: a.badges }));
    },
    openAbout() {
      if (this.dialogOpen()) return false;
      this.aboutOpen = true;
      this.focusSoon('#about-title');
      return true;
    },
    closeAbout() {
      if (!this.aboutOpen) return;
      this.aboutOpen = false;
      this.focusSoon('#about-open');
    },

    // ---------- save codes (#18) ----------
    // The Save code dialog: lib/save-dialog.mjs draws into #save-body (kit markup, wired with
    // el.onclick). Debug mode refuses to open it, so nothing is exported or imported.
    openSave() {
      if (this.debug || this.dialogOpen()) return false;
      saveDialog ??= createSaveDialog({
        registry,
        host: doc.getElementById('save-body'),
        doc,
        debug: this.debug,
        getProgress: () => this.progress,
        commit: (merged) => this.commitImport(merged),
        copy: (text) => {
          const clip = win?.navigator?.clipboard;
          return clip?.writeText ? clip.writeText(text).then(() => true, () => false) : false;
        },
        close: () => this.closeSave(),
      });
      saveDialog.open();
      this.saveOpen = true;
      this.focusSoon('#save-title');
      return true;
    },
    closeSave() {
      if (!this.saveOpen) return;
      this.saveOpen = false;
      saveDialog?.reset();
      this.focusSoon('#save-open');
    },
    // ---------- level feedback (#370) ----------
    // The Feedback button in the level overlay: shown when the server has it on, and always in debug (where Send says nothing was sent).
    feedbackShown() {
      return this.debug || this.feedbackOn;
    },
    // The dialog (#feedback-modal draws into #feedback-body, lib/feedback-dialog.mjs): only over an open level. It names the
    // level and the screen on show; the overlay is inert while it is open, so neither can change under the form.
    openFeedback() {
      if (!this.overlayOpen || this.howToOpen || this.rewardOpen || this.feedbackOpen || !this.currentLevelId) return false;
      feedbackDialog ??= createFeedbackDialog({
        host: doc.getElementById('feedback-body'),
        doc,
        debug: this.debug,
        send: (note) => feedbackClient?.send(note) ?? { kind: 'failed' },
        context: () => ({ levelId: this.currentLevelId, screen: Math.max(1, liveCtx?.screen ?? 1) }),
        close: () => this.closeFeedback(),
      });
      feedbackDialog.open();
      this.feedbackOpen = true;
      this.focusSoon('#feedback-title');
      return true;
    },
    closeFeedback() {
      if (!this.feedbackOpen) return;
      this.feedbackOpen = false;
      feedbackDialog?.reset();
      this.focusSoon('#ov-feedback-open');
    },

    // An import's merged record: saved like a completion (merged with what storage holds), and the
    // hub shows it. A refused save keeps it in memory for this visit, as a completion does.
    commitImport(merged) {
      const saved = saveProgress(storage, merged, registry);
      this.progress = saved.progress;
      this.notice = saved.saved ? null : saved.reason;
      this.refreshGlobe();
      this.syncProgress();
      return saved;
    },

    // ---------- levels ----------
    // A locked card wiggles and names what unlocks it (R's nudge) instead of doing nothing.
    // Refused while a level or the reward is open: the hub is inert then, and a stray
    // Enter must never abort a run. Close the level first (closeOverlay).
    // `from` is who opened it: 'card' or 'continue' (where focus goes back to, returnTarget).
    openLevel(id, from = 'card') {
      if (this.dialogOpen()) return false;
      if (this.levelState(id) === 'locked') {
        if (Object.hasOwn(registry.levels, id)) this.nudge(id);
        return false;
      }
      // The first level of an act with a primer the player has not met shows the primer instead; leaving it forward starts this level.
      const actId = registry.levels[id]?.actId;
      if (actId !== undefined && this.primerNew(actId)) {
        this.openPrimer(actId, { then: id, from });
        return false;
      }
      this.endSession();
      this.hideGlobe();
      this.litNote = '';
      this.nudgeId = null;
      const level = registry.levels[id];
      const controller = new AbortController();
      session = controller;
      this.currentLevelId = id;
      play?.begin(id);
      this.openedFrom = from;
      this.overlayTitle = level.name;
      this.overlayNo = level.kind === 'boss' ? 'Incident' : level.no ? `Level ${level.no}` : '';
      this.overlayOpen = true;
      // The guide is decided before the level runs, for the first widget it lists; the first step then
      // says which widget it really shows (onWidget) and each later step does too. Stored choices are
      // read at every decision, so another tab's Don't show again counts. A failed read shows the guide.
      this.howTo = howToView(level);
      this.howToKey = this.howTo.topics[0]?.key ?? null;
      this.howToOpen = this.howToKey !== null && this.howToNew(this.howToKey);
      this.howToAuto = this.howToOpen;
      let starting = true;
      const announced = new Set();
      const onWidget = (key) => {
        if (session !== controller || key === this.howToKey) return;
        if (!this.howTo.topics.some((t) => t.key === key)) return;
        this.howToKey = key;
        this.howToNote = '';
        const fresh = this.howToNew(key);
        if (starting) {
          this.howToOpen = fresh;
          this.howToAuto = fresh;
        }
        else if (fresh) {
          // Mid-level: never a pop-up over the step. The header button is flagged; the note is said once per type.
          this.howToFlagKey = key;
          if (!announced.has(key)) {
            announced.add(key);
            this.howToNote = `New guide: ${this.howTo.topics.find((t) => t.key === key).title}. Open How to play to read it.`;
          }
        }
      };
      try {
        const ctx = liveCtx = createLevelContext({
          level,
          ovBody: doc.getElementById('ov-body'),
          ovActions: doc.getElementById('ov-actions'),
          now,
          shuffle: (arr) => kitShuffle(arr, rand),
          reduceMotion: !!reduceMotion(),
          onFinish: (levelId, result) => this.completeLevel(levelId, result),
          signal: controller.signal,
          reportError: report,
          telemetry,
          guide: guideClient && { configured: guideClient.configured, ask: guideClient.ask },
          onWidget,
          glossary,
          termPops,
        });
        level.run(ctx);
      } catch (e) {
        report(e);
      }
      starting = false;
      if (this.howToOpen) this.focusSoon('#ov-howto-title');
      else this.focusStepStart();
      return true;
    },

    nudge(id) {
      this.nudgeId = id;
      cancel(nudgeTimer);
      nudgeTimer = later(() => {
        this.nudgeId = null;
      }, NUDGE_MS);
    },

    // ---------- How to play modal ----------
    // A kit modal outside .overlay and the level's DOM: a step never wipes it. While it is open the
    // overlay is inert (index.html :inert="overlayInert()", from the MODALS table) and Tab stays inside (trapTab). Focus returns
    // to the header's How to play button when it closes.
    howToExpanded() {
      return this.howToOpen ? 'true' : 'false';
    },
    // The guides the modal shows: the one of the step on screen, as a list for the template's x-for.
    howToTopics() {
      const topic = this.howTo.topics.find((t) => t.key === this.howToKey);
      return topic ? [topic] : [];
    },
    howToTitle() {
      const [topic] = this.howToTopics();
      return topic ? `How to play: ${topic.title}` : 'How to play';
    },
    // True when this type's guide is neither seen this visit nor hidden for good.
    howToNew(key) {
      void this.helpRev; // read so Alpine re-checks after another tab changes the stored choice
      return !seenHelp.has(key) && !readHiddenHelp(storage).hidden.has(key);
    },
    // The header button's flag: this step's type is new to the player and its guide not yet opened.
    howToFlagged() {
      return this.howToFlagKey !== null && this.howToFlagKey === this.howToKey && this.howToNew(this.howToKey);
    },
    howToLabel() {
      return this.howToFlagged() ? 'How to play: new guide' : 'How to play';
    },
    toggleHowTo() {
      if (!this.overlayOpen || this.howToKey === null) return false;
      if (this.howToOpen) this.closeHowTo();
      else {
        this.howToFlagKey = null;
        this.howToNote = '';
        this.howToOpen = true;
        this.howToAuto = false;
        this.focusSoon('#ov-howto-title');
      }
      return true;
    },
    // Focus after the card closes: the step's first control when the card opened by itself (the player never
    // asked for it, so the header button is not where they were), else the How to play button that opened it.
    leaveHowTo() {
      if (!this.howToAuto) {
        this.focusSoon('#ov-howto-open');
        return;
      }
      this.howToAuto = false;
      this.focusStepStart();
    },
    // The step's first control through focusFirst (Back when it has none), once the overlay is rendered (#353).
    focusStepStart() {
      const go = () => {
        // Not a glossary term in the intro (#442): focusing it would open its definition. linkedom has no reliable :not(), so filter.
        const first = [...doc.querySelectorAll(STEP_CONTROLS)].find((el) => !el.closest('[data-term]')) ?? null;
        focusFirst(first, { fallback: doc.querySelector('#ov-back') });
      };
      if (typeof this.$nextTick === 'function') this.$nextTick(go);
      else go();
    },
    // Close: this type's guide is gone until the page reloads, nothing stored.
    closeHowTo() {
      if (!this.overlayOpen || !this.howToOpen) return;
      seenHelp.add(this.howToKey);
      this.howToNote = '';
      this.howToOpen = false;
      this.leaveHowTo();
    },
    // Don't show again: this type's guide only, stored per widget (not in debug), and always
    // hidden for this visit, whether or not the write went through.
    hideHowTo() {
      if (!this.overlayOpen || !this.howToOpen) return;
      seenHelp.add(this.howToKey);
      if (!this.debug) hideHelp(storage, [this.howToKey]);
      this.howToNote = '';
      this.howToOpen = false;
      this.leaveHowTo();
    },

    // ---------- Act primer modal ----------
    // A kit modal like How to play (outside .overlay, Tab trapped, hub inert, Escape closes, focus to the title and back to the
    // opener) over the hub; it never gates a level. The body is drawn into #primer-body (x-ignore) by lib/primer-view.mjs.
    primerFor(actId) {
      return primerBuild.byAct[actId] ?? null;
    },
    // The act's saved entry; reads primerRev so Alpine re-renders the tile after a write here or in another tab.
    primerStored(actId) {
      void this.primerRev;
      return readPrimers(storage).acts.get(actId);
    },
    // The hub tile for an act: {text, tone, isNew, label}, or null when the act has no (valid) primer.
    primerTile(actId) {
      const primer = this.primerFor(actId);
      return primer === null ? null : tileOf(primerStatus(primer, this.primerStored(actId)));
    },
    // The one routing rule: a new primer opens the short pop-up, any other the zone; null when the act has no primer.
    primerEntry(actId) {
      const primer = this.primerFor(actId);
      if (primer === null) return null;
      return primerStatus(primer, this.primerStored(actId)).status === 'new' ? 'popup' : 'zone';
    },
    // The id of what the hub tile opens (its aria-controls).
    primerTileControls(actId) {
      const entry = this.primerEntry(actId);
      return entry === null ? null : entry === 'popup' ? 'primer-modal' : 'primer-zone';
    },
    // True when the primer should pop by itself: it exists, did not open this visit and nothing is stored for it, and no dialog is open.
    primerNew(actId) {
      return this.primerEntry(actId) === 'popup' && !seenPrimers.has(actId) && !this.dialogOpen();
    },
    // Remember something about the primer: stored (never in debug), and the tile re-reads it.
    markPrimer(actId, change) {
      if (!this.debug) recordPrimer(storage, actId, change);
      this.primerRev++;
    },
    // The screen on show (lib/primer.mjs primerView), or null when closed.
    primerCurrent() {
      const primer = this.primerFor(this.primerActId);
      if (primer === null) return null;
      const then = this.primerThen;
      const thenName = then !== null ? registry.levels[then]?.name : undefined;
      return viewOf(primer, this.primerScreen, { then: then ?? undefined, thenName });
    },
    primerTitle() {
      return this.primerCurrent()?.title ?? 'Act primer';
    },
    // The zone's current chapter (lib/primer.mjs primerZoneView), or null when there is none; every zone helper reads this.
    primerZoneCurrent() {
      const primer = this.primerFor(this.primerActId);
      if (primer === null) return null;
      const then = this.primerThen;
      const thenName = then !== null ? registry.levels[then]?.name : undefined;
      return zoneViewOf(primer, this.primerScreen, this.primerStored(this.primerActId), { then: then ?? undefined, thenName, actNo: this.primerActNo() });
    },
    // The registry number of the act whose primer is open (undefined when none).
    primerActNo() {
      return registry.acts.find((a) => a.id === this.primerActId)?.no;
    },
    // The pop-up's eyebrow, from the same rule as the zone's (lib/primer.mjs primerEyebrow).
    primerEyebrow() {
      return eyebrowOf(this.primerActNo());
    },
    primerZoneTitle() {
      return this.primerZoneCurrent()?.title ?? '';
    },
    primerZoneEyebrow() {
      return this.primerZoneCurrent()?.eyebrow ?? 'Act primer';
    },
    primerZoneLabel() {
      return this.primerZoneCurrent()?.primerTitle ?? 'Act primer';
    },
    primerBackShown() {
      return this.primerZoneCurrent()?.back === true;
    },
    primerNextLabel() {
      return this.primerZoneCurrent()?.next ?? 'Next';
    },
    // Draw the current screen into the modal body, scrolled to the top.
    drawPrimer() {
      const view = this.primerCurrent();
      const body = doc.getElementById('primer-body');
      if (view === null || !body) return;
      body.innerHTML = primerBodyHtml(view, { draft: this.primerFor(this.primerActId).placeholder === true, glossary });
      termPops.wire(body);
      body.scrollTop = 0;
    },
    showPrimerScreen(screen) {
      this.primerScreen = screen;
      this.drawPrimer();
      this.focusSoon('#primer-title');
    },
    // Draw the zone's chapter and its list; each jump button is wired with onclick (the body is x-ignore, no Alpine in it).
    drawPrimerZone() {
      const view = this.primerZoneCurrent();
      const body = doc.getElementById('primer-zone-body');
      if (view === null || !body) return;
      body.innerHTML = primerZoneHtml(view, { draft: this.primerFor(this.primerActId).placeholder === true, glossary });
      termPops.wire(body);
      for (const c of view.chapters) {
        const el = doc.getElementById(`primer-go-${c.index}`);
        if (el) el.onclick = () => this.primerGo(c.index);
      }
    },
    // Show a chapter: draw, scroll to the top, focus the title.
    showPrimerZoneScreen(screen) {
      this.primerScreen = screen;
      this.drawPrimerZone();
      const body = doc.getElementById('primer-zone-body');
      if (body) body.scrollTop = 0;
      this.focusSoon('#primer-zone-title');
    },
    // Into the zone at chapter `screen`: the pop-up (if open) closes, the hub is covered so the globe is freed.
    enterPrimerZone(screen) {
      termPops.closeAll();
      this.primerOpen = false;
      this.primerZoneOpen = true;
      this.hideGlobe();
      this.primerScreen = screen;
      this.drawPrimerZone();
      this.focusSoon('#primer-zone-title');
    },
    // Open an act's primer: from the tile, from toggling the act open, or in place of a level (`then`: the level to start after it).
    // A new primer opens the short pop-up, any other the zone at its first unread chapter. Refused when a dialog is open or the act has none.
    openPrimer(actId, { then = null, from = 'card', opener = `#primer-open-${actId}` } = {}) {
      if (this.dialogOpen() || this.primerFor(actId) === null) return false;
      const entry = this.primerEntry(actId); // before markPrimer: marking it seen ends "new"
      seenPrimers.add(actId);
      this.markPrimer(actId, { seen: true });
      this.primerActId = actId;
      this.primerThen = then;
      this.primerFrom = from;
      this.primerOpener = opener;
      if (entry === 'popup') {
        this.primerOpen = true;
        this.showPrimerScreen(-1);
      } else this.enterPrimerZone(firstUnread(this.primerFor(actId), this.primerStored(actId)));
      return true;
    },
    // Leave forward: start the pending level (if any); otherwise the map shows again and focus goes back to the opener.
    leavePrimer() {
      termPops.closeAll();
      const then = this.primerThen;
      const from = this.primerFrom;
      const wasZone = this.primerZoneOpen;
      this.primerOpen = false;
      this.primerZoneOpen = false;
      this.primerThen = null;
      if (then !== null && this.openLevel(then, from)) return;
      if (wasZone) this.showGlobe();
      this.exitPrimer(then, from);
    },
    // The primer closed with no level starting: play a map reveal that was waiting (Continue from the reward can land here),
    // else focus goes to where the player came from, worked out now (another tab may have folded the act meanwhile).
    exitPrimer(then, from) {
      if (pendingLit) {
        this.revealLit();
        return;
      }
      const target = then !== null
        ? this.levelFocusTarget(then, from)
        : this.actExpanded(this.primerActId) ? this.primerOpener : `#act-toggle-${this.primerActId}`;
      if (target) this.focusSoon(target);
    },
    // "I am already familiar with the topic": noted as skipped, then the level.
    primerFamiliar() {
      if (!this.primerOpen || this.primerScreen !== -1) return;
      this.markPrimer(this.primerActId, { skipped: true });
      this.leavePrimer();
    },
    // "Proceed with learning": into the zone at the first unread chapter (the first for a new primer). Writes nothing.
    primerProceed() {
      if (!this.primerOpen || this.primerScreen !== -1) return;
      this.enterPrimerZone(firstUnread(this.primerFor(this.primerActId), this.primerStored(this.primerActId)));
    },
    // Next marks the chapter on screen read (leaving it, not entering it); the last one leaves the primer.
    primerNext() {
      const view = this.primerZoneCurrent();
      if (!this.primerZoneOpen || view === null) return;
      this.markPrimer(this.primerActId, { read: [view.id] });
      if (this.primerScreen >= this.primerFor(this.primerActId).chapters.length - 1) this.leavePrimer();
      else this.showPrimerZoneScreen(this.primerScreen + 1);
    },
    // Back records nothing; there is nothing before chapter 1 (the overview is in the pop-up).
    primerBack() {
      if (!this.primerZoneOpen || this.primerScreen <= 0) return;
      this.showPrimerZoneScreen(this.primerScreen - 1);
    },
    // A jump from the chapter list: records nothing.
    primerGo(i) {
      const total = this.primerFor(this.primerActId)?.chapters.length ?? 0;
      if (!this.primerZoneOpen || !Number.isInteger(i) || i < 0 || i >= total || i === this.primerScreen) return;
      this.showPrimerZoneScreen(i);
    },
    // The close button, the zone's back arrow and Escape: the pending level is dropped, focus returns to the opener.
    closePrimer() {
      if (!this.primerOpen && !this.primerZoneOpen) return;
      termPops.closeAll();
      const then = this.primerThen;
      const wasZone = this.primerZoneOpen;
      this.primerOpen = false;
      this.primerZoneOpen = false;
      this.primerThen = null;
      if (wasZone) this.showGlobe();
      this.exitPrimer(then, this.primerFrom);
    },

    // Abort the open level (its timers stop, a stale finish is a no-op) and clear its DOM.
    endSession() {
      play?.abandon(); // a no-op when the play already completed
      if (session) session.abort();
      session = null;
      liveCtx = null;
      termPops.closeAll(); // a level's open definition must not outlive it: its Escape handler would swallow the game's
      this.howTo = NO_HOW_TO;
      this.howToKey = null;
      this.howToFlagKey = null;
      this.howToNote = '';
      this.howToOpen = false;
      for (const id of ['ov-body', 'ov-actions']) {
        const el = doc.getElementById(id);
        if (el) el.innerHTML = '';
      }
    },

    closeOverlay() {
      this.endSession();
      this.overlayOpen = false;
      this.showGlobe();
      if (pendingLit) this.revealLit(); // a country lit before Continue from the reward: shown now
      else this.returnFocus();
    },

    // Called by the ctx with the id it captured at creation, never the level open now.
    completeLevel(levelId, result) {
      // First, before endSession() would record it as an abandon.
      play?.complete(levelId, result);
      play?.flush();
      const level = registry.levels[levelId];
      const rec = recordCompletion(this.progress, levelId, result, registry);
      this.rewardDebug = this.debug;
      const before = this.progress;
      if (!this.debug) {
        const saved = saveProgress(storage, rec.progress, registry);
        this.progress = saved.progress;
        // A save that went through clears corrupt (the backup now exists) and unavailable.
        this.notice = saved.saved ? null : saved.reason;
      }
      // A debug run saves nothing, so nothing is freshly lit and no ignite plays.
      const fresh = this.debug ? null : freshlyLit(before, this.progress, registry, globeMap);
      const text = fresh ? litText(fresh, level, globeMap) : null;
      // A reveal still pending (Continue from the reward skipped the map) joins this one; it plays when the player next reaches the map.
      if (text && pendingLit) {
        pendingLit = {
          fresh: {
            countryIds: [...new Set([...pendingLit.fresh.countryIds, ...fresh.countryIds])],
            regionIds: [...new Set([...pendingLit.fresh.regionIds, ...fresh.regionIds])],
          },
          text: `${pendingLit.text} ${text}`,
        };
      } else if (text) pendingLit = { fresh, text };
      this.endSession();
      this.overlayOpen = false;
      this.showGlobe();
      this.fireConfetti();
      this.rewardTitle = level?.rewardTitle ?? 'Level complete';
      this.rewardText = result.text;
      this.rewardStars = level?.scored ? result.stars : null; // this run's stars
      this.rewardCards = rec.newCards.map((c) => cardFront[c] ?? c);
      this.rewardOpen = true;
      this.focusSoon(this.rewardFocus());
      this.recordTelemetry(levelId, level, result);
      this.signinNudgeOpen = false;
      if (!this.debug) {
        if (this.signedIn) this.syncProgress();
        else this.maybeSigninNudge();
      }
    },

    // Telemetry never blocks play (docs/DASH0-LAB.md, Telemetry session): a span for the completion, then a
    // flush that is not awaited. Any failure is reported and nothing else happens.
    recordTelemetry(levelId, level, result) {
      try {
        if (!telemetry) return;
        telemetry.emit({
          name: 'level.complete',
          attributes: {
            'game.level.id': levelId,
            'game.act.id': level?.actId ?? 'unknown',
            'game.level.stars': result.stars, // the result's stars, never recomputed
            'game.cards.count': Array.isArray(result.cards) ? result.cards.length : 0,
            'game.debug': this.debug,
          },
        });
        Promise.resolve(telemetry.flush()).catch(report);
      } catch (e) {
        report(e);
      }
    },

    // The reward dialog's Continue button: the hub's Continue, same words and same level (continueView).
    rewardContinueLabel() {
      return this.continueLabel();
    },
    // Where focus starts in the reward dialog: Continue when it is offered, else Back to the map.
    rewardFocus() {
      return this.rewardContinueLabel() !== '' ? '#reward-continue' : '#reward-close';
    },
    // Straight to the next level: the dialog closes without the map reveal (it stays pending and plays when the
    // player next returns to the map), then the level opens like the hub's Continue.
    continueFromReward() {
      const next = this.continueView();
      if (!this.rewardOpen || next === null) return false;
      this.rewardOpen = false;
      nudgeAsked++;
      this.signinNudgeOpen = false;
      return this.openLevel(next.levelId, 'continue');
    },
    closeReward() {
      this.rewardOpen = false;
      nudgeAsked++; // a board reply still on its way must not open the nudge on a later card
      this.signinNudgeOpen = false;
      if (pendingLit) this.revealLit();
      else this.returnFocus();
    },
    // Back to the map after a first completion: scroll to the globe (smooth unless reduced
    // motion), focus the map heading, announce the country and turn the globe to it with the
    // ignite effect (the renderer skips the effect under reduced motion).
    revealLit() {
      const { fresh, text } = pendingLit;
      pendingLit = null;
      const reduced = !!reduceMotion();
      this.litNote = text;
      const go = () => {
        // The header (Save code, stars) is the top of the page and the map sits under it: scrolling to the map itself hid the header (#331).
        doc.querySelector('.hub-header')?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        doc.getElementById('map-title')?.focus?.({ preventScroll: true });
      };
      if (typeof this.$nextTick === 'function') this.$nextTick(go);
      else go();
      const view = igniteView(fresh, dots, globeMap.actOf);
      if (view === null) return;
      const states = dotStates(this.mapState(), dots, globeMap.actOf);
      if (globe) globe.ignite(view, states);
      else if (mounts > 0 && !this.globeFallback) queuedIgnite = { view, states };
    },
    rewardNote() {
      return this.rewardDebug ? 'Debug run: not saved.' : '';
    },
    /** The reward text as paragraphs: a level's closing text may hold a blank line between the story and the Dash0 how-to. */
    rewardParagraphs() {
      return String(this.rewardText).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    },
    rewardStarsText() {
      return this.rewardStars == null ? '' : starGlyphs(this.rewardStars);
    },
    rewardStarsLabel() {
      return this.rewardStars == null ? 'Not scored' : `${this.rewardStars} of ${MAX_STARS} stars`;
    },

    // Another tab saved: merge its progress in (progress only goes up, never replaced).
    onStorage(e) {
      if (e && (e.key === HELP_KEY || e.key === null)) {
        this.helpRev++;
        if (!this.howToFlagged()) this.howToNote = '';
      }
      if (e && (e.key === PRIMER_KEY || e.key === null)) this.primerRev++;
      if (e && e.key !== STORAGE_KEY && e.key !== null) return;
      const { status, progress: other } = loadProgress(storage, registry);
      if (status === 'future') this.notice = 'future';
      this.progress = mergeProgress(this.progress, other, { keep: registryIds(registry) });
      this.refreshGlobe();
    },

    // The page behind an open kit modal must not scroll: a class on <html> (index.html x-effect keeps it
    // in step with the modal flags; the rule is in base.css, never an inline style).
    scrollLocked() {
      return MODALS.some((m) => this[m.flag]);
    },
    syncScrollLock() {
      doc.documentElement.classList.toggle('modal-open', this.scrollLocked());
    },
    // Tab (and Shift+Tab) wrap inside the open kit modal; the page behind is inert, so without this
    // focus would fall out to the browser's own controls. The level overlay and the reward card are trapped too (trapSelector).
    openModalSelector() {
      const open = MODALS.find((m) => this[m.flag]);
      return open ? `#${open.id}` : null;
    },
    // An open level (or the reward) keeps Tab too, at any width (#327): the hub behind is inert, and
    // without a trap Tab would leave for the browser's own controls and come back on the hub or body.
    trapSelector() {
      const modal = this.openModalSelector();
      if (modal !== null) return modal;
      if (this.rewardOpen) return '.reward-card';
      if (this.primerZoneOpen) return '#primer-zone';
      return this.overlayOpen ? '.overlay' : null;
    },
    trapTab(e) {
      const sel = this.trapSelector();
      return sel === null ? false : trapTab(e, doc.querySelector(sel), doc);
    },

    // One window-level Escape handler: closes the reward first, then one modal in the MODALS escape order, and the level last, but never the
    // level while the player is typing in it. A widget that handled the Escape (it called
    // preventDefault, e.g. Build it cancelling a pick) owns it.
    onEscape(e) {
      if (e?.defaultPrevented) return;
      if (this.rewardOpen) {
        this.closeReward();
        return;
      }
      // The modals in MODALS' escape order; an over-a-level one (feedback) closes alone, leaving the level open.
      // A needsLevel one (How to play) only counts while a level is open, and the level itself comes after it.
      for (const m of ESCAPE_ORDER) {
        if (!this[m.flag] || (m.needsLevel && !this.overlayOpen)) continue;
        this[m.close]();
        return;
      }
      if (this.primerZoneOpen) {
        this.closePrimer();
        return;
      }
      if (!this.overlayOpen) return;
      if (!isTyping(e?.target)) this.closeOverlay();
    },

    // ---------- focus ----------
    // Put focus back on the card that opened the level (by id, not position).
    returnFocus() {
      const target = this.returnTarget();
      if (target) this.focusSoon(target);
    },
    // Where focus goes when the level closes: Continue if it opened the level and is still shown, else the card
    // (its act's toggle when the act is folded and the card hidden).
    returnTarget() {
      return this.levelFocusTarget(this.currentLevelId, this.openedFrom);
    },
    // The hub control that opened level `id` (`from` is 'card' or 'continue'): where focus goes back to.
    levelFocusTarget(id, from) {
      if (!id) return null;
      if (from === 'continue' && this.continueLabel() !== '') return '#hub-continue';
      const actId = registry.levels[id]?.actId;
      if (actId !== undefined && !this.actExpanded(actId)) return `#act-toggle-${actId}`; // the card is hidden in a folded act
      return `[data-level-id="${id}"]`;
    },
    // Focus after Alpine has rendered (its $nextTick when running under Alpine), and only once the
    // target is shown: an x-show effect may not have flushed yet, and focus() on a display:none
    // element does nothing. Retries on the next frame, up to FOCUS_FRAMES, then gives up silently.
    focusSoon(selector) {
      let frames = 0;
      const go = () => {
        const el = doc.querySelector(selector);
        if (!el) return;
        if (rendered(el)) {
          el.focus?.();
        } else if (frames++ < FOCUS_FRAMES) {
          raf(go);
        }
      };
      if (typeof this.$nextTick === 'function') this.$nextTick(go);
      else go();
    },

    // Celebration bits: class colours (.c1-.c6) and Web Animations only, no style writes.
    // Skipped under reduced motion; the reward card still celebrates.
    fireConfetti() {
      if (reduceMotion()) return;
      const view = doc.defaultView;
      const height = (view && view.innerHeight) || 800;
      for (let i = 0; i < CONFETTI; i++) {
        const c = doc.createElement('div');
        c.className = `confetti c${(i % 6) + 1}`;
        c.setAttribute('aria-hidden', 'true');
        doc.body.appendChild(c);
        const x = Math.round(rand() * 100);
        const spin = Math.round(rand() * 720);
        const fall = 2000 + Math.round(rand() * 700);
        try {
          const anim = c.animate(
            [
              { transform: `translate(${x}vw, 0) rotate(0deg)`, opacity: 1 },
              { transform: `translate(${x}vw, ${height + 40}px) rotate(${spin}deg)`, opacity: 0.2 },
            ],
            { duration: fall, easing: 'cubic-bezier(.3,.6,.5,1)' },
          );
          anim.onfinish = () => c.remove();
        } catch {
          c.remove();
        }
      }
    },
  };
}
