// Level 5.2: Order matters. The player spots the pipelines whose processor list is misordered
// (memory_limiter not first, batch before a processor that drops data or reads the request
// context), says why memory_limiter goes first, and where batch goes, with the note that the
// processor docs now prefer an exporter's own batching where it has one.
// Spec: docs/OUTLINE.md §4 Act 5.
// Spec: https://opentelemetry.io/docs/collector/configuration/#processors , https://opentelemetry.io/docs/collector/components/processor/
// Docs (GitHub READMEs, not an allowed Spec host): https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/README.md#recommended-processors , https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/memorylimiterprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/batchprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/k8sattributesprocessor/README.md , https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/exporterhelper/README.md
//
// What is taught is the part of the recommended order that is stated without a condition:
// memory_limiter first; batch after the processors that drop or change data and after those that
// read the request context (k8s_attributes); the order between those middle processors is not
// graded, so no line depends on it. A pipeline without batch is fine.
//
// The two Choice steps are answer pools (#390, docs/CONTENT.md section 10): the content lists 9 answers each (3 right, 6 wrong) and a showing draws 3.
// Their extra answers rest on pages read 2026-11-21 (Collector v0.164.0): the memory limiter README
// (https://github.com/open-telemetry/opentelemetry-collector/blob/v0.164.0/processor/memorylimiterprocessor/README.md: periodic checks, a refusal is a
// non-permanent error to the preceding component, receivers retry and may apply backpressure, forced GC only above the hard limit, first processor in
// a pipeline), the batch README (.../processor/batchprocessor/README.md: after memory_limiter and sampling, send_batch_size is a trigger and
// send_batch_max_size the limit, the timeout) and the processors README (.../processor/README.md: the recommended order, batching clears the request
// context, prefer the exporter's batching).
//
// The words are in content/core/levels/order-matters.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/order-matters.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 1. Eight pipelines, one processor list each. The debug view prints `<pipeline>: processors: [...]`.
// The lines and the `whyNot` notes are in the content file.
const SPOT = {
  id: 'order-spot',
  target: 'config',
  helps: { hints: false },
  faults: ['metrics', 'traces-checkout', 'logs-audit', 'logs-noisy'],
};

// The level as it was, minus the words. Only the answers are marked: every choice's text is in the content file.
const SKELETON = {
  id: 'order-matters',
  no: '5.2',
  icon: '\u{1F522}',
  cards: ['memory-limiter-first'],
  lights: ['collector'],
  scoring: { parMs: null },
  play: {
    prefix: 'order',
    steps: [
      {
        qid: 'order-q-spot',
        spot: SPOT,
      },
      {
        qid: 'order-q-why',
        choice: {
          id: 'order-why',
          draw: 3,
          choices: [
            { key: 'refuse-early', right: true },
            { key: 'backpressure', right: true },
            { key: 'only-sees', right: true },
            { key: 'cleans-data' },
            { key: 'any-position' },
            { key: 'sizes-batches' },
            { key: 'gc-each' },
            { key: 'drops-oldest' },
            { key: 'scales-up' },
          ],
        },
      },
      {
        qid: 'order-q-batch',
        choice: {
          id: 'order-batch',
          draw: 3,
          choices: [
            { key: 'late', right: true },
            { key: 'after-filters', right: true },
            { key: 'last-in-list', right: true },
            { key: 'early' },
            { key: 'removed' },
            { key: 'ahead-of-limiter' },
            { key: 'exporter-cannot' },
            { key: 'send-size-max' },
            { key: 'shared-instance' },
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
