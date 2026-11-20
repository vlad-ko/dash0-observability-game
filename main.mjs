// Browser entry: the only file that touches Alpine. Loaded as a module before the
// deferred Alpine script (index.html), so `alpine:init` is registered in time.
import { createGame, liveRegistry } from './app.mjs';
import { mountGlobe } from './lib/globe-render.mjs';
import { isDebugMode } from './lib/debug-mode.mjs';
import { prefersReducedMotion } from './lib/lesson-kit.mjs';
import { takeReset } from './lib/reset-mode.mjs';
import { takeSignin } from './lib/signin-param.mjs';
import { createTelemetry } from './lib/telemetry.mjs';
import { createPlayTelemetry } from './lib/play-telemetry.mjs';
import { PRIMERS } from './content/core/primers/index.mjs';
import { GLOSSARY } from './content/core/glossary/index.mjs';

// ?mode=reset runs first: the saved state is gone before anything reads it.
takeReset(window);
const signin = takeSignin(window);

function browserDeps() {
  const debug = isDebugMode(window.location.search);
  return {
    registry: liveRegistry(),
    primers: PRIMERS,
    glossary: GLOSSARY,
    storage: () => window.localStorage,
    document,
    window,
    debug,
    telemetry: createTelemetry({
      fetch: window.fetch.bind(window),
      randomBytes: (n) => window.crypto.getRandomValues(new Uint8Array(n)),
      now: Date.now,
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      reportError: (e) => console.error(e),
      allowLocal: debug,
    }),
    // The owner's play events (docs/GAME-EVENTS.md): its own fetch, nothing at all in debug.
    play: createPlayTelemetry({
      fetch: window.fetch.bind(window),
      sendBeacon: window.navigator.sendBeacon?.bind(window.navigator),
      randomBytes: (n) => window.crypto.getRandomValues(new Uint8Array(n)),
      monotonic: () => window.performance.now(),
      debug,
    }),
    fetch: window.fetch.bind(window),
    signin,
    now: Date.now,
    rand: Math.random,
    reduceMotion: () => prefersReducedMotion(window),
    // three.js loads on the first mount, after the hub has rendered.
    globe: (host, view) => mountGlobe(host, { window, document, ...view }),
    reportError: (e) => console.error(e),
  };
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('game', () => createGame(browserDeps()));
});
