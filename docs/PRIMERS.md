# Writing an act primer

An act primer is the short reading a player can open before an act: an overview and a few chapters. It is plain text in one
file per act, in `content/core/primers/`. You do not need to write code; you edit words inside a fixed frame. The rules are checked by
`npm test`, so a mistake shows up as a failing test with the path of the problem, not as a broken page.
The contract behind it is docs/FOUNDATION.md §2.12.

## Start from Act 0

1. Copy `content/core/primers/act-0.mjs` to `content/core/primers/<act-id>.mjs`. The name is the act's `id` in `levels/index.mjs` (for example `act-2`).
2. Change `"act"` to that id, then the title, overview and chapters.
3. Add the file to `content/core/primers/index.mjs`: one `import` line and one entry in `PRIMERS`.
4. Run `npm test`. Fix what it names.

Keep the frame exactly: the file is `export default`, then one JSON object, then `;`. JSON is strict: every key and every string
in double quotes, no trailing commas, no repeated key in one object, no comments inside the object. Lines starting with `//`
are allowed above `export default`, but not a line starting `// Spec:` (that marks level files).

## Blocks

The overview and every chapter are lists of blocks. The block types, their fields and every length limit live in code, so they
cannot drift from this page: see `BLOCK_TYPES` and `LIMITS` in `lib/primer.mjs`, and the Act 0 file for one of each in use.
A paragraph is plain text, never HTML or Markdown. Each chapter also has `sources`: the pages it was written from, at least one.

Links: `LINK_KINDS` lists the kinds, and `KIND_HOSTS` which website each kind must point at (a `docs` link must be on dash0.com,
an `otel` link on opentelemetry.io). A link needs `https`, no username or password. `AUDIENCES` lists who may see it.

Chapter ids are the key the game saves "read" against. Never rename a chapter id once players may have read it; add a new
chapter instead.

## Placeholders

Until the Dash0 team has written its own words, a primer is a placeholder: set `"placeholder": true` and give a
`"placeholderNote"` that starts with `PLACEHOLDER` and says where the text came from. Draft placeholders only from official
pages (opentelemetry.io and dash0.com). When the team has replaced the text, set `"placeholder": false` and delete the note;
a note on a finished primer is an error.

## Claap recordings are internal

A link to a Claap recording (`"kind": "claap"`) must have `"audience": "internal"`. Internal links are shown with a
"Dash0 team only" label, because players outside Dash0 cannot open them. Never put a customer-facing claim only in a Claap
link; give the public page as a source too.

## Style

Plain words, short sentences, no em dashes. Say what a thing is before what it is called. Check that the primer matches what the
act's levels actually teach.
