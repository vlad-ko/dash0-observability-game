// The browser client of the game's play events (epic #18 P2; the wire contract and this client's rules are
// docs/GAME-EVENTS.md). It tells the owner how levels are played through the same-origin /api/events, never
// to a third party and never with a token. Separate from the Act 9 lab (lib/telemetry.mjs), which sends the
// player's own spans to the player's own Dash0.
//
// Everything comes in as a dependency (fetch, sendBeacon, randomBytes, a monotonic clock), so the module
// imports cleanly under node --test. It never throws, never awaits a send, and never calls reportError:
// telemetry must not be able to break play or feed the page's own error reporting.
import { errorKind, MAX_COUNT, MAX_ERRORS_PER_PAGE, MAX_EVENTS, MAX_MS, VERSION } from './play-events.mjs';

const HEADERS = Object.freeze({ 'content-type': 'text/plain;charset=UTF-8' });

const SID = /^[0-9a-f]{16}$/;
const hex =(bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
// A count for the wire: a whole number in range, otherwise 0.
const count = (n) => (Number.isInteger(n) && n >= 0 ? Math.min(n, MAX_COUNT) : 0);

/**
 * deps: { fetch, sendBeacon, randomBytes (n -> Uint8Array), monotonic (() -> ms), debug, url = '/api/events' }.
 * State is `off` (debug, no fetch, no valid session id, or the server said no), `pending` (probe not answered) or `on`.
 */
export function createPlayTelemetry({ fetch: request = null, sendBeacon = null, randomBytes, monotonic, debug = false, url = '/api/events' } = {}) {
  let state = debug === true || typeof request !== 'function' ? 'off' : 'pending';
  let sid = '';
  try {
    sid = hex(randomBytes(8));
  } catch {
    sid = '';
  }
  if (!SID.test(sid)) state = 'off'; // no valid id (the server would answer 400 to every batch): no events
  const buffer = []; // { event, at } with `at` the monotonic time the event happened
  let open = null; // { id, startedAt }
  let errors = 0;
  let probing = null;
  const stats = { dropped: 0, sent: 0, failed: 0 };

  const clock = () => {
    try {
      return monotonic();
    } catch {
      return NaN;
    }
  };

  function push(event) {
    if (state === 'off') return;
    if (buffer.length >= MAX_EVENTS && state === 'pending') {
      stats.dropped += 1;
      return;
    }
    buffer.push({ event, at: clock() });
    if (state === 'on' && buffer.length >= MAX_EVENTS) flush();
  }

  function close(outcome, scored) {
    const play = open;
    open = null;
    if (!play || state === 'off') return;
    const duration = Math.round(clock() - play.startedAt);
    if (!Number.isFinite(duration) || duration < 0 || duration > MAX_MS) {
      stats.dropped += 1;
      return;
    }
    const event = { t: 'play', level: play.id, outcome, durationMs: duration };
    if (scored) Object.assign(event, { stars: count(scored.stars), mistakes: count(scored.mistakes), hints: count(scored.hintsUsed) });
    push(event);
  }

  async function probe() {
    try {
      const res = await request(url, { method: 'GET', credentials: 'omit', cache: 'no-store' });
      const body = res?.status === 200 ? await res.json() : null;
      if (body?.v === VERSION && body.on === true) {
        state = 'on';
        flush(); // what waited for the answer goes now
        return;
      }
    } catch {
      // fall through: off
    }
    state = 'off';
    stats.dropped += buffer.length;
    buffer.length = 0;
  }

  function post(text) {
    try {
      Promise.resolve(request(url, { method: 'POST', body: text, keepalive: true, credentials: 'omit', headers: { ...HEADERS } })).then(
        (res) => {
          if (res?.ok) stats.sent += 1;
          else stats.failed += 1;
        },
        () => {
          stats.failed += 1;
        },
      );
    } catch {
      stats.failed += 1;
    }
  }

  function flush({ final = false } = {}) {
    // Nothing leaves the page until the probe says on, final or not (docs/GAME-EVENTS.md).
    if (state !== 'on' || buffer.length === 0) return;
    const taken = buffer.splice(0, MAX_EVENTS); // taken now, so a second flush cannot send it again
    const now = clock();
    const events = [];
    for (const { event, at } of taken) {
      const agoMs = Math.round(now - at);
      if (!Number.isFinite(agoMs) || agoMs < 0 || agoMs > MAX_MS) stats.dropped += 1;
      else events.push({ ...event, agoMs });
    }
    if (events.length === 0) return;
    const text = JSON.stringify({ v: VERSION, sid, events });
    if (final && typeof sendBeacon === 'function') {
      try {
        if (sendBeacon(url, text)) {
          stats.sent += 1;
          return;
        }
      } catch {
        // fall back to fetch
      }
    }
    post(text);
  }

  return {
    init() {
      if (state === 'off') return Promise.resolve();
      probing ??= probe().catch(() => {});
      return probing;
    },
    begin(id) {
      if (state === 'off') return;
      close('abandon');
      open = { id, startedAt: clock() };
    },
    complete(id, result) {
      if (!open || open.id !== id) return;
      close('complete', result ?? {});
    },
    abandon() {
      close('abandon');
    },
    error(e) {
      if (state === 'off' || errors >= MAX_ERRORS_PER_PAGE) return;
      errors += 1;
      let kind = '_OTHER';
      try {
        kind = errorKind(e); // a throwing name getter or a revoked proxy stays _OTHER
      } catch {
        // keep _OTHER
      }
      const event = { t: 'error', kind };
      if (open) event.level = open.id;
      push(event);
    },
    flush,
    stats: () => ({ buffered: buffer.length, ...stats }),
  };
}
