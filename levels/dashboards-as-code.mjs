// Level 8.1: Dashboards as code. Act 8 "Operating at scale". Kettle & Co keeps its dashboards in git and applies them with the Dash0
// operator for Kubernetes. The player reviews the added lines of a pull request that creates one dashboard file in the Perses format
// Dash0 uses and spots the three lines a reviewer should stop (Spot it): a namespace the operator does not watch, a grid item that
// runs past the grid's width, and a layout item that names a panel the file never defines. Then one Choice: how a team with no Kubernetes
// cluster, whose infrastructure is already in Terraform, gets reviewed dashboards into Dash0. Hints are off on the Spot it step (the
// default ladder: hints in early acts only). Nothing is parsed or applied.
// Spec: https://www.dash0.com/docs/dash0/dashboards/manage-dashboards-as-code , https://www.dash0.com/docs/dash0/dashboards/export-dashboards , https://perses.dev/perses/docs/api/dashboard/ , https://perses.dev/perses/docs/concepts/dashboard/
// Dash0 docs: https://www.dash0.com/docs/dash0/dashboards/manage-dashboards-as-code
//
// Facts used (each read on the pages above, 2026-11-07). Manage Dashboards as Code: Dash0 dashboards use the Perses dashboard format;
// they can be versioned and managed as infrastructure as code, which enables version control, automated deployment pipelines and code
// review for dashboard changes. With the Dash0 Operator for Kubernetes a dashboard is a Perses `PersesDashboard` custom resource
// (`apiVersion: perses.dev/v1alpha1`, `metadata.name` and `metadata.namespace`, and under `spec`: `display.name`,
// `layouts` of `kind: Grid` whose `spec.items` have `x`, `y`, `width`, `height` and
// `content.$ref: "#/spec/panels/<name>"`, and `panels` of `kind: Panel` with a `TimeSeriesChart` plugin whose
// `PrometheusTimeSeriesQuery` holds a `query`); the operator watches for Perses dashboard resources in namespaces with a Dash0
// monitoring resource deployed, and creates, updates or removes the Dash0 dashboard when the resource is created, modified or deleted.
// The Dash0 Terraform provider (`dash0hq/dash0`) has a `dash0_dashboard` resource with a `dataset` and the Perses YAML in
// `dashboard_yaml`, which holds the same document (`apiVersion`, `kind`, `metadata`, `spec`). The Dash0 CLI creates a dashboard from a
// YAML or JSON file. "Edit as JSON" applies changes immediately when saved and is described as convenient for quick edits and
// prototyping. Export Dashboards: the Source tab downloads a dashboard as Perses YAML, for sharing, version control or migration.
//
// Perses docs (v0.55, read 2026-11-08; the URLs redirect to perses.dev/docs/perses/latest/). API, Dashboard (perses.dev/perses/docs/api/dashboard/): a dashboard spec has the keys `display`,
// `datasources`, `variables`, `panels` and `layouts`, all marked Optional; `panels` is a map whose key is the reference of the panel; `layouts` is a list
// and "in Perses the definition of a panel is uncorrelated from the definition of where to position it"; a layout of `kind: Grid` has
// `spec.items`, each with `x`, `y`, `width`, `height` (integers) and `content` holding a `$ref` to a panel, as in the page's example
// `"#/spec/panels/statRAM"`. Concepts, Dashboard (perses.dev/perses/docs/concepts/dashboard/): a dashboard's visual elements are a
// set of panels, panels are plugged to datasources through queries written in the datasource's query language, and the format is an
// open, standardized specification meant as a foundation for managing dashboards as code.
//
// Stated as reasoning, with no source (neither Perses page says it): that a layout item covers the cells from x to x + width and from
// y to y + height (read from the field names), so an item whose x + width is more than the grid's width does not fit; that the Perses
// pages give no grid width, so the width of 24 columns is the game's own; that an item whose `$ref` names no panel of the file has
// nothing to draw (the pages say `$ref` points at a panel, not what happens when it points at none); that the grid items and panels
// of this board are the game's own; and that a team without a cluster has nowhere to run the operator.
//
// Invented for the game: the company, the file `dashboards/checkout-overview.yaml`, the namespaces `checkout`, `payments` and `tools`,
// the panel names, the queries, the grid sizes and the layout's width of 24 columns. Each line of the board is one added key, shown with its path from the top of the file (a key whose value is a mapping shows the mapping).
//
// The words are in content/core/levels/dashboards-as-code.mjs (docs/CONTENT.md); this file keeps the answers and the wiring.
import CORE from '../content/core/levels/dashboards-as-code.mjs';
import { bindLevel } from '../lib/content/bind.mjs';

// The figures the copy quotes. This level's copy has none that a grader computes over, so there are no fill-ins.
const VARS = {};

const SKELETON = {
  id: 'dashboards-as-code',
  no: '8.1',
  icon: '\u{1F4CA}',
  cards: [],
  lights: ['checkout'],
  scoring: { parMs: null },
  play: {
    prefix: 'dac',
    steps: [
      {
        qid: 'dac-q-spot',
        spot: {
          id: 'dac-spot',
          target: 'config',
          helps: { hints: false },
          faults: ['metadata', 'item-errors', 'item-latency'],
        },
      },
      {
        qid: 'dac-q-deploy',
        // Only the answer is marked; every choice's text is in the content file.
        choice: { id: 'dac-deploy', choices: [{ key: 'terraform', right: true }] },
      },
    ],
  },
};

/** The level with `text` (a content file's object) joined to the logic; one content file per edition (docs/CONTENT.md). */
export function withText(text) {
  return bindLevel(text, SKELETON, { vars: VARS });
}

export default withText(CORE);
