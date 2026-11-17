# Changing a level

For Dash0 engineers who know OpenTelemetry but not this codebase. It covers changing the content of a level (a fact, a question, a choice, a step) and getting the change merged. The full step format is in [DECLARATIVE-LEVELS.md](DECLARATIVE-LEVELS.md); this guide does not repeat it. The worked example is `levels/good-alerts.mjs` (level 7.1), a short declarative level.

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

Open `http://localhost:3000/?mode=debug` to open every act and level without saving anything, then pick the level on the globe. Without `?mode=debug` levels unlock in order. `?mode=reset` clears your saved progress.

## 3. Common edits

### Fix copy or a fact

Edit the string in the level file. Every fact has a source on a comment line at the top of the file: `// Spec: <https URL>` for the OpenTelemetry, W3C, Prometheus, Perses or MDN pages, and `// Dash0 docs: <URL>` for Dash0 behaviour (see the head of `levels/good-alerts.mjs`). Read the page, keep the "Facts used" comment true, and add the URL if you used a new page. `test/content.test.mjs` fails if a level has no `// Spec:` line, if a Spec URL is on a host other than opentelemetry.io, www.w3.org, prometheus.io, perses.dev, developer.mozilla.org or www.dash0.com, or if the copy has an em dash.

Each level also has its own test, here `test/act-7.test.mjs`, which pins keys, counts and some phrases (for example that the `delta` explanation says `gauges`). If your edit rewords a pinned phrase, that test fails: update the expected text in the same commit.

### Change a choice question

A `choice` step holds `choices: [{key, label, why, right?, keep?}]`. Exactly one choice has `right: true`; every choice needs a `why`, because the game shows it after the pick.

- Move the right answer: change `right: true` to the new choice, then update the answer key in `test/answers.test.mjs`. The line for this level is `'choice ga-fix: increase'`; the word after the colon is the `key` of the right choice. The level's own test (`test/act-7.test.mjs`, "step 2: one right fix") also pins the keys and the right one.
- Reword a `why` or a `label`: no answer key changes. The level's own test may pin it.
- The 50/50 joker: a choice step with 4 or more choices offers a 50/50 that removes two wrong answers and costs one penalty. `keep: true` marks the one tempting near-miss that the 50/50 must never remove, for example `key: 'sum'` in `levels/cardinality.mjs`. `keep` is a boolean, goes only on a wrong answer (never on the `right` one), and a question with fewer than two other wrong answers to remove gets no 50/50. The registry rejects a level that breaks these rules.
- Two tests track the 50/50 in `test/levels-play.test.mjs`. `FIFTY_PINNED` lists every question that offers the joker in a happy run, as `level-id:question-id-fifty`, in level order (`'good-alerts:ga-fix-fifty'`). If you take a question below 4 choices or raise one to 4 or more, add or remove its line. `KEEP_PICKS` lists the `keep` answers as `level-id:key` (`'cardinality:sum'`); add or remove a line when you add or remove a `keep`.

### Add a step

Add an object to `play.steps` with an `intro`, a `question`, a `qid` (`ga-q-fix` style, unique) and one step type key (`choice`, `sort`, `spot`, `build`, `incident`, `tradeoff`, `query`, `configure`: the keys of `STEP_TYPES` in `lib/play.mjs`; the field shapes are in DECLARATIVE-LEVELS.md §2). Then:

- Add one line to the level's entry in `test/answers.test.mjs`, in play order: `'choice <id>: <right key>'`, `'spot <id>: <fault ids>'` (see `'good-alerts'` there). Without it the answer-key test fails, and the generated play tests drive the level from that line.
- Fix the level's own test if it destructures the steps (`const [SPOT_STEP, FIX_STEP] = level.play.steps` in `test/act-7.test.mjs`).
- A new choice with 4 or more choices adds a `FIFTY_PINNED` line, as above.

A hand-written level has no `ANSWERS` entry; its driver is `DRIVERS['<id>']` in `test/levels-play.test.mjs`, with a happy run and a sloppy run. A new step or a changed button there means editing that driver. Ask for help on the issue if you must change a hand-written level.

Run `npm test` before you push; fix what fails by the lines above, not by deleting a test.

## 4. Rules for level content

- No em dash in level files or cards (`test/content.test.mjs`). Use a comma, colon or full stop.
- Use the terms in [GLOSSARY.md](GLOSSARY.md) as written there (it is a review rule, no test checks it), and do not invent a second name for a thing it names.
- CSP: no inline `<script>` or `style=`, no `on*=` attributes, no `:style` in markup you write (`test/static.test.mjs` checks `index.html`; for a hand-written level, wire buttons with `el.onclick = ...` after `ctx.renderStep`).
- No Alpine attributes (`x-`, `@`, `:`) in level markup (`test/levels-play.test.mjs` checks every step).
- A level's Finish button has `data-finish`, is never enabled on the first screen, and is the only thing that calls `ctx.finish`. Declarative levels get this from the `finish` text in `play`; it matters if you edit a hand-written level.
- Markup comes from `lib/ui/*.mjs` helpers and colours from `styles/tokens.css` ([DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)).
- Invented names (companies, services, thresholds) are fine; say so in the file header as the existing levels do ("Invented for the game").

## 5. The pull request

- One branch per issue, for example `fix/good-alerts-wording-123`, and a PR to `main`. Title in conventional form: `fix: reword the CheckoutErrors fix (#123)`, `docs:` or `feat:` as fits.
- No `Co-Authored-By` or "Generated with" lines in commits or the PR.
- The PR body follows `.github/pull_request_template.md`: What and why (with `Closes #N`), How it was tested, Not verifiable here. No full-suite test count.
- A reviewer posts findings as a PR comment in the exact format of the template (a `## Review of <sha>: NOT CLEAN` heading and a table, no lists), and you answer with a `## Dispositions for the review of <sha>` table. Run `node tools/pr-findings.mjs <PR number>` to see what it reads.
- Merge needs two green checks: `All checks` (CI, the same `npm test`) and the `PR findings` status. Level PRs are reviewed in parts by the diff, see `.claude/skills/wizard/reference/game-review-routing.md`.
