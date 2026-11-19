// Level 9.3: Connect the game to Dash0. The player works out the two things a sender needs, the
// endpoint of an organization (the one a browser can use) and an auth token that may only ingest, enters
// them in a connect form, and sends one test span. The game connects to the player's own Dash0
// (live, to the INGRESS_HOSTS of lib/dash0/ingress.mjs) or to a simulated one (practice, scored the same:
// a wrong permission, a bad form and a rejected token each cost one mistake, once per distinct cause).
// The token is typed into a secret field, handed to ctx.telemetry.connect and cleared from the
// DOM in the same click; it is never kept, shown or logged by this file (docs/DASH0-LAB.md).
// Spec: https://www.dash0.com/docs/dash0/miscellaneous/glossary/auth-tokens , https://www.dash0.com/docs/dash0/miscellaneous/glossary/endpoints , https://www.dash0.com/docs/dash0/miscellaneous/glossary/datasets , https://opentelemetry.io/docs/specs/otlp/
// Dash0 docs: auth tokens are `auth_...`, belong to one organization and are created by Admins in
// Settings -> Auth Tokens; the Permissions options are All permissions, Ingesting, Reading and Signal
// Control edge (sends telemetry and reads Signal Control Edge settings). The game lists the first three
// only: it is a curated choice for the ingest question, not a copy of Dash0's list, and the options are
// the telemetry session's PRACTICE_SCOPE keys. A token "drops the telemetry of each signal it has no
// action for, without an error" (glossary/auth-tokens), so the copy says the span is not stored, not
// that Dash0 refuses it;
// "Restrict tokens to Ingesting whenever you distribute them publicly, for example in
// OpenTelemetry instrumentation running in web browsers" (glossary/auth-tokens). The endpoint
// reference is in the organization's settings and its hosts name the region (glossary/endpoints).
// Teaching copy only: the endpoint row labels and the Create token button of the practice panel,
// and the 401 and 403 behaviour practice simulates, are marked VERIFY (#195) below and listed for
// owner sign-off.
//
// A run(ctx) level: its words are in content/core/levels/connect-to-dash0.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the answers and the screens.
import CORE from '../content/core/levels/connect-to-dash0.mjs';
import { bindRunLevel } from '../lib/content/bind.mjs';
import { fillSlots } from '../lib/content/placeholders.mjs';
import { PRACTICE_HOSTS, REASONS, TOKEN_PREFIX } from '../lib/dash0/ingress.mjs';
import { OUTCOME, TIMEOUT_MS } from '../lib/otlp/send.mjs';
import { MODE, STATE } from '../lib/telemetry.mjs';
import { focusFirst } from '../lib/widgets/focus.mjs';
import { actions as actionsBar, button, chip, feedback, field, note, panel, prose, radio, radioGroup, reason, setFeedback, step } from '../lib/ui/index.mjs';

// The one figure the copy quotes; every other {{name}} in the content is a slot the code fills as it runs.
const VARS = { 'timeout-s': TIMEOUT_MS / 1000 };
const SLOTS = ['where', 'status', 'message', 'host', 'prefix', 'session'];

// The Permissions options of an auth token (glossary/auth-tokens). Only Ingesting is right. The
// keys are the telemetry session's PRACTICE_SCOPE values (it mints the practice token per key); their
// labels and the explanation of each pick are the content's `scopes`, joined here by key.
const SKELETON = {
  id: 'connect-to-dash0',
  no: '9.3',
  icon: '\u{1F50C}',
  mechanics: ['configure'],
  // It builds its own form from the UI kit; none of the shared widgets is on a screen here.
  widgets: [],
  cards: [],
  lights: ['collector'],
  scored: true,
  scoring: { parMs: null },
  run: {
    scopes: [
      { key: 'all', right: false },
      { key: 'ingest', right: true },
      { key: 'read', right: false },
    ],
  },
};

// Why a send failed, by what came back (the content's `unreachable`, keyed by the cause). `auth` rejections are the
// token's fault; the rest are the network's or Dash0's, which never costs a star.

/** The feedback for a failed connect: {field, reason} from ctx.telemetry.connect, as plain words. */
function connectProblem(say, e, { field: which, reason }) {
  if (which === 'mode') {
    return reason === 'unavailable' ? say.problemUnavailable : say.problemMode;
  }
  const why = REASONS[reason] ?? say.problemUnchecked;
  // The content calls the dataset's name `datasetField`: "dataset" is a logic-only key under run.
  const names = { endpoint: say.fieldName.endpoint, token: say.fieldName.token, dataset: say.fieldName.datasetField };
  return `${names[which] ?? say.fieldNameOther}: ${e(why)}`;
}

// An address for display: escaped first, then <wbr> after "//" and each ".", and before ":", so a long
// address breaks at its punctuation and ":4317" stays together. textContent ignores <wbr>: copy stays plain.
export function breakableAddress(address, escape) {
  return escape(address).replace(/\/\/|\./g, '$&<wbr>').replace(/:(?=\d)/g, '<wbr>:');
}

/** The tone, words and whether to offer a retry for an outcome of the test span. */
function describeOutcome(say, outcome, mode) {
  const where = mode === MODE.practice ? say.whereSimulated : say.whereLive;
  switch (outcome.kind) {
    case OUTCOME.accepted:
      return { tone: 'success', html: fillSlots(say.outcomeAccepted, { where }), retry: false };
    case OUTCOME.rejected:
      if (outcome.auth) {
        // VERIFY (#195): that live Dash0 answers 401 for an unknown token and 403 for a token that
        // may not ingest. Practice simulates both; no Dash0 page says it, so the copy does not
        // split them: either way the remedy is the same three checks.
        return {
          tone: 'error',
          html: fillSlots(say.outcomeRefusedToken, { where }),
          retry: false,
        };
      }
      return {
        tone: 'error',
        html: fillSlots(say.outcomeRefusedStatus, { where, status: String(Number(outcome.status)) }),
        retry: true,
        message: outcome.message,
      };
    case OUTCOME.unreachable:
      return { tone: 'error', html: say.unreachable[outcome.cause] ?? say.unreachableFallback, retry: true };
    default:
      return { tone: 'error', html: say.unreachableFallback, retry: true };
  }
}

function screens(ctx, say) {
  const tele = ctx.telemetry;
  const e = ctx.escapeHtml;
  const body = ctx.ovBody;
  const actions = ctx.ovActions;
  const $ = (sel) => body.querySelector(sel);
  const screen = (...parts) => step({ bodyHtml: parts.join('') });
  const bar = (buttonsHtml) => actionsBar({ buttonsHtml });

  if (!tele) {
    ctx.renderStep(
      screen(ctx.speech(say.startIntro), note(say.startNote)),
      bar(''),
    );
    return;
  }

  // ---- screen 1: practice or live ----
  const stepMode = () => {
    const live = tele.liveAvailable();
    ctx.renderStep(
      screen(
        ctx.speech(say.modeIntro),
        chip({ text: say.modeChip, tone: 'attention' }),
        prose(say.modePractice + (live ? say.modeLive : `<p id="ctd-live-why">${say.modeLiveWhy}</p>`)),
      ),
      bar(
        button({ id: 'ctd-practice', label: say.modePracticeButton, variant: 'primary' }) +
          button({ id: 'ctd-live', label: say.modeLiveButton, variant: 'ghost', disabled: !live }) +
          (live ? '' : reason({ id: 'ctd-live-reason', text: say.modeLiveReason })),
      ),
    );
    actions.querySelector('#ctd-practice').onclick = () => stepConnect(MODE.practice);
    actions.querySelector('#ctd-live').onclick = () => stepConnect(MODE.live);
  };

  // ---- screen 2: find the endpoint, make a token, connect ----
  const stepConnect = (mode) => {
    const practice = mode === MODE.practice;
    const host = PRACTICE_HOSTS[0];
    // VERIFY (#195): the row labels of the endpoint reference ("OTLP via gRPC", "OTLP via HTTP";
    // the owner's screenshot of real Dash0, 2026-11-16, shows both in the integrations list)
    // and the Create token button. The docs say the endpoint reference lives in the
    // organization's settings and that tokens are created in Settings -> Auth Tokens.
    const simulated = panel({
      headHtml: `${chip({ text: say.connectSimulated, tone: 'attention' })} ${say.connectSimulatedHead}`,
      sections: [
        prose(
          `<h4>${say.connectEndpointsTitle}</h4>` +
            // The table is built here, not held in the content: prose() wraps a table in a scroller, which a
            // play-through check of the edited words cannot see past when the entry is the table itself.
            `<table><caption>${say.connectEndpointsCaption}</caption><thead><tr><th scope="col">${say.connectEndpointsHead[0]}</th><th scope="col">${say.connectEndpointsHead[1]}</th></tr></thead><tbody>` +
            `<tr><td>${say.connectEndpointGrpc}</td><td><code id="ctd-ep-grpc">${breakableAddress(`https://${host}:4317`, e)}</code></td></tr>` +
            `<tr><td>${say.connectEndpointHttp}</td><td><code id="ctd-ep-http">${breakableAddress(`https://${host}`, e)}</code></td></tr>` +
            '</tbody></table>',
        ),
        `<h4>${say.connectTokensTitle}</h4>` +
          radioGroup({
            legend: say.connectPermissionsLegend,
            itemsHtml: say.scopes.map((s) =>
              radio({ id: `ctd-scope-${s.key}`, name: 'ctd-scope', value: s.key, labelHtml: s.label })).join(''),
          }) +
          `<p>${button({ id: 'ctd-mint', label: say.connectMintButton, variant: 'ghost' })}</p>` +
          feedback({ id: 'ctd-mint-feedback' }) +
          `<div id="ctd-minted-row" hidden>${say.connectMintedLabel} <code id="ctd-minted"></code></div>`,
      ],
    });
    // Live: where to look, without naming the answer. Cited in the header: the endpoint
    // reference and Auth Tokens are in the organization's Settings, and only Admins create tokens.
    const guide = say.connectGuide;
    // Live cannot see a token's permission, so the player says which one they gave it. It is
    // charged by the same rule as the practice mint (chargeScope below).
    const liveScope =
      radioGroup({
        legend: say.connectLiveLegend,
        itemsHtml: say.scopes.map((s) => radio({ id: `ctd-scope-${s.key}`, name: 'ctd-scope', value: s.key, labelHtml: s.label })).join(''),
      }) +
      feedback({ id: 'ctd-scope-feedback' });
    ctx.renderStep(
      screen(
        ctx.speech(practice ? say.connectIntroPractice : say.connectIntroLive),
        chip(practice
          ? { text: say.connectChipPractice, tone: 'attention' }
          : { text: say.connectChipLive, tone: 'success' }),
        practice ? simulated : prose(guide),
        field({
          id: 'ctd-endpoint',
          label: say.connectEndpointLabel,
          autocompleteOff: true,
          noteHtml: say.connectEndpointNote,
        }),
        field({
          id: 'ctd-token',
          label: say.connectTokenLabel,
          kind: 'secret',
          noteHtml: fillSlots(say.connectTokenNote, { prefix: e(TOKEN_PREFIX) }),
        }),
        practice ? '' : liveScope,
        field({
          id: 'ctd-dataset',
          label: say.connectDatasetLabel,
          noteHtml: say.connectDatasetNote,
        }),
        practice ? '' : note(say.connectLiveNote),
        feedback({ id: 'ctd-feedback' }),
      ),
      bar(button({ id: 'ctd-connect', label: say.connectButton, variant: 'primary' })),
    );

    const fb = $('#ctd-feedback');
    const tell = (tone, html) => setFeedback(fb, tone, html, { scroll: true }); // each line answers a button press (#339)
    const endpointEl = $('#ctd-endpoint');
    const tokenEl = $('#ctd-token');
    const datasetEl = $('#ctd-dataset');
    const minted = practice ? $('#ctd-minted') : null;
    const mintedRow = practice ? $('#ctd-minted-row') : null;
    focusFirst(endpointEl, { fallback: fb }); // a new step opens at its top, on a visible element (#331, #339)

    // The shown practice token goes with the secret field: after Connect it is gone from the page.
    const scrub = () => {
      if (!practice) return;
      minted.textContent = '';
      mintedRow.setAttribute('hidden', '');
    };

    // The actions bar: Connect, plus a retry (a send that failed through no fault of the token)
    // and, for a live connection that could not be reached, a way into practice.
    const setActions = ({ busy = false, retry = false, toPractice = false } = {}) => {
      actions.innerHTML = bar(
        button({ id: 'ctd-connect', label: say.connectBarButton, variant: 'primary', disabled: busy }) +
          (retry ? button({ id: 'ctd-retry', label: say.connectRetryButton, variant: 'ghost', disabled: busy }) : '') +
          (toPractice ? button({ id: 'ctd-switch', label: say.connectSwitchButton, variant: 'ghost' }) : ''),
      );
      actions.querySelector('#ctd-connect').onclick = onConnect;
      const again = actions.querySelector('#ctd-retry');
      if (again) again.onclick = send;
      const sw = actions.querySelector('#ctd-switch');
      if (sw) sw.onclick = () => stepConnect(MODE.practice);
    };

    // One charge rule for everything the player gets wrong here: each distinct cause costs one
    // mistake, once. A cause is a permission (`scope:<key>`), a form error (`<field>:<reason>`) or a
    // rejected token (`rejected:<status>`).
    const charged = new Set();
    const charge = (cause) => {
      if (charged.has(cause)) return;
      charged.add(cause);
      ctx.mistake();
    };

    let scope = null;
    for (const s of say.scopes) $(`#ctd-scope-${s.key}`).onclick = () => { scope = s; };
    // A permission other than Ingesting is a mistake; `fbEl` says why.
    const declareScope = (fbEl) => {
      if (!scope.right) charge(`scope:${scope.key}`);
      setFeedback(fbEl, scope.right ? 'success' : 'error', scope.why);
    };

    // Practice: create a token. The token's name does not say what it can do.
    if (practice) {
      const mintFb = $('#ctd-mint-feedback');
      $('#ctd-mint').onclick = () => {
        if (!scope) {
          setFeedback(mintFb, 'neutral', say.connectMintSays, { scroll: true });
          return;
        }
        minted.textContent = tele.practiceCredential(scope.key); // a public practice token, only ever shown here
        mintedRow.removeAttribute('hidden');
        declareScope(mintFb);
      };
    }

    // The last reason shown for a bad form or a rejected token, and the endpoint and dataset it
    // was shown for. It is kept only while a press has nothing new to say: an emptied token field
    // over the same endpoint and dataset. Once either changed, the old reason would be stale.
    let lastProblem = false;
    let lastInput = '';

    const send = async () => {
      setActions({ busy: true });
      fb.removeAttribute('data-outcome');
      tell('neutral', say.connectSendingSays);
      const outcome = await tele.sendTest({ signal: ctx.signal });
      if (ctx.signal.aborted) return; // the level was closed while the request was out
      // "Connected?" has one answer: the session's own state, never the outcome alone.
      if (outcome.kind === OUTCOME.accepted && tele.status().state === STATE.connected) {
        stepConnected();
        return;
      }
      const shown = describeOutcome(
        say,
        outcome.kind === OUTCOME.accepted ? { kind: OUTCOME.unreachable, cause: 'not-connected' } : outcome,
        mode,
      );
      // Only the player's own token counts against them: the network's and Dash0's faults do not.
      if (outcome.kind === OUTCOME.rejected && outcome.auth) charge(`rejected:${outcome.status}`);
      lastProblem = outcome.kind === OUTCOME.rejected && outcome.auth;
      const message = shown.message ? ` ${fillSlots(say.outcomeSaid, { message: e(shown.message) })}` : '';
      tell(shown.tone, `${shown.html}${message}`);
      fb.setAttribute('data-outcome', outcome.kind);
      setActions({ retry: shown.retry, toPractice: !practice && outcome.kind === OUTCOME.unreachable });
      (shown.retry ? actions.querySelector('#ctd-retry') : endpointEl).focus({ preventScroll: true }); // the feedback just scrolled into view stays in view (#331)
    };

    function onConnect() {
      // The token leaves the field once a request is about to be sent or once it is itself refused, and never comes
      // back; a refusal of anything else (the endpoint, the dataset, a missing scope) keeps what the player typed (#339).
      const token = tokenEl.value;
      const endpoint = endpointEl.value;
      const dataset = datasetEl.value;
      const input = `${endpoint}\n${dataset}`;
      const same = input === lastInput;
      lastInput = input;
      if (endpoint.trim() === '') {
        tell('neutral', say.connectEndpointFirstSays);
        return;
      }
      if (!practice) {
        if (!scope) {
          tell('neutral', say.connectScopeFirstSays);
          return;
        }
        declareScope($('#ctd-scope-feedback'));
        if (scope.key === 'read') {
          // Declared and already charged above: sending would only earn a second charge for it.
          lastProblem = false;
          tell('error', say.connectReadingSays);
          return;
        }
      }
      const verdict = tele.connect({ mode, endpoint, token, dataset });
      if (!verdict.ok) {
        if (verdict.field === 'token') {
          tokenEl.value = '';
          scrub();
        }
        // An emptied token field is a nudge, not a wrong answer. Over the same endpoint and dataset it
        // keeps the last useful reason (a double click); after a change that reason is stale.
        if (verdict.reason === 'empty' && lastProblem && same) return;
        if (verdict.reason === 'empty' && lastProblem) {
          lastProblem = false;
          fb.removeAttribute('data-outcome');
          tell('neutral', `${connectProblem(say, e, verdict)} ${practice ? say.connectAgainPractice : say.connectAgainLive} ${say.connectNothingSent}`);
          return;
        }
        if (verdict.reason !== 'empty') {
          charge(`${verdict.field}:${verdict.reason}`);
          lastProblem = true;
        }
        fb.removeAttribute('data-outcome');
        tell('error', `${connectProblem(say, e, verdict)} ${say.connectNothingSent}`);
        return;
      }
      lastProblem = false;
      tokenEl.value = '';
      scrub();
      send();
    }

    actions.querySelector('#ctd-connect').onclick = onConnect;
  };

  // ---- screen 3: connected ----
  const stepConnected = () => {
    const status = tele.status();
    const practice = status.mode === MODE.practice;
    ctx.renderStep(
      screen(
        ctx.speech(practice ? say.connectedIntroPractice : say.connectedIntroLive),
        chip(practice
          ? { text: say.connectedChipPractice, tone: 'attention' }
          : { text: fillSlots(say.connectedChipLive, { host: status.host ?? '' }), tone: 'success' }),
        prose(
          `<h4 id="ctd-connected-title" tabindex="-1">${say.connectedTitle}</h4>` +
            fillSlots(say.connectedBody, { session: `<code id="ctd-session">${e(tele.sessionId)}</code>` }),
        ),
      ),
      bar(button({ id: 'ctd-finish', label: say.connectedButton, variant: 'primary', finish: true })),
    );
    $('#ctd-connected-title').focus({ preventScroll: true });
    actions.querySelector('#ctd-finish').onclick = () =>
      ctx.finish({
        text: practice ? say.connectedFinishPractice : say.connectedFinishLive,
        cards: [],
      });
  };

  stepMode();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { vars: VARS, slots: SLOTS, screens });
}

export default withText(CORE);
