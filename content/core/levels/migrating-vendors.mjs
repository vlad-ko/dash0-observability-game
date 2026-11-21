// Text of levels/migrating-vendors.mjs (docs/CONTENT.md).
// Each sort item's label says what the old tool does, and no label makes a claim about a real vendor: the rule is in the header of levels/migrating-vendors.mjs.
export default {
  "id": "migrating-vendors",
  "name": "Migrating vendors",
  "sub": "Not everything maps 1:1",
  "rewardTitle": "Migration lead",
  "play": {
    "finish": "Moving off a proprietary tool is part translation, with several places where the meaning shifts: a percentile becomes an estimate from buckets, an exact count becomes an extrapolated one, and what has no counterpart is rebuilt or left behind. Check each converted query against the old one on the same data before you switch it off.\n\nWhen the move is to Dash0, DART (Dashboards, Alerts & Rules to Terraform) brings dashboards, alerts and rules over as Terraform, and you still have to sort them: some need a person, whatever the tool.",
    "steps": [
      {
        "intro": "Kettle &amp; Co is moving its dashboards and alerts off a proprietary monitoring tool, with a query language of its own, to a tool that queries OpenTelemetry metrics with [[PromQL]]. A move rarely maps one to one, so each construct ends up in one of four places. <b>Translated</b>: it means the same thing in the new tool. <b>Approximated</b>: it converts to something close, and the numbers can differ. <b>Manual</b>: it is still needed and nothing converts it, so someone rebuilds it. <b>Skipped</b>: nothing in the new tool needs it. The new tool receives counters, gauges and histograms, here with fixed bucket boundaries.",
        "question": "Sort each dashboard panel and alert by what the move does to it.",
        "sort": {
          "id": "mv-sort",
          "buckets": [
            {
              "id": "translated",
              "label": "Translated: means the same in the new tool"
            },
            {
              "id": "approximated",
              "label": "Approximated: close, but check the numbers"
            },
            {
              "id": "manual",
              "label": "Manual: someone rebuilds it by hand"
            },
            {
              "id": "skipped",
              "label": "Skipped: nothing to carry over"
            }
          ],
          "items": [
            {
              "id": "p95-chart",
              "label": "A line chart of p95 latency, which the old tool computes from every raw sample",
              "why": "The new tool receives latency as histogram buckets, and a percentile is estimated from them: for a classic histogram, <code>histogram_quantile</code> assumes the requests are spread evenly inside the bucket the percentile falls in. The chart comes out close, not equal.",
              "whyNot": {
                "skipped": "The p95 line is still wanted in the new tool, so it is not dropped. It moves over, with a different way of computing it.",
                "translated": "A percentile is not a plain query. The old tool took it from every raw sample and the new one estimates it from buckets, so the line does not mean exactly the same.",
                "manual": "The query behind this chart carries over as it is, so there is nothing to write again."
              }
            },
            {
              "id": "ratio-alert",
              "label": "An alert when the error ratio stays above 2% for 5 minutes",
              "why": "Failed requests divided by all requests over the same window means the same thing in PromQL, and the \"for 5 minutes\" condition has a counterpart in an alert rule. The meaning survives the move.",
              "whyNot": {
                "approximated": "It is a ratio of two <code>rate</code>s, and both extrapolate the same way over the same window, so the extrapolation cancels and the ratio is unchanged in practice. That is why it differs from the exact count, which has no second number to cancel against.",
                "manual": "Nothing here is left to rebuild: the ratio and the \"for 5 minutes\" condition both convert as written.",
                "skipped": "An error-ratio alert is still needed in the new tool, so it is not left behind."
              }
            },
            {
              "id": "agent-panel",
              "label": "A panel of the old tool's own agent version and licence usage",
              "why": "It describes the tool you are leaving. Nothing in the new tool needs it, so it stays behind.",
              "whyNot": {
                "approximated": "No number gets compared here. The panel only describes the old tool, and nothing in the new tool plays that part.",
                "translated": "There is nothing to convert: the panel describes the old tool itself, and the new tool has no agent or licence of that kind.",
                "manual": "Nothing needs to be built in the new tool: the panel only describes the old tool."
              }
            },
            {
              "id": "anomaly-chart",
              "label": "A chart that marks request rates outside the old tool's learned normal band",
              "why": "The band comes from the old tool's own model, and the model does not move. The need is still real, so someone decides what \"normal\" means in a query they write, for instance the same hour last week with a margin.",
              "whyNot": {
                "skipped": "The need to spot odd request rates remains. Leaving the chart out would lose that check.",
                "translated": "The band comes from the old tool's own learned model. A query cannot read it, so there is nothing to convert as written.",
                "approximated": "No number here is a rough version of an old one: the old tool's model does not come over in any form."
              }
            },
            {
              "id": "memory-chart",
              "label": "A line chart of memory in use per host, from a gauge",
              "why": "A gauge is plotted as it is: select the series, group by host. There is nothing to compute, so there is nothing to lose.",
              "whyNot": {
                "skipped": "Memory per host is still worth watching, so the chart is not dropped.",
                "approximated": "A gauge is plotted as it is, with no calculation to be off by, so the line is the same in the new tool.",
                "manual": "Nothing needs to be written again: select the series and group by host."
              }
            },
            {
              "id": "p99-alert",
              "label": "An alert on the 99th percentile of checkout latency above 1.2 seconds",
              "why": "It is the same estimate as the p95 chart, now deciding whether someone is paged, and 1.2 s sits inside a bucket, not on a boundary, so the estimate is interpolated there. Step 2 shows a window where the estimate and the raw-sample percentile land on opposite sides of a threshold.",
              "whyNot": {
                "skipped": "Someone still needs to be paged when checkout gets slow, so the alert is not dropped.",
                "translated": "A percentile estimated from buckets does not mean the same as one taken from raw samples. Step 2 shows them landing on opposite sides of a threshold.",
                "manual": "The query carries over as written. What differs is the number it gives, not who has to write it."
              }
            },
            {
              "id": "retired-alert",
              "label": "An alert on a queue the team retired last year",
              "why": "The queue is gone, so the alert has nothing to watch. Moving a monitoring tool is a good time to leave it behind.",
              "whyNot": {
                "approximated": "There is no number to check. The queue no longer exists, so the alert reads nothing.",
                "translated": "The queue is gone, so there is nothing for a carried-over alert to watch.",
                "manual": "Rebuilding it by hand would only recreate an alert for a queue that no longer exists."
              }
            },
            {
              "id": "failed-count",
              "label": "A big number showing exactly how many checkouts failed in the last hour",
              "why": "It becomes <code>increase</code> over an hour, which extrapolates to cover the full window, so it can read 41.7 where the old tool said 42. The number is right to within a fraction, not exact.",
              "whyNot": {
                "translated": "The query converts, but the result does not mean the same: <code>increase</code> extrapolates to cover the full window, so it can return a fraction where the old tool counted whole checkouts.",
                "manual": "Nobody has to rebuild it. The query converts on its own, and only the exactness is lost.",
                "skipped": "The count is still wanted, so it is carried over, with the caveat that it is close, not exact."
              }
            },
            {
              "id": "paging-alert",
              "label": "An alert that phones the on-call engineer through the old tool's own paging app",
              "why": "The condition may well convert, but the phone call does not: the paging app, the schedule and the escalation steps have to be set up again by hand in the new tool's notification channels.",
              "whyNot": {
                "translated": "Only the condition translates. The phone call goes through the old tool's own paging app, which the new tool does not have, so the paging side is set up again by hand.",
                "approximated": "Nothing about the numbers is estimated here. What is missing is the paging path itself, and no query turns that into something close.",
                "skipped": "The engineer still has to be paged, so the need stays and the path is rebuilt."
              }
            },
            {
              "id": "unused-dashboard",
              "label": "A dashboard nobody has opened in a year",
              "why": "Converting it would cost effort and add a dashboard to maintain, and nobody would miss it. Leaving it out is a decision, not a gap.",
              "whyNot": {
                "approximated": "Whether its numbers come out close or exact does not matter, since nobody reads it.",
                "manual": "Nobody opened it in a year, so rebuilding it by hand is effort with no reader.",
                "translated": "Someone could carry it over, but nobody opens it, so the effort buys nothing."
              }
            },
            {
              "id": "disk-alert",
              "label": "An alert that the disk fills within 4 hours, from the old tool's least-squares straight-line forecast over the last 6 hours",
              "why": "PromQL has <code>predict_linear</code>, which fits a straight line to a gauge over a window and projects it forward. With a 6 hour window and 4 hours ahead it is the same least-squares method over the same window, so the alert means the same thing.",
              "whyNot": {
                "approximated": "A forecast sounds like an estimate, but <code>predict_linear</code> is the same least-squares line over the same 6 hour window, so nothing is approximated by the move.",
                "manual": "PromQL has the function, so nobody rebuilds anything by hand.",
                "skipped": "A disk that fills is exactly what the team still wants to hear about."
              }
            },
            {
              "id": "logs-panel",
              "label": "A panel whose single query combines request counts with a text search over logs",
              "why": "PromQL queries metrics, and the old tool's one-query mix of two signals has no one-query counterpart. The panel is rebuilt by hand, for instance as two panels side by side.",
              "whyNot": {
                "skipped": "The panel is still useful, because it puts request counts next to a search of the logs. Dropping it would lose that view.",
                "translated": "PromQL reaches logs through derived metrics such as <code>dash0.logs</code>, and a text search over log lines is not something a derived metric can express, so a query that mixes the two cannot carry over as written.",
                "approximated": "No number here is a rough copy of an old one: the query that mixes the two signals does not come over in any form."
              }
            }
          ]
        }
      },
      {
        "intro": "The p99 alert was converted to <code>histogram_quantile(0.99, ...)</code> over the new tool's request-duration histogram, with bucket boundaries at 0.5, 1 and 2.5 seconds, and it pages above 1.2 seconds. One 5-minute window held 1,000 requests: 900 took 0.5 s or less, 985 took 1 s or less and all 1,000 took 2.5 s or less. The 15 slowest took between 1.0 and 1.1 s. The old alert, working from the raw samples, read no more than 1.1 s and stayed quiet. The converted alert paged.",
        "question": "What do you do before the old alert is removed?",
        "choice": {
          "id": "mv-fix",
          "choices": [
            {
              "key": "boundary",
              "label": "Add a bucket boundary at 1.2 s to the request-duration histogram",
              "why": "The estimate is only as good as the buckets around the threshold. With boundaries at 0.5, 1 and 2.5 s, the 990th request of 1,000 falls in the 1 to 2.5 s bucket, 5 of its 15 requests in, so the estimate is 1 + 5/15 &times; 1.5 = 1.5 s. With a boundary at 1.2 s, all 15 slow requests sit in the 1 to 1.2 s bucket and the estimate is 1 + 5/15 &times; 0.2 = about 1.07 s, below the threshold, as the raw samples say. Bucket boundaries are set in the metrics SDK, so this is a change to the services, not to the query. Running both alerts for a while shows where they still disagree before the old one goes. Dash0's [[import of Grafana dashboards|migrator]] asks for the same care: it converts Prometheus queries only and a list of common panel types, shows a placeholder for a panel it cannot convert and may omit some panel options, so read the result."
            },
            {
              "key": "keep",
              "label": "Keep the converted alert and watch whether it pages again",
              "why": "It is not the same query. The old tool computed the percentile from raw samples; the new one estimates it from buckets. In this window the two readings sit on opposite sides of the threshold, so the new alert pages for a window the old one called healthy."
            },
            {
              "key": "raise",
              "label": "Raise the converted threshold to 1.5 s so it stops paging",
              "why": "The estimate comes from the bucket counts, not from how long the slow requests took: it reads 1.5 s for 1.05 s and for 1.4 s alike. A threshold of 1.5 s fits this window and misses the next one where the real p99 is 1.4 s, a latency the old alert would have paged on."
            },
            {
              "key": "mean",
              "label": "Alert on the mean latency instead, from the histogram's sum and count",
              "why": "The mean needs no buckets, and it changes what the alert says. Every request in this window took at most 1.1 s, so the mean cannot reach 1.2 s; it would stay quiet even if the tail were far slower, because a few slow requests barely move an average over 1,000."
            }
          ]
        }
      }
    ]
  }
};
