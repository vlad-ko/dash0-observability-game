// The level feedback dialog's behaviour (#370). `host` is the dialog body (#feedback-body); this draws the form with
// kit helpers only and wires the buttons with el.onclick (no Alpine, no inline handlers, no <form>: the CSP has
// form-action 'none'). In debug mode nothing is sent. deps: { host, doc, debug, send({levelId, screen, kind, text}) →
// Promise of an outcome (lib/feedback-client.mjs), context() → {levelId, screen}, close() }.
import { MAX_TEXT } from './feedback.mjs';
import { actions, button, eyebrow, feedback, field, panel, radio, radioGroup, setFeedback } from './ui/index.mjs';

/** What each kind says to the player, in the order the server lists them. */
const KIND_LABELS = Object.freeze({
  unclear: 'Something is unclear or confusing',
  'wrong-fact': 'Something is wrong or out of date',
  bug: 'Something is broken',
  idea: 'I have an idea',
});

const PUBLIC_NOTE = 'This becomes a public GitHub issue. Do not include anything private.';
const EMPTY = 'Write a few words first.';
const DEBUG = 'Debug mode: nothing was sent.';
const SENDING = 'Sending...';

/** The line for an outcome: `[tone, text]`. */
function outcomeLine(outcome) {
  switch (outcome.kind) {
    case 'sent': return ['success', `Sent as issue #${outcome.issue} on GitHub. Thank you.`];
    case 'rate-limited': {
      const minutes = Math.max(1, Math.ceil(outcome.retryAfterS / 60));
      return ['error', `Too many in a short time. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`];
    }
    case 'off': return ['neutral', 'Feedback is off right now.'];
    case 'rejected': return ['error', 'That could not be sent. Check the text and try again.'];
    default: return ['error', 'Could not send it. Try again later.'];
  }
}

export function createFeedbackDialog({ host, doc, debug = false, send, context, close }) {
  let sending = false; // one request in flight at a time
  let sent = false; // the note went; Send stays off until the dialog is opened again
  let drawn = 0; // bumps on every open and reset, so a late answer to a closed form is dropped
  let at = null; // the level and screen the dialog opened on: the overlay is inert while it is open
  const byId = (id) => doc.getElementById(id);
  const say = (tone, text) => setFeedback(byId('feedback-msg'), tone, text, { scroll: true });

  const kinds = Object.entries(KIND_LABELS).map(([value, label], i) =>
    radio({ name: 'feedback-kind', value, labelHtml: label, checked: i === 0 })).join('');
  const view = () => panel({
    sections: [
      eyebrow('Tell us about this step') +
        radioGroup({ legend: 'What kind of feedback is it?', itemsHtml: kinds }) +
        field({ id: 'feedback-text', label: 'What should we know?', kind: 'area', rows: 5, maxLength: MAX_TEXT, noteHtml: PUBLIC_NOTE }) +
        feedback({ id: 'feedback-msg' }),
      actions({ buttonsHtml: button({ id: 'feedback-send', label: 'Send', variant: 'primary' }) + button({ id: 'feedback-close', label: 'Close' }) }),
    ],
  });

  async function onSend() {
    if (sending || sent) return;
    const text = byId('feedback-text').value;
    if (text.trim() === '') {
      say('error', EMPTY);
      return;
    }
    if (debug) {
      say('neutral', DEBUG);
      return;
    }
    const chosen = [...host.querySelectorAll('input[name="feedback-kind"]')].find((r) => r.checked);
    const round = drawn;
    sending = true;
    byId('feedback-send').disabled = true;
    say('neutral', SENDING); // a player who closes the dialog now still knows a note is on its way
    let outcome;
    try {
      outcome = await send({ ...at, kind: chosen?.value ?? 'unclear', text });
    } catch {
      outcome = { kind: 'failed' };
    }
    if (round !== drawn) return; // the dialog closed (or opened again) meanwhile: the answer belongs to nothing on screen
    sending = false;
    sent = outcome.kind === 'sent';
    byId('feedback-send').disabled = sent; // a failure can be tried again; a sent note is not sent twice
    say(...outcomeLine(outcome));
    if (sent) byId('feedback-close').focus(); // Send is disabled now: keep keyboard and screen-reader users in the dialog
  }

  return {
    /** Draws the form for the level and screen on show. */
    open() {
      drawn += 1;
      sending = false;
      sent = false;
      at = context();
      host.innerHTML = view();
      const wire = (id, fn) => { byId(id).onclick = fn; };
      wire('feedback-send', onSend);
      wire('feedback-close', () => close());
    },
    /** The dialog is closing: drop the form. A request still in flight lands on nothing. */
    reset() {
      drawn += 1;
      host.innerHTML = '';
    },
  };
}
