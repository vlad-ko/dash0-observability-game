// Act 8 primer (#389). PLACEHOLDER: drafted from the official OpenTelemetry semantic conventions pages, the
// Perses dashboard page and Dash0 docs pages, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-8",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry, Perses and Dash0 docs pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Operating at scale: as code",
  "overview": [
    {
      "type": "paragraph",
      "text": "This act covers dashboards kept as code, names that change between convention versions, moving from another tool, telemetry from the browser, and AI assistants that query your data."
    },
    {
      "type": "list",
      "items": [
        "Dash0 dashboards can be versioned and managed as infrastructure as code, in the Perses format.",
        "Semantic conventions give common names to operations and data, and the HTTP conventions came with a migration plan.",
        "Dash0 website monitoring shows frontend health, and AI assistants can query Dash0 through its MCP Server."
      ]
    },
    {
      "type": "callout",
      "tone": "tip",
      "text": "Already know this? Pick \"I am already familiar with the topic\" to skip the reading."
    }
  ],
  "chapters": [
    {
      "id": "dashboards-as-code",
      "title": "Dashboards as code",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Dash0 dashboards are assets that can be versioned and managed as infrastructure as code. That enables version control, automated deployment pipelines, consistent configuration across environments, and code review for dashboard changes."
        },
        {
          "type": "paragraph",
          "text": "Dash0 dashboards use the Perses dashboard format. Perses dashboards are an open, standardized specification that fosters interoperability across observability tools."
        },
        {
          "type": "list",
          "items": [
            "Panels: a dashboard's visual elements consist of a set of panels.",
            "Variables: let users interactively change the query scopes.",
            "Datasources: a dashboard relies on one or more datasources to fetch its data."
          ]
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: Manage dashboards as code",
          "url": "https://www.dash0.com/docs/dash0/dashboards/manage-dashboards-as-code",
          "audience": "public"
        },
        {
          "kind": "article",
          "label": "Perses: Dashboard",
          "url": "https://perses.dev/perses/docs/concepts/dashboard/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "semantic-convention-versions",
      "title": "Semantic convention versions",
      "blocks": [
        {
          "type": "paragraph",
          "text": "OpenTelemetry semantic conventions specify common names for different kinds of operations and data. Following them gives you a naming scheme that can be standardized across a codebase, libraries and platforms."
        },
        {
          "type": "paragraph",
          "text": "Moving to the stable HTTP semantic conventions brought a significant number of changes to an extensive user base. So existing HTTP instrumentations published by OpenTelemetry are required to implement a migration plan."
        },
        {
          "type": "paragraph",
          "text": "Under that plan, an instrumentation updated to the stable conventions adds an opt-in setting in its current major version. By default, it keeps its existing behaviour."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Semantic conventions",
          "url": "https://opentelemetry.io/docs/concepts/semantic-conventions/",
          "audience": "public"
        },
        {
          "kind": "otel",
          "label": "OpenTelemetry: HTTP semantic convention stability migration",
          "url": "https://opentelemetry.io/docs/specs/semconv/non-normative/http-migration/",
          "audience": "public"
        }
      ]
    },
    {
      "id": "migrating-dashboards",
      "title": "Bringing dashboards in",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Dash0 can import dashboards from Dash0 itself (Perses), from Grafana, and from external Perses dashboards."
        },
        {
          "type": "paragraph",
          "text": "These Grafana panel types are supported for conversion: time series, stat, gauge, pie, table, and text or Markdown. Specialized panels like heatmaps, and custom panels, may not convert properly. In those cases, the migrator shows a placeholder in the dashboard."
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: Import dashboards",
          "url": "https://www.dash0.com/docs/dash0/dashboards/import-dashboards",
          "audience": "public"
        }
      ]
    },
    {
      "id": "browser-telemetry",
      "title": "Telemetry from the browser",
      "blocks": [
        {
          "type": "paragraph",
          "text": "In Dash0, the Websites Explorer is a curated, opinionated view of your frontend health. It shows traffic volume: sessions, page views, users, bounce rate, backend requests and JavaScript errors. A session's events include page views, HTTP requests, web vitals, errors, rage clicks and custom events."
        },
        {
          "type": "paragraph",
          "text": "Web Vitals are a set of performance metrics defined by Google that quantify the real-user experience of a webpage. Dash0 shows their p75 scores."
        },
        {
          "type": "list",
          "items": [
            "Largest Contentful Paint (LCP): how long the largest visible element, an image or a text block, takes to fully render.",
            "Interaction to Next Paint (INP): the latency of all user interactions, such as clicks, taps and keyboard input, over the whole page lifecycle.",
            "Cumulative Layout Shift (CLS): the total amount of unexpected layout movement during the page lifecycle."
          ]
        },
        {
          "type": "paragraph",
          "text": "A session's detail panel shows frontend-to-backend trace correlation, and its timeline links directly to backend traces."
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: Website monitoring",
          "url": "https://www.dash0.com/docs/dash0/monitoring/websites/website-monitoring",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: Understand Web Vitals",
          "url": "https://www.dash0.com/docs/dash0/monitoring/websites/understand-web-vitals",
          "audience": "public"
        }
      ]
    },
    {
      "id": "ai-assistants",
      "title": "AI assistants",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The Dash0 MCP Server lets AI assistants such as Claude, Claude Code and Cursor query your Dash0 observability data. The assistant calls Dash0 tools to read services, metrics, logs, traces, synthetic checks, SLOs and dashboards. These tools only read data: they never create, change or delete anything in Dash0."
        },
        {
          "type": "paragraph",
          "text": "Agent0 is Dash0's own agent. It investigates your telemetry, reads connected source code, and proposes dashboards, check rules and code fixes. It runs inside a sandboxed execution environment."
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: MCP Server",
          "url": "https://www.dash0.com/docs/dash0/ai/mcp",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: Agent0 overview",
          "url": "https://www.dash0.com/docs/dash0/ai/agent0/overview",
          "audience": "public"
        }
      ]
    }
  ]
};
