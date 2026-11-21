// Text of levels/errors-tripled.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
export default {
  "id": "errors-tripled",
  "name": "Errors tripled overnight",
  "sub": "The ratio moved, the errors did not",
  "rewardTitle": "Honest denominator",
  "play": {
    "finish": "The ratio tripled while the error count and the load balancer did not move: a tail_sampling processor sat ahead of the span_metrics connector. A sampler that keeps every error and a share of the rest leaves the numerator complete and the denominator small, so compute span metrics before sampling.",
    "steps": [
      {
        "intro": "The checkout dashboard shows the error ratio at {{after}}, three times yesterday's {{before}}, and the load balancer's request rate is flat. Start with the numbers, then find what changed.",
        "incident": {
          "id": "errors-tripled",
          "alert": {
            "title": "Error ratio tripled overnight",
            "html": "<p>PAGE 07:30: the checkout error ratio is {{after}}, up from {{before}} yesterday: it tripled overnight, since 02:05. The alert names no cause. Find it before the error budget runs out.</p>"
          },
          "views": [
            {
              "id": "rate-vs-lb",
              "label": "Request rate: load balancer and span metrics",
              "html": "<p>Requests a second, at 01:00 and at 06:00:</p><table><caption>Requests a second</caption><thead><tr><th scope=\"col\">Source</th><th scope=\"col\">01:00</th><th scope=\"col\">06:00</th></tr></thead><tbody><tr><td>Load balancer</td><td>{{requests}}</td><td>{{requests}}</td></tr><tr><td>Span metrics (<code>traces.span.metrics.calls</code>)</td><td>{{requests}}</td><td>{{kept}}</td></tr></tbody></table><p>The load balancer is flat, and the span-metric rate fell {{drop}}% at 02:05.</p>"
            },
            {
              "id": "error-count",
              "label": "Error count and error ratio",
              "html": "<p>Failed requests a second (span metrics, <code>status.code</code> Error), and the ratio, at 01:00 and at 06:00:</p><table><caption>Errors</caption><thead><tr><th scope=\"col\">Measure</th><th scope=\"col\">01:00</th><th scope=\"col\">06:00</th></tr></thead><tbody><tr><td>Failed requests a second</td><td>{{errors}}</td><td>{{errors}}</td></tr><tr><td>Error ratio</td><td>{{before}}</td><td>{{after}}</td></tr></tbody></table><p>The error count did not move; only the ratio did.</p>"
            },
            {
              "id": "collector-diff",
              "label": "Collector config change",
              "html": "<p>Gateway Collector config, applied at 02:04:</p><pre><code>   receivers:\n     otlp:\n       protocols:\n         grpc:\n   processors:\n     memory_limiter: {check_interval: 1s, limit_mib: 400, spike_limit_mib: 100}\n     batch:\n+    tail_sampling:\n+      policies:\n+        - {name: errors, type: status_code, status_code: {status_codes: [ERROR]}}\n+        - {name: rest, type: probabilistic, probabilistic: {sampling_percentage: {{keep-pct}}}}\n   exporters:\n     otlp_grpc/dash0:\n       endpoint: ${env:DASH0_ENDPOINT}\n   connectors:\n     span_metrics:\n   service:\n     pipelines:\n       traces:\n         receivers: [otlp]\n-        processors: [memory_limiter, batch]\n+        processors: [memory_limiter, tail_sampling, batch]\n         exporters: [otlp_grpc/dash0, span_metrics]\n       metrics/spans:\n         receivers: [span_metrics]\n         processors: [batch]\n         exporters: [otlp_grpc/dash0]</code></pre>"
            },
            {
              "id": "collector-health",
              "label": "Gateway Collector health",
              "html": "<p>The one gateway pod is Ready, with no restarts in 24 hours and memory at 38% of the limit. The Collector is healthy.</p>"
            },
            {
              "id": "backend-ingest",
              "label": "Ingestion at the backend",
              "html": "<p>The backend shows no rejected requests and no errors. It accepts everything the gateway sends.</p>"
            },
            {
              "id": "payments-deploy",
              "label": "Payments deploys",
              "html": "<p><code>payments</code> v2.14 was deployed at 02:20. The error ratio had already jumped at 02:05.</p>"
            },
            {
              "id": "provider-blip",
              "label": "Payment provider status",
              "html": "<p>The provider reported an incident from 03:30 to 03:40: failed requests rose to {{blip}} a second and were back to {{errors}} by 03:45. The ratio at 03:00 was already {{after}}.</p>"
            }
          ],
          "hypotheses": [
            {
              "id": "metrics-after-sampling",
              "label": "The <code>span_metrics</code> connector counts after sampling and skews the checkout ratio",
              "why": "The change at 02:04 put <code>tail_sampling</code> in the pipeline that feeds <code>span_metrics</code>. Its policies keep all {{errors}} errors a second and {{keep-pct}}% of the other {{healthy}}, so the [[connector]] counts {{kept}} of {{requests}} requests: the rate falls {{drop}}%, the ratio is {{errors}} / {{kept}} = {{after}}, and the load balancer, which sees all {{requests}}, has not moved. The sampler drops {{drop-pct}}% of the healthy traces."
            },
            {
              "id": "payments-regression",
              "label": "The payments deploy added errors to checkout requests overnight",
              "why": "The error count is {{errors}} a second before and after, and the deploy was at 02:20, fifteen minutes after the ratio moved."
            },
            {
              "id": "traffic-fell",
              "label": "Real traffic fell by two thirds overnight and the dashboard shows it",
              "why": "The load balancer shows {{requests}} requests a second, flat. Only the span-metric rate fell."
            },
            {
              "id": "provider-failing",
              "label": "The payment provider is failing more checkout calls, raising the <code>status.code</code> Error count",
              "why": "Its incident ended at 03:40 and the ratio did not come down. The error count is {{errors}} a second before and after."
            }
          ],
          "hint": "<p>A ratio has two parts. Check which of them moved, and compare the one that moved against a number measured somewhere else.</p>"
        }
      },
      {
        "intro": "The incident is explained. In the review, someone asks how the ratio can triple when the error count did not move.",
        "question": "Why did the ratio move?",
        "choice": {
          "id": "eto-ratio",
          "choices": [
            {
              "key": "counted-after-sampling",
              "label": "The <code>span_metrics</code> connector counts what <code>tail_sampling</code> keeps: all {{errors}} errors but {{kept}} of {{requests}} requests, so the ratio is {{errors}} / {{kept}} = {{after}}, not {{errors}} / {{requests}} = {{before}}",
              "why": "The numerator is complete and the denominator is not, so the ratio is biased up. Compute [[span metrics]] before sampling, in a pipeline with no sampling processor."
            },
            {
              "key": "uniform-sampling",
              "label": "Sampling {{keep-pct}}% of traces thins errors and requests alike, so the <code>span_metrics</code> ratio is unchanged and {{after}} is a dashboard fault, not a real change",
              "why": "That is true of a sampler that keeps the same share of both, like the head sampler in 6.1: {{keep-pct}}% of {{errors}} over {{keep-pct}}% of {{requests}} is still {{before}}. This policy keeps every error and {{keep-pct}}% of the rest, so the shares differ, and the dashboard shows what the connector counted."
            },
            {
              "key": "errors-undercounted",
              "label": "The error count is flat because <code>tail_sampling</code> keeps only {{keep-pct}}% of errors, so the real count is higher and the ratio on the dashboard is wrong too",
              "why": "The <code>status_code</code> policy keeps every error, so the {{errors}} a second is the full count. It is the requests that are missing from the count."
            }
          ]
        }
      }
    ]
  }
};
