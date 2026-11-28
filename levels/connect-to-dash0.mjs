// Level 9.3: Connect the game to Dash0 (#509 P7.3). A play level with three steps. A sort step: what may go in the code of a page that sends
// telemetry from a browser (an Ingesting-only token, the endpoint) and what may not (a token with All permissions, Reading or Signal Control edge).
// A choice step: which address the page sends to (the OTLP via HTTP endpoint, not gRPC, not the Prometheus API, not the local default).
// Then an In Dash0 step (task 'connect-test-span', a readback task with a send form): the player makes an Ingesting token in the game's own
// Dash0 organisation, copies the OTLP via HTTP endpoint, sends one test span from this tab and presses Check; the task server looks for the span.
// The game draws no Dash0 screen and no practice mode: the real places are named in words. The token is typed into the send form of
// lib/widgets/dash0-send.mjs, which holds and clears it; this file never sees it (docs/DASH0-LAB.md).
// A player who cannot do the In Dash0 step (signed out, task server off) plays the first two steps alone (lib/play.mjs, D7).
// Spec: https://www.dash0.com/docs/dash0/miscellaneous/glossary/auth-tokens , https://www.dash0.com/docs/dash0/miscellaneous/glossary/endpoints , https://www.dash0.com/docs/dash0/miscellaneous/glossary/datasets , https://www.dash0.com/docs/dash0/miscellaneous/glossary/dash0-api
// Spec: https://www.dash0.com/docs/dash0/miscellaneous/tooling/web-sdk/installation , https://www.dash0.com/docs/dash0/miscellaneous/tooling/web-sdk/overview , https://www.dash0.com/hub/integrations/int_otlp/overview
// Spec: https://www.dash0.com/docs/dash0/telemetry/signal-control/edge/about-signalcontrol-edge
// Spec: https://opentelemetry.io/docs/languages/js/exporters/ , https://opentelemetry.io/docs/specs/otlp/
// Dash0 docs: https://www.dash0.com/docs/dash0/telemetry/signal-control/edge/about-signalcontrol-edge , https://www.dash0.com/docs/dash0/miscellaneous/glossary/auth-tokens , https://www.dash0.com/docs/dash0/miscellaneous/glossary/endpoints , https://www.dash0.com/docs/dash0/miscellaneous/glossary/datasets , https://www.dash0.com/docs/dash0/miscellaneous/glossary/dash0-api , https://www.dash0.com/docs/dash0/miscellaneous/tooling/web-sdk/installation , https://www.dash0.com/docs/dash0/miscellaneous/tooling/web-sdk/overview , https://www.dash0.com/hub/integrations/int_otlp/overview
// Facts used (read 2026-11-27):
// - Auth tokens are of the form auth_abc123..., each belongs to one organisation, and are managed in Settings -> Auth Tokens (glossary/auth-tokens).
//   The Permissions options are All permissions (the default: the full Dash0 API for configuration, ingesting and querying), Ingesting (can only send
//   telemetry), Reading (can only query data) and Signal Control edge (sends telemetry and reads SignalControl Edge settings). "Restrict tokens to
//   Ingesting whenever you distribute them publicly, for example in OpenTelemetry instrumentation running in web browsers or mobile apps. Such a token is
//   readable by anyone using the app, and an ingestion-only token cannot read your telemetry back or change your configuration." A token drops the
//   telemetry of each signal it has no action for, without an error. A token's Dataset setting is All datasets or specific datasets; a request that
//   names a dataset the token may not write to is rejected (glossary/auth-tokens; the brief says to check that Dataset says All datasets).
// - The Dash0 Web SDK needs the Endpoint url for your Dash0 region, found via "Organization Settings > Endpoints > OTLP via HTTP", and a token with
//   Ingesting permissions; "auth tokens for client monitoring will be public as part of your website"; limit the dataset permissions to the dataset
//   to ingest into; init() takes endpoint: { url, authToken } in the page's code (tooling/web-sdk/installation and overview).
// - "Your organization's ingestion endpoint accepts all four OpenTelemetry signals over both OTLP transports: Traces: OTLP/gRPC, or OTLP/HTTP at
//   /v1/traces" (hub/integrations/int_otlp/overview). So the gRPC decoy never says Dash0 refuses gRPC.
// - "When you use the OTLP exporter in a browser-based application ... Using gRPC for exporting is not supported" (opentelemetry.io JS exporters).
//   OTLP/HTTP default port is 4318 and the default path for traces is /v1/traces (OTLP spec); the JS exporter's default url is
//   http://localhost:4318/v1/traces (JS exporters, a code comment).
// - The Dash0 API is how you "configure Dash0 and ... query your data"; the Prometheus APIs are on Dash0's Prometheus API endpoint and take a token
//   "having the querying permissions" (glossary/dash0-api). Endpoint URLs reflect the organisation's region, and the endpoint reference is in the
//   organisation's settings (glossary/endpoints).
// - SignalControl Edge "runs that same reduction inside your own network, before telemetry leaves it", with an edge collector that "connects back to
//   Dash0 for configuration" (telemetry/signal-control/edge/about-signalcontrol-edge); the Signal Control edge permission grants ingest:* and
//   edge-settings:read (glossary/auth-tokens). The edge-token answers say it is for that, and that a page reader could read those settings with it.
// Derived, not stated on a page: that the endpoint address is "not a credential" (an address; the token authorises: glossary/auth-tokens says tokens
// "authenticate and authorize"); that keeping the address out of the page's code would break the page (the SDK needs it to send); that localhost in a
// visitor's browser is the visitor's own machine; that a dataset name is safe in page code (Dash0 says only that a request naming a dataset the token
// may not write to is rejected); that anyone who reads the page could read the edge settings with an edge token.
// Naming: the player text says "Settings" throughout (Settings, Auth Tokens; Settings, Endpoints). The auth-tokens page writes "Settings -> Auth Tokens";
// the Web SDK page writes "Organization Settings > Endpoints > OTLP via HTTP". Whether they are the same menu is unverified.
// Not on a Dash0 page, so unverified (#195, P8): that the endpoint appears in Dash0 without a path (the send form refuses any path, lib/dash0/ingress.mjs,
// so the brief asks for "the address without a path"; the Web SDK page does not show the URL); that leaving Dataset at All datasets is the form's default; that the Create token form preselects a dataset other than All datasets for a player (the page says
// Dash0 "preselects your preferred dataset if it is eligible"; the brief only asks to check the Dataset field); that a player's browser may send to the
// organisation's ingress (CORS and the game's CSP: vercel.json connect-src, lib/dash0/ingress.mjs, whose INGRESS_HOSTS are inferred); and that a player
// is an Admin in the game's organisation (the page says only Admins can create tokens; the brief does not name the role).
// Invented: the page and the scenario of the first two steps; the token permissions and endpoint names are Dash0's. No pricing claim.
//
// A play level: its words are in content/core/levels/connect-to-dash0.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
// It reads no telemetry session: the send form of the In Dash0 step does, and the task server grades.
import CORE from '../content/core/levels/connect-to-dash0.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// Step 1: six things a page's code might hold, two buckets. Only the Ingesting-only token, the endpoint and a dataset name may go in it.
const SORT = {
  id: 'ctd-sort',
  helps: { hints: false }, // Act 9 has no helps (#240)
  buckets: [{ id: 'ship' }, { id: 'keep' }],
  items: [
    { id: 'ingest-token', bucket: 'ship' },
    { id: 'endpoint', bucket: 'ship' },
    { id: 'dataset-name', bucket: 'ship' },
    { id: 'all-token', bucket: 'keep' },
    { id: 'read-token', bucket: 'keep' },
    { id: 'edge-token', bucket: 'keep' },
  ],
};

// Step 2: the address. Only the OTLP via HTTP endpoint is right; the gRPC endpoint is the tempting near-miss (the 50/50 keeps it).
const ENDPOINT = {
  id: 'ctd-endpoint',
  choices: [
    { key: 'http', right: true },
    { key: 'grpc', keep: true },
    { key: 'prometheus' },
    { key: 'local' },
  ],
};

// Step 3: the task server sends nothing for this task: the player sends the test span, and the server looks for it (lib/dash0-task/tasks.mjs).
const DASH0 = { id: 'connect-send', task: 'connect-test-span', grader: 'readback' };

const SKELETON = {
  id: 'connect-to-dash0',
  no: '9.3',
  icon: '\u{1F50C}',
  cards: [],
  lights: ['collector'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'ctd',
    steps: [
      { qid: 'ctd-q-sort', sort: SORT },
      { qid: 'ctd-q-endpoint', choice: ENDPOINT },
      { dash0: DASH0 },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: {} });
}

export default withText(CORE);
