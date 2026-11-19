// Level 2.6: Events and links. The player learns that an exception record, a span event or
// a log record, never sets a span's status, sets the statuses of three spans by what
// happened in them, then links a batch consumer to the three messages it handled, one
// from each of three traces. Spec: docs/M1-DESIGN.md §6 Act 2.
// Spec: https://opentelemetry.io/docs/specs/otel/trace/api/#record-exception , https://opentelemetry.io/docs/specs/semconv/general/recording-errors/ , https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/
//
// A run(ctx) level: its words are in content/core/levels/events-and-links.mjs (docs/CONTENT.md section 11), read here as
// say.<name>; this file keeps the answers, the span fixtures and the screens.
import CORE from '../content/core/levels/events-and-links.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { mountBuild, renderBuild } from '../lib/widgets/build-it-view.mjs';
import { newBuildState } from '../lib/widgets/build-it.mjs';
import { actions, codeBlock, finishButton, nextButton, question, step } from '../lib/ui/index.mjs';

const CHARGE = '8f14e45fceea167a';
const RETRY = '45c48cce2e2d7fbd';
const STOCK = 'a87ff679a2f3e71d';
const P1 = '1679091c5a880faf';
const P2 = '8e296a067a375633';
const P3 = 'a5771bce93e200c3';
const SEND = 'd67d8ab4f4c10bf2';

const span = (spanId, traceId, service, name, kind, startMs, endMs, status = 'UNSET', events = []) => ({
  spanId, traceId, name, service, kind, startMs, endMs, status,
  attributes: {}, events, parentId: null, links: [],
});

// This level's copy has no figures a grader computes over and no values only the code knows: no fill-ins.
const VARS = {};
const SLOTS = [];

// Step 2: what happened in each span (authored), and the statuses as recorded. charge's
// exception escaped and was recorded, yet its status is Unset; a helper set Error on
// charge with retry, a span over the whole charge, retries included, although the code
// there handled the reset, retried, and the charge went through.
const ERRORS = {
  id: 'evl-errors',
  spans: [
    span(CHARGE, 'c9f0f895fb98ab9159f51fd0297e236d', 'payments', 'charge', 'INTERNAL', 0, 80, 'UNSET', [
      { name: 'exception', atMs: 78, attributes: { 'exception.type': 'CardDeclinedError' } },
    ]),
    span(RETRY, 'd3d9446802a44259755d38e6d163e820', 'payments', 'charge with retry', 'INTERNAL', 10, 40, 'ERROR'),
    span(STOCK, 'e4da3b7fbbce2345d7772b0674a318d5', 'inventory', 'GET /stock', 'SERVER', 50, 60),
  ],
  edit: ['status'],
  answer: { [CHARGE]: { status: 'ERROR' }, [RETRY]: { status: 'UNSET' } },
  helps: {}, // the help ladder's last rung (docs/M1-DESIGN.md §4.2): no helps, a Check button, no hints
};

// The name and service each story is told under, in the order of the content's `stories`.
const STORY_HEADS = [
  ['charge', 'payments'],
  ['charge with retry', 'payments'],
  ['GET /stock', 'inventory'],
];

// Step 3: notifications handles one batch of three order messages, each published in its
// own request (its own trace). The consumer span is a root; the answer links all three.
const BATCH = {
  id: 'evl-batch',
  spans: [
    span(P1, '6512bd43d9caa6e02c990b0a82652dca', 'orders', 'orders publish', 'PRODUCER', 0, 5),
    span(P2, 'c20ad4d76fe97759aa27a0c99bff6710', 'orders', 'orders publish', 'PRODUCER', 10, 15),
    span(P3, 'c51ce410c124a10e0db5e4b97fc2af39', 'orders', 'orders publish', 'PRODUCER', 20, 25),
    span(SEND, 'aab3238922bcc25a6f606eb525ffdc56', 'notifications', 'send batch', 'CONSUMER', 40, 70),
  ],
  edit: ['links'],
  answer: { [SEND]: { links: [P1, P2, P3] } },
  helps: {}, // no helps, a Check button, no hints
};

const SKELETON = {
  id: 'events-and-links',
  no: '2.6',
  icon: '\u{1F4CE}',
  mechanics: ['build'],
  widgets: ['choice', 'build'],
  hintless: ['build'], // both builds have helps: {}: a Check button, no Hint button
  cards: ['exception-no-status', 'batch-links'],
  lights: [],
  scoring: { parMs: null },
  run: {
    // Step 1: an exception recorded, then the span ended. `why` follows "Right." or "Not quite.".
    recorded: [{ key: 'unset', right: true }],
  },
};

/** The level's answer tables, in play order (pinned by test/act-2.test.mjs), from the bound words `say`. */
const contentOf = (say) => ({
  steps: [
    { id: 'evl', question: say.recordedQuestion, choices: say.recorded },
    { build: ERRORS },
    { build: BATCH },
  ],
});
export const CONTENT = contentOf(bindLevel(CORE, SKELETON, { vars: VARS, slots: SLOTS }).run);

function screens(ctx, say) {
  const bar = ctx.ovActions;
  const e = ctx.escapeHtml;
  const [{ choices: RECORDED }] = contentOf(say).steps; // the same table CONTENT holds
  const next = (onclick) => {
    const btn = bar.querySelector('#evl-next');
    btn.onclick = onclick;
    return btn;
  };

  const stepRecorded = () => {
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.recordedIntro)}${codeBlock('catch (err) {\n  span.recordException(err);\n  throw err;\n} finally {\n  span.end();\n}')}${question({ id: 'evl-q', html: say.recordedQuestion })}${choiceHtml(ctx, RECORDED, { id: 'evl', labelledBy: 'evl-q' })}`,
      }),
      actions({ wide: false, buttonsHtml: nextButton('evl-next', say.recordedReason) }),
    );
    const btn = next(stepErrors);
    mountChoice(ctx, RECORDED, {
      id: 'evl',
      onRight: () => {
        btn.disabled = false;
        return btn;
      },
    });
  };

  const stepErrors = () => {
    const stories = STORY_HEADS.map(([name, service], i) => `<li><code>${e(name)}</code> (${e(service)}): ${say.stories[i]}</li>`).join('');
    ctx.renderStep(
      step({
        wide: true,
        bodyHtml: `${ctx.speech(`${say.errorsIntro}<ul>${stories}</ul>`)}${question({ html: say.errorsQuestion })}${renderBuild(ERRORS, newBuildState(ERRORS), { escapeHtml: e })}`,
      }),
      actions({ wide: true, buttonsHtml: nextButton('evl-next', say.errorsReason) }),
    );
    const btn = next(stepBatch);
    mountBuild(ctx, ERRORS, {
      onComplete: () => {
        btn.disabled = false;
        return btn;
      },
    });
  };

  const stepBatch = () => {
    ctx.renderStep(
      step({
        wide: true,
        bodyHtml: `${ctx.speech(say.batchIntro)}${question({ html: say.batchQuestion })}${renderBuild(BATCH, newBuildState(BATCH), { escapeHtml: e })}`,
      }),
      actions({ wide: true, buttonsHtml: finishButton('evl-finish', say.batchReason) }),
    );
    const finish = bar.querySelector('#evl-finish');
    mountBuild(ctx, BATCH, {
      onComplete: () => {
        finish.disabled = false;
        return finish;
      },
    });
    finish.onclick = () =>
      ctx.finish({
        text: say.finish,
        cards: ['exception-no-status', 'batch-links'],
      });
  };

  stepRecorded();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { vars: VARS, slots: SLOTS, screens });
}

export default withText(CORE);
