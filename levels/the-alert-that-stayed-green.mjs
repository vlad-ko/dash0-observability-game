// Level 9.6: The alert that stayed green. Act 9 "Live Demo" (docs/LIVE-DEMO.md), on Fiji. A presenter says "the checkout error alert has
// been green all afternoon, so checkout is healthy". The player says why it is green (Choice: the numerator selects a status value no
// series has, so the expression returns nothing), then fixes the rule (Query it, on the checkout-http data): the label, and a
// grouping by route so the one failing route is not averaged away. Either fix alone still returns nothing.
// Source: an anonymised call question (docs/LIVE-DEMO.md). Nothing below identifies a customer, a person or a product.
// Spec: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/ , https://prometheus.io/docs/prometheus/latest/querying/operators/ , https://prometheus.io/docs/prometheus/latest/querying/functions/#absent
//
// Facts used (each read on the page named in its parentheses, 2026-11-08): "Whenever the alert expression results in one or more
// vector elements at a given point in time, the alert counts as active for these elements' label sets" (the alerting rules page), so an
// expression that returns nothing never makes an alert active. Between an instant vector and a scalar, a comparison operator is applied
// to every sample and "vector elements between which the comparison result is false get dropped from the result vector"; `by` "drops
// labels that are not listed in the by clause" (the operators page). "absent(v instant-vector) returns an empty vector if the vector
// passed to it has any elements (float samples or histogram samples) and a 1-element vector with the value 1 if the vector passed to it
// has no elements. This is useful for alerting on when no time series exist for a given metric name and label combination." (the
// functions page).
//
// Worked out in the game, not copied from a source (test/the-alert-that-stayed-green.test.mjs recomputes each from the dataset): every
// figure below. Per scrape (15 s) since the deploy /pay serves 60 requests and fails 15, /quote serves 120 and fails none.
// Invented for the game: the company, the presenter, the rule's threshold of 0.1. The counter is the checkout-http one, with status
// values "200" and "500" only.
//
// The words are in content/core/levels/the-alert-that-stayed-green.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/the-alert-that-stayed-green.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

const THRESHOLD = 0.1;
const PAY_REQUESTS = 60; // per scrape since the deploy
const PAY_FAILED = 15;
const QUOTE_REQUESTS = 120;
const ALL_REQUESTS = PAY_REQUESTS + QUOTE_REQUESTS;
const SCRAPE_S = 15;
const WINDOW_SCRAPES = 300 / SCRAPE_S; // a [5m] window holds this many scrapes
const SERVICE_RATIO = (PAY_FAILED / ALL_REQUESTS).toFixed(3); // 15/180, the whole service's share
const PAY_RATIO = PAY_FAILED / PAY_REQUESTS; // 0.25

const M = 'http_server_requests_total';
const RULE =
  `sum(rate(${M}{service="checkout", status="5xx"}[5m])) / ` +
  `sum(rate(${M}{service="checkout"}[5m])) > ${THRESHOLD}`;
const REFERENCE =
  `sum by (route) (rate(${M}{service="checkout", status="500"}[5m])) / ` +
  `sum by (route) (rate(${M}{service="checkout"}[5m])) > ${THRESHOLD}`;

// The figures the copy quotes, each filled into the content's {{name}} marks with the same expression and formatting the copy used.
// The content file writes the per-route table and the label values on both steps (a step replaces the screen, so step 2 repeats them); test/the-alert-that-stayed-green.test.mjs keeps the two copies identical.
const VARS = {
  rule: RULE,
  'pay-requests': PAY_REQUESTS,
  'pay-failed': PAY_FAILED,
  'quote-requests': QUOTE_REQUESTS,
  'window-scrapes': WINDOW_SCRAPES,
  threshold: THRESHOLD,
  'all-requests': ALL_REQUESTS,
  'service-ratio': SERVICE_RATIO,
  'pay-ratio': PAY_RATIO,
};

// Step 1: why is the alert green? `why` follows "Right." or "Not quite.". Labels are close in length; the right one is the third.
// Only the right choice is listed here.
const WHY = [{ key: 'selector', right: true }];

// The level as it was, minus the words.
const SKELETON = {
  id: 'the-alert-that-stayed-green',
  no: '9.6',
  icon: '\u{1F7E2}',
  cards: [],
  lights: ['checkout'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'asg',
    steps: [
      { qid: 'asg-q-why', choice: { id: 'asg-why', choices: WHY } },
      {
        qid: 'asg-q-rule',
        query: {
          id: 'asg-rule',
          dataset: 'checkout-http',
          at: 3600,
          given: RULE,
          reference: REFERENCE,
          helps: {},
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
