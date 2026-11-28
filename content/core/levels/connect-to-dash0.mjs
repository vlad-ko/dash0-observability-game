// Text of levels/connect-to-dash0.mjs (docs/CONTENT.md). A play level: a sort step, a choice step, then an In Dash0 step. The In Dash0 step's buttons and status lines come from content/core/ui/dash0-task.mjs, and its send form's labels and notes from the same file; the brief below names the real Dash0 places in words and draws none of them. The finish text says the same whether or not the In Dash0 step ran, so it never mentions it.
export default {
  "id": "connect-to-dash0",
  "name": "Connect the game to Dash0",
  "sub": "A token and an endpoint for a browser tab",
  "rewardTitle": "Connected",
  "play": {
    "finish": "You settled the two things a browser sender needs. The token sits in code that anyone who loads the page can read, so it should only be able to send: Dash0 says to restrict a token you distribute publicly to Ingesting. The address is the OTLP via HTTP endpoint of your organisation's region, because the OpenTelemetry JavaScript documentation says gRPC export is not supported in a browser.\n\nDash0 lists tokens under Settings, Auth Tokens and the endpoint list under Settings, Endpoints.",
    "steps": [
      {
        "intro": "You want a web page of your own to send telemetry to Dash0 from the browser. The page's code goes to every visitor, so whatever it holds, anyone who loads the page can read. Dash0 gives a sender an [[auth token]] and an address to send to.",
        "question": "Which of these can go in the page's code?",
        "sort": {
          "id": "ctd-sort",
          "buckets": [
            {
              "id": "ship",
              "label": "Can go in the page's code"
            },
            {
              "id": "keep",
              "label": "Not for the page's code"
            }
          ],
          "items": [
            {
              "id": "ingest-token",
              "label": "An auth token with only the Ingesting permission, used by one website",
              "why": "Dash0 says to restrict tokens you distribute publicly to [[Ingesting]], for example in OpenTelemetry instrumentation running in web browsers: such a token is readable by anyone using the app, and a token with only Ingesting cannot read your telemetry back or change your configuration. Dash0 also says to give each website its own token and to limit the token's datasets to the one it ingests into.",
              "whyNot": {
                "keep": "This is the token Dash0 recommends for browser code. Anyone can read it there, but with only the Ingesting permission it can send telemetry and nothing else."
              }
            },
            {
              "id": "endpoint",
              "label": "The ingestion endpoint Dash0 gives your organisation",
              "why": "It is an address, not a credential. The page has to use it to send, and the Dash0 Web SDK takes it in the page's own code, next to the token. What authorises a send is the token.",
              "whyNot": {
                "keep": "Keeping it out would stop nothing and break the page: the page has to use the address to send. What authorises a send is the token, not the address."
              }
            },
            {
              "id": "dataset-name",
              "label": "The name of the token's dataset",
              "why": "It only says where telemetry lands: a request can name a dataset, and Dash0 writes there if the token may write to it. A name grants nothing. What a token may do is set by its own permissions and datasets.",
              "whyNot": {
                "keep": "A dataset name is not a credential. Naming a dataset does not give a token access to it: a request that names a dataset the token may not write to is rejected."
              }
            },
            {
              "id": "all-token",
              "label": "An auth token with All permissions, the default",
              "why": "All permissions grants access to the full Dash0 API, for configuration, ingesting and querying. In page code, anyone could use it to read your telemetry back and change your configuration.",
              "whyNot": {
                "ship": "It does send telemetry, but it also grants the full Dash0 API, and the page's code is readable by anyone. An Ingesting token sends the same telemetry without the rest."
              }
            },
            {
              "id": "read-token",
              "label": "A token with the Reading permission",
              "why": "Reading lets a token query data. In page code, anyone could use it to query your telemetry. It would not even send the page's spans, because it has no ingest action.",
              "whyNot": {
                "ship": "A Reading token can only query data. In public code that lets anyone read your telemetry, and the page's spans would not be stored, because the token has no ingest action."
              }
            },
            {
              "id": "edge-token",
              "label": "An auth token that has the Signal Control edge permission",
              "why": "It sends telemetry, but it also reads SignalControl Edge settings. Dash0 describes SignalControl Edge as running in your own network, with an edge collector that connects back to Dash0 for configuration. Anyone who can read the page could read those settings with this token. For a token in public code, Dash0 says to restrict it to Ingesting.",
              "whyNot": {
                "ship": "It can send telemetry, but it also reads SignalControl Edge settings. Anyone who loads the page could read those settings with it. For a token anyone can read, Dash0 says Ingesting, which sends and does nothing else."
              }
            }
          ]
        }
      },
      {
        "intro": "The page's token is settled. A sender also needs an [[endpoint]] to send to. Your Dash0 organisation runs in one region, and the addresses it gives you name that region. The page runs in a visitor's browser and sends spans from there.",
        "question": "Which address does the page send its spans to?",
        "choice": {
          "id": "ctd-endpoint",
          "choices": [
            {
              "key": "http",
              "label": "The OTLP via HTTP endpoint of your organisation's region",
              "why": "The OpenTelemetry JavaScript documentation says that using gRPC for exporting is not supported in a browser, and Dash0's Web SDK asks for the OTLP via HTTP endpoint of your region. Dash0 shows it under Settings, Endpoints. Over HTTP, spans go to the path <code>/v1/traces</code> under that address."
            },
            {
              "key": "grpc",
              "label": "The OTLP gRPC endpoint of your organisation's region",
              "why": "Dash0's ingestion endpoint does take OTLP over gRPC, and services and Collectors use it. A browser is the problem: the OpenTelemetry JavaScript documentation says that using gRPC for exporting is not supported in a browser."
            },
            {
              "key": "prometheus",
              "label": "The Prometheus API endpoint of your organisation's region",
              "why": "That endpoint answers queries from tools such as Grafana and Perses, and it takes a token with querying permissions. The page sends spans and queries nothing, so it needs an ingestion endpoint."
            },
            {
              "key": "local",
              "label": "The default local OTLP via HTTP address, <code>http://localhost:4318</code>",
              "why": "That is where an OTLP via HTTP sender looks when nothing is configured: 4318 is the default port for OTLP via HTTP, and the JavaScript exporter defaults to <code>http://localhost:4318/v1/traces</code>. In a visitor's browser, localhost is the visitor's own machine, not Dash0. Dash0's address comes from your organisation's settings and names your region."
            }
          ]
        }
      },
      {
        "intro": "Now do it for real. The game has its own Dash0 organisation, and you will send one test span to it from this tab, as the page would. Get two things from Dash0 first:<ol><li>An auth token with only the [[Ingesting]] permission. In Dash0, open Settings, then Auth Tokens, and create one. This token is for the game's organisation, not for a public page, and the game picks the [[dataset]] for the test span, so leave Dataset at All datasets.</li><li>The endpoint. In Settings, then Endpoints, copy the OTLP via HTTP address, the address without a path.</li></ol><p>Press Start the task and paste both into the form, then press Send test span. When Dash0 has accepted it, press Check: the game looks for your span in Dash0, which can take a little while. Open in Dash0 opens the [[Trace Explorer]] on your test span.</p>",
        "dash0": {
          "id": "connect-send"
        }
      }
    ]
  }
};
