// The simulated Dash0 service view of the span kinds hunt (level 2.2): what a backend shows
// for a trace, derived from span kind. These are this game's simulated view rules, not a
// description of any one product: a service's requests are counted from its SERVER spans, and
// a map edge is drawn from a CLIENT span to its SERVER child in another service (serviceEdges,
// lib/widgets/trace.mjs). Pure and DOM-free; inputs are never mutated.
// Spec: https://opentelemetry.io/docs/specs/otel/trace/api/#spankind
// Docs (GitHub README at the v0.164.0 tag the repo pins elsewhere; not an allowed Spec host; span metrics carry span.kind as a dimension): https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/v0.164.0/connector/spanmetricsconnector/README.md
import { KINDS, serviceEdges } from './widgets/trace.mjs';

/**
 * Requests per minute per service: its SERVER spans times `perMin` (what one trace stands for).
 * Every service with at least one span is listed, sorted by name; a service with no spans is
 * absent, never 0. A `perMin` that is not a finite number of at least 0 is a TypeError.
 */
export function requestRates(spans, { perMin }) {
  if (typeof perMin !== 'number' || !Number.isFinite(perMin) || perMin < 0) {
    throw new TypeError(`requestRates: perMin must be a finite number of at least 0, got ${String(perMin)}`);
  }
  const servers = new Map();
  for (const s of spans) servers.set(s.service, (servers.get(s.service) ?? 0) + (s.kind === 'SERVER' ? 1 : 0));
  return [...servers.keys()].sort().map((service) => ({ service, perMin: servers.get(service) * perMin }));
}

/** `spans` with span `spanId` given `kind` (new copies); null for an unknown span id or a kind outside KINDS. */
export function withKind(spans, spanId, kind) {
  if (!KINDS.includes(kind) || !spans.some((s) => s.spanId === spanId)) return null;
  return spans.map((s) => (s.spanId === spanId ? { ...s, kind } : { ...s }));
}

/**
 * What the view shows: `{rates, edges, watched, firing}`. `watched` is the rate of service
 * `watch` (null when it has no spans: unknown, not firing) and `firing` is `watched < expected`
 * (`expected`, the rate the alert expects, defaults to 1: no requests at all).
 */
export function serviceView(spans, { perMin, watch, expected = 1 }) {
  const rates = requestRates(spans, { perMin });
  const hit = rates.find((r) => r.service === watch);
  const watched = hit ? hit.perMin : null;
  return { rates, edges: serviceEdges(spans), watched, firing: watched === null ? null : watched < expected };
}

/** A fresh hunt: nothing flagged, not solved. */
export const newHunt = () => ({ flagged: [], solved: false });

/**
 * Flag span `spanId` in a hunt. Outcomes: `closed` (already solved), `unknown` (no such span),
 * `repeat` (already ruled out), `right` (the culprit: solved) or `wrong` (ruled out). Returns
 * `{state, outcome}`; the state passed in is never changed.
 */
export function flagSpan(spans, culprit, st, spanId) {
  if (st.solved) return { state: st, outcome: 'closed' };
  if (!spans.some((s) => s.spanId === spanId)) return { state: st, outcome: 'unknown' };
  if (st.flagged.includes(spanId)) return { state: st, outcome: 'repeat' };
  if (spanId === culprit) return { state: { flagged: [...st.flagged], solved: true }, outcome: 'right' };
  return { state: { flagged: [...st.flagged, spanId], solved: false }, outcome: 'wrong' };
}
