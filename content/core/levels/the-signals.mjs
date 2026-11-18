// Text of levels/the-signals.mjs (docs/CONTENT.md).
// A run(ctx) level: levels/the-signals.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). "signals" holds the four buckets that both sorts share.
export default {
  "id": "the-signals",
  "name": "The signals",
  "sub": "Metrics, logs, traces and profiles",
  "rewardTitle": "Signal reader",
  "run": {
    "signals": [
      {
        "id": "metric",
        "label": "Metric"
      },
      {
        "id": "log",
        "label": "Log"
      },
      {
        "id": "trace",
        "label": "Trace"
      },
      {
        "id": "profile",
        "label": "Profile"
      }
    ],
    "dataIntro": "OpenTelemetry carries four kinds of telemetry, called signals: metrics, logs, traces and profiles. Here is a little of each from the shop.",
    "dataQuestion": "Which signal is each one?",
    "data": {
      "id": "sig-data",
      "hint": "Ask what one piece of this data holds, and how you would read it.",
      "items": [
        {
          "id": "duration",
          "label": "<code>http.server.request.duration</code> histogram point",
          "why": "A histogram point sums up many requests' durations over an interval: numbers you aggregate and chart.",
          "whyNot": {
            "log": "A histogram point holds no message and no severity. It counts many durations into buckets.",
            "trace": "A histogram point is not one request's path. It counts many durations in buckets.",
            "profile": "It holds no stack samples. A histogram point counts durations, and it does not say which function spent the time."
          }
        },
        {
          "id": "declined",
          "label": "<code>{severity_text:\"ERROR\", body:\"payment declined\"}</code>",
          "why": "A severity and a body: one log record, describing one event as it happened.",
          "whyNot": {
            "metric": "It is one event with a message, not a number summed up over an interval.",
            "trace": "Nothing here is a tree of calls. It is one event with a message.",
            "profile": "There are no stack samples or function names here, only a severity and a message."
          }
        },
        {
          "id": "stacks",
          "label": "CPU stack samples per function",
          "why": "Stack samples that show where CPU time goes, function by function, are a profile.",
          "whyNot": {
            "metric": "Stack samples list functions and where time goes. They are not a single number you chart over time.",
            "log": "A log record describes one event with a message and a severity. Stack samples are snapshots of the call stack, with neither.",
            "trace": "A span has a start, a duration and a parent, one per operation. A stack sample has none of these."
          }
        },
        {
          "id": "cpu-time",
          "label": "<code>process.cpu.time</code> counter",
          "why": "A counter is a metric: a number that only goes up, recorded over time.",
          "whyNot": {
            "log": "A counter holds a number, not a message. It has no severity and no body.",
            "trace": "A counter does not follow one request. It adds up CPU time for the whole process.",
            "profile": "A counter gives a total of CPU time with no function names. It cannot say which code used it."
          }
        },
        {
          "id": "checkout-span",
          "label": "Span <code>POST /checkout</code> with trace_id, span_id and parent",
          "why": "The trace ID, span ID and parent place this operation in one request's tree of spans: a trace.",
          "whyNot": {
            "metric": "A span describes one operation of one request, with its own IDs. It is not a number summed up over an interval.",
            "log": "A log record is one event with a message and a severity. This is an operation with a parent and its own span ID, and it lasts for a duration.",
            "profile": "It holds no stack samples. It says which operation ran in the request, not which functions burned CPU."
          }
        }
      ]
    },
    "sortReason": "Sort every item to continue.",
    "askIntro": "Each signal is good at some questions. Match each question to the signal that answers it best.",
    "askQuestion": "Which signal answers each question?",
    "ask": {
      "id": "sig-ask",
      "hint": "Ask whether the answer is a number over time, one event's exact contents, one request's path, or where code spends its time.",
      "items": [
        {
          "id": "rps",
          "label": "Requests per second over the last 30 days",
          "why": "A metric aggregates as it goes, so a long range stays cheap to keep and to chart.",
          "whyNot": {
            "log": "Keeping and scanning 30 days of individual records to count requests is costly. The answer is not one event's contents.",
            "trace": "A trace follows a single request, and keeping every one for 30 days is costly. This question is about the total, not one path.",
            "profile": "A profile shows where code spends its time. It says nothing about how many requests arrive."
          }
        },
        {
          "id": "provider",
          "label": "What exactly did the payment provider return?",
          "why": "A log record keeps the exact message an event produced.",
          "whyNot": {
            "metric": "A metric folds many events into numbers, so the exact reply text is gone.",
            "trace": "A trace shows that the call happened and how long it took, not the provider's exact reply.",
            "profile": "A profile shows where code spends CPU time. It does not keep what the provider replied."
          }
        },
        {
          "id": "cpu-fn",
          "label": "Which function burns CPU in inventory?",
          "why": "A profile attributes CPU time to the functions in the code.",
          "whyNot": {
            "metric": "A CPU metric gives one number for the whole process. It does not name the function behind it.",
            "log": "A log line says only what the code chose to write. It does not measure which function uses CPU.",
            "trace": "A span times one operation, such as a call. It does not break CPU down by function inside it."
          }
        },
        {
          "id": "slow-call",
          "label": "Which downstream call made this request slow?",
          "why": "A trace shows every call in the request with its own start and duration.",
          "whyNot": {
            "metric": "A metric can show that latency went up, but it is combined over many requests, so it cannot pick out the call behind this one.",
            "log": "Log lines from different services would have to be pieced together by hand to see which call took the time.",
            "profile": "A profile shows where CPU time goes. A slow call may spend most of its time waiting, which a CPU profile does not show."
          }
        }
      ]
    },
    "newestIntro": "One of the four is still settling.",
    "newestQuestion": "Which OpenTelemetry signal is the newest and still maturing?",
    "newest": [
      {
        "key": "metrics",
        "label": "Metrics",
        "why": "Traces, metrics and logs all came before profiles, the fourth signal."
      },
      {
        "key": "logs",
        "label": "Logs",
        "why": "Logs came before profiles, the fourth signal."
      },
      {
        "key": "traces",
        "label": "Traces",
        "why": "Traces were there before profiles, the fourth signal."
      },
      {
        "key": "profiles",
        "label": "Profiles",
        "why": "Profiles are OTel's fourth signal and the newest. The profiles spec is Alpha, and profiles in OTLP are still in Development, so expect changes."
      }
    ],
    "newestReason": "Pick the right answer to finish the level.",
    "finish": "You can match telemetry and questions to the signal that fits, and you know profiles are still settling."
  }
};
