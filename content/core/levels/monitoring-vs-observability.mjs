// Text of levels/monitoring-vs-observability.mjs (docs/CONTENT.md).
// A run(ctx) level: levels/monitoring-vs-observability.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). Sort labels must not give the bucket away: the rule is in levels/monitoring-vs-observability.mjs (Step 1) and test/sort-tells.test.mjs.
export default {
  "id": "monitoring-vs-observability",
  "name": "Monitoring vs observability",
  "sub": "Known questions and new ones",
  "rewardTitle": "Question asker",
  "run": {
    "sortIntro": "Day one on call. Before your first page, sort the questions people ask about a system: the ones a dashboard was built for in advance, and the new ones nobody planned for.",
    "sortQuestion": "Pick a question, then the kind it is.",
    "sort": {
      "id": "mvo-sort",
      "hint": "Ask whether someone could have written this question down, with its threshold, before anything went wrong.",
      "buckets": [
        {
          "id": "known",
          "label": "Known question"
        },
        {
          "id": "new",
          "label": "New question"
        }
      ],
      "items": [
        {
          "id": "cpu",
          "label": "Is CPU on db-1 above 90%?",
          "why": "Someone picked that threshold before anything broke, and a dashboard or an alert checks it all the time. That is monitoring.",
          "whyNot": {
            "new": "The limit is known up front, so an alert already asks this for you. Nobody has to explore anything to answer it."
          }
        },
        {
          "id": "ios",
          "label": "Why are only iOS 5.2 checkouts from Germany slow since 14:05 UTC?",
          "why": "Nobody builds a dashboard for iOS 5.2 in Germany. You answer it by slicing telemetry by app version, country and time after the fact.",
          "whyNot": {
            "known": "Nobody has a threshold or a chart ready for iOS 5.2 in Germany. The slice only matters once the slowdown has started."
          }
        },
        {
          "id": "5xx",
          "label": "Has the checkout API 5xx rate stayed under 1% for the last 5 minutes?",
          "why": "An error-rate threshold is a classic alert: decided in advance, checked all the time.",
          "whyNot": {
            "new": "The rate, the limit and the window are all fixed up front, so an alert can ask this continuously."
          }
        },
        {
          "id": "cust",
          "label": "Is this one user hitting API timeouts?",
          "why": "No chart follows one user. You need telemetry that carries the user ID, so you can filter by it when the question comes up.",
          "whyNot": {
            "known": "Nobody keeps a chart per user ahead of time. This one user only matters once their timeouts appear."
          }
        },
        {
          "id": "disk",
          "label": "Is the log disk down to 8 GB free space?",
          "why": "A disk running out of space is a failure mode you know about, with a number you can watch. A dashboard answers it.",
          "whyNot": {
            "new": "8 GB is a number you can set ahead of time for a failure you already expect. Nothing here needs exploring."
          }
        },
        {
          "id": "coupon",
          "label": "Is the coupon path slowing over 10% of carts with 20+ items?",
          "why": "This combines two details, the coupon path and the cart size, that nobody thought to chart together. You ask it of the telemetry itself.",
          "whyNot": {
            "known": "Nobody charts coupon use against cart size ahead of time. The two details only meet after the slowdown, so no ready chart or alert covers them."
          }
        }
      ]
    },
    "sortReason": "Sort every item to continue.",
    "answerableIntro": "Monitoring answers the known questions. Observability is being able to answer the new ones from the telemetry your system already sends, without shipping new code.",
    "answerableQuestion": "What makes the second kind answerable?",
    "answerable": [
      {
        "key": "rich",
        "label": "Telemetry with many attributes to slice by afterwards",
        "why": "New questions need data that still carries the details, such as app version, country, user ID and cart size, so you can group and filter by them once the question exists."
      },
      {
        "key": "dash",
        "label": "More dashboards, one for every service and region",
        "why": "A dashboard answers a question someone thought of in advance. The second kind are questions nobody had thought of yet."
      },
      {
        "key": "alerts",
        "label": "More alerts, with tighter thresholds on key metrics",
        "why": "An alert is a known question checked all the time. It can tell you something is wrong, not why only some requests are slow."
      },
      {
        "key": "retention",
        "label": "Keeping the same data for longer, month after month",
        "why": "Keeping data longer helps only if it has the detail you need. Months of CPU averages still cannot say whether that user timed out."
      }
    ],
    "answerableReason": "Pick the right answer to finish the level.",
    "finish": "You can tell a question someone planned for from a new one, and you know the new kind needs telemetry rich enough to slice."
  }
};
