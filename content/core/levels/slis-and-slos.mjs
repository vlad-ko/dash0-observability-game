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
              "key": "successful-share",
              "label": "Completed checkouts divided by started checkouts",
              "why": "Completed over started is the same idea as good over valid, in the words of the product: a number between 0 and 1 that does not move with the traffic, with completed and started defined once. An SLO target such as 99.9% can be set against it."
            },
            {
              "key": "failing-share",
              "label": "The fraction of checkout attempts that failed",
              "why": "The Dash0 documentation says an SLI is a ratio of good requests, or of bad ones, to all requests. The failing fraction is the other face of the good one, 100% minus it, and it does not move with the traffic either. An SLO target is then a ceiling on it, such as 0.1%."
            },
            {
              "key": "non-error-share",
              "label": "The percentage of calls to checkout answered without an error",
              "why": "A ratio of the calls with no error to all the calls that count means the same on a quiet night and on a sale day. What counts as an error, and as a call that counts, is decided once, and an SLO target can then be set against the result."
            },
            {
              "key": "cpu",
              "label": "Average CPU use across all the pods that run checkout",
              "why": "CPU use says how busy the machines are, not whether a customer's payment worked. A pod can run cool and fail every request, or run hot and serve them all."
            },
            {
              "key": "mean-latency",
              "label": "Average latency of checkout, in milliseconds",
              "why": "An average of times can look fine while requests fail: a request that fails at once is quick and pulls the mean down. It is also one time, not a share of the requests that worked, so a target such as 99.9% cannot be set against it."
            },
            {
              "key": "peak-rps",
              "label": "Requests per second that checkout handles at its peak",
              "why": "That is traffic. It says how much checkout is asked to do, not how well it does it, and a good day and a bad day can share the same peak."
            },
            {
              "key": "orders-per-day",
              "label": "The count of orders that checkout completes each day",
              "why": "A count of orders follows demand: it falls on a quiet day with nothing wrong and rises on a sale day when many requests fail. Without the attempts to set it against, it cannot say whether the service did well."
            },
            {
              "key": "deploys",
              "label": "How many times a week the team deploys checkout",
              "why": "Deploy frequency measures how the team ships, not what customers get when they pay. A service can deploy daily and fail often, or never deploy and work."
            },
            {
              "key": "mttr",
              "label": "Recovery duration after an incident has been declared",
              "why": "Recovery time measures the response after something broke, and it exists only once there has been an incident. It does not say how many requests worked on an ordinary day."
            },
            {
              "key": "memory",
              "label": "The memory that each checkout pod has in use at its busiest",
              "why": "Memory is a resource, and at best a cause. Customers never feel that number, only whether their request worked."
            },
            {
              "key": "alert-count",
              "label": "The number of alerts that fired across the team this month",
              "why": "How many alerts fire depends on how the rules are written and how noisy they are, not on how many requests worked. A badly tuned rule can push the count up while checkout is fine."
            },
            {
              "key": "total-since-start",
              "label": "Total requests served since the process started",
              "why": "A counter's total only grows until a restart, so it says how long the process has run, not how the service is doing now. A good measure is built from rates over a window."
            },
            {
              "key": "test-pass",
              "label": "The share of unit tests that pass in the checkout repository",
              "why": "Tests show how the code behaved before it shipped, on the cases someone thought of. They say nothing about the real requests customers send, which are what an SLI counts."
            },
            {
              "key": "db-p99",
              "label": "The 99th percentile of database query time over an hour",
              "why": "That is one internal part of a request, and a slow query is a cause the customer may never notice. An SLI describes what the customer got from the whole request, as a share that worked."
            },
            {
              "key": "log-lines",
              "label": "How many log lines checkout writes per minute",
              "why": "Log volume depends on what the code chooses to log and on the traffic. A failing service can be quiet and a healthy one chatty, so the count says nothing about whether requests worked."
            },
            {
              "key": "restarts",
              "label": "Restarts that a checkout pod goes through during a day",
              "why": "A restart is something the platform does. A request can fail with no restart at all, or succeed through many, and the SLI counts the requests customers make."
            },
            {
              "key": "ready-pods",
              "label": "Number of ready pods behind the checkout service",
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
              "label": "The edge access log with one line per response given",
              "why": "The access log at the edge lists every request that reached the load balancer, including the ones it answered with a 502 because no pod was ready. Responses that were not errors over all responses is a good-over-valid ratio taken where users meet the system."
            },
            {
              "key": "ingress-metrics",
              "label": "Metrics the ingress controller keeps, before any routing happens",
              "why": "Counting at the entry point sees a request before the question of whether a pod is ready even arises, so the refused requests are in the total and among the failures of the ratio. That makes it a measure of what users got, not of what checkout handled."
            },
            {
              "key": "front-door-counts",
              "label": "Tallies made at the front door of checkout as requests from customers arrive",
              "why": "A measurement at the point of entry includes the requests that were turned away before reaching the application, which is exactly what a promise to users must count. Anything measured further in is a view of the requests that got through."
            },
            {
              "key": "app-logs",
              "label": "Checkout's application logs, counting the lines marked as errors",
              "why": "A log line is written by code that handled the request, so a request that was refused before it arrived leaves none. Counting error lines gives no total of valid requests either, so no ratio can be made."
            },
            {
              "key": "db-queries",
              "label": "The database's rate of successful queries during the hour",
              "why": "Queries are the application's own work, made after a request has got in, and one request may make several of them. A request turned away at the edge makes none, so the rate stays healthy through the hour that customers saw errors."
            },
            {
              "key": "readiness",
              "label": "Pod readiness probe results, collected every few seconds",
              "why": "A readiness probe asks whether a pod can take traffic, on a schedule of its own, and not whether the requests users sent were answered well. It records that pods were not ready, not how many requests were lost as a share of the valid ones."
            },
            {
              "key": "provider-calls",
              "label": "The success rate of checkout's calls to its payment provider, taken per minute",
              "why": "Those calls happen only after a request has reached checkout, and they show how a dependency behaves. A request that never got past the load balancer makes no call, so the hour with no ready pod is invisible there."
            },
            {
              "key": "client-spans",
              "label": "Client spans that checkout records for its outgoing calls",
              "why": "A client span describes a call that checkout makes to something else, not a request that someone makes to checkout. It cannot count requests that were turned away on the way in."
            },
            {
              "key": "average-of-two",
              "label": "The average of the span-based ratio and the ratio from the load balancer",
              "why": "Averaging two ratios halves the signal of the one that saw the 502s and mixes in the one that is blind to them. A single source that sees every request has to be chosen, not blended."
            },
            {
              "key": "deploy-marker",
              "label": "Whether the last deploy pipeline finished without failing",
              "why": "A finished pipeline says the release was delivered, not that the requests which followed were answered. A deploy can finish cleanly and still leave checkout with no ready pod."
            },
            {
              "key": "support-tickets",
              "label": "The number of support tickets customers wrote this week",
              "why": "Tickets come only from the customers who take the trouble to write, they arrive later, and a count is not a share of the requests. They are a hint that something is wrong, not a measurement of it."
            },
            {
              "key": "pod-cpu",
              "label": "CPU use of the checkout pods during the hour of errors",
              "why": "CPU is a resource. With no ready pod there is hardly any work for it to measure, so it would look calm in the very hour customers saw errors."
            },
            {
              "key": "error-spans-only",
              "label": "Only the spans of checkout that carry an error status, counted over the month",
              "why": "Error spans have no total beside them, so there is no ratio to compute, and they are still spans: a request that was turned away before checkout never made one."
            },
            {
              "key": "status-page",
              "label": "The cloud provider's public status page for the region",
              "why": "A status page says whether the platform is up, in general terms, and not whether your requests were answered. Everything on it can be green while your own deploy leaves no pod ready."
            },
            {
              "key": "sampled-traces",
              "label": "The share of kept traces that carry an error status",
              "why": "A sampler keeps a chosen part of the traces, often favouring errors and slow requests, so the share of errors among the kept ones is not the share among all requests. Traces are also made by instrumented code, and a request that was refused at the edge may leave none."
            },
            {
              "key": "lb-total-rate",
              "label": "The total request rate at the load balancer, in requests per second, across the period",
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
