// Text of levels/burn-rate-alerts.mjs (docs/CONTENT.md).
export default {
  "id": "burn-rate-alerts",
  "name": "Burn-rate alerts",
  "sub": "Fast enough, not jumpy",
  "rewardTitle": "Burn watcher",
  "play": {
    "finish": "You can turn an SLO into a burn rate: the error ratio, from rates over one window, divided by what the SLO allows. You know a short window alone pages on blips and a long window alone keeps paging after the fix. A paging rule needs both.",
    "steps": [
      {
        "intro": "Kettle &amp; Co's checkout has an SLO of <b>99.9%</b> good requests over 30 days (the window is illustrative: the data is one hour), so its error budget is the other 0.1%. The <b>burn rate</b> says how fast that budget is being spent: 1 spends it exactly as the window closes, 10 spends it ten times faster. It is the error ratio divided by the share the SLO allows, <code>1 - 0.999</code>. The counter <code>http_server_requests_total</code> has the labels <code>service</code>, <code>route</code> and <code>status</code> (Kettle &amp; Co's own names; in Dash0 they arrive as <code>service_name</code>, <code>http_route</code> and <code>http_response_status_code</code>), and a failure has status 500. Checkout deployed 20 minutes ago.",
        "question": "Write checkout's burn rate over the last hour.",
        "query": {
          "id": "br-burn",
          "hint": "Take the error ratio of the requests and divide it by what the SLO allows. Both sides of the ratio are sums over one window, and a counter needs the function that turns it into a speed.",
          "explain": "Checkout burned its budget about 35 times faster than the SLO allows over the last hour. The hour holds two different stretches: before the deploy about 11 times, and since the deploy, 20 minutes ago, 83.3 times (the last 5 minutes read 83.3 too, because the failures have been steady since the deploy). Roughly two thirds of the hour at 11 plus one third at 83 makes 35. Without <code>rate()</code> you divide the totals since the counters restarted at the deploy, which cover only those 20 minutes, and read the same 83.3 while the 40 minutes before it vanish: the match comes from the steady failures, it is not a typo. Leave out the division by 0.001 and you read the error ratio, 0.035, which is not a burn rate. A window longer than the hour of data (<code>[2h]</code>, <code>[30d]</code>) reads almost the same here, because only one hour exists; on real traffic a 30-day window would average the incident away, so use the hour the question asks for."
        }
      },
      {
        "intro": "A burn rate above 14.4 for an hour spends 2% of the 30-day budget (14.4 x 1 hour out of 720 hours), which is worth a page. When every request fails, the burn rate is 1 / 0.001 = 1,000. The checkout data you queried has no blip followed by a long failure, so two incidents are told in numbers here, not in data. Incident A: a pod restart fails every request for 30 seconds. Right after it, the 5-minute burn rate reads 100 and the 1-hour burn rate reads 8.3. Incident B: a bad deploy fails every request for 10 minutes, then is rolled back. Six minutes after the rollback, the 5-minute burn rate reads 0 and the 1-hour burn rate reads 167. The team wants a page for B, none for A, and B's page gone soon after the rollback.",
        "question": "Which paging rule does that?",
        "choice": {
          "id": "br-rule",
          "choices": [
            {
              "key": "short-only",
              "label": "The 5-minute burn rate above 14.4, on its own",
              "why": "Incident A reads 100 on the 5-minute window, so this pages for a 30-second hiccup that spent only 1.2% of the budget (a 99.9% target allows 2,592 seconds of failure in 30 days, and the hiccup used 30). It does clear quickly after incident B, which is the half of the answer that works."
            },
            {
              "key": "long-only",
              "label": "The 1-hour burn rate above 14.4, on its own",
              "why": "It stays quiet for incident A (8.3) and pages for incident B (167). But six minutes after the rollback it still reads 167: the hour still holds all ten minutes of failures, and the reading stays above 14.4 for about 59 minutes after the fix: only when less than 52 seconds of failures remain in the hour does it fall below the line. The engineer is paged about something already fixed. It is slow to start as well: with 2% of requests failing (a burn rate of 20) it needs 43 minutes to cross the line."
            },
            {
              "key": "either",
              "label": "The 5-minute burn rate above 14.4, or the 1-hour one",
              "why": "Incident A reads 100 on the 5-minute window, so it pages exactly as the 5-minute rule does, and after incident B it keeps paging for as long as the 1-hour reading stays high. Taking whichever window is worse gives you the blips of the short one and the stale page of the long one."
            },
            {
              "key": "both",
              "label": "Both the 5-minute and 1-hour burn rates above 14.4",
              "why": "Incident A reads 100 and 8.3: the 1-hour window is below 14.4, so no page. Incident B pages once both are above 14.4, and six minutes after the rollback the 5-minute reading is 0, so the page clears while the 1-hour one still reads 167. The long window decides how much evidence is needed; the short one confirms that it is still happening. The pair starts as slowly as the long window, and what it gains is no blips and a quick clear. Dash0 pairs windows this way for you: an SLO exposes ready-made fast burn and slow burn signals (a fast burn spends the budget quickly, a slow burn slowly), each paired with a shorter window that confirms the problem is still happening, so you create a check rule on them instead of combining two windows yourself, and notification channels deliver the alert. The numbers differ from this level's example only because Dash0 uses a 28-day window: its fast burn is 2% of the budget in an hour, which is a burn rate of 13.44 there and 14.4 on the 30 days used here."
            }
          ]
        }
      }
    ]
  }
};
