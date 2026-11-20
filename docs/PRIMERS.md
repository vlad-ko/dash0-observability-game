# Writing an act primer

An act primer is the short reading a player can open before an act: an overview and a few chapters. It is text in one file per
act, in `content/core/primers/`, inside a fixed frame of quotes, braces and commas. You do not need to write code; you edit the
words and keep the frame. The rules are checked by `npm test`, so a mistake shows up as a failing test with the path of the
problem, not as a broken page. The contract behind it is docs/FOUNDATION.md §2.12.

A player meets a primer in two steps: a short pop-up with the overview, then a full-screen zone of chapters, entered with
"Proceed with learning". Once the player has seen the pop-up, the act's tile on the map goes straight into the zone, at the
first chapter not yet read (closing the pop-up without Proceed counts too, so the next tile click starts the zone at chapter 1). So write the overview to stand on its own: a returning reader skips it.

## Start from Act 0

1. Copy `content/core/primers/act-0.mjs` to `content/core/primers/<act-id>.mjs`. The name is the act's `id` in `levels/index.mjs` (for example `act-2`).
2. Change `"act"` to that id, then the title, overview and chapters. The copy also carries Act 0's `"placeholder": true`, its
   `"placeholderNote"` and its header comment: set `placeholder` and the note for your own text (see Placeholders) and rewrite the comment.
3. Add the file to `content/core/primers/index.mjs`: one `import` line and one entry in `PRIMERS`.
4. In a terminal in the repo folder, run `npm test`. Fix what it names.

Keep the frame exactly: at least one `//` comment line saying what the file is, then `export default`, then one JSON object,
then `;`. JSON is strict: every key and every string in double quotes, no trailing commas, no repeated key in one object.
Comment lines go only above `export default`, with no blank lines among them or between them and it, never inside the object,
and never a line starting `// Spec:` (that marks level files).

## Blocks

The overview and every chapter are lists of blocks. The block types, their fields and every limit live in code, so they cannot
drift from this page: see `BLOCK_TYPES` and `LIMITS` in `lib/primer.mjs`, and the Act 0 file for each in use. The main limits, in
case you do not want to open the code: a title is up to 80 characters; the overview has 1 to 6 blocks and a primer 1 to 12 chapters;
a chapter has 1 to 20 blocks and 1 to 10 sources; a paragraph is up to 600 characters; a list has up to 10 items of up to 200;
a callout is up to 400. Text is plain, never HTML or Markdown, with no leading or trailing spaces and no em dashes.
Each chapter also has `sources`: the pages it was written from, at least one.

Links: `LINK_KINDS` lists the kinds. A `docs` link must be on dash0.com, an `otel` link on opentelemetry.io and a `claap` link on
claap.io (`KIND_HOSTS`); `video` and `article` links may use any https website. A link needs `https` and no username or
password. `AUDIENCES` lists who may see it.

Chapter ids are the key the game saves "read" against. Never rename a chapter id once players may have read it; add a new
chapter instead.

## Marking glossary terms

A word the glossary defines (`content/core/glossary/`, docs/CONTENT.md section 12) can be marked in a primer, and the reader then
sees its definition in place: the word gets a dashed underline, and hovering it, focusing it with the keyboard or tapping it
opens a small card with the term's name and definition. Escape or a tap elsewhere closes it.

Write the marker around the words as they appear in the sentence:

- `[[shown text|term-id]]` marks the term with that glossary id: the `id` of a term in `content/core/glossary/`, for example
  `[[status|span-status]]`. An id the glossary does not have fails `npm test`. The reader sees only the shown text, so it can be a
  plural or any wording: `[[spans|span]]`.
- `[[shown text]]` is the short form. It finds the term by name or variant, ignoring case: `[[Signals]]` finds the term whose name
  or variants include "signals". Use the long form when the sentence's words are not a name or variant.

Where: in a paragraph, a list item or a callout. Not in a title, a link label, a source or the placeholder note, and a code block is never read for
markers (so `[[ -f file ]]` in a shell sample is fine).

What gets underlined: the first marked use of each term in a chapter, and separately the first in the overview. Later markers of the
same term in that chapter or overview show as plain words, so mark every use you like: only the first draws attention. Text you do
not mark never changes, so a plain "signal" stays plain. Mark a term where it helps a reader meet it, not every common word, and
only when the glossary's sense is the one meant (a "target" or a "status" in the everyday sense is not the glossary term).

The checks are in `npm test`, each naming the path of the problem:

- the id names no term in the glossary, or a short form matches no name or variant;
- a marker is not closed, a closing `]]` has no opening, a marker is inside another, or the shown text is empty or starts or ends with a space;
- a marker is in a title, a link label, a source or the placeholder note.

A level's `intro` and `show` use the same marker: see docs/CONTENT.md section 5.1.

Length limits count what the reader sees, not the marker: `[[signals|signal]]` counts as the 7 characters of "signals", so marking
a term never pushes a paragraph, list item or callout over its limit.

## Placeholders

Until the Dash0 team has written its own words, a primer is a placeholder: set `"placeholder": true` and give a
`"placeholderNote"` that starts with `PLACEHOLDER` and says where the text came from. Draft placeholders only from official
project pages (opentelemetry.io, prometheus.io and dash0.com) and, for a named method, its originator's own page.
Make every sentence something a cited page says. When the team has replaced the text, set `"placeholder": false` and delete the note.
A note on a finished primer is an error. Act 0 is a placeholder today, and a test says so
(`test/primers-content.test.mjs`, "act-0 is a placeholder in this phase").
When Act 0's text is final, change that test in the same pull request.

## Claap recordings are internal

A link to a Claap recording (`"kind": "claap"`) must have `"audience": "internal"`. Players will see internal links marked
"Dash0 team only", because players outside Dash0 cannot open them. Never put
a customer-facing claim only in a Claap link; give the public page as a source too.

## Style

Plain words, short sentences, no em dashes. Say what a thing is before what it is called. Check that the primer matches what the
act's levels actually teach.
