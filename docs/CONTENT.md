# Level content apart from level logic

For anyone who writes or edits what a level says. A level has two parts: the **words** (questions, choices, explanations) and the **logic** (which answer is right, the figures the copy quotes, how the pieces are wired). The words live in a content file; the logic stays in `levels/<id>.mjs`. Each part is checked on its own, and a tool joins them when the game loads. Design background: docs/FOUNDATION.md §2.13. Act primers use the same text rules and have their own guide: [PRIMERS.md](PRIMERS.md), which this page does not repeat.

Play levels (the ones with `play: { steps }`, see [DECLARATIVE-LEVELS.md](DECLARATIVE-LEVELS.md)) and levels that draw their screens in `run(ctx)` can be converted; run(ctx) levels convert by section 11 and stay run levels. Every level is converted: each has a file in `content/core/levels/` that holds its words (test/level-source.test.mjs checks this).

**A new level** is written with its content file from the start: the logic in the level file, the words in `content/core/levels/<id>.mjs` (test/level-source.test.mjs fails without one).

## 1. Where files live

- Words: `content/core/levels/<level-id>.mjs`. The file name is the level id. `core` is the edition (see section 8).
- Logic: `levels/<level-id>.mjs`, with the `// Spec:` and `// Dash0 docs:` lines, "Facts used" and "Invented" comments kept at the top. The sources stay with the logic for now.
- Shared code: `lib/content/` (`bind.mjs` joins, `placeholders.mjs` fills in the `{{name}}` marks (the file keeps its older name), `text-rules.mjs` checks text, `keys.mjs` lists the allowed keys). Do not add a second way to store content anywhere else.
- `content/` is deployed with the site (it is not in `.vercelignore`), because the level imports it.

## 2. The content file

A header of `//` lines, then `export default`, one JSON object and `;`. JSON is strict: double quotes everywhere, no trailing commas, no repeated key in one object, no `//` comment inside the object. The first header line should read `// Text of levels/<id>.mjs (docs/CONTENT.md).` and no header line may start `// Spec:` (that marks logic files). In JSON an apostrophe is plain (`team's`), a double quote is `\"`.

At the top: `id` (the level id), `name`, `sub`, `rewardTitle`, and `play` with `finish` and `steps`. A run(ctx) level has `run` in place of `play` (section 11). A step holds `intro`, `question` and optionally `show` and `code`, plus one widget key (`choice`, `spot`, `tradeoff`, ...) holding that widget's text. The shape mirrors the widget spec in DECLARATIVE-LEVELS.md section 2: copy an existing file such as `content/core/levels/cardinality.mjs` and edit the words.

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
- Top level only: `run` (the words of a run(ctx) level; see lib/content/bind.mjs).

The logic file must not hold any text key ("text in the logic file: <path>"), except inside data a grader computes over. The code calls these the **fixture keys** (`FIXTURE_KEYS` in `lib/content/keys.mjs`, and the tests use the same word): `spans`, `logs`, `answer`, `faults`, `given`, `reference`, `dataset`, `withhold`, `uses`, `target`, `extensions`, `forbids`, `helps`, `budget`. Rule of thumb: if the game computes over a piece of data (a log line a checker reads, a YAML the grader parses), it stays in the logic even if the player sees it. If it is only shown, it goes in the content.

## 4. Fill-ins: a figure the copy quotes

When copy quotes a number that the logic computes (a series count, a total), write `{{name}}` in the content (a **fill-in**) and put the figure in the level file's `VARS` table (the code keeps the older name "placeholder" in `lib/content/placeholders.mjs`; PRIMERS.md uses "placeholder" for unfinished primer text, which is a different thing):

```js
const VARS = { route: VALUES.route, 'product-mrs': n(product('method', 'route', 'status')) };
```

Then `"{{times-mrs}} = {{product-mrs}}"` in the content shows `5 × 14 × 9 = 630`, and a change to `VALUES` changes the copy and the answer together. Rules:
- A name is lower case: `[a-z][a-z0-9-]*`. Any other `{{` is an error ("malformed fill-in"). A lone `}}` (YAML copy has them) is plain text.
- A value is a string or a finite number. Format it in the level file (`n(x)` adds the thousands comma); the content never formats.
- Every fill-in needs a value (a missing one is an error, never an empty string), except a slot under `run`, declared in `slots` and filled at run time by `fillSlots`. Every value in `VARS` must be used.
- Inserted values are not searched again for fill-ins, and are not escaped: a value in an HTML field is checked after it is filled in.
- Ids (`id`, `key`) never hold a fill-in.

## 5. Plain text and HTML fields

- Plain (shown as written; the widget escapes it): `finish`, `name`, `sub`, `rewardTitle`, `unit`, `unitOne`, `code` and a spot line's `text`. Rules: no leading or trailing space, no control characters, no em dash. `code` and `finish` may hold line breaks and tabs (several levels write a multi-line finish).
- Every other text field is trusted HTML, checked by `checkHtml` in `lib/content/text-rules.mjs`. Allowed tags: `p b strong i em code pre br ul ol li table caption thead tbody tr th td`. Allowed attributes: `scope` on `th`, `data-wrap` on `pre`, `data-token` on `code`. Everything else is an error: links, images, scripts, `style=`, `on...=` handlers, `class=`, `id=`, and `x-`, `@` or `:` attributes. A `<` that does not start a tag (`p99 < 1s`) and a bare `&` (`Kettle & Co`) are fine; write `&amp;` if you prefer.
- No em dash anywhere (`test/content.test.mjs` scans `content/` too), no "costs a star" (say "counts as one penalty").

### 5.1 Marking glossary terms in a level (#442)

A word the glossary defines (section 12) can be marked in a play step's `intro` and `show` and in its answer feedback, so the reader sees its definition in place. The marker is the one a primer uses (docs/PRIMERS.md, "Marking glossary terms"): `[[shown text|term-id]]`, or the short form `[[shown text]]`, which finds the term by name or variant.

- Where: a play step's `intro` and `show`, and the answer feedback: `why`, a `whyNot` value, `explain`, `hint` and `closing`. Any other field refuses a marker with its path. The message reads `must not contain a glossary term marker (only intro, show, answer feedback and the run entries a level lists in TERMS mark terms)`. Those fields are the question, a label, `finish`, titles and names. A label or a question is the name of a control or a heading, so a term there would put a button inside it. Under `run` (a run(ctx) level, section 11) the level's logic lists which entries are prose: `export const TERMS = ['answerableIntro']`, passed to `bindLevel` and `bindRunLevel` as `terms` next to `vars` and `slots` (one shared `BIND` object keeps the two calls alike). Only a top-level string entry may be listed, and only a listed entry reads markers; a marker in any other entry is an error. Nested inside one, a marker is an error: a sort label or a choice's `why` is such an entry. The message reads `term markers are read under run only in the entries the level lists in TERMS`. A name in `terms` that is not a top-level string entry of `run` is an error (`terms: "x" is not a prose entry of run (a top-level string)`). List an entry only when its text is drawn through `ctx.renderStep`, a screen's intro or speech, or through `tell` (`lib/widgets/tell.mjs`); never list button text, a reason, a question, `finish`, a label, or a string the code sets with `textContent`. A level that lists entries must not call `setFeedback` itself, and `test/level-terms.test.mjs` checks that every marker in a listed entry names a glossary term. Answer feedback nested under `run` (a sort item's `why`) stays unmarked for now.
- Literal text: a `<pre>` or `<code>` region, `code` and a spot line's `text` are never read, so `[[ -f x ]]` and `[[1,2]]` are data.
- The shown text holds no `<`, `>`, `&` or `{{`, and a marker is never inside a tag. The text rules judge what the reader sees: the shown words, so `<b>[[series|time-series]]</b>` is fine and `[[x]] <a>y</a>` still fails on the tag.
- What the reader sees: the first use of each term on a screen is a dashed-underlined term with its definition on hover, focus or tap; later uses on that screen read as plain words. A screen is one `ctx.renderStep` call. Answer feedback shares the screen's first use: a term already underlined on the screen stays plain words in the feedback, and a term not yet drawn becomes a term there. "On the screen" means drawn and still shown, so replaced feedback (the next wrong answer, the 50/50 line, a new hint) gives its terms back and the next feedback may draw them again. Mark only the glossary's sense of a word, and only a few.
- How it works: bind writes each marker as `<span data-gloss="term-id">shown</span>` (the id is empty for the short form). The guide and every plain-text reader see the shown words, not the term id. `renderStep` turns the first span of each term into the kit term (`lib/term-text.mjs`) and the rest into plain words. Feedback is drawn the same way through `ctx.gloss`, see docs/FOUNDATION.md §2.14. Bind never imports the glossary, so `checkLevelTerms` (`test/level-terms.test.mjs`) checks every marker in every live level against it after bind, naming the path of a marker that names no glossary term, by id or by short form.
- Proving a marking change: `node tools/level-fingerprint.mjs --shown <dir>` writes the fingerprints with each span replaced by its shown words. Run it before and after and `diff -r`: a zero diff means no word changed. The plain output keeps the spans. `tools/extract-level-text.mjs` writes a marked term back as its marker.

## 6. Check your work

`npm test` runs everything. The tests that matter for content: `test/level-text-content.test.mjs` (the files, the wrapper, the wiring, that the text of every live play level would pass, and that every converted run level is checked too: no prose left in its code, every `say.<name>` it reads defined), `test/content-bind.test.mjs` and `test/content-placeholders.test.mjs` (the engine), `test/content.test.mjs` (em dash, "costs a star") and `test/levels-play.test.mjs` (plays every level). A broken level fails to load with one error that names the level and lists every problem, for example:

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

The folder name `core` is the edition: the one version of the words the game ships. A second edition (the same levels explained for another audience) would be new files under `content/<edition>/levels/` and `primers/`, and a registry that builds the acts with `levelModule.withText(text)` for that edition's text, chosen once at start-up. Every converted level exports `withText(text)` for this reason, so an edition covers every level. Nothing selects an edition yet, and engine words (buttons, card text, act names) are not part of an edition.

## 9. Converting a level, step by step

Do one act at a time and change only that act's level files and their content files. Play levels convert by the steps below; a level with `run(ctx)` converts by section 11 and stays a run level. A level written new gets its content file the same way, in the pull request that adds it.

1. **Baseline, on a clean checkout of main.** Pick a scratch folder `S` outside the repo. Run `node tools/level-fingerprint.mjs $S/before` (the exact data of every level) and `LEVEL_SNAPSHOT=$S/before node --test test/levels-play.test.mjs` (the page of every step, happy and sloppy run).
2. **Extract.** `node tools/extract-level-text.mjs <id>` prints every text field of the level as a content file, in the order the game shows it. Save it as `content/core/levels/<id>.mjs`.
3. **Put back the figures.** Every `${...}` in the old copy is now its computed result in the content file. For each, add an entry to `VARS` in the level file with the same expression (including any `n()` formatting), and write `{{name}}` in the content instead. A figure that the old copy wrote as literal text (not as `${...}`) stays literal text: turning it into a fill-in is a separate change, not part of the move. A `${...}` that only echoes a value the level's code passes in (for example a helper's argument) may stay plain text. A content file that ends up with fill-ins gets a longer first header line: `// Text of levels/<id>.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.` (as in `content/core/levels/cardinality.mjs`).
4. **Strip the logic.** In `levels/<id>.mjs` delete every text field (`name`, `sub`, `rewardTitle`, `intro`, `question`, `label`, `why`, `whyNot`, `explain`, `hint`, `finish`, `lines`, `needs`, `unit`, ...). Keep the ids, the answer flags (and `right: false` where it was written), the figures, `faults`, `answer`, `cost`, `keeps`, `helps`, `qid` and the wiring. Leave the header comments. Keep every id that an answer or the binder joins on: a sort's bucket ids (`buckets: [{ id: 'resource' }, { id: 'signal' }]`; the binder then rejects content that drops or renames a bucket), a trade-off knob's, option's and need's ids, and the ids of the spot lines that `faults` names. When a comment in the level file sets a rule for text that moves (for example how spot lines or sort labels are placed, enforced by a test such as `test/sort-tells.test.mjs`), keep that comment in the level file. Add a one-line pointer to it in the content file's header.
5. **Wire it.** Gather what is left into one object, `SKELETON`: the level as it was, minus the words. Then:

```js
import CORE from '../content/core/levels/<id>.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
```

A level that also exports an object built from its text (`levels/auto-vs-manual.mjs` and `levels/edge-of-the-platform.mjs` export `CONTENT`, which tests pin) builds it from a second `withText(CORE)` call. The binder is pure, so both binds are equal. Keep the literal default line: `test/level-text-content.test.mjs` requires it.

A fill-in's value may be HTML built from the level's data (a table, rows, code). The binder checks the markup after filling in (section 4). Words inside such a value stay in the level file; moving them is a separate change.

A level with no fill-ins declares `const VARS = {};` and passes `{ vars: VARS }` as above (every converted level on main does this); a literal `{ vars: {} }` binds the same, but use `VARS = {}` so every level reads alike.

6. **Prove nothing changed.** Run step 1 again into `$S/after`, then `diff -r $S/before $S/after`. It must show only the new `withText` export key in each converted level's fingerprint. Any other difference means the copy changed: fix it.
7. **Run the tests.** The level's own tests, `test/answers.test.mjs`, `test/level-text-content.test.mjs`, `test/content.test.mjs`. No existing test line should need a change; if one does, stop and ask.
8. **Mutation check.** Change one figure's source in the level file and see a pinned test go red; move one `right` flag and see `test/answers.test.mjs` go red. Put both back.

A test that reads a level's source text uses `levelSource(id)` (`test/helpers/level-source.mjs`), which also reads the content file.

## 10. Answer pools (#390)

A multiple-choice or sort step may list more answers in its content than one play shows. Each time the step is shown, the game draws a board from the pool, so a player who replays a level meets different wrong answers (and, for a choice, a different right one).

**Where it applies.** Multiple-choice and sort steps only (their logic kinds are `choice` and `sort`), and only where the step is opted in. Not build, incident, spot, trade-off, query or configure steps, not boss levels, not Act 9, and not a question whose answer depends on data on the screen (a table, a trace or a config the player reads), because another board would change that data. The mechanism is in `lib/pool.mjs`. The live pools:

- The pilots: `wcm-host` in what-costs-money (a choice of 20 that shows 4) and, in auto-vs-manual, `avm-sort` (a sort, 3 from each bucket of 10) with `avm-why` and `avm-fix` (choices of 20 that show 3).
- Act 1: `res-pod` and `res-dash0` in resources, and `det-when`, `det-where`, `det-rbac` and `det-dash0` in detectors-and-kubernetes (choices of 13 or 14 with 4 right, that show 3).
- Act 7: `ga-fix` in good-alerts (a choice of 20 that shows 4), `sl-sli` and `sl-edge` in slis-and-slos (choices of 20 that show 3), and `sc-alert` in synthetic-checks (a choice of 20 that shows 6).

**The format.** The content file does not change: the pool is the full `choices` list (`items` for a sort), with a `key` (`id` for a sort), a `label` and a `why` for every entry. The logic file opts the step in by stating `draw`, and still marks the answers (`right`, `keep`, `bucket`):

```js
choice: { id: 'wcm-host', draw: 4, choices: [{ key: 'fewer-hosts', right: true }, { key: 'consolidate-vms', right: true }, { key: 'drop-idle-senders', right: true }, /* the wrong answers: at least draw - 1 */] }
sort: { id: 'avm-sort', draw: { auto: 3, manual: 3 }, items: [{ id: 'server', bucket: 'auto' }, /* the rest of the pool */] }
```

- A choice's `draw` is the whole number of answers a step shows. A showing has exactly one right answer and `draw - 1` wrong ones. Several pool entries are marked `right: true`, and each is a different correct phrasing of the one fact the question tests.
- A sort's `draw` names every bucket id and gives the number of items of that bucket a showing shows. Every item still needs its `bucket` in the logic file.
- `draw` is never a content key: put it in the content file and the join fails with `"draw" is not a content key`.
- A phrasing added in the content file without `right: true` in the logic file is graded wrong. The playtest is the backstop for that slip; a new right answer is a logic edit as well.

**How a board is drawn.** The step draws through the level's random source (`ctx.shuffle`), once each time it is shown. That board is fixed for the showing: the buttons, the 50/50, the hints and the guide all see it. Nothing is saved, so a reload or a replay may draw another board, and the same board twice is fine. A test with a fixed random source draws a fixed board. Display order is shuffled as before.

**What a pool must hold.** `validateChoicePool` and `validateSortPool` (in `lib/pool.mjs`) run when the registry is built:

- A choice: `2 <= draw < choices`, at least one right answer and `draw - 1` wrong ones. Exposure: with R right and W wrong answers, `minWrongPerRightSlot * R * (draw - 1) <= W <= maxWrongPerRightSlot * R * (draw - 1)`. The two numbers are `EXPOSURE` in `lib/pool.mjs` and nowhere else; today they are 1 and 2, so `R * (draw - 1) <= W <= 2 * R * (draw - 1)`. The lower bound stops "pick the one not seen before" from winning. The upper bound is an accepted tell (owner decision 2026-11-20, revisit after playtest): a player who replays and picks the answer seen most often is right about 0.57 of the time by play 10 at 3 right and 17 wrong with 4 shown, against 0.25 by chance. To tighten towards parity set `maxWrongPerRightSlot` to 1, which needs more right answers (5 right and 15 wrong at 4 shown); `test/pool-replay.test.mjs` shows that case stays at chance. A pool of about 20 entries that shows 3 has 4 right and 16 wrong, and one that shows 4 has 3 right and 17 wrong.
- The 50/50: when `draw` is 4 or more, at most `draw - 3` wrong answers carry `keep`, so every board has two wrong answers it may remove. `keep` marks the tempting near-miss. The earlier idea of an `always` list is dropped, because `keep` already covers that need.
- Every right answer is checked with all the wrong ones as an ordinary question (`validateChoiceSpec`), keys are unique across the pool, and so are the labels once markup is removed.
- A sort: `draw` names exactly the buckets, each from 1 up to below that bucket's items (every bucket rotates, `draw[b] < n_b`), and the board's total is within 2 to 12 items. The shown shares `draw[b] / n_b` must be within 15% of each other, relative to the largest share, so that how often an item has been seen says nothing about its bucket (`{a: 3 of 3, b: 3 of 12}` fails both rules). The pool is checked as an ordinary sort without the item-count range.

**What the words must not do.** A board is a random draw, so no line may depend on what else is on it. `test/pool-content.test.mjs` checks every pooled step: no `label`, `why` or `whyNot` points at a position or at its siblings ("the other two options", "the first answer"), and the step's `intro`, `show`, `question` and `hint` quote no pool label of 12 or more characters. No other step's text and no `finish` text quotes a right answer, and no `why` quotes another entry's label. Write each `why` so it stands alone.

**Tests.** `test/choice-tells.test.mjs` and `test/sort-tells.test.mjs` score a pool over every board it can show (a large sort pool is sampled with a seeded draw). The game-wide sum of a blind rule over the choice questions is taken apart: the fixed questions at 3 points from chance, and the pooled ones at 3 points in expectation. A fixed sort keeps the rule that every blind rule costs two placements on its one board; a pool is held to a relaxed floor instead, because a bucket that rotates shows boards a rule happens to fit: no blind rule may sort more than 10% of its boards for 5 stars (the real scorer). `test/pool-content.test.mjs` also checks, hard, that no word (plurals folded, function words such as "the" or "of" skipped) is on every right answer of a choice pool and on no wrong one (C8): every board shows one right answer, so such a word would pick it every time. It also searches the labels of a pool for wording tells, as advice: C6 reads every word, two-word phrase, final word and punctuation mark of a choice pool as "pick the label with this" or "pick the label without it". C7 reads each of them in a sort pool, and code formatting, the shape of the identifier inside `<code>` (an upper-case letter, an underscore, `()`, a dotted name or prefix, a plain word), an all-caps word, every length cut and every OR of two of these, as "an item with this goes in bucket X, every other item in bucket Y". The report counts a single feature further than 0.15 from chance (for a sort, above the best uninformed guess, the bucket a board shows most of), a pair further than 0.25, or a rule that sorts more than 10% of the boards for 5 stars. C6 and C7 fail nothing: run `TELLS=1 node --test test/pool-content.test.mjs` to print, for every live pooled question, the three strategies furthest from chance and how many are past the band. T2 in `test/choice-tells.test.mjs` is advice too: `TELLS=1 node --test test/choice-tells.test.mjs` prints each pooled question that a length or tail rule scores more than 0.15 from chance, and by how much.

**What is hard and what is advice, and why.** A pool exists so that a player cannot click through a level after a couple of plays: the board is a random draw and its order is shuffled. Removing every wording pattern from the answers is not a goal for now (owner decision 2026-11-21), because each fix moves the pattern somewhere else and makes the answers read worse. So the suite fails on what breaks that purpose: C1 to C5 and C8, `validateChoicePool`, `validateSortPool` and `EXPOSURE`, the game-wide bands of `test/choice-tells.test.mjs`, and the blind sort rules of `test/sort-tells.test.mjs`. C6, C7 and T2 are advice for the writer. T2 was hard and is now advice because it forced authors to pad answers or shuffle labels, and pooling already varies every board. It still helps to let the wrong answers use the words of the right ones (the same parts of the scenario) and to keep a shape, a word or a length from marking one bucket. The answer key in `test/answers.test.mjs` lists every right answer of a pooled choice as `a|b|c` and every item of a pooled sort with its bucket. The step drivers play the board that the harness's identity shuffle draws, and `test/levels-play.test.mjs` checks the screen shows that board.

**The guide.** A pooled step's board changes, so the browser sends the keys (or item ids) its board shows with each question, in `shown`. The server tells the model that board and nothing else of the pool, and withholds every right answer of the pool in a reply, drawn or not (docs/FOUNDATION.md section 2.8).

## 11. Converting a run(ctx) level

A level that draws its screens in `run(ctx)` stays a run level. Its words move to `content/core/levels/<id>.mjs` under one key, `run`, and its code reads them from an object called `say`. Screens, buttons, scoring and help stay as they are. Turning a run level into a play level is a separate change (it adds the Ask the guide panel) and is not part of this move.

### 11.1 What moves, what stays

Move every string literal in `levels/<id>.mjs` that a player can see, whatever its length: lesson text, questions, answer labels and `why` text, hints, notes, button labels, the reason under a disabled button, chip text, table captions and headings, feedback lines, the finish text.

Keep in the level file:
- DOM element ids, data attribute names and values, CSS classes, tones, variants, modes, and any value the code compares (these are in the level file only). The ids and keys the binder joins on (11.4) are in both files: the content carries each with its text;
- fixture data: fields of spans, logs, events and attributes that a widget or the level computes over, even when shown (a span name such as `charge with retry`);
- words that come from another module (`lib/`, the UI kit);
- header comments, `VERIFY` notes and rules about text (keep them beside the code that uses the entry, and add a one-line pointer in the content header).

### 11.2 The content file

Header and strict JSON as in section 2. At the top: `id`, `name`, `sub`, `rewardTitle` and `run`. `run` holds named entries, in the order the game shows them:
- Names are lowerCamelCase.
- A module constant that holds words becomes one entry named after the constant (`ON_SPANS` becomes `onSpans`), with the same structure, minus answer flags, numbers, fixtures and `helps`. List elements keep their `id` or `key`.
- Every other literal becomes one entry named `<screen><Role>`. The screen is the step function's name without `step` (`stepSort` gives `sort`), or `start` for the top of `run`. The role is `Intro` (passed to `ctx.speech`), `Question`, `Reason` (a disabled button's reason), `Button`, `Chip`, `Note`, `Label`, `Says` (a feedback line), or what the code calls it. A level with one finish text names it `finish`. Add a number if two names would clash.
- One entry per literal in the old code. Literals joined by `+` count as one, and so does a template literal. Two literals with the same words in two places stay two entries.
- Inside `run` any key is allowed except answer and grader keys (`right`, `keep`, `bucket`, `kind`, `cost`, `keeps`, `cap`, `qid`, `prefix`, `steps`, `play` and the fixture keys of section 3). Every value is text, an object or a list. Every string may hold HTML (section 5) and is checked after its fill-ins.
- A text field whose name is one of those keys (the-pager's `answer`) gets another name in the content (`reply`), and `contentOf` maps it back.
- A list of words that two steps share (the-signals' buckets) is one entry, and `contentOf` uses it in both places.
- A literal that starts or ends with a space loses that space in the content; the code adds it back where it uses the entry.
- Markup that section 5 does not allow (`<h4>`, `<div>`, `<span>`, `id=`, `tabindex=`) stays in the code as a slot (11.3); the code builds the tag and puts the words, read from `say`, inside it.

### 11.3 Fill-ins

Each `${...}` in an old literal becomes `{{name}}`:
- a **VAR** (section 4) when the expression uses only module-level values that do not come from the content, for example `${TIMEOUT_MS / 1000}`;
- a **slot** otherwise: the expression reads `ctx`, the session, the page, a variable of the running level, or words from the content. Add the name to `const SLOTS = [...]` and fill it in the code with `fillSlots(say.<name>, { <slot>: <the exact old expression, escaping included> })` from `lib/content/placeholders.mjs`.

Slots work only under `run`, and never inside a tag. `fillSlots` throws when a slot has no value or a value has no slot; it never prints an empty string. A conditional that picks words (`x ? 'a' : 'b'`, a plural) becomes one entry per branch, and the condition stays in the code.

### 11.4 The level file

`SKELETON` is the level without its words. Under `run` it holds, for each entry, only what the logic needs: ids with answer flags (and `right: false` where it was written), numbers, fixtures and `helps`. An entry with no such parts is not in the skeleton. The skeleton also carries the ids the binder joins on, as in section 9 step 4: the ids of entries that have logic (such as the sort's own id), a sort's bucket ids, and the ids or keys of the elements that carry an answer flag.

```js
import CORE from '../content/core/levels/<id>.mjs';
import { bindLevel, bindRunLevel } from '../lib/content/bind.mjs';

const VARS = {};
const SLOTS = [];

function screens(ctx, say) {
  // the old run(ctx) body; every word is say.<name>
}

export function withText(text) {
  return bindRunLevel(text, SKELETON, { vars: VARS, slots: SLOTS, screens });
}

export default withText(CORE);
```

Rules:
- A level that marks glossary terms (section 5.1) also exports `TERMS`, the list of its prose entries (`export const TERMS = []` until it marks one), and passes `terms: TERMS` with `vars` and `slots`, as `monitoring-vs-observability` does.
- Read words only as `say.<name>`. Do not destructure `say` and do not compute a top-level name.
- A module-level helper with words takes `say` as an argument.
- A named export that held words (`CONTENT` and the like) stays, built by one function of `say`, for example `export const CONTENT = contentOf(bindLevel(CORE, SKELETON, { vars: VARS, slots: SLOTS }).run);`, and `screens` takes its tables from the same function (`const [{ sort: SORT }, { choices: ON_SPANS }] = contentOf(say).steps;`), so the tables the tests pin are the ones the screens play. A table whose text has a slot is filled in that function.

### 11.5 Step by step

1. **Baseline, on a clean checkout of main.** As section 9 step 1 (fingerprint and LEVEL_SNAPSHOT into `$S/before`), and copy each level file of the act: `cp levels/<id>.mjs $S/old-<id>.mjs`.
2. **Write the content file by hand.** `tools/extract-level-text.mjs` run on a run level prints only `id`, `name`, `sub` and `rewardTitle`: copy those, then write the `run` entries by hand by 11.2.
3. **Put in the fill-ins** by 11.3.
4. **Strip and wire** by 11.4.
5. **Fixtures.** If `test/level-text-content.test.mjs` lists a kept literal that is fixture data (11.1), add it to `RUN_FIXTURES` (in `test/helpers/run-edit.mjs`, which both that test and the play-through test read) under the level id. Any other literal it lists moves to the content. If a driver cannot reach an entry of `run` (a wrong-placement explanation, say), list its path in `UNREACHED` in `test/levels-play.test.mjs`: the play-through test fails for an entry that no run shows edited, and for a listed one that a run does show.
6. **Prove nothing changed.** Run step 1 into `$S/after`. `diff -r $S/before $S/after` must show only the new `withText` key in each fingerprint, and no change to any snapshot (frames and clicks). `node tools/level-words.mjs $S/old-<id>.mjs <id>` must report no word lost and none added.
7. **Run the tests.** The level's own tests, `test/levels-play.test.mjs`, `test/level-text-content.test.mjs`, `test/content.test.mjs` and the act's test. No existing test line should need a change (the first run level's pull request generalised the four tests that covered play levels only); if one does, stop and ask.
8. **Mutation check.** Put one old literal back in the code: the "a run level's code holds no prose literal" test in `test/level-text-content.test.mjs` goes red. Misspell one `say.<name>`: "a run level reads exactly the names its content defines" goes red. Make a screen read the module's built-in words instead of the ones it was given (for example `CONTENT.steps[1].choices`): "a converted run level plays every screen ... with the words it was given and no others" in `test/levels-play.test.mjs` goes red. Change one word in the content: `tools/level-words.mjs` reports it lost and added. Put all four back.

One act per pull request, as in section 9.

## 12. The glossary

`content/core/glossary/` is the one source of the game's terms (#428), one file per act (#427) so that parallel act pull requests do not conflict: `act-0.mjs` to `act-9.mjs` for the terms an act teaches, and `general.mjs` for the game's own terms (for example Hint, 50/50, Save code). Each file is a strict-JSON module like a primer (header `//` lines, then `export default {...};`), loads in the browser and under `node --test`, and holds `{ "terms": [...] }`. `content/core/glossary/index.mjs` lists the files, as `content/core/primers/index.mjs` lists the primers: a new act's file needs its file, one import and one entry there. Each term has:
- `id`: lowercase kebab, unique. A primer marks a term by this id (`[[shown text|id]]`, docs/PRIMERS.md "Marking glossary terms"), and `npm test` fails when a marker names an id that is gone, so never rename or remove one that is in use.
- `name`: the display name.
- `variants`: other spellings or plurals a primer may use (the short marker `[[shown text]]` finds a term by its name or a variant, so a variant that is a common word, such as "status" or "target", makes that short form match it: give the marker the id instead). Names and variants share one case-insensitive key space: none may repeat, within a term or across terms.
- `definition`: plain text, one or two short sentences, at most 240 characters. No markup (no backticks, asterisks, tags or Markdown links), no em dashes, UK spelling.
- `topic`: the section heading in the generated doc. It must be one of `TOPIC_ORDER` in `lib/glossary.mjs` (Foundations, OpenTelemetry, Traces, Metrics, Logs, Collector, Reliability, Dash0), and the doc shows the topics in that order.

A term has no `act` key: the file name says it. `content/core/glossary/index.mjs` joins the files and gives each term its `act` from its file name (`general` gives `null`), so callers of `lib/glossary.mjs` still see it. The checks report any id, name or variant shared across files. If a name clash gets past them, `glossaryIndex` keeps the first term, in the order general, then the acts. In the generated doc the terms of a topic follow that same order: general, then the acts, then file order. A file named for an act id that is not in the registry is a problem.

`lib/glossary.mjs` is pure: `validateGlossaryFiles(files, { actIds })` returns the list of problems for the per-act files (empty is clean), `joinGlossaryFiles(files)` makes the one glossary, `validateGlossary(glossary, { actIds })` checks the joined result, `glossaryIndex(glossary)` returns a `Map` from each lowercase name and variant to its term id, and `glossaryDoc(glossary)` is the text of `docs/GLOSSARY.md`. That doc is generated: after changing a file run `node tools/build-glossary-doc.mjs`, never edit the doc by hand. `test/glossary.test.mjs` validates the files against the registry's act ids and fails when the committed doc differs from the generator's output.
