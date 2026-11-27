// The In Dash0 step's markup and mount (#509, docs/DECLARATIVE-LEVELS.md). The only home of "a charged fail costs one
// mistake; a check that cannot be judged costs nothing and says why and when to try again". No timers: a wait is text and a
// Retry button. The answers are never here: the server derives and grades them (lib/dash0-task/client.mjs is the only way
// in). The words are content/core/ui/dash0-task.mjs. Markup is the kit's (lib/ui). DOM-free at import.
import COPY from '../../content/core/ui/dash0-task.mjs';
import { focusFirst } from './focus.mjs';
import { tell } from './tell.mjs';
import { DOWN_AFTER, causeOf, missesAfter, offersSkip } from './dash0-task.mjs';
import { button, buttonRow, codeBlock, eyebrow, externalLink, feedback, field, note } from '../ui/index.mjs';

export { DOWN_AFTER };

const fill = (text, vars) => Object.entries(vars).reduce((t, [k, v]) => t.replace(`{${k}}`, String(v)), text);
const fieldId = (spec, key) => `${spec.id}-f-${key}`;

/**
 * The step's body: a Start button, then (hidden until the task has started) the task's details and, for each question, its answer
 * field and its own Check, a slot for Retry and "Finish without the Dash0 task", and the feedback region `#<id>-feedback`.
 * Ids: `<id>-start`, `<id>-task`, `<id>-info`, `<id>-f-<question>`, `<id>-check-<question>`, `<id>-more`, `<id>-retry`, `<id>-skip`.
 */
export function renderDash0(ctx, spec) {
  const id = spec.id;
  const rows = spec.answers.map((k) => {
    const f = spec.fields.find((x) => x.key === k);
    return field({ id: fieldId(spec, k), label: f.label, kind: 'text', autocompleteOff: true, ...(f.hint === undefined ? {} : { noteHtml: f.hint }) }) +
      buttonRow(button({ id: `${id}-check-${k}`, label: COPY.check, variant: 'primary' }));
  });
  return (
    `<div id="${id}-top">${buttonRow(button({ id: `${id}-start`, label: COPY.start, variant: 'primary' }))}</div>` +
    `<div id="${id}-task" hidden><div id="${id}-info"></div>${rows.join('')}</div>` +
    `<div id="${id}-more"></div>` +
    feedback({ id: `${id}-feedback` })
  );
}

/**
 * Wire the step rendered by renderDash0 into ctx.ovBody. Start asks ctx.dash0Task.start; the started task shows its Open in
 * Dash0 link (only when ctx.dash0Task.isDash0AppUrl says the server's link is app.dash0.com), the asset name of a readback
 * task, the tag and when the data is ready, and one field per question. Each field's Check sends one `{question, value}`:
 * a pass locks that field; once every question has passed the step calls onDone() (Next or Finish) and ctx.dash0Task.passed;
 * a fail with `charge` calls ctx.mistake() once; a fail without one, or an inconclusive result, costs nothing and says why
 * (and when to try again, as text) with a Retry button. A stale or expired attempt (restart) offers Start again, never a mistake.
 * When the server says it is off or the player is signed out, or DOWN_AFTER results in a row cannot be judged, "Finish
 * without the Dash0 task" appears: it records the task as skipped (ctx.dash0Task.skip, D7), calls onDone() and costs
 * nothing, so the player is never stuck. After one such skip, a later In Dash0 step of the same level skips at once.
 */
export function mountDash0Task(ctx, spec, { onDone }) {
  ctx.widget?.('dash0');
  const api = ctx.dash0Task;
  if (!api) throw new TypeError(`dash0 "${spec.id}": needs ctx.dash0Task`);
  const id = spec.id;
  const $ = (s) => ctx.ovBody.querySelector(`#${id}-${s}`);
  const [top, task, info, more, fb] = ['top', 'task', 'info', 'more', 'feedback'].map($);
  const qs = spec.answers.map((key) => ({ key, el: $(`f-${key}`), btn: $(`check-${key}`), label: spec.fields.find((f) => f.key === key).label, passed: false }));
  const text = (t) => ctx.escapeHtml(t);
  const say = (tone, t, opts) => tell(ctx, fb, tone, text(t), opts);
  const gone = () => ctx.signal?.aborted === true || !fb.isConnected; // the step was left: a late answer draws and charges nothing
  let attempt = null;
  let misses = 0;
  let busy = false;
  let over = false; // every question passed, or skipped
  let again = { run: 'start' }; // what Retry does
  let cause = null; // set when "Finish without" is on offer

  const lock = (on) => {
    busy = on;
    const start = $('start');
    if (start) start.disabled = on || attempt !== null;
    for (const q of qs) q.btn.disabled = on || over || q.passed;
    const retry = $('retry');
    if (retry) retry.disabled = on || over;
  };

  // The slot under the fields: Retry and, when on offer, "Finish without the Dash0 task".
  const drawMore = (retryLabel) => {
    const rows = [];
    if (retryLabel !== null) rows.push(button({ id: `${id}-retry`, label: retryLabel, variant: 'ghost' }));
    if (cause !== null) rows.push(button({ id: `${id}-skip`, label: COPY.skip, variant: 'ghost' }));
    more.innerHTML = rows.length === 0 ? '' : buttonRow(rows.join(''));
    const retry = $('retry');
    if (retry) retry.onclick = () => (again.run === 'start' ? doStart() : doCheck(again.q));
    const skip = $('skip');
    if (skip) skip.onclick = doSkip;
  };

  // The one way to leave the step without a pass: remember the task (D7), open Next or Finish, say what to do later.
  function skipNow(why) {
    over = true;
    api.skip?.([spec.task], why);
    lock(false);
    more.innerHTML = '';
    say('neutral', COPY.notices[why]);
    focusFirst(onDone(), { fallback: fb });
  }
  function doSkip() {
    if (over || cause === null) return;
    skipNow(cause);
  }

  // A result that is no verdict: say why, and when to try again, as text; count it towards "the server is not answering".
  function unjudged(res, retry) {
    misses = missesAfter(misses, res);
    const why = COPY.reasons[res.reason] ?? COPY.reasons.default;
    const wait = res.retryAfterS > 0 ? ` ${fill(COPY.retryIn, { seconds: res.retryAfterS })}` : '';
    if (offersSkip(res, misses)) cause = causeOf(res);
    again = res.restart ? { run: 'start' } : retry;
    drawMore(res.restart ? COPY.restart : COPY.retry);
    say('neutral', `${why}${wait}${cause === null ? '' : ` ${COPY.offer}`}`, { scroll: true });
  }

  async function doStart() {
    if (busy || over) return;
    lock(true);
    say('neutral', COPY.starting, { scroll: false });
    const res = await api.start(spec.task);
    if (gone()) return;
    if (!res.ok) {
      lock(false);
      return unjudged(res, { run: 'start' });
    }
    attempt = res;
    misses = 0;
    cause = null;
    for (const q of qs) q.passed = false; // a new attempt asks every question again
    top.hidden = true;
    task.hidden = false;
    const link = api.isDash0AppUrl(res.link) ? externalLink({ id: `${id}-open`, label: COPY.open, href: res.link }) : '';
    const asset = res.name === undefined ? '' : eyebrow(COPY.nameLabel) + codeBlock(res.name, { wrap: true });
    info.innerHTML = (link === '' ? '' : buttonRow(link)) + asset + note(`${text(COPY.tagLabel)}: <b>${text(res.tag)}</b>. ${text(fill(COPY.ready, { seconds: res.readyAfterS }))}`);
    drawMore(null);
    fb.setAttribute('hidden', '');
    lock(false);
    focusFirst(qs[0].el, { fallback: fb });
  }

  async function doCheck(key) {
    const q = qs.find((x) => x.key === key);
    if (busy || over || attempt === null || !q || q.passed) return;
    lock(true);
    say('neutral', COPY.checking, { scroll: false });
    const res = await api.check(spec.task, attempt.attemptId, { question: key, value: q.el.value.trim() });
    if (gone()) return;
    if (res.outcome === 'pass') {
      misses = 0;
      cause = null;
      q.passed = true;
      q.el.disabled = true;
      drawMore(null);
      const left = qs.filter((x) => !x.passed).length;
      if (left > 0) {
        lock(false);
        say('success', `${COPY.answered} ${fill(COPY.left, { n: left })}`);
        return;
      }
      over = true;
      lock(false);
      say('success', COPY.passed);
      api.passed?.(spec.task);
      focusFirst(onDone(), { fallback: fb });
      return;
    }
    lock(false);
    if (res.outcome === 'fail') {
      misses = 0;
      cause = null;
      if (res.charge === true) ctx.mistake();
      const why = res.reason === undefined || res.reason === 'answer' ? '' : ` ${COPY.reasons[res.reason] ?? ''}`.trimEnd();
      const wait = res.retryAfterS > 0 ? ` ${fill(COPY.retryIn, { seconds: res.retryAfterS })}` : '';
      drawMore(null);
      say('error', `${fill(COPY.failedField, { field: q.label })}${why}${wait}`);
      return;
    }
    if (res.restart) attempt = null;
    unjudged(res, { run: 'check', q: key });
  }

  $('start').onclick = doStart;
  for (const q of qs) q.btn.onclick = () => doCheck(q.key);
  // After an earlier step of this level was skipped (the server is down or the player signed out), do not ask again.
  const earlier = api.downCause?.() ?? null;
  if (earlier !== null) skipNow(earlier);
  else focusFirst($('start'), { fallback: fb });
}
