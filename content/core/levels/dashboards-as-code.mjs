// Text of levels/dashboards-as-code.mjs (docs/CONTENT.md).
// Each spot line is one added key, shown with its path from the top of the file: the rule is in the header of levels/dashboards-as-code.mjs.
export default {
  "id": "dashboards-as-code",
  "name": "Dashboards as code",
  "sub": "Review it before it is live",
  "rewardTitle": "Dashboard reviewer",
  "play": {
    "finish": "A dashboard in git is reviewed like code: a reviewer reads what the pull request adds, before anything is live. Dash0 dashboards use the Perses format, so the same YAML is applied by the operator in a cluster or by Terraform without one.",
    "steps": [
      {
        "intro": "Kettle &amp; Co keeps its dashboards in git and applies them with the Dash0 operator for Kubernetes: a <code>PersesDashboard</code> resource in a namespace that has a Dash0 monitoring resource becomes a dashboard in Dash0. The cluster has monitoring resources in <code>checkout</code> and <code>payments</code>, and none in <code>tools</code>. A pull request adds <code>dashboards/checkout-overview.yaml</code>, a new file in the [[Perses]] format Dash0 dashboards use. Below are the lines that matter for this review, one key per line with its path from the top of the file (the file also gives each [[panel]] its query and the layout its kind). In this game's reading, a layout is 24 columns wide. A layout item names its panel in <code>$ref</code>; reading the fields as cells, <code>x</code> and <code>width</code> give the columns it covers, from <code>x</code> to <code>x + width</code>, and <code>y</code> and <code>height</code> the rows.",
        "question": "Which lines would you stop in review?",
        "spot": {
          "id": "dac-spot",
          "lines": [
            {
              "id": "header",
              "text": "+ apiVersion: perses.dev/v1alpha1"
            },
            {
              "id": "kind",
              "text": "+ kind: PersesDashboard"
            },
            {
              "id": "metadata",
              "text": "+ metadata: {name: checkout-overview, namespace: tools}"
            },
            {
              "id": "display",
              "text": "+ spec.display.name: Checkout overview"
            },
            {
              "id": "item-rate",
              "text": "+ spec.layouts[0].spec.items[0]: {x: 0, \"y\": 0, width: 12, height: 6, content: {$ref: \"#/spec/panels/request_rate\"}}"
            },
            {
              "id": "item-errors",
              "text": "+ spec.layouts[0].spec.items[1]: {x: 18, \"y\": 0, width: 12, height: 6, content: {$ref: \"#/spec/panels/error_ratio\"}}"
            },
            {
              "id": "item-corner",
              "text": "+ spec.layouts[0].spec.items[2]: {x: 12, \"y\": 6, width: 12, height: 6, content: {$ref: \"#/spec/panels/request_count\"}}"
            },
            {
              "id": "item-latency",
              "text": "+ spec.layouts[0].spec.items[3]: {x: 0, \"y\": 6, width: 12, height: 6, content: {$ref: \"#/spec/panels/latency_p99\"}}"
            },
            {
              "id": "panel-rate",
              "text": "+ spec.panels.request_rate: {kind: Panel, spec: {display: {name: Request rate}, plugin: {kind: TimeSeriesChart}}}"
            },
            {
              "id": "panel-errors",
              "text": "+ spec.panels.error_ratio: {kind: Panel, spec: {display: {name: Error ratio}, plugin: {kind: TimeSeriesChart}}}"
            },
            {
              "id": "query-errors",
              "text": "+ spec.panels.error_ratio.spec.plugin.spec.queries[0].spec.plugin.spec.query: sum(rate(http_server_requests_total{service=\"checkout\", code=~\"5..\"}[5m])) / sum(rate(http_server_requests_total{service=\"checkout\"}[5m]))"
            },
            {
              "id": "panel-count",
              "text": "+ spec.panels.request_count: {kind: Panel, spec: {display: {name: Request count}, plugin: {kind: TimeSeriesChart}}}"
            }
          ],
          "whyNot": {
            "header": "The line <code>apiVersion: perses.dev/v1alpha1</code> is fine: it names the Perses API the resource belongs to, as in Dash0's example of a dashboard the operator manages.",
            "kind": "The line <code>kind: PersesDashboard</code> is fine: a dashboard the operator manages is a <code>PersesDashboard</code>, the kind in Dash0's example.",
            "display": "The line <code>spec.display.name: Checkout overview</code> is fine: it sets the name the dashboard shows in Dash0, as in Dash0's example, and any title works.",
            "item-rate": "The line for <code>items[0]</code> is fine: its <code>x: 0</code> is the left edge that <code>items[3]</code> shares, one band of the grid further down, and read as cells it covers columns 0 to 12 of the 24, well inside the grid.",
            "item-corner": "The line for <code>items[2]</code> is fine: read as cells it covers columns 12 to 24 of the second band (<code>y</code> 6 to 12), which ends exactly at the edge, and it names <code>request_count</code>, a panel the file defines. That its <code>x: 12</code> is not shared with another item is not a fault.",
            "panel-errors": "The line that defines <code>error_ratio</code> is fine, and the item that names it points at the right key. If something is wrong near it, it is where that item sits on the grid, not the panel it shows.",
            "panel-rate": "The line that defines <code>request_rate</code> is fine: the panel exists, its query is in the part of the file not shown, and the item that names it points at the right key.",
            "panel-count": "The line that defines <code>request_count</code> is fine: the panel exists, its query is in the part of the file not shown, and the item that names it points at the right key.",
            "query-errors": "The query line is fine: it is the share of requests that fail, the rate of 5xx requests divided by the rate of all requests over the same 5 minutes, a ratio between 0 and 1."
          },
          "explain": "Three lines to stop. <code>namespace: tools</code>: the operator watches for Perses dashboard resources in namespaces that have a [[Dash0 monitoring resource]], and only <code>checkout</code> and <code>payments</code> do, so a resource applied to <code>tools</code> would never reach Dash0. Reading the fields as cells (Dash0's example shows only their names), the second item starts at <code>x: 18</code> and is 12 wide, so it would run to column 30 on a grid of 24: it does not fit. At <code>x: 12</code> it would end at the edge, as the third item does one band down. The fourth item names <code>latency_p99</code>, and the file defines three panels, <code>request_rate</code>, <code>error_ratio</code> and <code>request_count</code>, so that item points at nothing: the panel was left out of the pull request. A reviewer can read all three in the diff before anything is live, which is the point of keeping dashboards in git. This step grades the lines you select, not a parsed file: nothing here checks the YAML against the Perses schema."
        }
      },
      {
        "intro": "The payments team runs on a managed container service with no Kubernetes cluster. Its cloud resources are described in Terraform and applied by the pipeline when a pull request merges. It wants its dashboards to go through the same review, and a dashboard exported from Dash0 is the same kind of YAML you just read.",
        "question": "How should payments' dashboards reach Dash0?",
        "choice": {
          "id": "dac-deploy",
          "choices": [
            {
              "key": "terraform",
              "label": "Add a <code>dash0_dashboard</code> entry per dashboard, with its <code>PersesDashboard</code> YAML inline and a dataset",
              "why": "Dash0's [[Terraform]] provider has a <code>dash0_dashboard</code> resource that takes a <code>dataset</code> and the dashboard as Perses YAML in <code>dashboard_yaml</code>. The file reviewed in the pull request is then what the pipeline applies, next to the rest of payments' infrastructure, with no cluster involved. Dash0 dashboards use the Perses format, so the YAML is the same kind of document the operator takes (the Kubernetes resource wraps the configuration in <code>spec.config</code>), and a dashboard downloaded as YAML from More actions gives you a starting file."
            },
            {
              "key": "provider",
              "label": "Declare each dashboard as a Dash0 provider resource and let a deploy run it",
              "why": "The provider, published as <code>dash0hq/dash0</code>, manages dashboards in your Terraform next to your other cloud resources, with no cluster involved. Dash0 describes managing dashboards as code as version control, automated deployment pipelines and code review for dashboard changes, and a merged pull request that the pipeline then applies gives payments all three."
            },
            {
              "key": "agent0-pr",
              "label": "Ask Agent0 to write each dashboard as code and raise the pull request before anything is applied",
              "why": "Dash0's documentation says Agent0 can generate infrastructure as code for a dashboard and raise it as a pull request to your repository: after it builds a dashboard you ask for the Terraform configuration. The reviewers then read code, and the pipeline applies it through the same Terraform resource, with no cluster involved."
            },
            {
              "key": "operator",
              "label": "Run the Dash0 operator with a <code>PersesDashboard</code> resource for each dashboard",
              "why": "The operator watches for Perses dashboard resources in namespaces that have a Dash0 monitoring resource, so it needs a Kubernetes cluster to run in. Payments has none, and building one just for dashboards is a much larger change than the one asked for."
            },
            {
              "key": "json",
              "label": "Carry on editing with Edit as JSON in the dashboard, and paste the result into git once it works",
              "why": "Edit as JSON applies changes when you save, so the dashboard is already live before anyone reads the change, and git only records it afterwards. Dash0 describes the editor as convenient for quick edits and experiments, which is what it is for."
            },
            {
              "key": "export",
              "label": "Download each dashboard as YAML every sprint and store the files as a record",
              "why": "Exporting gives a snapshot of what is live, for sharing or version control. Changes still happen in Dash0 first and the file records them later, so nothing is reviewed before it goes live."
            },
            {
              "key": "cli-first",
              "label": "Use <code>dash0 dashboards create</code> on the YAML from a laptop before the pull request and look at the result live",
              "why": "The Dash0 CLI does create a dashboard from a YAML or JSON file, but run before the review it makes the dashboard live first, and a laptop is not the pipeline that applies the rest of payments' infrastructure. The review would be of something already deployed."
            },
            {
              "key": "perses-terraform",
              "label": "Express each dashboard as a <code>PersesDashboard</code> YAML and let the Terraform pipeline deploy it",
              "why": "A <code>PersesDashboard</code> is a Kubernetes custom resource, and the operator is what turns one into a Dash0 dashboard, by watching the namespaces of a cluster that have a Dash0 monitoring resource. Applying it from Terraform still needs that cluster and operator, and payments has neither. The Terraform resource that fits is <code>dash0_dashboard</code>, which takes the YAML directly."
            },
            {
              "key": "grafana-import",
              "label": "Write the dashboards in the Grafana format and have each deploy import them to a dataset",
              "why": "Dash0's import is described as steps in the interface: Edit as JSON, browse to a Grafana file, review the converted dashboard, click Apply to update an unsaved preview, then save. It is for bringing existing Grafana or Perses dashboards in, and it converts Prometheus queries only. The page does not describe it as something a pipeline runs, so there is nothing for the merge to apply."
            },
            {
              "key": "agent0-live",
              "label": "Build each dashboard with Agent0 in Dash0 and let the team review it before sharing the link",
              "why": "A dashboard built with Agent0 is created in Dash0, so it is live while it is reviewed, and nothing lands in git. Dash0's documentation says that to keep a dashboard in code you ask Agent0 for the Terraform configuration or Kubernetes manifest after it is built."
            },
            {
              "key": "copy-dataset",
              "label": "Make the dashboard in a test dataset, then copy it across to production in the editor",
              "why": "Dash0 lists copying dashboards across organisations and datasets among the jobs the JSON editor suits. It is a copy by hand from one live dashboard to another, with no file in git and no pull request to review, so it does not give payments the review it asked for."
            },
            {
              "key": "screenshot",
              "label": "Set up the dashboard in the Dash0 interface and attach a screenshot to the pull request",
              "why": "A screenshot shows how a dashboard looks, not what it is: a reviewer cannot read its queries or its layout from a picture. The dashboard is also built and live in Dash0 before the pull request exists, so the review comes after it."
            }
          ]
        }
      }
    ]
  }
};
