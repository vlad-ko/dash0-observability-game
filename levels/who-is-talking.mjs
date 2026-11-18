// Act 1 boss: Who is talking? An alert fires for a service called unknown_service:node, which no runbook
// names. The player reads the alert's resource (the SDK fell back to unknown_service plus the executable
// name, while the Collector's k8s attributes still name the deployment that owns the pod), then the
// deploy that removed OTEL_SERVICE_NAME, then the running pod's env to confirm. Three views hold the chain
// (clues); two are red herrings; the rest are neutral. Scored. A plain-data Scenario for the incident
// engine, played through one declarative `incident` step (lib/widgets/incident.mjs, docs/M1-DESIGN.md §4.3,
// docs/DECLARATIVE-LEVELS.md §2). The scenario is designed for this game: docs/OUTLINE.md §4 Act 1 defines
// no boss (decided on #16); it exercises 1.1 (resource attributes identify the producer), 1.2 (the fallback
// and OTEL_SERVICE_NAME) and 1.3 (the k8s attributes come from the Collector, not the SDK).
// Spec: docs/OUTLINE.md §4 Act 1.
// Spec: https://opentelemetry.io/docs/specs/semconv/registry/attributes/service/ , https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/
// Spec: https://opentelemetry.io/docs/concepts/resources/ , https://opentelemetry.io/docs/specs/semconv/resource/k8s/#pod
// Dash0 docs: https://www.dash0.com/docs/dash0/monitoring/resources/about-resources , https://www.dash0.com/docs/dash0/monitoring/resources/explore-resources
//
// Facts used, each from the pages above: service.name, when not specified, falls back to "unknown_service:"
// plus the process executable name, the value of the process.executable.name resource attribute, for example
// unknown_service:bash (semantic conventions, service attributes); OTEL_SERVICE_NAME sets the service.name
// resource attribute and, if service.name is also in OTEL_RESOURCE_ATTRIBUTES, OTEL_SERVICE_NAME takes
// precedence (SDK environment variables). Dash0: each signal carries resource metadata, a resource is made
// of resource attributes such as k8s.pod.uid, k8s.namespace.name and service.name; the Resources Explorer
// lists Kubernetes pods and deployments and filters by resource attributes. Nothing below claims how Dash0
// names or groups a service that has no service.name.
// The names, versions, times and the pod are invented for this game.
//
// The words are in content/core/levels/who-is-talking.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/who-is-talking.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

// The incident: the ids, the cost and kind of each view, and which hypothesis is right. Every label, view and explanation is in the content file.
const SCENARIO = {
  id: 'who-is-talking',
  budget: { startPct: 100, burnPctPerMin: 5 },
  views: [
    { id: 'alert-resource', costMin: 4, kind: 'clue' },
    { id: 'deploy-history', costMin: 4, kind: 'clue' },
    { id: 'pod-env', costMin: 4, kind: 'clue' },
    { id: 'collector-restart', costMin: 3, kind: 'neutral' },
    { id: 'message-volume', costMin: 2, kind: 'neutral' },
    { id: 'pod-health', costMin: 2, kind: 'neutral' },
    { id: 'catalog-rename', costMin: 4, kind: 'herring' },
    { id: 'k8s-warnings', costMin: 3, kind: 'herring' },
  ],
  hypotheses: [
    { id: 'name-dropped', right: true },
    { id: 'new-service', right: false },
    { id: 'detector-broken', right: false },
    { id: 'collector-renamed', right: false },
  ],
  answerAfterViews: 2,
};

// Step 2: what fixes it. `why` follows "Right." or "Not quite.".
const FIX = [{ key: 'env-var', right: true }];

// The level as it was, minus the words.
const SKELETON = {
  id: 'who-is-talking',
  no: null,
  icon: '\u{1F575}',
  cards: [],
  lights: ['notifications'],
  scored: true,
  scoring: { parMs: null },
  play: {
    prefix: 'wit',
    steps: [
      { incident: SCENARIO },
      { qid: 'wit-q-fix', choice: { id: 'wit-fix', choices: FIX } },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
