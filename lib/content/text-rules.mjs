// Text rules shared by every kind of authored content (#391, docs/FOUNDATION.md §2.12): what a
// string may contain. Pure; each check returns a list of problem phrases (empty is fine) and never
// throws, whatever it is given. Callers put their own path in front of each problem.

/** A kebab-case id of at most 64 characters: the registry's rule, re-exported so content shares it. */
export { isId } from '../registry.mjs';

const CONTROL = /[\u0000-\u001f\u007f]/;
const CONTROL_EXCEPT_LINES = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const EM_DASH = String.fromCharCode(0x2014);

function check(s, control) {
  if (typeof s !== 'string') return ['must be a string'];
  const problems = [];
  if (s !== s.trim()) problems.push('must not start or end with whitespace');
  if (control.test(s)) problems.push('must not contain control characters');
  if (s.includes(EM_DASH)) problems.push('must not contain an em dash');
  return problems;
}

/** Problems with a plain text string: trimmed, no control characters, no em dash. */
export const checkPlain = (s) => check(s, CONTROL);

/** Like `checkPlain`, but newlines and tabs are allowed inside (code samples). */
export const checkCode = (s) => check(s, CONTROL_EXCEPT_LINES);
