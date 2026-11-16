// Level feedback (#370; docs/FOUNDATION.md §2.11): the wire contract between the page and api/feedback.mjs and the
// text of the GitHub issue it opens. Pure and browser-importable: nothing here reads process.env, a clock or the network.

export const VERSION = 1;
/** What the player says the problem is; the order is the order the dialog offers. */
export const KINDS = Object.freeze(['unclear', 'wrong-fact', 'bug', 'idea']);
/** The longest feedback text, in code points (not UTF-16 units: an emoji is one). */
export const MAX_TEXT = 1000;
/** The largest request body the function reads, in bytes. */
export const MAX_BODY_BYTES = 8192;
export const MAX_SCREEN = 999;

const BODY_KEYS = ['v', 'levelId', 'screen', 'kind', 'text'];
const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const COMMIT = /^[0-9a-f]{7,40}$/;
// C0 controls except tab (\t) and newline (\n), DEL, the bidi embedding/override marks and the bidi isolates.
const STRIPPED = /[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/g;
const ZERO_WIDTH_SPACE = '​';
/** Player text without the characters that are never shown: the one definition parseFeedback and issueBody share. */
const strip = (text) => text.replace(STRIPPED, '');

/** `{on, token, repo}`: on only with a non-empty `FEEDBACK_GITHUB_TOKEN` and a `FEEDBACK_REPO` shaped `owner/name`; token and repo are null when off. */
export function feedbackConfig(env) {
  const token = env?.FEEDBACK_GITHUB_TOKEN;
  const repo = env?.FEEDBACK_REPO;
  const on = typeof token === 'string' && token !== '' && typeof repo === 'string' && REPO.test(repo) && !/\/\.{1,2}$/.test(repo); // `a/..` fits the pattern but is a path, not a repository
  return on ? { on: true, token, repo } : { on: false, token: null, repo: null };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The request body text -> `{ok:true, levelId, screen, kind, text, chars}` (text without the stripped characters, then
 * trimmed; `chars` its length in code points) or `{ok:false, field}`. The body is closed: exactly `v, levelId, screen, kind, text`; another key, or JSON
 * that is not an object, is field `body`.
 */
export function parseFeedback(raw, registry) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, field: 'body' };
  }
  if (!isObject(data) || Object.keys(data).some((k) => !BODY_KEYS.includes(k))) return { ok: false, field: 'body' };
  if (data.v !== VERSION) return { ok: false, field: 'v' };
  const { levelId, screen, kind, text } = data;
  if (typeof levelId !== 'string' || !Object.hasOwn(registry.levels, levelId)) return { ok: false, field: 'levelId' };
  if (!Number.isInteger(screen) || screen < 1 || screen > MAX_SCREEN) return { ok: false, field: 'screen' };
  if (typeof kind !== 'string' || !KINDS.includes(kind)) return { ok: false, field: 'kind' };
  if (typeof text !== 'string') return { ok: false, field: 'text' };
  const trimmed = strip(text).trim(); // text made only of stripped characters is empty
  const chars = [...trimmed].length;
  if (chars < 1 || chars > MAX_TEXT) return { ok: false, field: 'text' };
  return { ok: true, levelId, screen, kind, text: trimmed, chars };
}

/** The issue title, from registry data only (never the player's text). */
export const issueTitle = (level) => `Feedback: ${level.name} (${level.id})`;

/** Player text made safe to show in an issue: no control or direction characters, and no `@` that can mention anyone. */
const clean = (text) => strip(text).replaceAll('@', `@${ZERO_WIDTH_SPACE}`);

/**
 * The issue body: five header lines from controlled data, then the cleaned text inside a code fence that is longer
 * than any backtick run in the text, so the text cannot close it. `commit` is shown only when it looks like a git sha;
 * `who` is the finished "From" text (a nickname in backticks, `signed in, not listed` or `signed out`).
 */
export function issueBody({ kind, screen, level, commit, who, text }) {
  const body = clean(text);
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  const sha = typeof commit === 'string' && COMMIT.test(commit) ? commit : 'unknown';
  return [`Kind: ${kind}`, `Level: ${level.name} (${level.id})`, `Step: ${screen}`, `Game commit: ${sha}`, `From: ${who}`, '', `${fence}text`, body, fence].join('\n');
}
