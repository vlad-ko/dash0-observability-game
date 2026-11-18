// Level 3.1: Instruments. The player sorts eight measurements from Kettle & Co's services into
// the instrument that fits (Counter, UpDownCounter, Gauge, Histogram), picks how to report a
// heap size you can read at any time (an asynchronous instrument), then says what a Gauge
// used for a count costs: the sum and start time a rate needs.
// Spec: docs/OUTLINE.md §4 Act 3.
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/api/#synchronous-and-asynchronous-instruments , https://opentelemetry.io/docs/specs/otel/metrics/api/#updowncounter , https://opentelemetry.io/docs/specs/otel/metrics/api/#gauge
// Spec: https://opentelemetry.io/docs/specs/otel/metrics/data-model/#sums , https://opentelemetry.io/docs/specs/otel/metrics/data-model/#gauge
//
// The words are in content/core/levels/instruments.mjs (docs/CONTENT.md); this file keeps the answers, the figures and the wiring.
import CORE from '../content/core/levels/instruments.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// Step 1. Two measurements per instrument. Label wording must not give the bucket away (test/sort-tells.test.mjs).
const SORT = {
  id: 'instr-sort',
  helps: { hints: false },
  buckets: [{ id: 'counter' }, { id: 'up-down-counter' }, { id: 'gauge' }, { id: 'histogram' }],
  items: [
    { id: 'orders-placed', bucket: 'counter' },
    { id: 'warehouse-temp', bucket: 'gauge' },
    { id: 'queue-length', bucket: 'up-down-counter' },
    { id: 'checkout-duration', bucket: 'histogram' },
    { id: 'payment-declines', bucket: 'counter' },
    { id: 'cache-hit-ratio', bucket: 'gauge' },
    { id: 'active-requests', bucket: 'up-down-counter' },
    { id: 'response-bytes', bucket: 'histogram' },
  ],
};

// Steps 2 and 3: `why` follows "Right." or "Not quite."; only the right choice is listed here.
const SKELETON = {
  id: 'instruments',
  no: '3.1',
  icon: '\u{1F4CF}',
  cards: ['gauge-not-count'],
  lights: ['kafka'],
  scoring: { parMs: null },
  play: {
    prefix: 'instr',
    steps: [
      { qid: 'instr-q-sort', sort: SORT },
      { qid: 'instr-q-async', choice: { id: 'instr-async', choices: [{ key: 'async-updown', right: true }] } },
      { qid: 'instr-q-gauge', choice: { id: 'instr-gauge', choices: [{ key: 'sampled-not-sum', right: true }] } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: {} });
}

export default withText(CORE);
