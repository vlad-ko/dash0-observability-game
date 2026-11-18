// Level 1.2: Naming your service. The checkout service ships without a name and shows
// up as unknown_service:node; the player spots the fallback, fixes the .env with the
// level 1.2 checker (lib/widgets/env-config.mjs), then answers which name wins when
// OTEL_SERVICE_NAME and service.name in OTEL_RESOURCE_ATTRIBUTES disagree.
// Spec: https://opentelemetry.io/docs/specs/semconv/registry/attributes/service/ , https://opentelemetry.io/docs/specs/semconv/registry/attributes/deployment/ , https://opentelemetry.io/docs/specs/otel/resource/sdk/#specifying-resource-information-via-an-environment-variable , https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/
// Design: docs/FOUNDATION.md §5 and §6 F6. Player text reaches HTML only via escapeHtml.
//
// A run(ctx) level: its words are in content/core/levels/naming-your-service.mjs (docs/CONTENT.md section 11), read here
// as say.<name>; this file keeps the answers and the screens.
import CORE from '../content/core/levels/naming-your-service.mjs';
import { bindRunLevel } from '../lib/content/bind.mjs';
import { fillSlots } from '../lib/content/placeholders.mjs';
import { actions, codeBlock, finishButton, helpChips, nextButton, prose, question, setFeedback, sideColumn, split, step } from '../lib/ui/index.mjs';
import { choiceHtml, mountChoice } from '../lib/widgets/choice.mjs';
import { canFocus } from '../lib/widgets/focus.mjs';
import { editorPanel, fitEditor, lockEditor } from '../lib/widgets/editor.mjs';
import { mountHintLadder, ruleText } from '../lib/widgets/help-ladder.mjs';
import { normalizeConfig } from '../lib/widgets/configure-it.mjs';
import { checkConfig, effectiveResource, parseEnv, renderIssues } from '../lib/widgets/env-config.mjs';
import { GIVEN, PROCESS, TARGET, hintFor } from '../lib/widgets/env-config-help.mjs';
import { playSwirl } from '../lib/swirl-render.mjs';

// This level's copy has no figures a grader computes over: no vars. The slots are what only the running level knows
// (the count and list of problems Check found, and the values of the config that passed).
const VARS = {};
const SLOTS = ['count', 'issues', 'name', 'version', 'environment'];

const SKELETON = {
  id: 'naming-your-service',
  no: '1.2',
  icon: '\u{1F3F7}\u{FE0F}',
  mechanics: ['configure'],
  // Its .env step is the env checker (lib/widgets/env-config.mjs), which follows the penalty rules of Configure it.
  widgets: ['choice', 'configure'],
  cards: ['unknown-service'],
  lights: ['checkout'],
  run: {
    // Step 1: what the given config shows up as. `why` follows "Right." or "Not quite.".
    showsUpAs: [{ key: 'fallback', right: true }],
    // Step 3: which name wins when both are set.
    whoWins: [{ key: 'env-var', right: true }],
  },
};

function screens(ctx, say) {
  const body = ctx.ovBody;
  const bar = ctx.ovActions;
  const SHOWS_UP_AS = say.showsUpAs;
  const WHO_WINS = say.whoWins;
  // Step 2's score card follows the penalty rules of Configure it (lib/widgets/configure-it-view.mjs).
  const RULE = ruleText(say.rule);

  const stepShowsUpAs = () => {
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.showsUpAsIntro)}<div id="nys-config">${codeBlock(GIVEN, { wrap: true })}</div>${question({ id: 'nys-q-name', html: say.showsUpAsQuestion })}${choiceHtml(ctx, SHOWS_UP_AS, { id: 'nys', labelledBy: 'nys-q-name' })}`,
      }),
      actions({ wide: false, buttonsHtml: nextButton('nys-next', say.showsUpAsReason) }),
    );
    const next = bar.querySelector('#nys-next');
    mountChoice(ctx, SHOWS_UP_AS, {
      id: 'nys',
      onRight: () => {
        next.disabled = false;
        return next;
      },
    });
    next.onclick = stepFix;
  };

  const stepFix = () => {
    const editor = editorPanel({
      inputId: 'nys-env',
      label: say.fixEditorLabel,
      rows: 6,
      wrap: true,
      value: GIVEN,
      noteHtml: say.envNote,
      actionId: 'nys-check',
      actionLabel: say.fixCheckButton,
      feedbackId: 'nys-feedback',
    });
    const chips = helpChips('nys', [
      { key: 'instant', label: say.fixInstantChip, on: true },
      { key: 'hints', label: 'Hints', on: true }, // the same word as the kit's own heading in the score card (lib/ui/side.mjs): RUN_FIXTURES
    ]);
    const side = sideColumn({ id: 'nys', titleHtml: say.fixSideTitle, counts: [{ key: 'wrong', label: '' }], hints: true, ruleHtml: RULE });
    ctx.renderStep(
      step({
        wide: true,
        bodyHtml: `${ctx.speech(say.fixIntro)}<div data-env-config>${split({ mainHtml: chips + editor, sideHtml: side })}</div>`,
      }),
      actions({ wide: true, buttonsHtml: nextButton('nys-next', say.fixNextReason) }),
    );
    const box = body.querySelector('[data-env-config]');
    const input = body.querySelector('#nys-env');
    const check = body.querySelector('#nys-check');
    const fb = body.querySelector('#nys-feedback');
    const next = bar.querySelector('#nys-next');
    const tell = (tone, html) => setFeedback(fb, tone, html, { scroll: true }); // each line answers a button press (#339)
    const fit = fitEditor(input, { max: 16, signal: ctx.signal });
    const tried = new Set(); // normalised failing configs, as in Configure it
    ctx.widget?.('configure'); // this step is the env checker, a Configure it board (how to play follows it)
    const ladder = mountHintLadder(ctx, box, 'nys', {
      swirl: playSwirl,
      fallback: () => input,
      wrongNouns: [say.fixWrongNounOne, say.fixWrongNounMany],
      hint: (tier) => hintFor(input.value, tier),
      fill: (text) => {
        input.value = text;
        fit();
        run({ hinted: true });
      },
    });

    /** Check `input.value`. `hinted` marks the tier 3 run: the right answer is then not earned. */
    function run({ hinted = false } = {}) {
      if (ladder.done) return;
      const text = input.value;
      if (!hinted && text.trim() === '') return void tell('neutral', say.fixBlankSays);
      const result = checkConfig(text, TARGET, PROCESS);
      if (!result.ok) {
        // Only a new failing config costs a mistake; any config already checked (same after normalising) is free.
        // A .env parses the same without indentation or blank lines, so the key ignores both.
        const norm = normalizeConfig(text).split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
        const same = tried.has(norm);
        tried.add(norm);
        const count = result.issues.length;
        const issues = prose(renderIssues(result.issues, ctx.escapeHtml));
        if (same) return void tell('neutral', fillSlots(say.fixRepeatSays, { issues }));
        ladder.miss();
        tell('error', count === 1 ? fillSlots(say.fixMissOneSays, { issues }) : fillSlots(say.fixMissManySays, { count, issues }));
        return;
      }
      const { attributes: attrs, source } = effectiveResource(parseEnv(text).vars, PROCESS);
      const e = ctx.escapeHtml;
      ladder.complete();
      lockEditor(input, check);
      tell(
        hinted ? 'neutral' : 'success',
        `${hinted ? `${say.fixFilledSays} ` : ''}${fillSlots(say.fixPassSays, {
          name: e(attrs['service.name']),
          version: e(attrs['service.version']),
          environment: e(attrs['deployment.environment.name']),
        })}${source === 'OTEL_RESOURCE_ATTRIBUTES' ? prose(say.fixAttrNote) : ''}`,
      );
      next.disabled = false;
      ladder.succeed();
    }

    check.onclick = () => {
      if (check.disabled) return;
      run();
    };
    next.onclick = stepWhoWins;
    (canFocus(input) ? input : fb).focus();
  };

  const stepWhoWins = () => {
    ctx.renderStep(
      step({
        wide: false,
        bodyHtml: `${ctx.speech(say.whoWinsIntro)}${codeBlock(say.clashEnv, { wrap: true })}${question({ id: 'nys-q-wins', html: say.whoWinsQuestion })}${choiceHtml(ctx, WHO_WINS, { id: 'nys', labelledBy: 'nys-q-wins' })}`,
      }),
      actions({ wide: false, buttonsHtml: finishButton('nys-finish', say.whoWinsReason) }),
    );
    const finish = bar.querySelector('#nys-finish');
    mountChoice(ctx, WHO_WINS, {
      id: 'nys',
      onRight: () => {
        finish.disabled = false;
        return finish;
      },
    });
    finish.onclick = () =>
      ctx.finish({
        text: say.finish,
        cards: ['unknown-service'],
      });
  };

  stepShowsUpAs();
}

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindRunLevel(text, SKELETON, { vars: VARS, slots: SLOTS, screens });
}

export default withText(CORE);
