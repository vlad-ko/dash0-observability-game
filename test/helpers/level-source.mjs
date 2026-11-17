// The one way a test reads a level's source text (#391). A level's grading and wiring live in
// levels/<id>.mjs; once its copy moves to content/core/levels/<id>.mjs the scans that look for an
// em dash, a "Spec:" host or markup must still see that copy, so they read through here:
// the logic file, a newline, then the decoded string leaves of the content file when it exists.
// With no content file the result is the logic file exactly.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonModule } from './content-files.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The parsed content file at `path`; throws naming every problem when it is not strict JSON. */
function decodeContentModule(path) {
  const { value, errors } = readJsonModule(path);
  if (errors.length) throw new Error(`${path}: ${errors.join('; ')}`);
  return value;
}

/** Every string value (not key) in `value`, depth first, in document order. */
function stringLeaves(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) stringLeaves(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) stringLeaves(v, out);
  return out;
}

/** The source text of level `id`; `root` is the repo root (a fixture root in tests of this helper). */
export function levelSource(id, { root = ROOT } = {}) {
  const logic = readFileSync(join(root, 'levels', `${id}.mjs`), 'utf8');
  const contentFile = join(root, 'content', 'core', 'levels', `${id}.mjs`);
  if (!existsSync(contentFile)) return logic;
  return `${logic}\n${stringLeaves(decodeContentModule(contentFile)).join('\n')}`;
}
