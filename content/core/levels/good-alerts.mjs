// Text of levels/good-alerts.mjs (docs/CONTENT.md).
export default {
  "id": "good-alerts",
  "name": "Good alerts",
  "sub": "Page on what users feel",
  "rewardTitle": "Alert tuner",
  "play": {
    "finish": "You can tell a rule that pages for the right reason: alert on the rate of a counter, not its total, on symptoms users feel, and give the condition a for duration so one bad minute does not page.",
    "steps": [
      {
        "intro": "Kettle &amp; Co's on-call engineer was paged all night, mostly for nothing. These are the team's Prometheus [[alerting rules]], one per line: the alert's name, the [[PromQL]] expression that makes it fire, and <code>for</code>, how long the expression must stay true before it pages.",
        "question": "Spot the rules that page badly: for something no user feels, without end, or on and off.",
        "spot": {
          "id": "ga-spot",
          "lines": [
            {
              "id": "counter-value",
              "text": "alert: CheckoutErrors expr: http_requests_total{job=\"checkout\", code=~\"5..\"} > 500 for: 5m"
            },
            {
              "id": "error-ratio",
              "text": "alert: CheckoutErrorRatio expr: sum(rate(http_requests_total{job=\"checkout\", code=~\"5..\"}[5m])) / sum(rate(http_requests_total{job=\"checkout\"}[5m])) > 0.02 for: 10m"
            },
            {
              "id": "queue-age",
              "text": "alert: OrdersWaiting expr: max(orders_oldest_age_seconds{job=\"orders\"}) > 900 for: 15m"
            },
            {
              "id": "payments-increase",
              "text": "alert: PaymentsFailing expr: increase(payments_failed_total{job=\"payments\"}[10m]) > 20 for: 5m"
            },
            {
              "id": "cause-cpu",
              "text": "alert: CheckoutHighCpu expr: avg(rate(process_cpu_seconds_total{job=\"checkout\"}[5m])) > 0.9 for: 15m"
            },
            {
              "id": "checkout-slow",
              "text": "alert: CheckoutSlow expr: histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{job=\"checkout\"}[5m]))) > 2 for: 10m"
            },
            {
              "id": "no-for",
              "text": "alert: SearchSlowP99Latency expr: histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{job=\"search-api\"}[1m]))) > 1 for: 0s"
            }
          ],
          "whyNot": {
            "error-ratio": "A symptom users feel: the share of checkout requests that fail, from rates over 5 minutes, and it must hold for 10 minutes before it pages.",
            "queue-age": "A gauge is a current value, so comparing it with a threshold is right, no rate needed. And orders waiting over 15 minutes are something customers notice.",
            "payments-increase": "<code>increase()</code> over 10 minutes turns the counter into the failures in that window, so the alert resolves when they stop.",
            "checkout-slow": "A symptom, slow checkouts, from the histogram's rate over 5 minutes, and it waits 10 minutes before it pages, so one slow minute does not wake anyone."
          },
          "explain": "<code>CheckoutErrors</code> compares a cumulative counter's value with 500. A counter only grows until the process restarts, so once it passes 500 the rule stays firing until a restart. <code>CheckoutHighCpu</code> pages on a cause: checkout processes using 0.9 of a CPU core on average may hurt no one, and when they do, the error and latency rules already fire. Page on symptoms users feel and keep causes on a dashboard. <code>SearchSlowP99Latency</code> has no <code>for</code> wait (<code>for: 0s</code>), so it fires on the first evaluation over the line, and a p99 over 1 minute crosses it and falls back often: the alert flaps. A <code>for</code> duration makes the condition hold that long before the alert fires."
        }
      },
      {
        "intro": "<code>CheckoutErrors</code> has been firing for three days, and checkout has been fine for two of them.",
        "question": "How do you fix CheckoutErrors?",
        "choice": {
          "id": "ga-fix",
          "choices": [
            {
              "key": "raise",
              "label": "Raise the threshold to 5,000, so a normal day stays below it",
              "why": "The counter only grows, so a bigger threshold only delays the page: one day it passes 5,000 and fires for good, failing or not."
            },
            {
              "key": "for-1h",
              "label": "Add <code>for: 1h</code>, so the condition must hold for an hour first",
              "why": "Once the total is over 500 it stays over for as long as the process runs, so the condition is true every hour after that. <code>for</code> delays the page; it cannot make it resolve."
            },
            {
              "key": "increase",
              "label": "Alert on <code>increase()</code> over 10 minutes: failures in that window",
              "why": "<code>increase(http_requests_total{job=\"checkout\", code=~\"5..\"}[10m]) > 20</code> estimates the failures in the last ten minutes, so it fires while checkout fails and resolves when it stops, and it adjusts for the reset when the process restarts. Better still, page on the share that fails, as <code>CheckoutErrorRatio</code> does. In Dash0, a [[check rule]] evaluates a PromQL expression against a threshold, and its For setting is how long the threshold must be exceeded before alerting."
            },
            {
              "key": "delta",
              "label": "Alert on <code>delta()</code> over 10 minutes: the change across that window",
              "why": "Prometheus says to use <code>delta()</code> with gauges only. On a counter, a restart resets the total to zero and delta reads that as a huge drop. <code>increase()</code> and <code>rate()</code> are the counter functions."
            }
          ]
        }
      }
    ]
  }
};
