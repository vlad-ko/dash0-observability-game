# Level content apart from level logic

For anyone who writes or edits what a level says. A level has two parts: the **words** (questions, choices, explanations) and the **logic** (which answer is right, the figures the copy quotes, how the pieces are wired). The words live in a content file; the logic stays in `levels/<id>.mjs`. Each part is checked on its own, and a tool joins them when the game loads. Design background: docs/FOUNDATION.md §2.13. Act primers use the same text rules and have their own guide: [PRIMERS.md](PRIMERS.md), which this page does not repeat.

Only play levels (the ones with `play: { steps }`, see [DECLARATIVE-LEVELS.md](DECLARATIVE-LEVELS.md)) can be converted so far. Today `good-alerts` and `cardinality` are converted; the other levels still hold their words in the level file, and both kinds work side by side.

**A new level** is written in the level file, as before. It is converted in its act's conversion pull request (section 9), not at birth.

## 1. Where files live

- Words: `content/core/levels/<level-id>.mjs`. The file name is the level id. `core` is the edition (see section 8).
- Logic: `levels/<level-id>.mjs`, with the `// Spec:` and `// Dash0 docs:` lines, "Facts used" and "Invented" comments kept at the top. The sources stay with the logic for now.
- Shared code: `lib/content/` (`bind.mjs` joins, `placeholders.mjs` fills in the `{{name}}` marks (the file keeps its older name), `text-rules.mjs` checks text, `keys.mjs` lists the allowed keys). Do not add a second way to store content anywhere else.
- `content/` is deployed with the site (it is not in `.vercelignore`), because the level imports it.

## 2. The content file

A header of `//` lines, then `export default`, one JSON object and `;`. JSON is strict: double quotes everywhere, no trailing commas, no repeated key in one object, no `//` comment inside the object. The first header line should read `// Text of levels/<id>.mjs (docs/CONTENT.md).` and no header line may start `// Spec:` (that marks logic files). In JSON an apostrophe is plain (`team's`), a double quote is `\"`.

At the top: `id` (the level id), `name`, `sub`, `rewardTitle`, and `play` with `finish` and `steps`. A step holds `intro`, `question` and optionally `show` and `code`, plus one widget key (`choice`, `spot`, `tradeoff`, ...) holding that widget's text. The shape mirrors the widget spec in DECLARATIVE-LEVELS.md section 2: copy an existing file such as `content/core/levels/cardinality.mjs` and edit the words.

Things to know:
- Order is yours. Choices, options, lines and needs appear in the game in the order the content file lists them.
- Every element that the logic needs to find carries its `id` or `key` (a choice has `key`, a spot line, knob, option or need has `id`; a step is found by its widget key plus the widget's `id`).
- Content holds **text only**. A number, `true` or `false` in a content file is an error. So are answer flags (`right`, `keep`, `faults`, `answer`, `cost`, `keeps`, `cap`, `bucket`): those stay in the logic.

## 3. How the two parts are joined (merge rules)

`bindLevel` merges the content into the level's logic. You rarely need the detail, but these are the rules, and the validator's messages follow them:

- Two objects are merged key by key. A key on only one side is kept as is.
- A key on both sides must be an `id` or `key` with the same value, or an object or array on both sides. Two plain values for one key is an error ("set in both the logic and the content").
- Two arrays are joined by `id` (or `key`). The content's order wins. The logic may list only the elements it needs to annotate (for example only the choice that is `right`). An element in the logic with no text in the content is an error. A repeated id is an error.
- `steps` must name the same widgets in the same order on both sides.
- The result is a fresh copy; it shares nothing with the content file.

### Allowed content keys

Anything else is an error ("is not a content key").
- Identity: `id`, `key`.
- Containers: `play`, `steps`, `choice`, `sort`, `spot`, `tradeoff`, `incident`, `build`, `query`, `configure`, `choices`, `buckets`, `items`, `lines`, `knobs`, `options`, `needs`, `views`, `hypotheses`, `alert`.
- Text: `intro`, `question`, `show`, `code`, `finish`, `label`, `why`, `whyNot` (an object from a key to text), `explain`, `hint`, `text`, `html`, `title`, `unit`, `unitOne`, `closing`, `name`, `sub`, `rewardTitle`.

The logic file must not hold any text key ("text in the logic file: <path>"), except inside data a grader computes over. The code calls these the **fixture keys** (`FIXTURE_KEYS` in `lib/content/keys.mjs`, and the tests use the same word): `spans`, `logs`, `answer`, `faults`, `given`, `reference`, `dataset`, `withhold`, `uses`, `target`, `extensions`, `forbids`, `helps`, `budget`. Rule of thumb: if the game computes over a piece of data (a log line a checker reads, a YAML the grader parses), it stays in the logic even if the player sees it. If it is only shown, it goes in the content.

## 4. Fill-ins: a figure the copy quotes

When copy quotes a number that the logic computes (a series count, a total), write `{{name}}` in the content (a **fill-in**) and put the figure in the level file's `VARS` table (the code keeps the older name "placeholder" in `lib/content/placeholders.mjs`; PRIMERS.md uses "placeholder" for unfinished primer text, which is a different thing):

```js
const VARS = { route: VALUES.route, 'product-mrs': n(product('method', 'route', 'status')) };
```

Then `"{{times-mrs}} = {{product-mrs}}"` in the content shows `5 × 14 × 9 = 630`, and a change to `VALUES` changes the copy and the answer together. Rules:
- A name is lower case: `[a-z][a-z0-9-]*`. Any other `{{` is an error ("malformed fill-in"). A lone `}}` (YAML copy has them) is plain text.
- A value is a string or a finite number. Format it in the level file (`n(x)` adds the thousands comma); the content never formats.
- Every fill-in needs a value (a missing one is an error, never an empty string), and every value in `VARS` must be used.
- Inserted values are not searched again for fill-ins, and are not escaped: a value in an HTML field is checked after it is filled in.
- Ids (`id`, `key`) never hold a fill-in.

## 5. Plain text and HTML fields

- Plain (shown as written; the widget escapes it): `finish`, `name`, `sub`, `rewardTitle`, `unit`, `unitOne`, `code` and a spot line's `text`. Rules: no leading or trailing space, no control characters, no em dash. `code` and `finish` may hold line breaks and tabs (several levels write a multi-line finish).
- Every other text field is trusted HTML, checked by `checkHtml` in `lib/content/text-rules.mjs`. Allowed tags: `p b strong i em code pre br ul ol li table caption thead tbody tr th td`. Allowed attributes: `scope` on `th`, `data-wrap` on `pre`, `data-token` on `code`. Everything else is an error: links, images, scripts, `style=`, `on...=` handlers, `class=`, `id=`, and `x-`, `@` or `:` attributes. A `<` that does not start a tag (`p99 < 1s`) and a bare `&` (`Kettle & Co`) are fine; write `&amp;` if you prefer.
- No em dash anywhere (`test/content.test.mjs` scans `content/` too), no "costs a star" (say "counts as one penalty").

## 6. Check your work

`npm test` runs everything. The tests that matter for content: `test/level-text-content.test.mjs` (the files, the wrapper, the wiring, and that the text of every live play level would pass), `test/content-bind.test.mjs` and `test/content-placeholders.test.mjs` (the engine), `test/content.test.mjs` (em dash, "costs a star") and `test/levels-play.test.mjs` (plays every level). A broken level fails to load with one error that names the level and lists every problem, for example:

```
content of level cardinality has 2 problems:
- play.steps[0].choice.choices[1].label: fill-in {{product-mrs}} has no value
- play.steps[2].tradeoff.knobs[0].options[3].label must not contain the tag <a>
```

The messages include: "is not a content key" (a key outside the list), "must be a string" (a number, boolean or null in content), "text in the logic file" (copy left in the logic), "is in the logic and has no text in the content", "the steps differ", "appears twice", "needs an id or a key to be joined", "set in both the logic and the content", "fill-in ... has no value", "malformed fill-in", "an id must not hold a fill-in", "var ... is never used", and the text rules: "must not start or end with whitespace", "must not contain control characters", "must not contain an em dash", "has a malformed tag", "must not contain the tag <x>" and "must not give <x> the attribute y".

## 7. Changing a level's text

1. Edit the string in `content/core/levels/<id>.mjs`. Keep the JSON valid.
2. If the copy quotes a figure, change the figure in the level file's `VARS` source (for example `VALUES`), not in the text.
3. Run `node --test test/level-text-content.test.mjs` and the level's own test (a test may pin a phrase).
4. Adding a plain wrong choice, or a spot line that is not a fault, is a content edit only: the logic lists just the elements it annotates. Moving the right answer or any other flag (`right`, `keep`), a new step (it must appear in both files, in the same place) or a new `qid` touches the logic too: see [CHANGING-A-LEVEL.md](CHANGING-A-LEVEL.md).

## 8. Editions (later)

The folder name `core` is the edition: the one version of the words the game ships. A second edition (the same levels explained for another audience) would be new files under `content/<edition>/levels/` and `primers/`, and a registry that builds the acts with `levelModule.withText(text)` for that edition's text, chosen once at start-up. Every converted level exports `withText(text)` for this reason, so an edition covers converted levels only; a level that is not converted yet has one set of words. Nothing selects an edition yet, and engine words (buttons, card text, act names) are not part of an edition.

## 9. Converting a level, step by step

Do one act at a time and change only that act's level files and their content files. Only play levels convert (a level with `run(ctx)` has to become a play level first). A level written new is converted the same way, in its act's pull request.

1. **Baseline, on a clean checkout of main.** Pick a scratch folder `S` outside the repo. Run `node tools/level-fingerprint.mjs $S/before` (the exact data of every level) and `LEVEL_SNAPSHOT=$S/before node --test test/levels-play.test.mjs` (the page of every step, happy and sloppy run).
2. **Extract.** `node tools/extract-level-text.mjs <id>` prints every text field of the level as a content file, in the order the game shows it. Save it as `content/core/levels/<id>.mjs`.
3. **Put back the figures.** Every `${...}` in the old copy is now its computed result in the content file. For each, add an entry to `VARS` in the level file with the same expression (including any `n()` formatting), and write `{{name}}` in the content instead.
4. **Strip the logic.** In `levels/<id>.mjs` delete every text field (`name`, `sub`, `rewardTitle`, `intro`, `question`, `label`, `why`, `whyNot`, `explain`, `hint`, `finish`, `lines`, `needs`, `unit`, ...). Keep the ids, the answer flags (and `right: false` where it was written), the figures, `faults`, `answer`, `cost`, `keeps`, `helps`, `qid` and the wiring. Leave the header comments.
5. **Wire it.** Gather what is left into one object, `SKELETON`: the level as it was, minus the words. Then:

```js
import CORE from '../content/core/levels/<id>.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
```

6. **Prove nothing changed.** Run step 1 again into `$S/after`, then `diff -r $S/before $S/after`. It must show only the new `withText` export key in each converted level's fingerprint. Any other difference means the copy changed: fix it.
7. **Run the tests.** The level's own tests, `test/answers.test.mjs`, `test/level-text-content.test.mjs`, `test/content.test.mjs`. No existing test line should need a change; if one does, stop and ask.
8. **Mutation check.** Change one figure's source in the level file and see a pinned test go red; move one `right` flag and see `test/answers.test.mjs` go red. Put both back.

A test that reads a level's source text uses `levelSource(id)` (`test/helpers/level-source.mjs`), which also reads the content file.

## 10. Later: answer pools (#390)

A level could carry more wrong answers in its content than one play shows, and the logic would say how many to draw (`draw: {count, always: [...]}`). The content format would not change. This is not built; do not write `draw` yet.
