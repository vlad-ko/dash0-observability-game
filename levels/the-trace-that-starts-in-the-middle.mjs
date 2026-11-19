// Level 9.4: The trace that starts in the middle. Act 9 "Live Demo" (docs/LIVE-DEMO.md). The player hears a confident answer to a
// customer, "cart's SDK ignores the header and starts over, so its spans float loose", and says whether it holds (Choice): the
// spans of cart and payments carry web's trace ID, and their parent-ids name spans that no exporter sends, because a mesh sidecar
// between each caller and callee writes a parent-id of its own into the header and exports no span. Then the sidecars pass the header
// through unchanged, and the player rebuilds the tree the fix will give (Build it, `edit: ['parent']`): each server span joins the
// CLIENT span of the call that carried the header, not the SERVER span around it and not a parallel call. The presenter has no
// name and no affiliation.
// Source: written for the game from the Act 9 design on issue #240 (docs/LIVE-DEMO.md). Nothing below identifies a customer, a person or a product.
// Spec: https://www.w3.org/TR/trace-context/#parent-id , https://www.w3.org/TR/trace-context/#mutating-the-traceparent-field , https://opentelemetry.io/docs/concepts/context-propagation/
//
// Facts used (each read on the page named, 2026-11-08). W3C Trace Context, 3.2.2.4 parent-id: "This is the ID of this request as known
// by the caller (in some tracing systems, this is known as the span-id, where a span is the execution of a client request)."
// W3C 3.4 Mutating the traceparent Field: "A vendor receiving a traceparent request header MUST send it to outgoing requests. It MAY
// mutate the value of this header before passing it to outgoing requests." and "Unmodified header propagation is typically
// implemented in pass-through services like proxies." and, among the allowed mutations, "Update parent-id: The value of the parent-id
// field can be set to the new value representing the ID of the current operation." OpenTelemetry, Context propagation: "When Service A
// calls Service B, Service A includes a trace ID and a span ID as part of the context. Service B uses these values to create a new
// span that belongs to the same trace, setting the span from Service A as its parent."
//
// Stated as reasoning, with no source (neither page says it in these words): that a rewritten parent-id leaves a hole in the trace
// unless some exporter sends the span it names (a parent-id is only a pointer; the W3C text allows the mutation and does not say who
// must export the span); and that a mesh sidecar with tracing export off exports no span. The sidecars, their settings and the lab are invented.
//
// Invented for the game: the company, the three services (web, cart, payments), every span ID, trace ID, name and time, the sidecars
// and their settings, and the parallel calls. How 9.4 differs from 2.4 and 8.4: in 2.4 a proxy DROPS the header and the trace splits
// in two (the Choice finds the hop, one orphan to join). In 8.4 the header is intact and the trace starts in the browser (the
// Build it has two identical twin calls, one orphan, one hop). Here the header arrives but its parent-id is a pointer to nothing and
// the trace ID is intact; the player diagnoses that from the data and rebuilds two hops, where every client span that could be the parent
// overlaps the server span in time, and no name, verb or position tells them apart, only the IDs.
//
// The words are in content/core/levels/the-trace-that-starts-in-the-middle.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/the-trace-that-starts-in-the-middle.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const T = '5d2b8f0e7c41a396b0d4e8f21a7c3b95';
const WEB_S = '1e7a3c9d5b2f8046';
const WEB_C = '9c3e1a7d4b6f2085';
const WEB_C2A = '2f8b6d0a1c5e9347';
const WEB_C2B = 'f7a1d5f3b9e0c462';
const CART_S = '4b9e2c6a0d8f1573';
const CART_C = 'e0a4c8f2b6d19375';
const CART_C2A = '3d7b1f5a9c2e8064';
const CART_C2B = '8c2e6a0d4f1b7953';
const PAY_S = 'a5f1b9d3c7e20468';
const PAY_DB = '6e0c4a8f2d1b5973';
const MESH1 = 'c70d3b9f1a5e8264'; // the parent-id the sidecar wrote for the web to cart call: no exporter sends this span
const MESH2 = 'f4a82e6c0b1d7935'; // the same for the cart to payments call

const span = (spanId, service, name, kind, startMs, endMs, parentId) => ({
  spanId, traceId: T, name, service, kind, startMs, endMs, status: 'UNSET', attributes: {}, events: [], parentId, links: [],
});

// One checkout request, as the backend received it with the sidecars rewriting parent-id. Cart's and payments' server spans arrive
// with a parent-id that is not the id of any received span. Each server span sits inside three client spans of its caller (the call
// that carried the header and two parallel calls), all enclosing it, so timing cannot pick. Client spans carry the bare HTTP method as
// their name (a client has no route to put in a name), so no server name matches a client name; the right client is not its caller's
// only POST (one parallel call is a POST too, listed above it on the web board); and the timings share no position between the two
// hops, and no span ID order picks it either (the decoy POST on web has the largest ID there, the right one on cart) (web: the right client is the latest to start, the tightest and the first to end; cart: the earliest to start, the widest and
// the last to end), so no rule by name, verb, middle, extreme or row position passes both hops (test/the-trace-that-starts-in-the-middle.test.mjs).
// Only the ids tell them apart, read from the header against the id table.
const TREE = {
  id: 'ttsm-tree',
  spans: [
    span(WEB_S, 'web', 'POST /checkout', 'SERVER', 0, 400, null),
    span(WEB_C2A, 'web', 'GET', 'CLIENT', 20, 385, WEB_S),
    span(WEB_C2B, 'web', 'POST', 'CLIENT', 25, 375, WEB_S),
    span(WEB_C, 'web', 'POST', 'CLIENT', 30, 365, WEB_S),
    span(CART_S, 'cart', 'POST /cart/checkout', 'SERVER', 40, 360, MESH1),
    span(CART_C, 'cart', 'POST', 'CLIENT', 85, 315, CART_S),
    span(CART_C2A, 'cart', 'GET', 'CLIENT', 90, 310, CART_S),
    span(CART_C2B, 'cart', 'POST', 'CLIENT', 100, 290, CART_S),
    span(PAY_S, 'payments', 'POST /payments/charge', 'SERVER', 120, 280, MESH2),
    span(PAY_DB, 'payments', 'INSERT charges', 'CLIENT', 140, 260, PAY_S),
  ],
  edit: ['parent'],
  answer: { [CART_S]: { parentId: WEB_C }, [PAY_S]: { parentId: CART_C } },
  helps: {}, // the help ladder's last rung (docs/M1-DESIGN.md §4.2): no helps, a Check button, no hints
};

const traceparent = (parentId) => `00-${T}-${parentId}-01`;
const code = (text) => `<code>${text}</code>`;
const header = (text) => `<code data-token>${text}</code>`; // a traceparent: kept whole on a line while it fits
const row = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;

// Step 1 data: every span as received, and the header on each hop before and after its sidecar. The code supplies the data cells
// only; every word the player reads (the "none" of the root's parent cell, the hop names) is in the content file's table markup.
// The root is the first span: the content holds its row (`<tr>{{root-cells}}<td>none</td></tr>`) and `{{child-rows}}` follows it.
const [ROOT, ...CHILDREN] = TREE.spans;
if (ROOT.parentId !== null || CHILDREN.some((s) => s.parentId === null)) throw new Error('the tree must have exactly one root, listed first');
const dataCells = (s) => [s.service, code(s.name), s.kind, code(s.spanId)].map((c) => `<td>${c}</td>`).join('');
const CHILD_ROWS = CHILDREN.map((s) => row([s.service, code(s.name), s.kind, code(s.spanId), code(s.parentId)])).join('');

// Step 2 data: the client spans' ids, so the header's parent-id can be looked up.
const CLIENT_ROWS = TREE.spans
  .filter((s) => s.kind === 'CLIENT' && s.service !== 'payments')
  .map((s) => row([s.service, code(s.name), code(s.spanId)]))
  .join('');

// The figures the copy quotes, each filled into the content's {{name}} marks with the same expression and formatting the copy used.
// The headers: `web-c-header` and `cart-c-header` left the caller (and, after the fix, pass through); `*-mesh-header` is what the sidecar wrote.
const VARS = {
  'trace-short': T.slice(0, 8),
  'root-cells': dataCells(ROOT),
  'child-rows': CHILD_ROWS,
  'web-c-header': header(traceparent(WEB_C)),
  'web-c': code(WEB_C),
  mesh1: code(MESH1),
  'web-mesh-header': header(traceparent(MESH1)),
  'cart-c-header': header(traceparent(CART_C)),
  'cart-mesh-header': header(traceparent(MESH2)),
  'client-rows': CLIENT_ROWS,
};

// Step 1: does the presenter's answer hold? `why` follows "Right." or "Not quite."; only the right choice is listed here.
const VERDICT = [{ key: 'rewritten', right: true }];

// The level as it was, minus the words.
const SKELETON = {
  id: 'the-trace-that-starts-in-the-middle',
  no: '9.4',
  icon: '\u{1F9ED}',
  cards: [],
  lights: ['storefront', 'cart', 'payments'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'ttsm',
    steps: [
      { qid: 'ttsm-q-verdict', choice: { id: 'ttsm-verdict', choices: VERDICT } },
      { qid: 'ttsm-q-tree', build: TREE },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
