// Text of levels/instruments.mjs (docs/CONTENT.md).
export default {
  "id": "instruments",
  "name": "Instruments",
  "sub": "Which one fits",
  "rewardTitle": "Instrument picker",
  "play": {
    "finish": "You can pick the instrument by what the number means, and you know a count belongs in a Counter, not a Gauge.",
    "steps": [
      {
        "intro": "Metrics start in code, with an [[instrument]] you pick. Each one tells the SDK what a number means: whether it only goes up, whether you add it up across pods, whether it is a reading, or one of many values. Kettle & Co's dashboards need eight of them.",
        "question": "Pick a measurement, then say which instrument fits it.",
        "sort": {
          "id": "instr-sort",
          "buckets": [
            {
              "id": "counter",
              "label": "Counter"
            },
            {
              "id": "up-down-counter",
              "label": "UpDownCounter"
            },
            {
              "id": "gauge",
              "label": "Gauge"
            },
            {
              "id": "histogram",
              "label": "Histogram"
            }
          ],
          "items": [
            {
              "id": "orders-placed",
              "label": "Orders placed",
              "why": "It only ever goes up: a Counter takes non-negative increments, here <code>add(1)</code> per order.",
              "whyNot": {
                "histogram": "A histogram keeps the spread of many measured values. An order has no size to measure.",
                "up-down-counter": "Nothing ever subtracts from it: an order that was placed stays placed.",
                "gauge": "A gauge records a reading. Orders arrive one at a time and add up, so a gauge would lose the rate math."
              }
            },
            {
              "id": "warehouse-temp",
              "label": "Temperature in the warehouse, in °C",
              "why": "A current reading that makes no sense to add up: two rooms at 20 °C are not 40 °C. That is a Gauge.",
              "whyNot": {
                "counter": "A counter takes only non-negative increments, and a temperature can fall.",
                "histogram": "A histogram keeps a spread of many separate values. Here there is just one value for the room at any moment.",
                "up-down-counter": "An UpDownCounter is for values you add up across sources. Adding two room temperatures tells you nothing."
              }
            },
            {
              "id": "queue-length",
              "label": "Orders waiting in the order queue",
              "why": "It goes up when an order is queued and down when one is taken, and the lengths from several pods add up to the total waiting. That is an UpDownCounter.",
              "whyNot": {
                "gauge": "A gauge is for values that make no sense to add up. Queue lengths from several pods do add up to the total waiting.",
                "histogram": "A histogram keeps the spread of many separate values. A queue has one length at a time, so there is no spread to keep.",
                "counter": "A queue shrinks, and a Counter can only add non-negative amounts."
              }
            },
            {
              "id": "checkout-duration",
              "label": "How long each checkout request took",
              "why": "Many separate values where the spread matters, such as the slowest 1%. A [[Histogram]] keeps that spread.",
              "whyNot": {
                "counter": "A counter can only add up. It would give a total of the time, with no way to see the slowest 1%.",
                "up-down-counter": "An UpDownCounter keeps a running sum. A total of durations says nothing about how the slow ones are spread.",
                "gauge": "A gauge keeps one sampled value, so a slow tail would vanish behind the last request."
              }
            },
            {
              "id": "payment-declines",
              "label": "Payments declined",
              "why": "Declines are events you count, and the total only grows. That is a Counter.",
              "whyNot": {
                "up-down-counter": "Nothing takes a decline back, so there is never a subtraction to make.",
                "histogram": "A histogram is for values with a spread. A decline has no size or duration to measure.",
                "gauge": "A gauge records a reading. Declines arrive one at a time and add up, so a gauge would lose the rate math."
              }
            },
            {
              "id": "cache-hit-ratio",
              "label": "Cache hit ratio of recommendations, from 0 to 1",
              "why": "A ratio is a reading, and adding two ratios gives nonsense. That is a Gauge.",
              "whyNot": {
                "counter": "A counter adds non-negative amounts. A ratio can fall as well as rise, and adding ratios makes no sense.",
                "up-down-counter": "An UpDownCounter is for values you add up across sources. Two ratios of 0.9 do not make 1.8.",
                "histogram": "It is one current value, not a spread of individual values."
              }
            },
            {
              "id": "active-requests",
              "label": "Requests being handled right now (+1 when one starts, -1 when it ends)",
              "why": "You add and subtract at the edges of each request, and the counts from three pods add up to what is in flight. That is an UpDownCounter.",
              "whyNot": {
                "counter": "A counter takes only non-negative increments. Here the number drops when a request ends.",
                "histogram": "A histogram records many separate values. This is one running total of what is in flight.",
                "gauge": "A gauge is for values that make no sense to sum. In-flight requests from three pods do sum."
              }
            },
            {
              "id": "response-bytes",
              "label": "Size of each response, in bytes",
              "why": "Many separate values where the spread matters, such as the largest responses. A [[Histogram]] keeps that spread.",
              "whyNot": {
                "counter": "A counter only adds up. A total of bytes would hide how big the largest responses are.",
                "up-down-counter": "An UpDownCounter keeps a running sum. Adding sizes up would lose the difference between small and large responses.",
                "gauge": "A gauge keeps one sampled value, so most responses, and the largest ones, would never be seen."
              }
            },
            {
              "id": "accounts-created",
              "label": "Customer accounts created",
              "why": "An account that was created stays created, so the total only grows. A Counter takes non-negative increments, here <code>add(1)</code> per account.",
              "whyNot": {
                "up-down-counter": "Creating an account never takes one away from the total, so there is no decrement to record.",
                "histogram": "A histogram keeps the spread of many measured values. Creating an account has no size or duration to measure.",
                "gauge": "A gauge records a reading. New accounts arrive one at a time and add up, so a gauge would lose the rate math."
              }
            },
            {
              "id": "fan-speed",
              "label": "CPU fan speed of each server in the office, in RPM",
              "why": "A current reading that makes no sense to add up: two fans at 2000 RPM are not one fan at 4000. That is a Gauge.",
              "whyNot": {
                "counter": "A counter takes only non-negative increments, and a fan slows down as well as speeds up.",
                "histogram": "A histogram keeps a spread of many separate values. Here there is one speed for the fan at any moment.",
                "up-down-counter": "An UpDownCounter is for values you add up across sources. Two fan speeds added together tell you nothing."
              }
            },
            {
              "id": "db-connections",
              "label": "Connections the order database pool has open",
              "why": "The count goes up when the pool opens a connection and down when it closes one, and the counts from several pods add up to the total open. That is an UpDownCounter.",
              "whyNot": {
                "gauge": "A gauge is for values that make no sense to add up. Open connections from several pods do add up to the total.",
                "histogram": "A histogram keeps the spread of many separate values. The pool has one count of open connections at a time.",
                "counter": "Connections get closed, and a Counter can only add non-negative amounts."
              }
            },
            {
              "id": "query-duration",
              "label": "Duration of the order database's queries",
              "why": "Many separate values where the spread matters, such as the slowest queries. A Histogram keeps that spread.",
              "whyNot": {
                "counter": "A counter can only add up. It would give the total query time, with no way to see the slow queries.",
                "up-down-counter": "An UpDownCounter keeps a running sum. A total of durations says nothing about how the slow queries are spread.",
                "gauge": "A gauge keeps one sampled value, so the slow queries between samples would vanish."
              }
            },
            {
              "id": "bytes-received",
              "label": "Bytes received by the payments service, in total",
              "why": "Every request adds the bytes it brought in, and the total never goes down. That is a Counter.",
              "whyNot": {
                "up-down-counter": "Bytes that were received stay received, so nothing is ever subtracted from the total.",
                "histogram": "A histogram keeps the spread of separate values. Here you want the running total, which only grows.",
                "gauge": "A gauge records a reading. Bytes arrive with every request and add up, so a gauge would lose the rate math."
              }
            },
            {
              "id": "noise-level",
              "label": "Background noise level on the packing floor, in dB",
              "why": "A reading that makes no sense to sum: noise levels from several rooms added together are not a noise level. That is a Gauge.",
              "whyNot": {
                "counter": "A counter takes only non-negative increments, and the noise level falls as well as rises.",
                "histogram": "A histogram keeps a spread of many separate values. Here there is one noise level on the floor at any moment.",
                "up-down-counter": "An UpDownCounter is for values you add up across sources. Summing the noise levels of several rooms tells you nothing."
              }
            },
            {
              "id": "provider-connections",
              "label": "HTTP connections open to the card provider",
              "why": "Payments opens connections to the provider and later closes them, so the count goes up and down, and the counts from several pods add up. That is an UpDownCounter.",
              "whyNot": {
                "gauge": "A gauge is for values that make no sense to add up. Connections open from several pods do add up to the total.",
                "histogram": "A histogram records many separate values. This is one running count of open connections.",
                "counter": "A connection that closes takes one away from the count, and a Counter only adds."
              }
            },
            {
              "id": "request-body-size",
              "label": "Size of each request body received, in bytes",
              "why": "Many separate values where the spread matters, such as the largest uploads. A Histogram keeps that spread.",
              "whyNot": {
                "counter": "A counter only adds up. A total of bytes would hide how big the largest request bodies are.",
                "up-down-counter": "An UpDownCounter keeps a running sum. Adding sizes up would lose the difference between small and large bodies.",
                "gauge": "A gauge keeps one sampled value, so most request bodies, and the largest ones, would never be seen."
              }
            }
          ]
        }
      },
      {
        "intro": "Instruments come in two kinds. Synchronous ones you call where the event happens, such as <code>add()</code> or <code>record()</code>. Asynchronous (observable) ones take a callback that the SDK runs when it collects. Orders' runtime already keeps its heap size, and you can read it at any time.",
        "question": "How do you report the heap size?",
        "choice": {
          "id": "instr-async",
          "choices": [
            {
              "key": "sync-updown",
              "label": "An <code>UpDownCounter</code> that your code updates with <code>add()</code>, given the change in heap size at each allocation and release",
              "why": "An UpDownCounter you call yourself is for when the current value is not already known, or reading it takes extra effort. Here the runtime already has the number, so reading it on demand is simpler."
            },
            {
              "key": "async-updown",
              "label": "An asynchronous <code>UpDownCounter</code>: register a callback that reads the heap size when the SDK collects",
              "why": "Heap sizes from several processes add up to the total heap in use, so the value is additive, and an asynchronous (observable) instrument runs your callback only when metrics are collected. Additive and readable on demand is an asynchronous UpDownCounter."
            },
            {
              "key": "async-gauge",
              "label": "An asynchronous <code>Gauge</code>: register a callback that reads the heap size when the SDK collects",
              "why": "The callback part is right, but a Gauge is for values that make no sense to add up. Heap sizes from several processes add up to the total heap in use, so the API points additive values to an asynchronous UpDownCounter."
            },
            {
              "key": "observable-updown",
              "label": "An observable <code>UpDownCounter</code>, since heap sizes add up across processes",
              "why": "Heap sizes from several processes add up to the total heap in use, which makes the value additive. Observable is the other name for asynchronous: the SDK runs the callback only when metrics are collected, and the API's own example for it is the process heap size."
            },
            {
              "key": "on-demand-additive",
              "label": "The additive instrument for values like the heap size (its callback runs each time the SDK collects)",
              "why": "That is the asynchronous UpDownCounter. Its callback reports the absolute value, not an increment, and the heap sizes of several processes add up to the total heap in use."
            },
            {
              "key": "sync-gauge",
              "label": "A synchronous <code>Gauge</code>, with <code>record()</code> receiving the new heap size when it moves, so the SDK keeps the last one",
              "why": "A Gauge is for values that make no sense to add up, and heap sizes from several processes add up to the total heap in use, so the API points additive values to an UpDownCounter. The synchronous Gauge is also meant for values you hear about through change events, and the runtime can simply be asked."
            },
            {
              "key": "async-counter",
              "label": "An asynchronous <code>Counter</code>, its callback reading the absolute heap size when the SDK collects",
              "why": "A Counter, in either form, is for values that only grow, such as CPU time. A heap size falls when memory is released, so it does not fit."
            },
            {
              "key": "span-attribute",
              "label": "Put the heap size on the spans as an attribute and chart it from the traces",
              "why": "A span attribute exists only while a request runs, so the chart has no point when traffic stops. A metric is read at every collection, whether requests arrive or not."
            },
            {
              "key": "add-per-minute",
              "label": "An <code>UpDownCounter</code> fed once a minute with the absolute heap size you just read",
              "why": "An UpDownCounter you call yourself takes changes, not current values, so each minute would pile another whole heap onto the total. A value you can read at any time is reported as an absolute number, from a callback."
            },
            {
              "key": "async-add-change",
              "label": "An <code>UpDownCounter</code> observed asynchronously, whose callback passes <code>add()</code> the change since the last collection",
              "why": "The callback of an asynchronous instrument reports the absolute value, not an increment. The change between two collections is worked out afterwards from successive values."
            }
          ]
        }
      },
      {
        "intro": "A teammate reports orders placed with a Gauge that is set to the running total, <code>gauge.record(totalOrders)</code>, and says it works: the number goes up.",
        "question": "What does reporting a count with a Gauge cost you?",
        "choice": {
          "id": "instr-gauge",
          "choices": [
            {
              "key": "same-data",
              "label": "Nothing: a running total is the same data whichever instrument you pick",
              "why": "The instrument decides the kind of [[data point]]. A Gauge point is a sampled value, while a Counter produces a [[monotonic]] [[Sum]] with a start time, and backends treat the two differently."
            },
            {
              "key": "sampled-not-sum",
              "label": "The meaning: the backend sees sampled values, and rate math built for counts does not apply",
              "why": "A gauge point is a sampled value with no aggregation semantic. A [[monotonic]] [[Sum]] also carries a start time, which lets a backend compute a rate that notices restarts, and a sum can be added across series. Report orders with a Counter and call <code>add(1)</code> per order."
            },
            {
              "key": "lost-between",
              "label": "Orders: a gauge keeps one value per interval, and orders between two samples are lost",
              "why": "Nothing is lost that way: the value recorded is the running total, so the last sample still includes every earlier order. What the gauge lacks is meaning, not data."
            },
            {
              "key": "no-aggregation",
              "label": "Adding: a gauge holds the latest reading only, so no total of orders across pods exists",
              "why": "Gauges do not provide an aggregation semantic: the last sample value is used when a backend aligns points in time or lowers the resolution, and a Gauge cannot be assumed to be a sum. A [[monotonic]] [[Sum]] adds across pods, so orders belong in a Counter."
            },
            {
              "key": "start-time",
              "label": "Restarts: a Sum should carry the start time that marks a reset, and a Gauge point may omit it",
              "why": "The start time is strongly recommended on Sum points, because a rate that is aware of restarts needs it, and it is optional on a Gauge point. A running total reported by a Gauge therefore gives the backend nothing it can rely on to tell a restart from a drop."
            },
            {
              "key": "always-delta",
              "label": "Deltas: a gauge reports only what changed since its last report, and the running total is not kept",
              "why": "A Gauge has no aggregation temporality. Only Sum and Histogram points have one, and a Gauge point is the last sampled value, here the running total itself."
            },
            {
              "key": "no-attributes",
              "label": "The split: sampled values drop attributes, which means the rate of all orders shows together",
              "why": "Each Gauge point carries its own set of attributes, like any other point, so a split is possible. What the Gauge lacks is the sum semantic a count needs."
            },
            {
              "key": "rate-any-series",
              "label": "Rates: <code>rate()</code> and <code>increase()</code> give the same result on a gauge as on a counter, whatever sent it",
              "why": "Prometheus says <code>rate()</code> should only be used with counters, because it adjusts for the resets of a counter. A series that arrives as a Gauge has no such guarantee, so the result can be wrong."
            },
            {
              "key": "total-suffix",
              "label": "Naming: a Gauge is exported with a <code>_total</code> suffix, so queries for each count find nothing",
              "why": "The <code>_total</code> suffix is added to a [[monotonic]] [[Sum]], which becomes a Prometheus counter. A Gauge becomes a Prometheus gauge and keeps its name."
            },
            {
              "key": "thread-safety",
              "label": "Safety: recording to a Gauge from several threads is not supported, and concurrent orders corrupt the total",
              "why": "The Metrics API requires every Instrument method to be safe for concurrent use by default, so concurrent calls do not corrupt a value. The problem is meaning, not safety."
            },
            {
              "key": "no-unit",
              "label": "Units: a Gauge cannot have a unit, and the orders show up without one",
              "why": "The unit is an optional property of every instrument, and the API's own Gauge example sets one. A Gauge of orders can carry a unit, so the problem is the meaning of its value."
            },
            {
              "key": "decimals-only",
              "label": "Whole numbers: a Gauge records decimals only, and a count of orders is stored as a fraction",
              "why": "The API has integer and floating-point forms of the Gauge, such as the UInt64 and double variants of its creation call, so a count can be recorded as a whole number."
            },
            {
              "key": "callback-only",
              "label": "The form: a Gauge is observed by the SDK, which makes a handler that records to it a mistake",
              "why": "The Gauge is a synchronous instrument: you record to it where a change happens, and the API's own example does so. The callback form is the Asynchronous Gauge, a different instrument."
            },
            {
              "key": "resets-to-zero",
              "label": "Zeroing: each report empties the Gauge, so the next sampled value is only what came since",
              "why": "A Gauge point is the last sampled value for its time window, so the running total is reported as it is and nothing resets it to zero."
            }
          ]
        }
      }
    ]
  }
};
