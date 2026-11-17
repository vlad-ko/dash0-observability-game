// Level feedback, the browser side (#370; docs/FOUNDATION.md §2.11): whether feedback is on (GET /api/feedback, once
// per page, cached) and one note turned into a typed outcome the dialog words. `fetch` is injected; nothing here
// touches window, so it imports cleanly under node --test. Unknown or failed means off. Never rejects.

export const FEEDBACK_URL = '/api/feedback';

/** The retry wait when a 429 does not say. */
const DEFAULT_RETRY_S = 60;

/**
 * `{kind}` for a POST answer: `sent` (issue), `rate-limited` (retryAfterS), `off`, `rejected` (400 or 413: the
 * server refused the note itself) or `failed` (anything else). Pure.
 */
export function outcomeOf(status, body) {
  if (status === 201) {
    const issue = body?.issue;
    return body?.v === 1 && body.ok === true && Number.isInteger(issue) && issue > 0 ? { kind: 'sent', issue } : { kind: 'failed' };
  }
  if (status === 429) {
    const s = Number(body?.retryAfterS);
    return { kind: 'rate-limited', retryAfterS: Number.isFinite(s) && s > 0 ? s : DEFAULT_RETRY_S };
  }
  if (status === 503) return { kind: 'off' };
  if (status === 400 || status === 413) return { kind: 'rejected' };
  return { kind: 'failed' };
}

export function createFeedbackClient({ fetch, url = FEEDBACK_URL }) {
  let asked = null; // the one status request of this page
  let on = false;
  const load = () => {
    asked ??= (async () => {
      try {
        const res = await fetch(url, { method: 'GET' });
        const body = res.ok ? await res.json() : null;
        on = body?.v === 1 && body.on === true;
      } catch {
        on = false;
      }
      return on;
    })();
    return asked;
  };

  return {
    /** Resolves true when the server has feedback on; false for anything else. Fetched once. */
    status: load,
    /** The cached answer: false until `status()` has resolved. */
    get on() {
      return on;
    },
    /** POST one note: `{levelId, screen, kind, text}` -> an outcome. Never rejects. */
    async send({ levelId, screen, kind, text }) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ v: 1, levelId, screen, kind, text }),
        });
        let body = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        return outcomeOf(res.status, body);
      } catch {
        return { kind: 'failed' };
      }
    },
  };
}
