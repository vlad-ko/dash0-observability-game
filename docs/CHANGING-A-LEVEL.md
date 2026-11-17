# Changing a level

For Dash0 engineers who know OpenTelemetry but not this codebase. It covers changing the content of a level (a fact, a question, a choice, a step, a card) and getting the change merged. The full step format is in [DECLARATIVE-LEVELS.md](DECLARATIVE-LEVELS.md); this guide does not repeat it. The worked example is `levels/good-alerts.mjs` (level 7.1), a short declarative level.

## 1. Find the file

Every level is one file in `levels/`, named by its id. Search for text the player sees, or for the level name:

```
grep -rn "How do you fix CheckoutErrors" levels/
```

That finds `levels/good-alerts.mjs`. Player text is HTML inside JS strings, so search for a short phrase without quotes or entities (`&amp;` for `&`, `\'` for an apostrophe). A level that has `play: { steps: [...] }` is declarative. A level with `run(ctx)` and `mechanics` (for example `levels/checkout-is-slow.mjs`) is hand-written: its steps are code, and its test is a driver (see below). Prefer a declarative level for your first change.

In-game player feedback becomes a GitHub issue titled `Feedback: <level name> (<level id>)`, so the id in the title is the file name. Those issues are a good source of edits.

## 2. Run it

```
npm ci
npm run dev            # http://localhost:3000/
npm test               # all tests
node --test test/act-7.test.mjs    # one file
```

Open `http://localhost:3000/?mode=debug` to open every act and level (bosses too) without saving anything. Under the globe, unfold the level's act in the Levels list and click its card. The globe only shows progress; it is not clickable. Without `?mode=debug`, acts open in order, levels inside an open act in any order, and the boss once the act's levels are done (`lib/unlock.mjs`). `?mode=reset` clears your saved progress.

## 3. Common edits

### Fix copy or a fact

Edit the string in the level file. Every fact has a source on a comment line at the top of the file. `// Spec: <https URL>` carries the URL the tests check, on the OpenTelemetry, W3C, Prometheus, Perses, MDN or Dash0 (www.dash0.com) pages. `// Dash0 docs: <URL>` (see the head of `levels/good-alerts.mjs`) is extra context and is not checked. Read the page, keep the "Facts used" comment true, and add the URL if you used a new page. `test/content.test.mjs` fails if a level has no `// Spec:` line, if a Spec URL is on any other host, or if the copy has an em dash.

Each level also has its own test, here `test/act-7.test.mjs`, which pins keys, counts and some phrases (for example that the `delta` explanation says `gauges`). If your edit rewords a pinned phrase, that test fails: update the expected text in the same commit. The same fact may also sit in the design docs ([M1-DESIGN.md](M1-DESIGN.md) and the other `docs/` files that describe levels): grep `docs/` for a distinctive word of the old text and fix what you find.

### Change a choice question

A `choice` step holds `choices: [{key, label, why, right?, keep?}]`. Exactly one choice has `right: true`; every choice needs a `why`, because the game shows it after the pick.

- Move the right answer: change `right: true` to the new choice, then update the answer key in `test/answers.test.mjs`. The line for this level is `'choice ga-fix: increase'`; the word after the colon is the `key` of the right choice. The level's own test (`test/act-7.test.mjs`, "step 2: one right fix") also pins the keys and the right one.
- Reword a `why` or a `label`: no answer key changes. The level's own test may pin it.
- The 50/50 (see [GLOSSARY.md](GLOSSARY.md)): a choice step with 4 or more choices offers a 50/50 that removes two wrong answers and costs one penalty. `keep: true` marks the one tempting near-miss that it must never remove, for example `key: 'sum'` in `levels/cardinality.mjs`. Validation rejects a `keep` that is not a boolean and a `keep` on the `right` answer. Nothing rejects a question where the 50/50 cannot work: its button is shown disabled when fewer than 3 wrong answers are open or fewer than 2 of them are not `keep` (`jokerBlocked` in `lib/widgets/choice.mjs`).
- Two lists in `test/levels-play.test.mjs` track it. `FIFTY_PINNED` lists every question that offers the 50/50 in a happy run, as `level-id:question-id-fifty`, in level order (`'good-alerts:ga-fix-fifty'`); a test compares it with the real run, so a question that gains or loses the 50/50 fails it. `KEEP_PICKS` lists the `keep` answers as `level-id:key` (`'cardinality:sum'`); no test compares it with the `keep` flags, so keep it by hand when you add or remove a `keep`.

### Add a step

Add an object to `play.steps` with an `intro`, a `question`, a `qid` (`ga-q-fix` style, unique) and one step type key (`choice`, `sort`, `spot`, `build`, `incident`, `tradeoff`, `query`, `configure`: the keys of `STEP_TYPES` in `lib/play.mjs`; the field shapes are in DECLARATIVE-LEVELS.md §2). Then:

- Add one line to the level's entry in `test/answers.test.mjs`, in play order: `'choice <id>: <right key>'`, `'spot <id>: <fault ids>'` (see `'good-alerts'` there). The `<id>` is the one inside the spec (`ga-fix`), not the step's `qid` (`ga-q-fix`). Without the line the answer-key test fails, and the generated play tests drive the level from it.
- Fix the level's own test if it destructures the steps (`const [SPOT_STEP, FIX_STEP] = level.play.steps` in `test/act-7.test.mjs`).
- A new choice with 4 or more choices adds a `FIFTY_PINNED` line, as above.

A hand-written level (`run(ctx)`) declares `mechanics` and `widgets` by hand ([DECLARATIVE-LEVELS.md](DECLARATIVE-LEVELS.md) §1), has no `ANSWERS` line, and its edits go through `DRIVERS['<id>']` in `test/levels-play.test.mjs`, with a happy run and a sloppy run. A new step or a changed button means editing that driver; add a `widgets` or `mechanics` entry when you add a kind of widget.

### Change a card

Cards live in `cards/deck.mjs` (`id`, `front` up to 140 characters, `back`, `specUrl`, `dash0Angle`). A level lists the cards it awards in `cards`, and a declarative level repeats that list in `play.finish` (DECLARATIVE-LEVELS.md §1). `test/content.test.mjs` checks every `specUrl` host and the em dash rule, and the card fronts are pinned in the act tests (`test/act-*.test.mjs`), so when you reword a front, update the pinned text there.

Run `npm test` before you push; fix what fails by the lines above, not by deleting a test.

## 4. Rules for level content

The code rules (CSP, no Alpine attributes in level markup, the Finish button, the UI kit) are in the Conventions and Design sections of `CLAUDE.md`; tests enforce them. The content rules:

- No em dash in level files or cards (`test/content.test.mjs`). Use a comma, colon or full stop.
- Use the terms in [GLOSSARY.md](GLOSSARY.md) as written there (a review rule, no test checks it), and do not invent a second name for a thing it names.
- Invented names (companies, services, thresholds) are fine; say so in the file header as the existing levels do ("Invented for the game").

## 5. The pull request

- One branch per issue, for example `fix/good-alerts-wording-123`, and a PR to `main`. Title in conventional form: `fix: reword the CheckoutErrors fix (#123)`, `docs:` or `feat:` as fits.
- No `Co-Authored-By` or "Generated with" lines in commits or the PR.
- Tests assert behaviour and are mutation-checked (`CLAUDE.md`): after green, change one line of what you changed, watch a test go red, change it back.
- The PR body follows `.github/pull_request_template.md`: What and why (with `Closes #N`), How it was tested (run with `NODE_OPTIONS=--max-old-space-size=2048`; say which mutations you ran), Not verifiable here. No full-suite test count.
- A reviewer posts findings as a PR comment in the exact format of the template (a `## Review of <sha>: NOT CLEAN` heading and a table, no lists), and you answer with a `## Dispositions for the review of <sha>` table. Run `node tools/pr-findings.mjs <PR number>` to see what it reads.
- Merge needs two green checks: `All checks` (CI, the same `npm test`) and the `PR findings` status. Level PRs are reviewed in parts by the diff, see `.claude/skills/wizard/reference/game-review-routing.md`.
