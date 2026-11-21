// Level 1.1: Resources. The player sorts eight attributes into resource attributes (what the
// telemetry is about: service, pod, host, cloud region) and signal attributes (what one span
// says about its operation), says why a pod name on every span is the wrong place for it, and
// says where Dash0 gets the identity of the things it lists.
// Spec: docs/OUTLINE.md §4 Act 1.
// Spec: https://opentelemetry.io/docs/concepts/resources/ , https://opentelemetry.io/docs/specs/otel/resource/sdk/ , https://opentelemetry.io/docs/specs/otel/resource/
// Spec: https://opentelemetry.io/docs/specs/semconv/resource/k8s/#pod , https://opentelemetry.io/docs/specs/semconv/resource/cloud/ , https://opentelemetry.io/docs/specs/semconv/resource/host/ , https://opentelemetry.io/docs/specs/semconv/resource/#service
// Spec: https://opentelemetry.io/docs/specs/semconv/http/http-spans/
// Spec: https://opentelemetry.io/docs/specs/semconv/resource/k8s/ , https://opentelemetry.io/docs/platforms/kubernetes/collector/components/#kubernetes-attributes-processor
// Dash0 docs: https://www.dash0.com/docs/dash0/monitoring/resources/about-resources , https://www.dash0.com/docs/dash0/monitoring/resources/explore-resources
//
// The words are in content/core/levels/resources.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/resources.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// Step 1. Four resource attributes and four signal attributes. Label wording must not give the bucket away (test/sort-tells.test.mjs).
// The bucket labels and every item's text are in the content file.
const SORT = {
  id: 'res-sort',
  helps: { hints: true },
  buckets: [{ id: 'resource' }, { id: 'signal' }],
  items: [
    { id: 'service-name', bucket: 'resource' },
    { id: 'http-method', bucket: 'signal' },
    { id: 'pod-name', bucket: 'resource' },
    { id: 'http-route', bucket: 'signal' },
    { id: 'host-name', bucket: 'resource' },
    { id: 'status-code', bucket: 'signal' },
    { id: 'cloud-region', bucket: 'resource' },
    { id: 'url-path', bucket: 'signal' },
  ],
};

// Step 2: the nuance, an answer pool (docs/CONTENT.md section 10). `why` follows "Right." or "Not quite.". The content
// lists 14 answers and a showing draws 3 (one of the 4 right, 2 of the 10 wrong). Only the right answers are marked
// here, so a right answer added in the content file without `right: true` would be graded wrong. No 50/50 (it
// needs 4 shown), so no `keep`.
const POD = [
  { key: 'set-once', right: true },
  { key: 'all-signals', right: true },
  { key: 'producer', right: true },
  { key: 'repeats', right: true },
];

// Step 3: the Dash0 tie-in, an answer pool: 13 answers, a showing draws 3 (one of the 4 right, 2 of the 9 wrong).
const DASH0 = [
  { key: 'resource-attributes', right: true },
  { key: 'derived', right: true },
  { key: 'signal-metadata', right: true },
  { key: 'equality', right: true },
];

// The level as it was, minus the words.
const SKELETON = {
  id: 'resources',
  no: '1.1',
  icon: '\u{1F3F7}\u{FE0F}',
  cards: ['resource-not-span-attribute'],
  lights: ['recommendations'],
  scoring: { parMs: null },
  play: {
    prefix: 'res',
    steps: [
      { qid: 'res-q-sort', sort: SORT },
      { qid: 'res-q-pod', choice: { id: 'res-pod', draw: 3, choices: POD } },
      { qid: 'res-q-dash0', choice: { id: 'res-dash0', draw: 3, choices: DASH0 } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
