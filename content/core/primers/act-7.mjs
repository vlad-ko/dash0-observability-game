// Act 7 primer (#389). PLACEHOLDER: drafted from the official Prometheus alerting rules page, the
// OpenTelemetry observability primer and Dash0 docs pages, pending the Dash0 team's own words. Format and rules: docs/PRIMERS.md.
export default {
  "act": "act-7",
  "placeholder": true,
  "placeholderNote": "PLACEHOLDER: drafted from public Prometheus, OpenTelemetry and Dash0 docs pages; the Dash0 team replaces it with its own words, then sets placeholder to false and removes this note.",
  "title": "Alerting and SLOs: wake me only when it matters",
  "overview": [
    {
      "type": "paragraph",
      "text": "This act is about writing alert conditions, putting a number on reliability, and checking a service the way its users reach it."
    },
    {
      "type": "list",
      "items": [
        "Prometheus alerting rules and Dash0 check rules define alert conditions in PromQL.",
        "A Service Level Objective turns \"is this service reliable enough\" into a number.",
        "Synthetic checks send requests to your endpoints at regular intervals."
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
      "id": "alerting-rules",
      "title": "Alerting rules",
      "blocks": [
        {
          "type": "paragraph",
          "text": "In Prometheus, alerting rules let you define alert conditions based on PromQL expressions and send notifications about firing alerts to an external service."
        },
        {
          "type": "list",
          "items": [
            "The labels clause attaches a set of additional labels to the alert.",
            "The annotations clause stores longer additional information, such as alert descriptions or runbook links."
          ]
        },
        {
          "type": "paragraph",
          "text": "Another layer is needed to add summarization, notification rate limiting, silencing and alert dependencies on top of the rules."
        },
        {
          "type": "paragraph",
          "text": "In Dash0, check rules continuously evaluate PromQL expressions against your telemetry data and trigger alerts when values cross defined thresholds."
        }
      ],
      "sources": [
        {
          "kind": "article",
          "label": "Prometheus: Alerting rules",
          "url": "https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: Create check rules",
          "url": "https://www.dash0.com/docs/dash0/monitoring/alerting/create-check-rules",
          "audience": "public"
        }
      ]
    },
    {
      "id": "slis-and-slos",
      "title": "SLIs and SLOs",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Reliability answers the question: is the service doing what users expect it to be doing? A Service Level Indicator (SLI) represents a measurement of a service's behaviour. A Service Level Objective (SLO) is how reliability is communicated to an organization or to other teams."
        },
        {
          "type": "paragraph",
          "text": "In Dash0, an SLO is built on the same evaluation engine as a check rule, but it answers a different question. It tracks an error budget over a time window and tells you how fast that budget is being consumed."
        },
        {
          "type": "paragraph",
          "text": "Dash0 shows SLO gauges, error budget burndown charts and burn-rate views instead of a simple pass or fail. Every SLO also emits metrics, which you can chart on dashboards, query, and build check rules on."
        }
      ],
      "sources": [
        {
          "kind": "otel",
          "label": "OpenTelemetry: Observability primer",
          "url": "https://opentelemetry.io/docs/concepts/observability-primer/",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: SLOs",
          "url": "https://www.dash0.com/docs/dash0/monitoring/alerting/slos",
          "audience": "public"
        }
      ]
    },
    {
      "id": "synthetic-checks",
      "title": "Synthetic checks",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Synthetic checks are automated, scripted tests that verify the availability and performance of your websites and APIs. They simulate requests to your endpoints at regular intervals, so issues get caught early."
        },
        {
          "type": "paragraph",
          "text": "Each check validates one endpoint's availability, response time and correctness through assertions, and collects latency, status code and error on every run. In Dash0, checks run from Dash0-operated public regions or from private locations in your network."
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: Synthetic monitoring",
          "url": "https://www.dash0.com/docs/dash0/monitoring/synthetics/synthetic-monitoring",
          "audience": "public"
        }
      ]
    },
    {
      "id": "notifications",
      "title": "Notifications",
      "blocks": [
        {
          "type": "paragraph",
          "text": "In Dash0, notification channels deliver alerts from check rules and synthetic checks to your team, through messaging platforms, incident management systems and email. Examples are Slack, PagerDuty and email."
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: About notifications",
          "url": "https://www.dash0.com/docs/dash0/monitoring/alerting/about-notifications",
          "audience": "public"
        }
      ]
    }
  ]
};
