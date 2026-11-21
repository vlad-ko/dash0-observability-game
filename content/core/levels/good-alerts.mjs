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
            },
            {
              "key": "rate-5m",
              "label": "Use <code>rate()</code> with a <code>[5m]</code> range, so that 2 errors a minute is the limit to cross",
              "why": "<code>rate()</code> turns the counter into failures per second over the window, so the rule fires while checkout fails and resolves once it stops, and it adjusts for the reset when a process restarts. The threshold then reads as a speed, not as a total."
            },
            {
              "key": "error-share",
              "label": "Page if users meet one error among 50 of the requests made",
              "why": "The failing request rate divided by the whole request rate is a symptom that does not grow with the traffic or with the age of the process. It rises while users get errors and falls back when they stop, and the Prometheus practices page says to page on user-visible errors."
            },
            {
              "key": "keep-firing",
              "label": "Add <code>keep_firing_for: 1h</code> to the rule, to hold the alert open",
              "why": "That setting holds an alert open after its condition stops being true. This condition never stops being true, because the total stays over 500, so the alert has no way to resolve and the setting adds nothing."
            },
            {
              "key": "resets",
              "label": "Alert on <code>resets()</code> over 10 minutes: restarts in that window",
              "why": "<code>resets()</code> counts how often the counter fell back, which happens when a process restarts. That pages on restarts, not on failed requests, and a restart is not an error a customer meets."
            },
            {
              "key": "changes",
              "label": "Alert on <code>changes()</code> over 10 minutes: movements in that window",
              "why": "<code>changes()</code> counts how many times the value moved. With the threshold lowered to 0, a single failed request in ten minutes is enough to page, however calm the rest of the traffic is. Kept at 500 it could never fire, because ten minutes hold far fewer than 500 samples at a usual scrape interval."
            },
            {
              "key": "rate-gauge",
              "label": "Apply <code>rate()</code> to a gauge that holds the failure count over the last 60 seconds",
              "why": "Prometheus says <code>rate()</code> should only be used with counters. A gauge that dips is read as a counter that reset, so the speed it reports is not the speed of anything, and the failures a gauge holds are not events to count."
            },
            {
              "key": "nightly-restart",
              "label": "Restart checkout nightly at 03:00, so that the counter starts again from zero",
              "why": "A restart resets the total, so the rule clears until 500 failures have piled up once more, which on a busy service can take only days. That hides the flaw instead of fixing it, and each restart interrupts real requests."
            },
            {
              "key": "gauge",
              "label": "Declare the metric a gauge, since a gauge can fall back below 500 as well as rise",
              "why": "A gauge holds a value that can go up and down, such as the length of a queue, while this metric counts the failures since the process began. Declaring another type does not change what the numbers record: they still only grow."
            },
            {
              "key": "sum-pods",
              "label": "Add up the 4 checkout pods' totals using <code>sum()</code>",
              "why": "A sum of counters is still a total that only grows, and a larger one than any single pod's. The rule would cross 500 sooner and stay over it for as long as the pods run."
            },
            {
              "key": "avg-over-time",
              "label": "Alert on <code>avg_over_time()</code> over 10 minutes: the average in that window",
              "why": "The average of values that only grow is itself a value that only grows, so it crosses 500 a little later and then stays over. Averaging smooths a gauge; it does not turn a running total into a speed."
            },
            {
              "key": "threshold-zero",
              "label": "Lower the threshold to 0, so that every failed request counts",
              "why": "The total is above 0 after the first failure and never comes back down, so the rule would fire for as long as the process runs, after one error instead of after 500."
            },
            {
              "key": "quiet-channel",
              "label": "Send this alert to a quieter channel, so that nobody is woken at 4 a.m.",
              "why": "The rule would still claim that checkout is failing when it is not, now somewhere fewer people look. A page nobody can act on is a flaw in the rule, and the Prometheus practices page says to avoid pages where there is nothing to do."
            },
            {
              "key": "absent",
              "label": "Alert when <code>absent()</code> finds no 5xx series for checkout",
              "why": "<code>absent()</code> returns the value 1 only when the vector it is given has no elements. This would page when checkout has no failing series, which is when all is well, and stay silent while checkout fails."
            },
            {
              "key": "predict-linear",
              "label": "Alert on <code>predict_linear()</code> over 6 hours: the forecast from that window",
              "why": "Prometheus says <code>predict_linear()</code> should only be used with gauges. A total that only grows is forecast to keep growing, so the prediction stays above any threshold, and the drop to zero at a restart bends the line."
            },
            {
              "key": "for-0s",
              "label": "Drop to <code>for: 0s</code>, so that the alert can clear a lot sooner",
              "why": "The <code>for</code> clause only holds back the first firing: without it an alert is active at the first evaluation. How soon an alert clears depends on the expression turning false, and a total over 500 stays over 500."
            },
            {
              "key": "rate-500",
              "label": "Alert when <code>rate()</code> over 10 minutes is above 500, as before",
              "why": "<code>rate()</code> is a speed, in failures per second, so a limit of 500 asks for 500 failed requests every second. Checkout would be down long before it got there, so the rule stays silent through a real incident. The limit has to be in the unit of the function."
            }
          ]
        }
      }
    ]
  }
};
