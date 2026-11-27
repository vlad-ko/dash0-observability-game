// An in-memory Dash0 for tests and local dev (#509 P5): the OTLP ingest (`POST /v1/{traces,logs,metrics}`) and the
// task server's API interface (lib/dash0-task/api.mjs), over a fetch-shaped function. No network, ever: a request to a host the
// fake was not built with throws a TypeError, so a suite cannot reach the real Dash0 by accident (T8).
//   createFakeDash0({now, lagMs, hosts, ingestToken}) -> {fetch, countAttempt, findAssets, fail, records, assets, calls}
//   records   every record received: {signal, attemptId, tag, taskId, receivedAt}. It is only COUNTED once receivedAt + lagMs <= now().
//   assets    the assets findAssets lists: {origin, kind}; a test pushes them.
//   calls     every API call: {op, attemptId | originPrefix, from, to}
//   fail(mode, where = 'both')   mode is 401 | 403 | 429 | 500 | 'timeout' | 'malformed' | null (healthy again); where is 'ingest', 'api' or 'both'.
//     ingest: the status; 'timeout' never answers until aborted; 'malformed' is a 200 with a body that is not JSON.
//     api:    the call rejects (with `status` for a status), 'timeout' rejects when `signal` aborts, 'malformed' resolves a count that is not a number.
import { ATTR } from '../lib/dash0-task/stamp.mjs';

const SIGNAL_OF = Object.freeze({ '/v1/traces': 'traces', '/v1/logs': 'logs', '/v1/metrics': 'metrics' });
const STATUSES = [401, 403, 429, 500];

export function createFakeDash0({ now, lagMs = 0, hosts, ingestToken = null } = {}) {
  if (typeof now !== 'function') throw new TypeError('createFakeDash0 needs now');
  if (!Array.isArray(hosts) || hosts.length === 0) throw new TypeError('createFakeDash0 needs the hosts it answers for');
  const records = [];
  const assets = [];
  const calls = [];
  const failing = { ingest: null, api: null };

  const stringAttr = (list, key) => (Array.isArray(list) ? list.find((a) => a.key === key)?.value?.stringValue : undefined);
  const note = (signal, item) => {
    const list = item.attributes;
    records.push({
      signal,
      attemptId: stringAttr(list, ATTR.attempt) ?? null,
      tag: stringAttr(list, ATTR.player) ?? null,
      taskId: stringAttr(list, ATTR.task) ?? null,
      receivedAt: now(),
    });
  };
  function take(signal, body) {
    const rows = {
      traces: () => body.resourceSpans?.flatMap((r) => r.scopeSpans.flatMap((s) => s.spans)),
      logs: () => body.resourceLogs?.flatMap((r) => r.scopeLogs.flatMap((s) => s.logRecords)),
      metrics: () => body.resourceMetrics?.flatMap((r) => r.scopeMetrics.flatMap((s) => s.metrics.flatMap((m) => (m.gauge ?? m.sum).dataPoints))),
    }[signal]();
    if (!Array.isArray(rows)) throw new Error('not an OTLP body');
    rows.forEach((row) => note(signal, row));
  }

  const aborted = (signal) =>
    new Promise((_, reject) => {
      const stop = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      if (signal?.aborted) stop();
      else signal?.addEventListener('abort', stop, { once: true });
    });

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    if (!hosts.includes(url.hostname)) throw new TypeError(`fake dash0: unknown host ${url.hostname}`);
    const mode = failing.ingest;
    if (STATUSES.includes(mode)) return new Response('{}', { status: mode });
    if (mode === 'timeout') return aborted(init.signal);
    if (mode === 'malformed') return new Response('<html>not json', { status: 200 });
    const signal = SIGNAL_OF[url.pathname];
    if (init.method !== 'POST' || signal === undefined) return new Response('{}', { status: 404 });
    if (ingestToken !== null && init.headers?.Authorization !== `Bearer ${ingestToken}`) return new Response('{}', { status: 401 });
    try {
      take(signal, JSON.parse(init.body));
    } catch {
      return new Response('{"message":"bad request"}', { status: 400 });
    }
    return new Response('{}', { status: 200 });
  }

  async function apiFault(signal) {
    const mode = failing.api;
    if (STATUSES.includes(mode)) throw Object.assign(new Error(`status ${mode}`), { status: mode });
    if (mode === 'timeout') return aborted(signal);
    return mode;
  }

  async function countAttempt(attemptId, { signal, from, to } = {}) {
    calls.push({ op: 'countAttempt', attemptId, from, to });
    if ((await apiFault(signal)) === 'malformed') return { count: 'many' };
    const count = records.filter((r) => r.attemptId === attemptId && r.receivedAt + lagMs <= now()).length;
    return { count };
  }

  async function findAssets({ signal, originPrefix } = {}) {
    calls.push({ op: 'findAssets', originPrefix });
    if ((await apiFault(signal)) === 'malformed') return { assets: 'many' };
    return { assets: assets.filter((a) => a.origin.startsWith(originPrefix)) };
  }

  function fail(mode, where = 'both') {
    if (mode !== null && !STATUSES.includes(mode) && mode !== 'timeout' && mode !== 'malformed') throw new RangeError('unknown failure mode');
    if (where !== 'ingest') failing.api = mode;
    if (where !== 'api') failing.ingest = mode;
  }

  return { fetch, countAttempt, findAssets, fail, records, assets, calls };
}
