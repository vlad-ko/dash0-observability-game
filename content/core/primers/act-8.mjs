// Act 8 primer (#389). PLACEHOLDER: drafted from the official OpenTelemetry semantic conventions pages and
// Dash0 docs pages, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-8",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public OpenTelemetry and Dash0 docs pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Operating at scale: as code",
  "overview": [
    {
      "type": "paragraph",
      "text": "This act covers dashboards kept as code, names that change between semantic convention versions, moving from another tool, telemetry from the browser, and AI assistants that query your data."
    },
    {
      "type": "list",
      "items": [
        "Dash0 dashboards can be versioned and managed as code, like source files, in the Perses format (an open dashboard format).",
        "Semantic conventions give common names to operations and data, and the HTTP conventions came with a migration plan.",
        "The Websites Explorer, a Dash0 view, shows frontend health.",
        "AI assistants can query Dash0 through the Dash0 MCP Server (MCP is the Model Context Protocol, a standard for AI tools to call data sources)."
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
          "text": "Dash0 dashboards are assets that can be versioned and managed as code, the way teams manage servers and networks as infrastructure as code. That enables version control, automated deployment pipelines, consistent configuration across environments, and code review for dashboard changes."
        },
        {
          "type": "paragraph",
          "text": "Dash0 dashboards use the Perses dashboard format, an open format that describes a dashboard in a file."
        },
        {
          "type": "list",
          "items": [
            "Panels: each panel on a dashboard is an independent visualisation, with its own queries, chart type and styling.",
            "Variables: you define a variable once and reuse it across every panel. When you change its selection, every panel that uses it updates."
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
          "kind": "docs",
          "label": "Dash0 docs: Add panels",
          "url": "https://www.dash0.com/docs/dash0/dashboards/add-panels",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: Add variables",
          "url": "https://www.dash0.com/docs/dash0/dashboards/add-variables",
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
          "text": "OpenTelemetry semantic conventions specify common names for different kinds of operations and data. Following them gives you a naming scheme that can be standardised across a codebase, libraries and platforms."
        },
        {
          "type": "paragraph",
          "text": "The HTTP semantic conventions now have a stable release. Stable means released, with no breaking changes. The stable release changed many attribute names. So existing HTTP instrumentations published by OpenTelemetry are required to implement a migration plan."
        },
        {
          "type": "paragraph",
          "text": "Under that plan, an instrumentation updated to the stable conventions should add an opt-in setting (one you turn on to get the new names), the environment variable OTEL_SEMCONV_STABILITY_OPT_IN, in its current major version. By default, it keeps its existing behaviour."
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
          "text": "Dash0 can import dashboards from Dash0 itself (Perses), from Grafana (another dashboard tool), and from external Perses dashboards."
        },
        {
          "type": "paragraph",
          "text": "These Grafana panel types are supported for conversion: time series, stat, gauge, pie, table, and text or Markdown. Specialised panels like heatmaps, and custom panels, may not convert properly. In those cases, the migrator (the Dash0 tool that converts Grafana dashboards) shows a placeholder panel in the dashboard."
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
          "text": "In Dash0, the Websites Explorer is a built-in view of your frontend health. It shows traffic volume: sessions (one visit to your site by one browser), page views, users, bounce rate, backend requests and JavaScript errors. A bounce is a session that views only one page, so the bounce rate is the share of sessions that bounce."
        },
        {
          "type": "paragraph",
          "text": "Web Vitals are a set of performance metrics defined by Google that quantify the real-user experience of a webpage. Dash0 shows their p75 scores (the 75th percentile: three quarters of the measurements are at or below it)."
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
          "text": "A session's events include page views, HTTP requests, Web Vitals, errors, rage clicks (repeated clicks on something that does not respond) and custom events."
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
          "text": "The Dash0 MCP Server (MCP is the Model Context Protocol, a standard for AI tools to call data sources) lets AI assistants such as Claude, Claude Code and Cursor query your Dash0 observability data. The assistant calls MCP tools (named actions it can take) to read services, metrics, logs, traces, synthetic checks, SLOs and dashboards. These tools only read data: they never create, change or delete anything in Dash0."
        },
        {
          "type": "paragraph",
          "text": "The one exception is the run-task tool (runTask), which hands an open-ended question to Agent0, Dash0's AI agent. Each task creates an Agent0 thread (one conversation with Agent0) in your organisation, the only thing the server creates."
        },
        {
          "type": "paragraph",
          "text": "Agent0 is Dash0's own AI agent, not a Collector agent. It investigates your telemetry, reads connected source code, and proposes dashboards, check rules and code fixes. It runs inside a sandbox (an isolated environment)."
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
