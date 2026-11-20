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
        "[[Alerting rules]] in [[Prometheus]], and [[check rules]] in Dash0, raise an alert when a [[PromQL]] condition holds.",
        "A Service Level Objective ([[SLO]]) is a target for a Service Level Indicator ([[SLI]], a measurement of how the service behaves) over a [[time window]]. It turns \"is this service reliable enough\" into a number.",
        "[[Synthetic checks]] (scripted tests that probe your service from outside) send requests to your service's URLs at regular intervals."
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
          "text": "In [[Prometheus]], [[alerting rules]] let you define alert conditions based on [[PromQL]] expressions and send notifications about firing alerts (alerts whose condition has held for the rule's wait time) to an external service."
        },
        {
          "type": "list",
          "items": [
            "The [[labels clause]] attaches extra [[labels]] (Prometheus's word for attributes) to the alert.",
            "The [[annotations clause]] stores longer notes, such as alert descriptions or [[runbook]] links (a runbook is the team's written steps for handling the alert)."
          ]
        },
        {
          "type": "paragraph",
          "text": "Another layer is needed on top of the rules. In Prometheus, a separate component called [[Alertmanager]] provides it. It handles grouping related alerts, notification rate limiting and [[silencing]] (muting alerts for a set time)."
        },
        {
          "type": "paragraph",
          "text": "Alertmanager also does [[alert dependencies]], called inhibition. It holds back the notifications of one alert while a related alert is already firing."
        },
        {
          "type": "paragraph",
          "text": "In Dash0, [[check rules]] continuously evaluate PromQL expressions against your telemetry data. They trigger alerts when values cross defined thresholds."
        }
      ],
      "sources": [
        {
          "kind": "article",
          "label": "Prometheus: Alertmanager",
          "url": "https://prometheus.io/docs/alerting/latest/alertmanager/",
          "audience": "public"
        },
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
          "text": "Reliability answers the question: is the service doing what users expect it to be doing? A Service Level Indicator ([[SLI]]) represents a measurement of a service's behaviour. A Service Level Objective ([[SLO]]) is a target for an SLI over a [[time window]], for example 99.9% over a rolling 28-day window, which is the window Dash0 uses."
        },
        {
          "type": "paragraph",
          "text": "In Dash0, an SLO is built on the same evaluation as a check rule, but it answers a different question. It tracks an [[error budget]] (the share of failures the SLO allows) over a time window and tells you how fast that budget is being consumed."
        },
        {
          "type": "paragraph",
          "text": "Dash0 shows SLO gauges, error budget burndown charts and [[burn-rate|burn-rate]] views instead of a simple pass or fail. An SLO gauge is a dial, not the Gauge [[instrument]] from the metrics act. A burndown chart shows the remaining budget over time. A burn-rate view shows how fast the budget is being spent. Every SLO also emits metrics, which you can chart on dashboards, query, and build check rules on."
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
          "text": "[[Synthetic checks]] are automated, scripted tests that verify the availability and performance of your websites and APIs. They simulate requests to your service's URLs at regular intervals, so issues get caught early."
        },
        {
          "type": "paragraph",
          "text": "Each check validates one URL's availability, response time and correctness through assertions (conditions the response must meet), and collects latency, status code and error on every run. In Dash0, checks run from Dash0-operated public regions or from [[private locations]] (places inside your own network)."
        }
      ],
      "sources": [
        {
          "kind": "docs",
          "label": "Dash0 docs: Synthetic monitoring",
          "url": "https://www.dash0.com/docs/dash0/monitoring/synthetics/synthetic-monitoring",
          "audience": "public"
        },
        {
          "kind": "docs",
          "label": "Dash0 docs: Run checks from private locations",
          "url": "https://www.dash0.com/docs/dash0/monitoring/synthetics/private-locations",
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
          "text": "In Dash0, [[notification channels]] deliver alerts from [[check rules]] and [[synthetic checks]] to your team, through messaging platforms, incident management systems and email. Examples are Slack, PagerDuty and email."
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
