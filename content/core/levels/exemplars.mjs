// Text of levels/exemplars.mjs (docs/CONTENT.md).
// When editing the point lines, keep their placement rule: no blind tell (count, sum, length, digits, words) separates answers from decoys; see the header of levels/exemplars.mjs, enforced by test/spot-tells.test.mjs.
export default {
  "id": "exemplars",
  "name": "Exemplars",
  "sub": "From a point to a trace",
  "rewardTitle": "Exemplar spotter",
  "play": {
    "finish": "You can tell a point with an exemplar from one without: an exemplar is one recorded measurement with the ids of its span, and by default only a measurement recorded in a sampled span can become one.",
    "steps": [
      {
        "intro": "Charges got slow on Kettle &amp; Co at 09:14:30. The payments histogram <code>payments.charge.duration</code> shows the spike, and an engineer wants to jump from a point to a trace of one slow charge. A point can link to traces through its exemplars: each is a recorded measurement with the <code>trace_id</code> and <code>span_id</code> of the span it was recorded in. Payments traces are sampled, so only some requests are recorded. A debug view prints each point and its exemplar field.",
        "question": "Spot the points that carry an exemplar.",
        "spot": {
          "id": "exm-spot",
          "hint": "An exemplar is not part of the series and does not come with a big number: ask where a point would carry one.",
          "lines": [
            {
              "id": "pay-0914-00",
              "text": "09:14:00 payments.charge.duration{route=\"/pay\"} count=14 sum=4.31s min=0.19s max=0.52s exemplar: none"
            },
            {
              "id": "pay-0914-15",
              "text": "09:14:15 payments.charge.duration{route=\"/pay\"} count=13 sum=3.39s min=0.21s max=0.50s exemplar: value=0.28s trace_id=ae926589c1fd4adc8eeaeb2bfcb0d19c span_id=b7adcbfe6920dc31"
            },
            {
              "id": "refund-batch",
              "text": "09:14:30 payments.charge.duration{route=\"/refund-batch\", job=\"settlement-sweep\", cloud_region=\"eu-west-1\", instance_id=\"10.244.103.117:9464\", build_id=\"20241102\"} count=4 sum=17.38s min=2.31s max=6.80s exemplar: none"
            },
            {
              "id": "pay-0914-30",
              "text": "09:14:30 payments.charge.duration{route=\"/pay\"} count=11 sum=34.52s min=0.34s max=6.12s exemplar: value=0.41s trace_id=3b7e51d09a84c2f6e1470bd8a35c9f12 span_id=6e0d41a9c85b27f3 exemplar: value=6.12s trace_id=ecddaaffc7bfdda6a3ce9f9dcebec436 span_id=00f0c7aa0bacf2b7"
            },
            {
              "id": "pay-label",
              "text": "09:14:45 payments.charge.duration{route=\"/pay\", cloud_region=\"eu-west-1\", build_id=\"2411\", trace_id=\"7d1e0b6a94c2f35880ad41c6be92f07d\", span_id=\"c4a1e5d27b903f68\"} count=1 sum=5.40s min=5.40s max=5.40s exemplar: none"
            },
            {
              "id": "pay-0914-45",
              "text": "09:14:45 payments.charge.duration{route=\"/pay\"} count=10 sum=41.83s min=0.40s max=7.35s exemplar: none"
            },
            {
              "id": "pay-0915-00",
              "text": "09:15:00 payments.charge.duration{route=\"/pay\"} count=9 sum=36.17s min=0.47s max=5.47s exemplar: value=0.52s trace_id=91c4a8e2d7b6035f4ea1c9d82b70f6a3 span_id=d3159b6c0e7a48f2 exemplar: value=2.84s trace_id=5fa07d3c1e9b46a8b2d80c7f4136e95a span_id=08e6b2f4a1c937d5 exemplar: value=5.47s trace_id=fccad9972863abf3deeabec3b1afc60c span_id=eeeb9b7ec3cfb174"
            },
            {
              "id": "pay-0915-15",
              "text": "09:15:15 payments.charge.duration{route=\"/pay\"} count=12 sum=3.90s min=0.22s max=0.61s exemplar: none"
            }
          ],
          "whyNot": {
            "pay-0914-00": "The exemplar field says none: nothing here to follow to a trace. A point is linked only when that field holds a trace_id and a span_id, spike or no spike.",
            "pay-0914-45": "This point is on the spike and its exemplar field says none. A high value does not bring an exemplar with it, so there is no trace to jump to from this point.",
            "pay-0915-15": "The spike is over and the field says none: no exemplar, so no link from this point.",
            "refund-batch": "A job started by a scheduler, not by a request, and its point says none: no exemplar, so no link.",
            "pay-label": "The trace ID and span id here are [[labels]] of the series, not an exemplar: a label makes a series of its own for every value, and an exemplar sits beside the point, in its own field. This point's field says none."
          },
          "explain": "Three points carry exemplars. Each exemplar is one measurement recorded in that window, with its value, the <code>trace_id</code> and the <code>span_id</code> of the span it was recorded in, and a point can carry more than one: two of the spike points carry two and three. The value is one measurement, not the point's sum, and an exemplar can sit on an ordinary point as well as on the spike: the point at 09:14:15 has one, and the spike point at 09:14:45, with ten charges and a 7.35s slowest one, has none. The trace ID and span id in series [[labels]] do not link anything, and the scheduled job has no exemplar either."
        }
      },
      {
        "intro": "Payments runs a current SDK with its exemplar settings left alone. Yet most points, on the spike too, have no exemplar.",
        "question": "Why do the other points have none?",
        "choice": {
          "id": "exm-why",
          "choices": [
            {
              "key": "errors-only",
              "label": "SDKs only keep exemplars for slow or failing requests, and ordinary points have none",
              "why": "The filters an SDK has to support are AlwaysOn, AlwaysOff and TraceBased, and none of them looks at errors or at how slow a measurement is. The first exemplar on the list is an ordinary 0.28 s charge, and a spike point has none."
            },
            {
              "key": "unsampled-or-no-span",
              "label": "Those measurements were recorded outside any span, or inside a span that was not sampled",
              "why": "Exemplar sampling is on by default with the TraceBased filter: only a measurement recorded in the context of a sampled span is eligible to become an exemplar. A measurement from a scheduled job has no active span, and one from a request whose trace was not sampled has a span that is not sampled, so neither is eligible. The reservoir then makes the final decision and may keep fewer still. <code>OTEL_METRICS_EXEMPLAR_FILTER</code> can be set to <code>always_on</code> or <code>always_off</code>, and the default is <code>trace_based</code>."
            },
            {
              "key": "backend-dropped",
              "label": "The backend dropped the exemplars after the points arrived",
              "why": "Exemplars are chosen in the SDK while measurements are recorded: the filter decides which measurements are eligible and the reservoir which are kept, and the kept ones leave the SDK in the metric data point. A point that left the SDK with none has none to lose."
            },
            {
              "key": "trace-based-default",
              "label": "By default the SDK takes exemplars from sampled traces, so every other histogram point lacks one that links it to a trace you could open",
              "why": "The default exemplar filter is TraceBased: it makes eligible only the measurements recorded in the context of a sampled parent span. Every other measurement is out, whatever its value or its place on the spike. The reservoir then makes the final decision among the eligible ones."
            },
            {
              "key": "job-and-unsampled",
              "label": "A scheduled job has no span and a skipped request has an unsampled span: neither gives a point an exemplar",
              "why": "The trace ID and span ID of an exemplar are those of the active span when the measurement is recorded. With no span there are none to attach, and a span that is not sampled does not pass the TraceBased filter, which is the default."
            },
            {
              "key": "off-by-default",
              "label": "Exemplar sampling is off by default, so a point gets one when its service turned it on for spans that are sampled",
              "why": "An SDK should have exemplar sampling on by default, with the TraceBased filter. Three of the points here carry exemplars and nothing was changed, so it was on."
            },
            {
              "key": "otlp-no-slot",
              "label": "OTLP has no field for a span_id beside a histogram point, so a recorded exemplar from a sampled span never leaves the exporter",
              "why": "A histogram data point has an exemplars field, and an exemplar holds the trace ID and span ID of the span it was recorded in. A point that left the SDK with none had none, and the three points on this list that carry one arrived with it."
            },
            {
              "key": "folded-away",
              "label": "A histogram folds every recorded measurement into counts and a sum: no sampled request or span is left at all",
              "why": "Exemplars exist for exactly that case: they keep a few recorded measurements beside the aggregate, with the attributes the aggregation dropped and the ids of the span. A point can hold several, as the spike points here do."
            },
            {
              "key": "counters-only",
              "label": "Just counters and gauges can carry an exemplar: a histogram point has no slot for one, whatever span it came from",
              "why": "Sum, gauge, histogram and exponential histogram data points all have an exemplars field. The points in this level are histogram points, and three of them carry exemplars."
            },
            {
              "key": "reservoir-unsized",
              "label": "Even a measurement made inside a span that is sampled is lost, because the reservoir has to be sized by hand and no size was set",
              "why": "An SDK includes two built-in reservoirs and picks one by the aggregation, so no hand sizing is needed. With the settings left alone, a measurement from a sampled span can be kept, as three points here show."
            }
          ]
        }
      }
    ]
  }
};
