// Act 9 boss: It's us. The game holds an incident of its own, a failing save in the player's session, as
// one trace. Connected to the player's Dash0 it sends that incident once and the player finds it there
// (filter by their session id, open the trace, read the span in error). Not connected, or in practice,
// the game simulates a Trace Explorer: six traces from six sessions, the player's among them, and the
// player filters by their session id to find theirs. Either way the questions are graded by
// gradeAnswer against the player's own spans (lib/incident-lab.mjs, docs/DASH0-LAB.md invariant I5).
// The fault code is only ever in the attributes of the failing span, as in Dash0: live shows no trace
// at all, so it is nowhere on the page; practice shows it only after that span is opened, and the trace
// id only inside an opened trace.
// Spec: https://opentelemetry.io/docs/specs/otel/trace/api/#add-events , https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-spans/
// Spec: https://opentelemetry.io/docs/specs/semconv/registry/attributes/session/ (session.id)
// Spec: https://www.dash0.com/docs/dash0/telemetry/tracing/about-tracing , https://www.dash0.com/docs/dash0/telemetry/tracing/view , https://www.dash0.com/docs/dash0/telemetry/tracing/span-sidebar
// Spec: https://www.dash0.com/docs/dash0/telemetry/tracing/span-events , https://www.dash0.com/docs/dash0/miscellaneous/glossary/filtering
// Dash0 docs: the Trace Explorer has a Filter (pick a key, an operator and a value), a Time Picker and a
// Span Table; the Trace View shows one trace as a Waterfall (the Span Sidebar's "View full trace" button opens it); selecting a span
// opens the Span Sidebar with its Attributes and its span events (telemetry/tracing/*, glossary/filtering).
// Not on a Dash0 page, so marked VERIFY (#195) below: that a session.id attribute set by the sender is
// filterable as a key.
// The practice view is the game's own simulation of those pages and says so on every screen.
//
// The token never comes into this file: connecting is level 9.3's job (and the game is connected
// or it is not). The boss reads ctx.telemetry.status(), sends with sendBatch and shows what came back.
//
// A run(ctx) level: its words are in content/core/levels/its-us.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the answers and the screens.
import CORE from '../content/core/levels/its-us.mjs';
import { bindRunLevel } from '../lib/content/bind.mjs';
import { fillSlots } from '../lib/content/placeholders.mjs';
import { isErrorStatus, RESOURCE_ATTRIBUTES, SESSION_ATTR } from '../lib/otlp/encode.mjs';
import { OUTCOME, TIMEOUT_MS } from '../lib/otlp/send.mjs';
import {
  answersFrom, buildTraceList, FILTER_KEY, FILTER_OP, gradeAnswer, GRADE, matchTraces, normaliseAnswer, QUESTION,
} from '../lib/incident-lab.mjs';
import { MODE, STATE } from '../lib/telemetry.mjs';
import {
  actions as actionsBar, button, buttonRow, chip, feedback, field, finishButton, note, panel, prose, radio, radioGroup, reason, setFeedback, step, table,
} from '../lib/ui/index.mjs';

// The two figures the copy quotes (the timeout and the session attribute); every other {{name}} in the content is a
// slot the code fills as it runs.
const VARS = { 'timeout-s': TIMEOUT_MS / 1000, 'session-attr': SESSION_ATTR };
const SLOTS = ['hosts', 'host', 'session', 'count', 'key', 'op', 'value', 'n', 'name', 'id', 'message', 'status'];

const SKELETON = {
  id: 'its-us',
  no: null,
  icon: '\u{1F575}',
  mechanics: ['spot'],
  // It builds its own screens from the UI kit; no shared widget is on them.
  widgets: [],
  cards: [],
  lights: ['collector'],
  scored: true,
  scoring: { parMs: null },
  run: {
    // What each question asks, how to find it, and what to say when the input cannot be checked: the content's
    // `questions` (label, note, nudge, wrong), joined here by the key the answer is graded under.
    questions: [
      { key: QUESTION.operation },
      { key: QUESTION.faultCode },
      { key: QUESTION.retryCount },
      { key: QUESTION.traceId },
    ],
  },
};

// Incidents already accepted by a Dash0 in this page's session (one per telemetry session), and the
// host that took them. Keyed by the incident object the session caches, so a second open of the boss
// does not send again to the same Dash0, and a different Dash0 is offered the send.
const SENT = new WeakMap(); // incident -> Set of the hosts that took it
// Incidents a send was ever started for. An attempt may have got through (the level can close before the
// answer), so a later send screen must not say "not sent yet".
const ATTEMPTED = new WeakSet();

// Why a send failed is the content's `unreachable`, keyed by what came back. The network's and Dash0's faults never cost a star.

const KEY_ORDER = [FILTER_KEY.serviceName, FILTER_KEY.sessionId, FILTER_KEY.spanName];
const OP_ORDER = [FILTER_OP.is, FILTER_OP.isNot];
const clockOf = (ms) => new Date(ms).toISOString().slice(11, 19);
const slug = (v) => v.replace(/\W+/g, '-');

function screens(ctx, say) {
  const tele = ctx.telemetry;
  const e = ctx.escapeHtml;
  const body = ctx.ovBody;
  const actions = ctx.ovActions;
  const $ = (sel) => body.querySelector(sel);
  const screen = (...parts) => step({ bodyHtml: parts.join('') });
  const bar = (buttonsHtml) => actionsBar({ buttonsHtml });

  // The incident is built here, on the first open of the boss, and cached by the session: it is the
  // one array that is sent, rendered and graded (invariant I5).
  const incident = tele ? tele.incident() : null;
  const key = incident ? answersFrom(incident.spans) : null;
  if (!tele || !incident || key === null) {
    ctx.renderStep(
      screen(ctx.speech(
        tele ? say.startIntroNoIncident : say.startIntroNoTelemetry,
      ), note(say.startNote)),
      bar(''),
    );
    return;
  }
  const spans = incident.spans;

  // ---- the first screen depends on what the session is ----
  const stepStart = () => {
    const { state, mode, host } = tele.status();
    if (state === STATE.connected && mode === MODE.live) {
      if (SENT.get(incident)?.has(host)) stepFind(MODE.live);
      else stepSend();
      return;
    }
    if (state === STATE.connected) {
      stepFind(MODE.practice); // practice connection: the simulated Dash0 is the only Dash0 there is
      return;
    }
    stepNotConnected();
  };

  // ---- not connected: explain, offer practice ----
  const stepNotConnected = () => {
    const why = tele.liveAvailable() ? say.notConnectedWhyAvailable : say.notConnectedWhyUnavailable;
    ctx.renderStep(
      screen(
        ctx.speech(say.notConnectedIntro),
        chip({ text: say.notConnectedChip, tone: 'attention' }),
        prose(say.notConnectedPractice + `<p id="its-live-why">${e(why)}</p>`),
      ),
      bar(
        button({ id: 'its-practice', label: say.notConnectedPracticeButton, variant: 'primary' }) +
          button({ id: 'its-live', label: say.notConnectedLiveButton, variant: 'ghost', disabled: true }) +
          reason({ id: 'its-live-reason', text: tele.liveAvailable() ? say.notConnectedReasonAvailable : say.notConnectedReasonUnavailable }),
      ),
    );
    actions.querySelector('#its-practice').onclick = () => stepFind(MODE.practice);
  };

  // ---- connected live: send the incident once ----
  const stepSend = () => {
    const { host } = tele.status();
    const elsewhere = [...(SENT.get(incident) ?? [])];
    let lead;
    if (elsewhere.length > 0) {
      lead = fillSlots(say.sendLeadElsewhere, { hosts: elsewhere.map(e).join(` ${say.sendHostsJoiner} `) });
    } else if (ATTEMPTED.has(incident)) {
      lead = say.sendLeadAttempted;
    } else {
      lead = say.sendLeadFresh;
    }
    const duplicate = elsewhere.length === 0 && ATTEMPTED.has(incident);
    ctx.renderStep(
      screen(
        ctx.speech(lead),
        chip({ text: fillSlots(say.sendChip, { host: host ?? '' }), tone: 'success' }),
        prose(
          fillSlots(say.sendBody, { session: `<code id="its-session">${e(tele.sessionId)}</code>` }) +
            (duplicate ? `<p id="its-duplicate">${e(say.duplicateNote)}</p>` : ''),
        ),
        feedback({ id: 'its-feedback' }),
      ),
      bar(button({ id: 'its-send', label: say.sendButton, variant: 'primary' })),
    );
    actions.querySelector('#its-send').onclick = send;
  };

  // The bar of the send screen: the send button (pending or not), plus the ways out of a failure.
  // After any failed outcome the send button stays disabled: the way on is a retry, if one is offered,
  // or practice, never the same press with the same refused token.
  const setSendBar = ({ busy = false, failed = false, retry = false } = {}) => {
    actions.innerHTML = bar(
      button({ id: 'its-send', label: say.sendBarButton, variant: 'primary', disabled: busy || failed }) +
        (retry ? button({ id: 'its-retry', label: say.sendRetryButton, variant: 'primary' }) : '') +
        (failed ? button({ id: 'its-switch', label: say.sendSwitchButton, variant: 'ghost' }) : ''),
    );
    actions.querySelector('#its-send').onclick = send;
    const again = actions.querySelector('#its-retry');
    if (again) again.onclick = send;
    const sw = actions.querySelector('#its-switch');
    if (sw) sw.onclick = () => stepFind(MODE.practice);
  };

  // What came back, in plain words: the tone, the text, whether to offer a retry.
  const describe = (outcome) => {
    switch (outcome.kind) {
      case OUTCOME.rejected:
        if (outcome.auth) {
          // VERIFY (#195): whether live Dash0 answers 401 or 403 here; the copy splits neither.
          return {
            html: say.describeRefusedToken,
            retry: false,
          };
        }
        return {
          html: `${fillSlots(say.describeRefused, { status: String(Number(outcome.status)) })}${outcome.message ? ` ${fillSlots(say.describeSaid, { message: e(outcome.message) })}` : ''}`,
          retry: true,
        };
      case OUTCOME.unreachable:
        return { html: `${say.unreachable[outcome.cause] ?? say.unreachableFallback} ${say.duplicateNote}`, retry: true };
      default:
        return { html: say.unreachableFallback, retry: true };
    }
  };

  let sending = false;
  const send = async () => {
    if (sending) return; // one request at a time; the button is disabled too
    sending = true;
    ATTEMPTED.add(incident); // from here an attempt may have got through, whatever the player sees next
    const target = tele.status().host;
    setSendBar({ busy: true });
    const fb = $('#its-feedback');
    fb.removeAttribute('data-outcome');
    setFeedback(fb, 'neutral', say.sendSendingSays, { scroll: true });
    let outcome;
    try {
      outcome = await tele.sendBatch(spans, { signal: ctx.signal });
    } catch {
      outcome = { kind: OUTCOME.unreachable, cause: 'invalid' }; // the spans were refused before any request
    }
    sending = false;
    if (ctx.signal.aborted) return; // the level was closed while the request was out
    const now = tele.status();
    if (outcome.kind === OUTCOME.accepted && now.state === STATE.connected && now.host === target) {
      SENT.set(incident, new Set([...(SENT.get(incident) ?? []), target]));
      stepFind(MODE.live);
      return;
    }
    const shown = describe(outcome.kind === OUTCOME.accepted ? { kind: OUTCOME.unreachable, cause: 'not-connected' } : outcome);
    setFeedback(fb, 'error', shown.html);
    fb.setAttribute('data-outcome', outcome.kind);
    setSendBar({ failed: true, retry: shown.retry });
    (shown.retry ? actions.querySelector('#its-retry') : actions.querySelector('#its-switch')).focus();
  };

  // ---- the simulated Trace Explorer (practice only): several sessions' traces, the player's among them ----
  const failed = (s) => isErrorStatus(s.status);
  let traces = null; // built on the first practice screen; the same list for every redraw
  let applied = null; // the filter in force: {key, op, value}
  let form = { key: FILTER_KEY.serviceName, op: FILTER_OP.is, value: '' };
  let filtered = false; // the player did filter by their own session id
  const checked = (name) => [...body.querySelectorAll(`input[name="${name}"]`)].find((i) => i.checked)?.value;

  const filterForm = () => {
    const keys = KEY_ORDER.map((k) =>
      radio({ id: `its-fkey-${slug(k)}`, name: 'its-fkey', value: k, labelHtml: `<code>${e(k)}</code>`, checked: k === form.key })).join('');
    const ops = OP_ORDER.map((o) =>
      radio({ id: `its-fop-${slug(o)}`, name: 'its-fop', value: o, labelHtml: e(o), checked: o === form.op })).join('');
    return radioGroup({ legend: say.filterKeyLegend, itemsHtml: keys }) +
      radioGroup({ legend: say.filterOperatorLegend, itemsHtml: ops }) +
      field({ id: 'its-fvalue', label: say.filterValueLabel, autocompleteOff: true, value: form.value }) +
      feedback({ id: 'its-filter-feedback' }) +
      buttonRow(
        button({ id: 'its-filter-apply', label: say.filterApplyButton, variant: 'primary' }) +
          (applied ? button({ id: 'its-filter-clear', label: say.filterClearButton, variant: 'ghost' }) : ''),
      );
  };

  // The heading text is focusable (tabindex -1) so a screen-reader or keyboard user lands where the task is.
  // The title and its sentence are one flex item, so the header's gap does not open a space before the period.
  const explorerHead = (what, id) => `${chip({ text: say.explorerChip, tone: 'attention' })} <span><span id="${id}" tabindex="-1">${what}</span>. ${say.explorerTail}</span>`;

  const showList = () => {
    const shown = applied ? matchTraces(traces, applied) : traces;
    const rows = shown.map((t, i) => [
      i + 1,
      t.spans[0].name,
      clockOf(t.spans[0].startMs),
      t.spans[0].endMs - t.spans[0].startMs,
      t.spans.length,
      t.spans.some(failed) ? 'Error' : 'Unset', // span status names: the driver reads them off the table (RUN_FIXTURES)
    ]);
    const summary = applied
      ? fillSlots(shown.length === 1 ? say.listMatchOne : say.listMatchMany, { count: shown.length, key: e(applied.key), op: e(applied.op), value: e(applied.value) })
      : fillSlots(say.listCount, { count: shown.length });
    const box = $('#its-explorer');
    box.innerHTML = panel({
      headHtml: explorerHead(say.explorerListTitle, 'its-explorer-title'),
      sections: [
        fillSlots(say.listSession, { session: `<code id="its-session">${e(tele.sessionId)}</code>` }),
        filterForm(),
        shown.length === 0
          ? `<p id="its-results" tabindex="-1" aria-live="polite">${say.listNone}</p>`
          : `<p id="its-results" tabindex="-1" aria-live="polite">${summary}</p>` +
            table({
              caption: say.listCaption,
              head: say.listHead,
              rows,
              numeric: [0, 2, 3, 4],
            }) +
            buttonRow(shown.map((_, i) => button({ id: `its-open-trace-${i}`, label: fillSlots(say.listOpenButton, { n: i + 1 }), variant: 'ghost' })).join('')),
      ],
    });
    $('#its-filter-apply').onclick = () => {
      const key = checked('its-fkey');
      const op = checked('its-fop');
      const value = $('#its-fvalue').value.trim();
      form = { key, op, value };
      if (value === '') {
        setFeedback($('#its-filter-feedback'), 'neutral', say.filterValueSays, { scroll: true });
        return;
      }
      applied = { key, op, value };
      if (key === FILTER_KEY.sessionId && op === FILTER_OP.is && value === tele.sessionId) filtered = true;
      showList();
      $('#its-results').focus();
    };
    const clear = $('#its-filter-clear');
    if (clear) {
      clear.onclick = () => {
        applied = null;
        form = { key: FILTER_KEY.serviceName, op: FILTER_OP.is, value: '' };
        showList();
        $('#its-results').focus();
      };
    }
    shown.forEach((t, i) => {
      $(`#its-open-trace-${i}`).onclick = () => showTrace(t);
    });
  };

  // The Trace View of the simulation: one trace's spans. The trace id is shown here, as in Dash0.
  const showTrace = (t) => {
    const root = t.spans[0];
    const rows = t.spans.map((s, i) => [
      s.name,
      i === 0 ? '-' : root.name,
      s.startMs - root.startMs,
      s.endMs - s.startMs,
      failed(s) ? 'Error' : 'Unset',
    ]);
    const opens = t.spans.map((s, i) => button({ id: `its-open-${i}`, label: fillSlots(say.traceOpenButton, { name: s.name }), variant: 'ghost' })).join('');
    $('#its-explorer').innerHTML = panel({
      headHtml: explorerHead(say.explorerTraceTitle, 'its-trace-title'),
      sections: [
        fillSlots(say.traceIdLine, { id: `<code id="its-trace">${e(t.traceId)}</code>` }),
        table({
          caption: say.traceCaption,
          head: say.traceHead,
          rows,
          numeric: [2, 3],
        }),
        buttonRow(opens),
        `<div id="its-detail" aria-live="polite" tabindex="-1">${note(say.traceNote)}</div>`,
        buttonRow(button({ id: 'its-back', label: say.traceBackButton, variant: 'ghost' })),
      ],
    });
    $('#its-trace-title').focus();
    t.spans.forEach((s, i) => {
      $(`#its-open-${i}`).onclick = () => {
        const box = $('#its-detail');
        box.innerHTML = detail(s, t);
        box.querySelector('#its-detail-title').focus();
      };
    });
    $('#its-back').onclick = () => {
      showList();
      $('#its-results').focus();
    };
  };

  // The Span Sidebar of the simulation: the span's attributes and events. The one place a fault code is.
  const detail = (s, t) => {
    const attrs = Object.entries({ ...(s.attributes ?? {}), ...RESOURCE_ATTRIBUTES, [SESSION_ATTR]: t.sessionId }).map(([k, v]) => [k, String(v)]);
    const events = Array.isArray(s.events) ? s.events : [];
    const status = failed(s) ? `Error: ${s.status.message ?? ''}` : 'Unset';
    return panel({
      variant: 'inset',
      headHtml: `<h4 tabindex="-1" id="its-detail-title">${e(s.name)}</h4> ${chip({ text: status, tone: failed(s) ? 'error' : 'neutral' })}`,
      sections: [
        table({ caption: fillSlots(say.detailAttrCaption, { name: s.name }), head: say.detailAttrHead, rows: attrs }),
        events.length === 0
          ? note(say.detailNoEvents)
          : table({
            caption: fillSlots(say.detailEventsCaption, { name: s.name }),
            head: say.detailEventsHead,
            rows: events.map((ev) => [
              ev.name,
              ev.timeMs - s.startMs,
              Object.entries(ev.attributes ?? {}).map(([k, v]) => `${k}=${v}`).join(', ') || '-',
            ]),
            numeric: [1],
          }),
      ],
    });
  };

  // ---- find it, then answer ----
  const stepFind = (mode) => {
    const practice = mode === MODE.practice;
    if (practice && traces === null) traces = buildTraceList(incident, { sessionId: tele.sessionId });
    const findIt = practice
      ? '<div id="its-explorer"></div>'
      : prose(
        `<h4>${say.findGuideTitle}</h4>` +
          // VERIFY (#195): that a session.id span attribute set by the sender is offered as a filter key.
          fillSlots(say.findGuide, { session: `<code id="its-session">${e(tele.sessionId)}</code>` }),
      );
    ctx.renderStep(
      screen(
        ctx.speech(practice ? say.findIntroPractice : say.findIntroLive),
        chip(practice ? { text: say.simulated, tone: 'attention' } : { text: say.findChipLive, tone: 'success' }),
        findIt,
        ...say.questions.map((qn) =>
          field({ id: `its-q-${qn.key}`, label: qn.label, autocompleteOff: true, noteHtml: e(qn.note) }) +
          feedback({ id: `its-q-${qn.key}-feedback` })),
        feedback({ id: 'its-feedback' }),
      ),
      bar(
        button({ id: 'its-check', label: say.findCheckButton, variant: 'primary' }) +
          finishButton('its-finish', say.findFinishReason),
      ),
    );
    if (practice) showList();

    const passed = new Set();
    const charged = new Set();
    const check = () => {
      for (const qn of say.questions) {
        if (passed.has(qn.key)) continue;
        const input = $(`#its-q-${qn.key}`);
        const fb = $(`#its-q-${qn.key}-feedback`);
        const value = input.value;
        const grade = gradeAnswer(spans, qn.key, value);
        if (grade === GRADE.pass) {
          passed.add(qn.key);
          input.disabled = true;
          setFeedback(fb, 'success', say.findRightSays);
        } else if (grade === GRADE.fail) {
          // Each distinct wrong value costs once; pressing Check again over the same value is free.
          const cause = `${qn.key}:${normaliseAnswer(qn.key, value)}`;
          if (!charged.has(cause)) {
            charged.add(cause);
            ctx.mistake();
          }
          setFeedback(fb, 'error', e(qn.wrong));
        } else {
          setFeedback(fb, 'neutral', e(qn.nudge), { scroll: true });
        }
      }
      if (passed.size === say.questions.length) {
        actions.querySelector('#its-check').disabled = true;
        actions.querySelector('#its-finish').disabled = false;
        setFeedback($('#its-feedback'), 'success', say.findAllRightSays);
      }
    };
    actions.querySelector('#its-check').onclick = check;
    actions.querySelector('#its-finish').onclick = () =>
      ctx.finish({
        text: practice
          ? (filtered ? say.findFinishFiltered : say.findFinishUnfiltered)
          : say.findFinishLive,
        cards: [],
      });
    // Practice: the task starts in the explorer, not in the first answer field.
    (practice ? $('#its-explorer-title') : $('#its-q-operation')).focus({ preventScroll: true }); // a new step opens at its top (#331)
  };

  stepStart();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { vars: VARS, slots: SLOTS, screens });
}

export default withText(CORE);
