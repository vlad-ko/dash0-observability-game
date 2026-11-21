// Text of levels/what-costs-money.mjs (docs/CONTENT.md). {{name}} is a figure from the level's VARS table.
export default {
  "id": "what-costs-money",
  "name": "What costs money",
  "sub": "Know what the meter counts",
  "rewardTitle": "Bill reader",
  "play": {
    "finish": "You know what each pricing model counts: hosts, bytes or signals. Volume, cardinality and retention drive the bill, sampling is the lever on volume, and the model decides whether size or count is the thing to cut.",
    "steps": [
      {
        "intro": "Kettle & Co is choosing where to send its telemetry, and the price lists differ in what they count. Whatever the meter counts is what you optimise, so the first thing to find out is what that is. Three drivers sit behind every model: how much you send (volume), how many [[series|time-series]] your metrics make (cardinality) and how long you keep it (retention). [[Sampling]] is the lever on volume. The first vendor charges a flat amount for each <b>host</b> that sends telemetry.",
        "question": "Under per-host pricing, which change lowers the bill?",
        "choice": {
          "id": "wcm-host",
          "choices": [
            {
              "key": "drop-debug",
              "label": "Drop the debug logs on the hosts, so that fewer log lines go out",
              "why": "Under per-host metering the bill follows the number of hosts, not the telemetry each one sends, so fewer log lines change nothing on the invoice. They can still cost you elsewhere: network, a Collector that has to process them, and a slower search."
            },
            {
              "key": "fewer-hosts",
              "label": "Run the same workload on fewer, larger hosts",
              "why": "The bill counts hosts, so consolidating them is the lever. The flip side is that a host can send as much telemetry as it likes at no extra charge, so nothing in the bill pushes you to trim volume."
            },
            {
              "key": "sample",
              "label": "Sample 10% of traces on the hosts, to send fewer spans",
              "why": "Sampling reduces what is sent and stored, which matters when the price follows volume. A per-host price does not move with it."
            },
            {
              "key": "short-keys",
              "label": "Shorten the attribute names on the hosts to make the records smaller",
              "why": "Size matters when bytes are metered. A per-host price ignores both the size and the number of records."
            },
            {
              "key": "consolidate-vms",
              "label": "Merge the services of three small VMs onto a single larger VM",
              "why": "Each VM is a host to the meter, so three become one on the bill, whatever telemetry the services send. The telemetry itself is unchanged, so what you pay for storage or network stays as it was."
            },
            {
              "key": "retire-idle",
              "label": "Switch off the idle hosts, or stop them from sending any telemetry whatsoever",
              "why": "The meter counts hosts that send telemetry, so a host that is gone, or that sends nothing, drops off the bill. A host that sends one log line a day is charged the same as a busy one."
            },
            {
              "key": "split-hosts",
              "label": "Split each large host into several small ones to spread the load",
              "why": "More hosts is more units on a per-host bill, and each one is charged the same flat amount however small it is. Spreading the load can help the application and still raise the invoice."
            },
            {
              "key": "longer-interval",
              "label": "Export metrics from the hosts every 5 minutes instead of every 30 seconds",
              "why": "A longer interval makes fewer data points, which matters when the meter counts signals. A per-host price counts hosts, and every host still sends."
            },
            {
              "key": "cut-cardinality",
              "label": "Remove the user ID label from the metrics the hosts send",
              "why": "Every combination of label values is another time series, so cardinality drives cost where the price follows volume. A per-host price does not follow the number of series, only the number of hosts."
            },
            {
              "key": "shorter-retention",
              "label": "Keep the telemetry from the hosts for 30 days, not 90",
              "why": "Retention multiplies the volume you store, so it matters where storage is paid for. A flat amount for each host does not depend on how long the data is kept, and the number of hosts has not changed."
            },
            {
              "key": "tail-sample",
              "label": "Tail-sample in the Collector on the hosts so that only errors and slow traces go on to the vendor",
              "why": "Sampling is a lever on volume, and the OpenTelemetry docs call it one of the most effective ways to reduce the cost of observability. It does not remove a host, and a per-host bill counts hosts."
            },
            {
              "key": "filter-health",
              "label": "Filter the health-check spans out in the Collector on the hosts",
              "why": "The spans that are filtered out are fewer to send and store, and the hosts that sent them still send. The per-host bill has the same number of units."
            },
            {
              "key": "compress",
              "label": "Turn on compression on the hosts' exporters",
              "why": "Compression makes what is sent smaller, which matters when bytes are the meter. A per-host price ignores the size of what each host sends."
            },
            {
              "key": "host-per-service",
              "label": "Give each new service a host of its own, so its telemetry is easy to tell apart",
              "why": "Each extra host is another unit on the bill, and the flat amount does not shrink because a host runs only one service. Telling the telemetry apart is what a service name is for."
            },
            {
              "key": "cut-bodies",
              "label": "Cut the request and response bodies out of every log line on the hosts",
              "why": "Smaller lines help when bytes are the meter. A per-host price does not move with the size of a record, and the hosts that send them are still there."
            },
            {
              "key": "delete-dashboards",
              "label": "Delete the dashboards nobody opens",
              "why": "A dashboard reads data that has already been sent, and it is not a host. The number of hosts sending telemetry is the same after the clean-up as before."
            },
            {
              "key": "one-service-metrics",
              "label": "Stop the metrics of one service on a host that still sends its logs and traces",
              "why": "A host that sends any telemetry is one unit, and this host still sends some. Only when it stops sending altogether does it leave a per-host bill."
            },
            {
              "key": "downsize",
              "label": "Move every host to a smaller instance type",
              "why": "The flat amount is for each host, not for each unit of its size, so a smaller host is charged the same. Any saving is on the cloud bill for the machines, and that is a different bill."
            },
            {
              "key": "filter-after",
              "label": "Add a filter that drops the noisy telemetry once it has reached the vendor",
              "why": "Filtering changes what is kept, and the hosts that sent the data are still sending it. A per-host price follows hosts, not the amount of data that survives."
            },
            {
              "key": "delete-alerts",
              "label": "Delete half of the alert rules",
              "why": "An alert rule reads telemetry that is already there, and it is not a host. The number of hosts that send telemetry has not changed."
            }
          ]
        }
      },
      {
        "intro": "The second vendor charges per <b>GB</b> sent. The budget is {{gb-cap}} GB sent a day. Sending every span would be 120 GB a day, and every request and response body in every log line 80. The costs are invented, and each option shows the GB it adds.",
        "question": "Pick a setting for each of the two: keep every need and stay within the budget.",
        "tradeoff": {
          "id": "wcm-gb",
          "unit": "GB per day",
          "hint": "The meter here is bytes a day. Ask where the bytes in a log line are, and what each choice sends of them.",
          "knobs": [
            {
              "id": "traces",
              "label": "Traces",
              "options": [
                {
                  "id": "head-25",
                  "label": "Head-sample 25% at the SDK"
                },
                {
                  "id": "tail",
                  "label": "Tail-sample in the Collector: errors, slow traces and a few more"
                },
                {
                  "id": "head-1",
                  "label": "Head-sample 1% at the SDK"
                },
                {
                  "id": "errors-only",
                  "label": "Tail-sample in the Collector: keep the failed traces and nothing else"
                },
                {
                  "id": "head-10",
                  "label": "Head-sample 10% at the SDK"
                }
              ]
            },
            {
              "id": "logs",
              "label": "Logs",
              "options": [
                {
                  "id": "full",
                  "label": "Every request and response body in every log line"
                },
                {
                  "id": "warn",
                  "label": "Error and warning lines, with the bodies"
                },
                {
                  "id": "half",
                  "label": "Every second log line, with the bodies"
                },
                {
                  "id": "trimmed",
                  "label": "Every log line, with the bodies cut out"
                },
                {
                  "id": "errors-only",
                  "label": "Error lines only, with the bodies"
                }
              ]
            }
          ],
          "needs": [
            {
              "id": "slow-traces",
              "label": "the trace of every slow or failed request"
            },
            {
              "id": "incident-logs",
              "label": "enough log lines to explain an incident"
            },
            {
              "id": "error-detail",
              "label": "the reason a request failed"
            }
          ],
          "whyNot": {
            "traces:head-25": "A fixed 25% is picked without looking at the trace, so three in four slow or failed requests are thrown away with the healthy ones.",
            "traces:head-1": "A fixed 1% is picked without looking at the trace, so almost every slow or failed request is thrown away with the healthy ones.",
            "traces:head-10": "A fixed 10% is picked without looking at the trace, so nine in ten slow or failed requests are thrown away with the healthy ones.",
            "traces:errors-only": "The failed traces explain why a request failed, and a slow trace that did not fail is gone.",
            "logs:full": "The bodies are most of the bytes. When bytes are the meter, a few large fields cost more than many short lines.",
            "logs:half": "Half the lines, and the bodies are still in the rest: 40 GB, and with the traces the plan is over the budget. The bytes are in the bodies, not in the count.",
            "logs:warn": "The warning and error lines explain why a request failed, and the lines around an incident that are neither are gone.",
            "logs:errors-only": "The error lines explain why a request failed, and the lines around an incident that are not errors are gone."
          },
          "explain": "When the meter is bytes, size is the lever as much as count: cutting the bodies out of the logs takes them from 80 to 30 GB with every line kept, where halving the number of lines would only take them from 80 to 40. The failed traces already say why a request failed, so the logs do not need the bodies for that. Sampling is the other lever, and the OpenTelemetry docs call it one of the most effective ways to reduce the cost of observability, with costs of its own. Retention multiplies all of it: data kept for ninety days is stored three times as long as data kept for thirty, so what you store is the daily volume times the days you keep it. The numbers are made up for this level."
        }
      },
      {
        "intro": "The third vendor charges per <b>signal</b>: each span, [[log record]] and metric data point is one, however large. The budget is {{signal-cap}} cost units a day. The costs are invented, and each option shows the units it adds.",
        "question": "Pick a setting for each of the three: keep every need and stay within the budget.",
        "tradeoff": {
          "id": "wcm-signal",
          "unit": "cost units per day",
          "unitOne": "cost unit per day",
          "hint": "The meter here counts signals: spans, log records and metric data points, not how big each one is. Ask what changes the number of records, spans and data points that go out.",
          "knobs": [
            {
              "id": "interval",
              "label": "Metric export interval",
              "options": [
                {
                  "id": "s30",
                  "label": "Every 30 seconds"
                },
                {
                  "id": "m5",
                  "label": "Every 5 minutes"
                },
                {
                  "id": "s10",
                  "label": "Every 10 seconds"
                },
                {
                  "id": "s60",
                  "label": "Every 60 seconds"
                },
                {
                  "id": "m2",
                  "label": "Every 2 minutes"
                }
              ]
            },
            {
              "id": "records",
              "label": "Log records",
              "options": [
                {
                  "id": "per-line",
                  "label": "One record for each log line"
                },
                {
                  "id": "failed-only",
                  "label": "One record for each failed request, its lines as attributes"
                },
                {
                  "id": "per-request",
                  "label": "One record for each request, lines as attributes"
                },
                {
                  "id": "half",
                  "label": "One record for every second log line"
                },
                {
                  "id": "per-line-trimmed",
                  "label": "One record for each log line, with the bodies cut out"
                }
              ]
            },
            {
              "id": "spans",
              "label": "Traces",
              "options": [
                {
                  "id": "all",
                  "label": "Send every span, nothing sampled"
                },
                {
                  "id": "head",
                  "label": "Head-sample 1% at the SDK, in each service"
                },
                {
                  "id": "head-10",
                  "label": "Head-sample 10% at the SDK, in each service"
                },
                {
                  "id": "tail",
                  "label": "Tail-sample in the Collector"
                },
                {
                  "id": "tail-errors",
                  "label": "Tail-sample in the Collector, failed traces only"
                }
              ]
            }
          ],
          "needs": [
            {
              "id": "fast-alerts",
              "label": "an alert within two minutes of a failure"
            },
            {
              "id": "request-detail",
              "label": "the detail of each request in the logs"
            },
            {
              "id": "slow-traces",
              "label": "the trace of every slow or failed request"
            }
          ],
          "whyNot": {
            "interval:s10": "A metric sends one data point for each series at every interval, so six times as often is six times the data points for the same information.",
            "interval:s30": "It makes twice the data points of a 60-second interval for an alert that a 60-second interval already gives within two minutes.",
            "interval:m5": "It is cheap, and a failure can go unseen for several minutes before the next point arrives.",
            "interval:m2": "A failure can wait a whole interval for the next point, and the alert then comes after the two minutes.",
            "records:per-line": "The same text in many records. When the meter counts records and not bytes, packing a request's lines into one record keeps the detail and cuts the count.",
            "records:per-line-trimmed": "Smaller records, same count: the meter counts records, so the bill did not move.",
            "records:failed-only": "The failed requests are all there, and the requests that did not fail have no detail in the logs.",
            "records:half": "Half the records, and half the lines of each request are gone, so the detail of a request is incomplete. A request is the unit to pack, not a line to drop.",
            "spans:all": "Every span carries the detail of its request, and the count is the bill: 50 units on its own.",
            "spans:head": "A fixed 1% is picked without looking at the trace, so most slow or failed requests are lost.",
            "spans:head-10": "A fixed 10% is picked without looking at the trace, so nine in ten slow or failed requests are lost.",
            "spans:tail-errors": "The failed traces are kept, and a slow trace that did not fail is gone."
          },
          "explain": "When the meter counts signals, what matters is how many spans, log records and metric data points you send, and how big each one is does not. That reverses the last step: cutting the bodies saves nothing here, because every line is still one record, and packing a request's lines into one record does. A metric makes one data point per series per interval, so cardinality times frequency is what you pay for, which is why the 3.5 rules for attributes matter here too. Dash0 meters spans, log records and metric data points. Its bill has two parts: ingest on every signal you send, before any filtering, and index on the signals you keep. A spam filter drops after ingest, so filtered telemetry still carries the ingest charge, and sampling in the Collector means those spans are never sent at all. Dash0 also has dashboards that rank services by telemetry volume, which show where the count comes from. The numbers are made up for this level."
        }
      }
    ]
  }
};
