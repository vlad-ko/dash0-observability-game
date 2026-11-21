// Text of levels/slis-and-slos.mjs (docs/CONTENT.md).
export default {
  "id": "slis-and-slos",
  "name": "SLIs and SLOs",
  "sub": "A number for \"it works\"",
  "rewardTitle": "Budget keeper",
  "play": {
    "finish": "You can turn \"it works\" into a ratio of good requests to valid requests, and compute it from rates, not from a counter's total. You can read the error budget off an SLO. You know a server-span SLI misses the requests that never reached the server.",
    "steps": [
      {
        "intro": "Kettle &amp; Co's checkout team is tired of arguing about whether checkout is \"fine\". They want one number. An <b>SLI</b>, a service level indicator, is a measurement of how well the service is doing for its users. An <b>SLO</b>, a service level objective, is the target the team sets for it.",
        "question": "Which measurement makes the best SLI for \"checkout works\"?",
        "choice": {
          "id": "sl-sli",
          "choices": [
            {
              "key": "good-over-valid",
              "label": "Good requests over valid requests, as a share of the traffic",
              "why": "A ratio of good requests to valid requests is a number between 0 and 1 that means the same on a quiet night and on a sale day, and an SLO target can be set against it: 99.9% good. What counts as good and as valid is your decision, and it is written down once."
            },
            {
              "key": "error-count",
              "label": "The number of failed requests per minute, as a count of errors",
              "why": "A count follows the traffic: a sale day has more failures with the same quality, and a quiet night hides a service that fails half of its few requests. A share of the requests does not move with the traffic."
            },
            {
              "key": "uptime",
              "label": "The share of the time the checkout servers are up and answering",
              "why": "A server can be up and still fail every payment. Users do not feel whether a process runs, they feel whether their request worked, so the SLI counts requests, not time."
            },
            {
              "key": "successful-requests",
              "label": "Successes divided by the requests that checkout should answer",
              "why": "Successes divided by the requests the service was meant to answer is the same idea as good over valid, in the words of the product: a number between 0 and 1 that does not move with the traffic, with success and valid defined once. An SLO target such as 99.9% can be set against it."
            },
            {
              "key": "failing-share",
              "label": "The failures counted against all valid ones",
              "why": "The Dash0 documentation says an SLI is a ratio of good, or of bad, to total. Failed over valid is 100% minus good over valid, and it does not move with the traffic either. An SLO target is then a ceiling on it, such as 0.1%."
            },
            {
              "key": "non-error-share",
              "label": "The share of calls made to checkout answered without an error",
              "why": "A ratio of the calls with no error to all the calls that count means the same on a quiet night and on a sale day. What counts as an error, and as a call that counts, is decided once, and an SLO target can then be set against the result."
            },
            {
              "key": "cpu",
              "label": "Average CPU use across all the pods that run checkout",
              "why": "CPU use says how busy the machines are, not whether a customer's payment worked. A pod can run cool and fail every request, or run hot and serve them all."
            },
            {
              "key": "mean-latency",
              "label": "Average latency of valid requests, in milliseconds, for each day",
              "why": "An average of times can look fine while requests fail: a request that fails at once is quick and pulls the mean down. It is also one time, not a share of the requests that worked, so a target such as 99.9% cannot be set against it."
            },
            {
              "key": "week-on-week",
              "label": "Valid requests per minute against the same minute last week",
              "why": "That compares traffic with traffic. A quiet Tuesday after a busy one reads as a collapse though every request worked, and a bad hour that matches last week's volume reads as fine."
            },
            {
              "key": "orders-per-day",
              "label": "The count of valid orders that checkout completes each day",
              "why": "A count of orders follows demand: it falls on a quiet day with nothing wrong and rises on a sale day when many requests fail. Without the attempts to set it against, it cannot say whether the service did well."
            },
            {
              "key": "funnel-rate",
              "label": "Completed checkouts over the checkouts started in the same period",
              "why": "That is a funnel rate. A customer who abandons the basket counts as a failure though nothing broke, and a failed request that the customer retries successfully counts as a success. Good over valid counts only the requests the service was meant to answer."
            },
            {
              "key": "failed-over-successful",
              "label": "Failed requests over successful requests across the window",
              "why": "The denominator leaves out the failures, so this is a ratio with no ceiling: 1 failure per 2 successes reads 0.5 and 1 per 1 reads 1.0, then it climbs past 1. A target such as 99.9% cannot be set against it, and the valid requests are the whole of what the service was asked."
            },
            {
              "key": "average-of-ratios",
              "label": "The mean of every minute's good share across the month",
              "why": "Averaging per-minute ratios gives a quiet 3 a.m. minute the same weight as a sale-day minute with a thousand times the requests. The ratio has to be taken over the whole window's requests: all the good over all the valid."
            },
            {
              "key": "quiet-minutes",
              "label": "The share of this month during which no alert was firing",
              "why": "It depends on how the alert rules are written, not on how many requests worked. A minute in which one request failed and a minute in which all of them did count the same, and a badly tuned rule can fire while checkout is fine."
            },
            {
              "key": "total-since-start",
              "label": "Total valid requests served by checkout since the process started",
              "why": "A counter's total only grows until a restart, so it says how long the process has run, not how the service is doing now. A good measure is built from rates over a window."
            },
            {
              "key": "valid-over-all",
              "label": "Valid requests over all the requests that checkout received",
              "why": "That says how many of the requests were well formed, which is a fact about the callers, not about checkout. A service that fails every valid request scores 100% on it."
            },
            {
              "key": "db-p99",
              "label": "The 99th percentile of database query time over an hour",
              "why": "That is one internal part of a request, and a slow query is a cause the customer may never notice. An SLI describes what the customer got from the whole request, as a share that worked."
            },
            {
              "key": "error-line-share",
              "label": "The share of checkout's log lines that are marked as errors",
              "why": "Log lines are not requests. One failing request can write a dozen error lines and a successful one none, so the share depends on what the code chooses to log, not on how many requests worked."
            },
            {
              "key": "health-checks",
              "label": "The share of health checks that passed since the last rollout",
              "why": "A health check asks whether a pod answers one simple question on a timer. It can pass every time while payments fail, and it samples a request every few seconds instead of counting the ones customers made."
            },
            {
              "key": "ready-pods",
              "label": "The share of checkout pods that report ready",
              "why": "Ready pods are capacity, not outcome. Every pod can report ready while payments fail, and a single pod may serve all the traffic well."
            }
          ]
        }
      },
      {
        "intro": "The [[span metrics]] from 3.7 reach your backend as <code>traces_span_metrics_calls_total</code>, a counter with the [[labels]] <code>service_name</code>, <code>span_kind</code> and <code>status_code</code>. Checkout's own requests are its SERVER spans. A success is <code>STATUS_CODE_UNSET</code> and a failure is <code>STATUS_CODE_ERROR</code>. A counter only grows, so the SLI is built from rates.",
        "question": "Write the checkout SLI over the last 5 minutes: the rate of good server requests divided by the rate of all of them.",
        "query": {
          "id": "sl-sli-query",
          "hint": "Good over valid: both sides are sums over the same requests of one service, the top side without the failures. A counter needs the function that turns it into a speed.",
          "explain": "Checkout served 12 requests per second and 11 of them were good: 91.7%. Without <code>rate()</code> you divide the totals since the counters began, an hour of history, and read 96.5%, which hides the minutes that are failing now. Leave out the span kind and checkout's call to the payment provider counts as a request it serves: 87.5%."
        }
      },
      {
        "intro": "The team sets an SLO of <b>99.9%</b> good requests over a window of 30 days. The window is illustrative: the data you queried is one hour. Say checkout serves 1,000,000 valid requests in the window. Whatever the target leaves over is the <b>error budget</b>. Checkout measured 91.7% in the last step, far below 99.9%: right now its budget is spent, and that gap is what an SLO is for.",
        "question": "How many of those requests may fail before the SLO is missed?",
        "choice": {
          "id": "sl-budget",
          "choices": [
            {
              "key": "thousand",
              "label": "1,000 failed requests (0.1%)",
              "why": "The error budget is what the SLO leaves over: 100% minus 99.9% is 0.1%, and 0.1% of 1,000,000 valid requests is 1,000. Spend them on deploys and mistakes; once they are gone, the target is missed."
            },
            {
              "key": "hundred",
              "label": "100 failed requests (0.01%)",
              "why": "That is 0.01% of the requests. The target is 99.9% good, so the failures allowed are the other 0.1%, and 0.1% of 1,000,000 is 1,000."
            },
            {
              "key": "ten-thousand",
              "label": "10,000 failed requests (1%)",
              "why": "That is a 99% target. At 99.9%, the failures allowed are 0.1% of the valid requests, which is 1,000 of 1,000,000, a tenth of what this answer allows."
            },
            {
              "key": "all-but",
              "label": "999,000 failed requests (99.9%)",
              "why": "Inverted. The target is the share that must be good, 99.9%, so 999,000 of the 1,000,000 must succeed. The failures allowed are the 1,000 left over."
            }
          ]
        }
      },
      {
        "intro": "Back to the 99.9% SLO over 30 days, with steady traffic. A deploy left checkout with no ready pod for one hour, and the load balancer in front of it (the edge of your system) answered 502 to every request in that hour: 1 hour of 720, so 0.14% of the month's requests. Checkout's server-span SLI for the 30 days reads 99.95%, which meets the target. Counted at the load balancer, which adds those 502s to the failures, it reads about 99.81%, which misses it. Customers wrote in.",
        "question": "Which source should the SLI come from?",
        "choice": {
          "id": "sl-edge",
          "choices": [
            {
              "key": "server-spans",
              "label": "Checkout's server spans: they carry the labels and they are the application's own record",
              "why": "A request the load balancer turned away never reached checkout, so it never became a span. The server-span SLI counts only the requests that got in, and it reads healthy through exactly the minutes users saw errors. Keep the spans to find out why, but do not measure the promise to users with them."
            },
            {
              "key": "load-balancer",
              "label": "The load balancer's request counts: good responses over all responses it sent",
              "why": "The load balancer sees every request that reaches your infrastructure, including the ones that never reached a healthy pod, so its good-over-valid ratio is the one closest to what users got. It has fewer labels than a span, so use the server spans to find out where and why, and the load balancer for the SLI."
            },
            {
              "key": "both-summed",
              "label": "Both, added together: server-span requests plus load-balancer requests",
              "why": "Every request that reached checkout is counted twice, once at the load balancer and once as a span, and the sum is not a share of anything. An SLI uses one source for its good requests and its valid requests."
            },
            {
              "key": "lb-access-log",
              "label": "The edge access log, with one line per reply given",
              "why": "The access log at the edge lists every request that reached the load balancer, including the ones it answered with a 502 because no pod was ready. Responses that were not errors over all responses is a good-over-valid ratio taken where users meet the system."
            },
            {
              "key": "ingress-metrics",
              "label": "The ingress controller's metrics on the outcomes returned for checkout",
              "why": "The ingress controller records the status code of every response it sends, the 502s included, so good responses over all responses can be taken there. That makes it a measure of what users got, not of what checkout handled."
            },
            {
              "key": "front-door-counts",
              "label": "Successful against total answers at the point of entry",
              "why": "A count of arrivals alone would say nothing about how they ended, but the outcome of each response counted at the point of entry includes the requests turned away before reaching the application, which is exactly what a promise to users must count. Anything measured further in is a view of the requests that got through."
            },
            {
              "key": "app-logs",
              "label": "Checkout's application logs, counting the lines marked as errors",
              "why": "A log line is written by code that handled the request, so a request that was refused before it arrived leaves none in checkout's own logs. Counting error lines gives no total of valid requests either, so no ratio can be made."
            },
            {
              "key": "http-server-metrics",
              "label": "Checkout's own HTTP server metrics: the good share of responses served",
              "why": "Those metrics are recorded by checkout's code for the requests it received, the same population as its server spans. The hour with no ready pod produced none, so the ratio keeps reading about 99.95%, which meets the target through the very hour customers saw errors."
            },
            {
              "key": "spanmetrics-ratio",
              "label": "The spanmetrics ratio of non-error calls to every call counted for checkout",
              "why": "The calls metric is counted from the server spans, so it has the spans' blind spot: a request that was turned away never became one. It reads about 99.95% and meets the target while users saw errors."
            },
            {
              "key": "edge-latency",
              "label": "The load balancer's median response time at the edge, in milliseconds",
              "why": "A time is not a share of requests that worked. An immediate 502 is a fast answer, so a load balancer that refuses every request can look quicker than one that serves them."
            },
            {
              "key": "lb-health-checks",
              "label": "The load balancer's health checks of each pod, as a share that passed",
              "why": "A health check asks a pod one question on a timer, so it measures the pods, not the requests customers sent. With no ready pod the checks fail, but the share says nothing about how many requests were lost."
            },
            {
              "key": "average-of-two",
              "label": "The average of the application's ratio and the one from the load balancer",
              "why": "Averaging two ratios halves the signal of the one that saw the 502s and mixes in the one that is blind to them. A single source that sees every request has to be chosen, not blended."
            },
            {
              "key": "server-span-30d",
              "label": "The span ratio taken over the full 30 days of the window",
              "why": "A longer window does not add requests that never reached checkout. Counted over the 30 days it still reads about 99.95%, which meets the target, so it is as blind to the refused requests as a shorter window."
            },
            {
              "key": "support-tickets",
              "label": "The number of support tickets customers wrote this week",
              "why": "Tickets come only from the customers who take the trouble to write, they arrive later, and a count is not a share of the requests. They are a hint that something is wrong, not a measurement of it."
            },
            {
              "key": "mesh-gateway",
              "label": "The mesh sidecar in each checkout pod, counting good responses after routing",
              "why": "A sidecar runs in the pod, so it sees only the requests that were routed there. The ones the load balancer answered with a 502 because no pod was ready never reach it, and its ratio reads healthy through the hour customers saw errors."
            },
            {
              "key": "front-door-502s",
              "label": "The number of 502s sent at the front door during the month",
              "why": "A count follows the traffic: a busy month has more 502s at the same quality, and a quiet one hides a bad hour. With no total beside it, it is not a ratio, so no target such as 99.9% can be set against it."
            },
            {
              "key": "pod-access-logs",
              "label": "Each pod's own access log of responses, summed over the pods",
              "why": "A pod logs only the requests it received, and the 502s were answered before any pod was asked. The summed ratio reads healthy, and it still misses the hour customers saw errors."
            },
            {
              "key": "sampled-traces",
              "label": "The share of kept traces that carry an error status",
              "why": "A sampler keeps a chosen part of the traces, often favouring errors and slow requests, so the share of errors among the kept ones is not the share among all requests. Traces are also made by instrumented code, and a request that was refused at the edge may leave none."
            },
            {
              "key": "lb-total-rate",
              "label": "The load balancer's traffic, in requests a second, across the period",
              "why": "That is traffic, a count of requests arriving, and it does not say how many of them worked. It would only show the load balancer busy, as it was while it returned its 502s."
            },
            {
              "key": "lb-running",
              "label": "Whether the load balancer itself is up and running",
              "why": "A load balancer that is up can still answer 502 to every request. Whether the process runs says nothing about what users received, so the SLI counts the answers, not the uptime."
            }
          ]
        }
      }
    ]
  }
};
