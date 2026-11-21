// Text of levels/tail-sampling.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
export default {
  "id": "tail-sampling",
  "name": "Tail sampling",
  "sub": "Decide at the end",
  "rewardTitle": "Patient sampler",
  "play": {
    "finish": "You know tail sampling keeps what is wrong by deciding on the whole trace, and that the wait and the traces held in memory are its price. And you compute span metrics before sampling, in a pipeline with no sampling processor, or your rates are wrong.",
    "steps": [
      {
        "intro": "Head sampling kept 1 in 10 of the failures too, so the team moves to tail sampling in the [[gateway]]: the <code>tail_sampling</code> [[processor]] holds the spans of each trace until it can decide on the whole trace. One gateway replica gets {{traces}} new traces a second. The team wants every failed trace ({{error-pct}} of them) and every slow one ({{slow-pct}}, above 2 seconds, the slowest take {{slowest}} seconds), and a healthy baseline. The processor's <code>decision_wait</code> is 30 seconds by default. Each trace held costs {{mib-per-trace}} MiB, and the replica has {{cap}} MiB for it.",
        "question": "Pick the wait and the policies: keep what the team wants and stay within the memory.",
        "tradeoff": {
          "id": "ts-budget",
          "unit": "MiB",
          "hint": "Memory is what the traces cost while the sampler waits to decide on them. Ask how long the slowest trace takes to finish, what every second of waiting costs, and what each policy can only see once the trace is whole.",
          "knobs": [
            {
              "id": "wait",
              "label": "How long <code>decision_wait</code> holds a trace before it decides",
              "options": [
                {
                  "id": "wait-10s",
                  "label": "10 seconds: {{traces}} × 10 × {{mib-per-trace}} MiB = {{mib10}}"
                },
                {
                  "id": "wait-30s",
                  "label": "30 seconds, the default: {{traces}} × 30 × {{mib-per-trace}} MiB = {{mib30}}"
                },
                {
                  "id": "wait-5s",
                  "label": "5 seconds: {{traces}} × 5 × {{mib-per-trace}} MiB = {{mib5}}"
                },
                {
                  "id": "wait-25s",
                  "label": "25 seconds: {{traces}} × 25 × {{mib-per-trace}} MiB = {{mib25}}"
                },
                {
                  "id": "wait-15s",
                  "label": "15 seconds: {{traces}} × 15 × {{mib-per-trace}} MiB = {{mib15}}"
                }
              ]
            },
            {
              "id": "policies",
              "label": "What the <code>tail_sampling</code> policies keep",
              "options": [
                {
                  "id": "errors-slow-baseline",
                  "label": "Status ERROR, latency above 2 seconds, and 5% of all traces by <code>probabilistic</code>: {{errors}} + {{slow}} + about {{base}} more = {{kept}} of {{traces}} traces/s"
                },
                {
                  "id": "errors-slow",
                  "label": "Traces with status ERROR and traces with latency above 2 seconds, nothing else: {{errors-slow}} of {{traces}} traces/s, all of them failed or slow"
                },
                {
                  "id": "probabilistic",
                  "label": "A <code>probabilistic</code> policy at 10% of all traces: {{tenth}} of {{traces}} traces/s, chosen by the trace ID alone"
                },
                {
                  "id": "errors",
                  "label": "Traces with status ERROR, only the failed ones: {{errors}} of {{traces}} traces/s"
                }
              ]
            }
          ],
          "needs": [
            {
              "id": "errors-kept",
              "label": "every failed trace"
            },
            {
              "id": "slow-kept",
              "label": "every slow trace"
            },
            {
              "id": "baseline-kept",
              "label": "a sample of healthy traces to compare against"
            },
            {
              "id": "whole-traces",
              "label": "a decision made on the whole trace, even one that takes {{slowest}} seconds"
            }
          ],
          "whyNot": {
            "wait:wait-5s": "A trace that takes {{slowest}} seconds is still running when the 5 seconds are up, so the processor decides on part of it. A late span can cause different sampling decisions for different parts of the same trace.",
            "wait:wait-10s": "A trace that takes {{slowest}} seconds is still running when the 10 seconds are up, so the processor decides on part of it, and the rest arrives late.",
            "wait:wait-15s": "The slowest traces take {{slowest}} seconds, so 15 seconds still decides on part of them and the rest arrives late. Cheap, and not whole.",
            "wait:wait-30s": "It sees every trace whole, and {{held30}} traces held is {{mib30}} MiB: over the {{cap}} MiB the replica has, whichever policies are set, and {{mib-extra}} MiB more than the {{slowest}}-second traces need.",
            "policies:errors": "It keeps what failed and drops the slow traces and every healthy one: no slow checkout to open, and nothing fine to compare a failing trace with.",
            "policies:errors-slow": "It keeps what is wrong and nothing that is fine, so there is no healthy trace to compare a failing one with. A small probabilistic policy next to the other two adds one.",
            "policies:probabilistic": "A content-blind 10%, like head sampling done later: it keeps about 1 in 10 of the failed traces and 1 in 10 of the slow ones, and tail sampling exists to do better than that."
          },
          "explain": "The wait is what costs: {{traces}} new traces a second, each held for the 25-second <code>decision_wait</code>, is {{held25}} traces at once, under the default <code>num_traces</code> of {{num-traces}}, and {{slowest}} seconds is the slowest trace, so a 25-second wait decides on the whole trace with room to spare. Every second beyond that is memory spent for nothing: the 30-second default would be {{mib-extra}} MiB more. The policies cost nothing extra in this table, because with the default <code>trace-complete</code> sampling strategy the processor holds every trace until it decides, whichever policies you set. They keep {{errors}} failed and {{slow}} slow traces a second and {{base}} healthy ones, {{kept}} of {{traces}}, a saving of about {{saving}} of the traces, and they can only choose that way because they decide on the whole trace. The price is a stateful component that all spans of a trace must reach, which is why 5.4 sent them there by trace ID. A span that arrives after the decision is late, and can get a different decision from the rest of its trace. These figures come from one authored table, not a measurement; the real per-trace size depends on your spans."
        }
      },
      {
        "intro": "The same gateway computes request and error rates from spans with one <code>span_metrics</code> connector, and a metrics pipeline sends them to the dashboards. Since the <code>tail_sampling</code> processor went in, the dashboards are wrong: the request rate fell to a tenth and the error ratio jumped. It also counts spans with a <code>count</code> connector. Here are the gateway's pipelines, one field of one pipeline per line, each pipeline named for where it sends; the definitions of the components are not shown.",
        "question": "Spot the two lines that together make the span_metrics connector count the wrong spans.",
        "spot": {
          "id": "ts-spot",
          "lines": [
            {
              "id": "metrics-receivers",
              "text": "service: {pipelines: {metrics/dash0: {receivers: [span_metrics, count]}}}"
            },
            {
              "id": "archive-processors",
              "text": "service: {pipelines: {traces/archive: {processors: [probabilistic_sampler, batch]}}}"
            },
            {
              "id": "count-processors",
              "text": "service: {pipelines: {traces/count: {processors: [batch]}}}"
            },
            {
              "id": "traces-processors",
              "text": "service: {pipelines: {traces/dash0: {processors: [tail_sampling]}}}"
            },
            {
              "id": "metrics-processors",
              "text": "service: {pipelines: {metrics/dash0: {processors: [batch/span_metrics]}}}"
            },
            {
              "id": "count-exporters",
              "text": "service: {pipelines: {traces/count: {exporters: [count]}}}"
            },
            {
              "id": "traces-receivers",
              "text": "service: {pipelines: {traces/dash0: {receivers: [otlp]}}}"
            },
            {
              "id": "archive-exporters",
              "text": "service: {pipelines: {traces/archive: {exporters: [otlp_grpc/archive]}}}"
            },
            {
              "id": "traces-exporters",
              "text": "service: {pipelines: {traces/dash0: {exporters: [otlp_grpc/dash0, span_metrics]}}}"
            },
            {
              "id": "metrics-exporters",
              "text": "service: {pipelines: {metrics/dash0: {exporters: [otlp_grpc/dash0, debug/span_metrics]}}}"
            }
          ],
          "whyNot": {
            "metrics-receivers": "This is the receiving end of both connectors, a metrics pipeline: a connector has to be received somewhere, or the Collector will not start. What the connector counts is decided before its metrics arrive here.",
            "metrics-processors": "A batch processor, named for the span metrics it batches, only groups metrics before they are sent. The spans were counted before the metrics reach it, so it cannot change what the connector counts.",
            "metrics-exporters": "This sends the metrics on, to the backend and to a debug exporter that prints them. By then the spans are counted, so it cannot change what the connector counts.",
            "count-processors": "This pipeline only batches its spans: no processor here drops one, so the count connector at its end counts every span.",
            "count-exporters": "This pipeline ends in a connector too, the count connector, which counts spans. Nothing before it in this pipeline drops a span, so its count is the real one.",
            "archive-processors": "probabilistic_sampler keeps a random share of the spans it sees, each decided on its own, with no state kept between spans, unlike the sampler that waits for whole traces. Its cut stays in this pipeline, which ends in an archive of its own and lists no connector.",
            "archive-exporters": "This sends the sample to an archive of its own and lists no connector, so nothing in this pipeline reaches the span metrics.",
            "traces-receivers": "A receiver can be listed in more than one pipeline, so every traces pipeline can read the same otlp receiver and get every span. Getting every span is not what makes a count wrong."
          },
          "explain": "A connector is an exporter at the end of one [[pipeline]] and a receiver at the start of another, so it counts what comes out of the processors of the pipeline that exports to it. Two lines of <code>traces/dash0</code> do it together, and neither is wrong alone: its processors list <code>tail_sampling</code>, which is how a pipeline samples what it sends to a backend, and its exporters list <code>span_metrics</code>, which a connector needs. Because <code>tail_sampling</code> runs first, <code>span_metrics</code> gets only the spans of the traces it kept: {{kept}} of {{traces}} traces a second with the policies you picked in the last step. The request rate it computes is {{kept}} of every {{traces}}, not all of them, and the error ratio is {{errors}} of {{kept}}, {{error-share}}%, not the real {{error-pct}}, because the sampler kept every error and few of the rest. The other two traces pipelines each have one half: <code>traces/count</code> ends in a connector but samples nothing, so <code>count</code> sees the spans of all {{traces}} traces a second, and <code>traces/archive</code> samples but ends in no connector. The two lines are the fault because of how they meet in one pipeline, so the fix keeps them apart rather than making either one wrong: <code>tail_sampling</code> stays in the processors of <code>traces/dash0</code>, and <code>span_metrics</code> moves to a pipeline whose processors list no sampler. Compute span metrics before sampling: give the connector its own traces pipeline with no sampling processor, <code>traces/metrics</code>, with <code>exporters: [span_metrics]</code>. Then take <code>span_metrics</code> out of the exporters of <code>traces/dash0</code>, so <code>traces/metrics</code> is the only pipeline that feeds it. It is still one span_metrics connector, received by <code>metrics/dash0</code>: the README warns that several pipelines using one instance, or several instances writing the same metrics, can conflict or lose series. A receiver can be listed in more than one pipeline, so every traces pipeline can read the same <code>otlp</code> receiver. The connector was renamed from <code>spanmetrics</code> to <code>span_metrics</code>; the old name still works and is deprecated. This step grades the lines you select, not a parsed config: it does not check that the pipelines are wired."
        }
      }
    ]
  }
};
