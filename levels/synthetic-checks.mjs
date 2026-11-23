// Level 7.4: Synthetic checks. Act 7 "Alerting and SLOs". Kettle & Co's checkout is fully instrumented, and customers still tell the team
// about outages first. The player sorts eleven failures (drawn from a pool of seventeen) into "your spans record the failure" and "your spans record nothing, a probe sees it" (Sort it),
// then chooses the alert that would have paged for an expired TLS certificate, where the spans read healthy (Choice). No synthetic run is
// simulated. Hints are off on the sort (the default ladder: hints in early acts only).
// Spec: https://opentelemetry.io/docs/specs/otel/trace/api/#spankind , https://opentelemetry.io/docs/specs/semconv/http/http-spans/
// Dash0 docs: https://www.dash0.com/docs/dash0/monitoring/synthetics/synthetic-monitoring , https://www.dash0.com/docs/dash0/monitoring/synthetics/explore-run-details , https://www.dash0.com/docs/dash0/monitoring/alerting/about-notifications
//
// The alert Choice is an answer pool (#390, docs/CONTENT.md section 10): the content lists 20 answers and a showing draws 6 (one of
// the 3 right, 5 of the 17 wrong). Its extra answers use the same facts as below plus, read 2026-11-20 on the synthetic monitoring page
// above: a synthetic check makes real requests to an endpoint at regular intervals from Dash0 public regions or private locations, and
// notifications fire automatically when any assertion fails. Every wrong answer rests on the scenario in the step's own text (spans
// healthy, internal tools still connecting, nothing deployed, pods untouched), not on a claim about a product.
//
// Facts used (each read on the page named in its parentheses, 2026-11-07): a SERVER span covers server-side handling of a remote request
// (the trace API page, SpanKind); the HTTP spans page has an example of a client call that fails with a DNS error, seen from the client
// side. In Dash0, synthetic checks are scripted tests that send requests to your websites and APIs at regular intervals from public or
// private locations, and a notification fires when an assertion fails; a check run shows a timeline of DNS resolution, TCP connection,
// SSL/TLS handshake, request send, response wait and download, and error attributes that highlight network errors such as a timeout or a
// TLS error; notification channels deliver alerts from check rules and synthetic checks (the synthetic monitoring page, the run details
// page, the notification channels page).
//
// Stated as reasoning, with no source: a request that fails before it reaches instrumented code of your service (a failed DNS lookup of
// your hostname, a failed TLS handshake with your certificate, an answer from a CDN cache or from the load balancer) does not become a
// server span of your service, because a server span is made by the code that handles the request. The copy scopes it to your
// service's spans: an instrumented proxy or ingress has spans of its own, and a failed call out of your service is a client span.
//
// The sort pool (#390) adds six failures on the same facts and reasoning, plus, read 2026-11-22 on the HTTP spans page: error.type
// lists timeout as an example value, and for status codes in the 5xx range span status should be set to Error. The firewall, the
// certificate for another name and the CDN's retired origin stop the request before it reaches checkout, as above; the inventory
// timeout is a failed call out of checkout (a client span); a write the database rejects is recorded on the database client span under
// checkout's server span (reasoning, as for the slow query).
//
// Invented for the game: the company, the seventeen failures, and every number in step 2 (3,000 requests against a usual 4,000 at that hour, 0 errors, 180 ms, a 10-second health check).
//
// The words are in content/core/levels/synthetic-checks.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/synthetic-checks.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Only the ids and the bucket each item belongs to; every label and explanation is in the content file. An answer pool (#390,
// docs/CONTENT.md section 10): 9 span items and 8 probe items, and a showing draws 6 and 5 (the eleven it showed before the pool).
const SORT = {
  id: 'sc-sort',
  helps: { hints: false },
  draw: { spans: 6, probe: 5 },
  buckets: [{ id: 'spans' }, { id: 'probe' }],
  items: [
    { id: 'handler-throws', bucket: 'spans' },
    { id: 'tls-expired', bucket: 'probe' },
    { id: 'payment-dns', bucket: 'spans' },
    { id: 'slow-query', bucket: 'spans' },
    { id: 'dns-dropout', bucket: 'probe' },
    { id: 'inventory-loop', bucket: 'spans' },
    { id: 'dns-stale', bucket: 'probe' },
    { id: 'payment-tls', bucket: 'spans' },
    { id: 'cdn-stale', bucket: 'probe' },
    { id: 'bad-deploy', bucket: 'spans' },
    { id: 'lb-no-targets', bucket: 'probe' },
    { id: 'inventory-timeout', bucket: 'spans' },
    { id: 'firewall-block', bucket: 'probe' },
    { id: 'db-disk-full', bucket: 'spans' },
    { id: 'tls-wrong-name', bucket: 'probe' },
    { id: 'big-basket', bucket: 'spans' },
    { id: 'cdn-origin', bucket: 'probe' },
  ],
};

const SKELETON = {
  id: 'synthetic-checks',
  no: '7.4',
  icon: '\u{1F4E1}',
  cards: ['synthetics-see-the-edge'],
  lights: ['storefront', 'api-gateway'],
  scoring: { parMs: null },
  play: {
    prefix: 'sc',
    steps: [
      { qid: 'sc-q-sort', sort: SORT },
      {
        qid: 'sc-q-alert',
        choice: {
          id: 'sc-alert',
          draw: 6,
          choices: [
            { key: 'health-check', keep: true }, // the tempting near-miss: the 50/50 never removes it (#371)
            { key: 'probe', right: true },
            { key: 'synthetic-check', right: true },
            { key: 'outside-200', right: true },
          ],
        },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
