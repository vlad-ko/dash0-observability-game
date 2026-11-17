// Text of levels/histograms.mjs (docs/CONTENT.md).
export default {
  "id": "histograms",
  "name": "Histograms",
  "sub": "Not just the average",
  "rewardTitle": "Percentile reader",
  "play": {
    "finish": "You can read a percentile with histogram_quantile, you know an average hides a tail and that buckets must reach your slowest requests, and that Dash0 takes the same PromQL.",
    "steps": [
      {
        "intro": "Kettle & Co's checkout durations run from a few milliseconds to several seconds. A <b>histogram</b> counts observations into buckets instead of keeping every value. An <b>explicit bucket</b> histogram uses boundaries you list. An <b>exponential</b> one derives them from a scale.",
        "question": "What does an exponential histogram do that an explicit one does not?",
        "choice": {
          "id": "hist-kind",
          "choices": [
            {
              "key": "fixed",
              "label": "Explicit: you give a list of boundaries once and the histogram adapts them as the data changes",
              "why": "An explicit bucket histogram keeps the boundaries you gave it (or the default or advisory ones the SDK falls back on). Values outside them pile up in the first or last bucket, which is why picking them well matters."
            },
            {
              "key": "exponential",
              "label": "Exponential: the boundaries follow a growth factor set by a scale, and one histogram covers a wide range with small relative error",
              "why": "Bucket boundaries sit at powers of a base set by the scale, so there is no list to pick, and a higher scale means finer buckets. The SDK adjusts the scale to the data it sees. Support varies by backend: the Prometheus text formats cannot carry exponential histograms, so there they are dropped or converted to fixed buckets."
            },
            {
              "key": "exact",
              "label": "Exponential: it keeps every value, and a percentile read from it is exact, with no estimate and no bucket error",
              "why": "Both kinds count observations into buckets and keep a count, a sum and, by default, a min and max. A percentile read from either is an estimate. The exponential one is just built to keep the error small across a wide range."
            }
          ]
        }
      },
      {
        "intro": "Checkout deployed at t=2400, and customers say paying is slow. The dashboard for <code>/pay</code> shows the average duration, and nobody is worried. A histogram gives you <code>_sum</code> and <code>_count</code> series next to the buckets, and sum divided by count is the mean.",
        "question": "Write a query for the average duration of /pay requests over the last 5 minutes, in seconds.",
        "query": {
          "id": "hist-avg",
          "hint": "A mean is a total over a count, and the histogram keeps both as counters that only grow.",
          "explain": "About 0.79 seconds: a rate of the sum divided by a rate of the count is the mean of the last 5 minutes. It looks tolerable, and an average cannot show you how slow the slowest requests are."
        }
      },
      {
        "intro": "The same histogram has one <code>_bucket</code> series per boundary, each with an <code>le</code> (less or equal) label, and each counts the observations up to that boundary. <code>histogram_quantile(0.99, ...)</code> estimates the 99th percentile from the rates of those series. Take the rate first, then sum by <code>le</code>, because percentiles cannot be averaged but buckets can be added.",
        "question": "Write a query for the p99 duration of /pay over the last 5 minutes.",
        "query": {
          "id": "hist-p99",
          "hint": "A percentile is estimated from buckets; a percentile cannot be added or averaged, so add up the bucket rates for each boundary first.",
          "explain": "The p99 is 2.5 seconds, three times the average. Percentiles show the tail the average hides."
        }
      },
      {
        "intro": "The p99 reads exactly 2.5. The buckets of this histogram are 0.05, 0.1, 0.25, 0.5, 1 and 2.5 seconds, then +Inf. These service buckets stop at 2.5 seconds, narrower than the semantic conventions advise for HTTP durations.",
        "question": "What does a p99 of exactly 2.5 seconds tell you?",
        "choice": {
          "id": "hist-buckets",
          "choices": [
            {
              "key": "exact-p99",
              "label": "The slowest 1% of /pay requests take exactly 2.5 seconds",
              "why": "It would be a coincidence. 2.5 is the upper bound of the highest bucket before +Inf, and histogram_quantile has nothing to interpolate with beyond it."
            },
            {
              "key": "top-bucket",
              "label": "Only that they take at least 2.5 seconds: the buckets stop before the tail",
              "why": "The p99 falls inside the +Inf bucket, and for a quantile there Prometheus returns the upper bound of the second highest bucket, here 2.5. The real p99 is higher, and these buckets cannot say by how much. Add boundaries above your slowest requests, or use an exponential histogram. The OpenTelemetry SDK default boundaries run from 0 to 10000, which suits large values, so a duration metric in seconds with no better boundaries puts everything under 5 seconds into one bucket, (0, 5]. For http.server.request.duration, the semantic conventions advise boundaries in seconds from 0.005 to 10, which the SDK uses; for your own duration metrics, set the boundaries yourself."
            },
            {
              "key": "trust-average",
              "label": "Nothing: the 0.79 second average is the number to trust",
              "why": "The average is the one that hid the problem. A mean is a sum divided by a count, so a few very slow requests are diluted by every fast one."
            }
          ]
        }
      },
      {
        "intro": "In Dash0 you write the same PromQL in the Metric Explorer, and a dashboard panel keeps the query. The team wants one p95 line per service on a panel. The label names in this data, such as <code>service</code> and <code>route</code>, are Kettle &amp; Co's own; in Dash0 the OpenTelemetry attributes arrive as <code>service_name</code> and <code>http_route</code>.",
        "question": "Write the p95 duration per service for the last 5 minutes.",
        "query": {
          "id": "hist-p95",
          "hint": "Reuse the recipe from the previous query, not its filter: change the percentile, and keep one line per thing the panel compares.",
          "explain": "One series per service: checkout is at 1.45 seconds and cart at 0.24. Dash0 speaks PromQL, so <code>histogram_quantile</code> over the rate of the <code>_bucket</code> series is the query you would write against Prometheus."
        }
      }
    ]
  }
};
