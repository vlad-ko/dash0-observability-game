// The send form of a readback In Dash0 task that the player sends from their own browser (#509 P7.1, docs/FOUNDATION.md §2.15):
// an endpoint field, a secret token field and "Send test span". It connects the game's telemetry session to the player's own Dash0
// and sends one test span stamped with this attempt's id (lib/telemetry.mjs sendTest), so the task server can read it back.
//
// The token (docs/FOUNDATION.md §2.6, I1): read and emptied in the same click, before any await; it goes to ctx.telemetry.connect
// and nowhere else (never the task server, a frame, reportError, storage, the URL or the console). It stays in this closure only,
// so that a send after "Start again" reuses it; a refused token is forgotten. The dataset is the attempt's, never typed. The attempt
// id lives only in the closures here. Sending costs no mistake, ever. Once the task passes the session stays connected (the game's
// own play telemetry keeps going to the same organisation). DOM-free at import.
import COPY from '../../content/core/ui/dash0-task.mjs';
import { REASONS } from '../dash0/ingress.mjs';
import { OUTCOME, TIMEOUT_MS } from '../otlp/send.mjs';
import { MODE, STATE } from '../telemetry.mjs';
import { button, buttonRow, field, note } from '../ui/index.mjs';
import { focusFirst } from './focus.mjs';

const fill = (text, vars) => Object.entries(vars).reduce((t, [k, v]) => t.replace(`{${k}}`, String(v)), text);

/** The form's markup, hidden until the task has started. Ids: `<id>-send`, `<id>-endpoint`, `<id>-token`, `<id>-send-go`, `<id>-send-first`, `<id>-held`. */
export function renderSend(id) {
  return (
    `<div id="${id}-send" hidden>` +
    field({ id: `${id}-endpoint`, label: COPY.send.endpointLabel, autocompleteOff: true, noteHtml: COPY.send.endpointNote }) +
    field({ id: `${id}-token`, label: COPY.send.tokenLabel, kind: 'secret', noteHtml: COPY.send.tokenNote }) +
    `<div id="${id}-held"></div>` +
    buttonRow(button({ id: `${id}-send-go`, label: COPY.send.button, variant: 'primary' })) +
    `<div id="${id}-send-first">${note(COPY.sendFirst)}</div>` +
    '</div>'
  );
}

/** The words for a connect refusal `{field, reason}`; never the token. */
function problem({ field: which, reason }) {
  const names = COPY.send.fields;
  return `${names[which] ?? names.other}: ${REASONS[reason] ?? COPY.send.unchecked}`;
}

/** The words for a send outcome that is not an accepted and connected session. Never a status code for a refused token. */
export function outcomeLine(outcome) {
  switch (outcome.kind) {
    case OUTCOME.rejected:
      if (outcome.auth) return COPY.send.refusedToken;
      return `${fill(COPY.send.refusedStatus, { status: String(Number(outcome.status)) })}${typeof outcome.message === 'string' && outcome.message !== '' ? ` ${fill(COPY.send.said, { message: outcome.message })}` : ''}`;
    case OUTCOME.unreachable:
      return fill(COPY.send.unreachable[outcome.cause] ?? COPY.send.unreachable.fallback, { seconds: TIMEOUT_MS / 1000 });
    default:
      return COPY.send.unreachable.fallback;
  }
}

/**
 * Wire the form rendered by renderSend. `hooks`: `attempt()` the started attempt (`{attemptId, dataset?}`) or null, `say(tone, text)`,
 * `gone()` the step was left, `onSent(ok)` the session is (or is no longer) accepted and connected, `onUnavailable()` the player's own
 * Dash0 cannot be used in this browser (the view offers "Finish without the In Dash0 task"). Returns `{reset}`.
 */
export function mountSend(ctx, id, hooks) {
  const $ = (s) => ctx.ovBody.querySelector(`#${id}-${s}`);
  const box = $('send');
  const endpointEl = $('endpoint');
  const tokenEl = $('token');
  const go = $('send-go');
  const first = $('send-first');
  const held = $('held');
  let token = null; // the token the player pasted, kept in this closure for a re-send after Start again; forgotten when refused
  let seq = 0; // each send takes the next number; only the send that still holds `flying` may re-enable Send
  let flying = 0; // the number of the send in flight, 0 when none; reset() never touches it

  const drawHeld = () => {
    held.innerHTML = token === null ? '' : note(ctx.escapeHtml(COPY.send.held));
  };

  async function onSend() {
    // The token leaves the field in this click, before anything is awaited and before any early return.
    const typed = tokenEl.value;
    tokenEl.value = '';
    if (typed !== '') token = typed;
    drawHeld();
    if (flying !== 0) return;
    const attempt = hooks.attempt();
    if (attempt === null) return;
    const attemptId = attempt.attemptId;
    const tele = ctx.telemetry;
    if (!tele) return hooks.onUnavailable();
    const verdict = tele.connect({ mode: MODE.live, endpoint: endpointEl.value, token: token ?? '', dataset: attempt.dataset ?? '' });
    if (!verdict.ok) {
      if (verdict.field === 'mode' && verdict.reason === 'unavailable') {
        hooks.say('neutral', COPY.send.unavailable);
        return hooks.onUnavailable();
      }
      if (verdict.field === 'token') {
        token = null;
        drawHeld();
      }
      hooks.say('error', `${problem(verdict)} ${verdict.field === 'token' ? COPY.send.again : ''} ${COPY.send.nothingSent}`.replace(/ {2,}/g, ' '));
      return focusFirst(verdict.field === 'token' ? tokenEl : endpointEl, { fallback: go });
    }
    const mine = ++seq;
    flying = mine;
    go.disabled = true;
    hooks.onSent(false); // the replaced session is no longer connected: Check waits for this send
    hooks.say('neutral', COPY.send.sending, { scroll: false });
    let outcome;
    try {
      outcome = await tele.sendTest({ signal: ctx.signal, attemptId });
    } catch {
      outcome = { kind: OUTCOME.unreachable, cause: 'fallback' };
    }
    const current = flying === mine;
    if (current) flying = 0;
    if (hooks.gone()) return;
    if (current && hooks.attempt() !== null) go.disabled = false;
    if (hooks.attempt()?.attemptId !== attemptId) return; // another attempt began meanwhile: this answer is for the old one
    // "Connected?" has one answer: the session's own state, never the outcome alone.
    if (outcome.kind === OUTCOME.accepted && tele.status().state === STATE.connected) {
      first.hidden = true;
      hooks.say('success', COPY.send.accepted);
      hooks.onSent(true);
      return;
    }
    if (outcome.kind === OUTCOME.rejected && outcome.auth) {
      token = null; // a refused token is not tried again
      drawHeld();
    }
    hooks.onSent(false);
    hooks.say('error', outcome.kind === OUTCOME.accepted ? outcomeLine({ kind: OUTCOME.unreachable, cause: 'not-connected' }) : outcomeLine(outcome));
    focusFirst(outcome.kind === OUTCOME.rejected && outcome.auth ? tokenEl : go, { fallback: go });
  }

  go.onclick = onSend;
  return {
    /** A new attempt began: nothing is sent for it yet, so Check waits; a held token stays. */
    reset() {
      box.hidden = false;
      first.hidden = false;
      go.disabled = flying !== 0; // a send still in flight keeps Send off until it completes
      endpointEl.disabled = false;
      tokenEl.disabled = false;
      tokenEl.value = '';
      drawHeld();
    },
    /** The attempt ended (a 409 or 410): nothing can be sent until Start again. */
    idle() {
      go.disabled = true;
      endpointEl.disabled = true;
      tokenEl.disabled = true;
    },
  };
}
