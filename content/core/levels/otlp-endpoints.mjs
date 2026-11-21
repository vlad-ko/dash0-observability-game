// Text of levels/otlp-endpoints.mjs (docs/CONTENT.md).
export default {
  "id": "otlp-endpoints",
  "name": "OTLP endpoints",
  "sub": "Ports and paths",
  "rewardTitle": "Endpoint tuner",
  "play": {
    "finish": "You know OTLP/gRPC is 4317 and OTLP/HTTP is 4318, that the general endpoint variable gets /v1/traces added while a per-signal one is used as is, and that the Dash0 token travels in an Authorization header.",
    "steps": [
      {
        "intro": "The checkout service at Kettle &amp; Co is a Node app. Its environment says <code>OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf</code> and <code>OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317</code>. The [[Collector]] is running, and nothing arrives.",
        "question": "What is wrong?",
        "choice": {
          "id": "otlp-port",
          "choices": [
            {
              "key": "http-port",
              "label": "4317 is the OTLP/gRPC port. OTLP/HTTP uses 4318, so use <code>http://collector:4318</code>",
              "why": "OTLP has two transports with their own default ports: 4317 for OTLP/[[gRPC]] and 4318 for OTLP/HTTP. An HTTP exporter pointed at the gRPC port is not understood by it. Also remember the difference in shape: a gRPC endpoint is a host and a port with no path, while an HTTP base endpoint gets the signal path added."
            },
            {
              "key": "same-port",
              "label": "Port 4317 serves both OTLP/gRPC and OTLP/HTTP on the Collector, so the cause is somewhere else",
              "why": "Each OTLP transport has its own default port, 4317 for gRPC and 4318 for HTTP. A client has to use the one that matches its protocol."
            },
            {
              "key": "needs-path",
              "label": "The endpoint has to end in <code>/v1/traces</code>: the exporter does not add a path to the base URL you give it",
              "why": "With <code>OTEL_EXPORTER_OTLP_ENDPOINT</code> an OTLP/HTTP exporter adds the signal path itself, so the general variable is a base URL. The wrong port is the problem here."
            }
          ]
        }
      },
      {
        "intro": "The port is fixed. In staging the team sets only the traces variable, <code>OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://collector:4318</code>, for an [[OTLP]]/HTTP [[exporter]], and leaves the general variable unset.",
        "question": "Where do the traces go?",
        "choice": {
          "id": "otlp-signal",
          "choices": [
            {
              "key": "as-is",
              "label": "To <code>http://collector:4318/</code>, the root path: a per-signal URL is used as is",
              "why": "The per-signal variables are used as they are: the exporter adds no path, so a URL with no path means the root path. Only with the general <code>OTEL_EXPORTER_OTLP_ENDPOINT</code> does the exporter add <code>/v1/traces</code>, <code>/v1/metrics</code> or <code>/v1/logs</code> to the base URL. So a per-signal URL has to carry <code>/v1/traces</code> itself, because that is the path the receiver serves."
            },
            {
              "key": "adds-path",
              "label": "To <code>http://collector:4318/v1/traces</code>, as it does for the general endpoint variable",
              "why": "The exporter adds <code>/v1/traces</code> only for the general variable, <code>OTEL_EXPORTER_OTLP_ENDPOINT</code>. A per-signal variable takes precedence over it and its URL is used without any change."
            },
            {
              "key": "rejected",
              "label": "Nowhere: the exporter refuses a URL without a path and logs an error at startup",
              "why": "Nothing requires a path. The exporter accepts the URL and sends to it as it is, and a URL with no path means the root path."
            }
          ]
        }
      },
      {
        "intro": "The Collector in front of the apps accepts both transports, on 4317 and 4318, and should send to Dash0 through the [[exporter]] <code>otlp_grpc/dash0</code>. Its config is half done: traces go to the debug exporter only, and metrics name an exporter nobody defined, so it will not start.",
        "question": "Fix the config so the Collector starts and both traces and metrics go to Dash0 through <code>otlp_grpc/dash0</code>.",
        "configure": {
          "id": "otlp-config",
          "hint": "A pipeline sends data only to the exporters its list names, and only to ones that are defined. Read each list against the exporters section.",
          "explain": "A pipeline sends data only to the exporters it lists, and an exporter that is defined but not listed does nothing: <code>otlp_grpc/dash0</code> was defined and listed nowhere, while <code>metrics</code> named an <code>otlp_http/dash0</code> that nobody defined, so the Collector would not start. <code>otlp_grpc</code> is the Collector's OTLP/gRPC exporter: its <code>endpoint</code> is a host and a port with no path, and it sends the token in an <code>Authorization</code> header that the <code>headers_setter</code> extension adds, read from an environment variable. <code>otlp_http</code> is the HTTP exporter, another component: its endpoint is a base URL that gets the signal path, and <code>traces_endpoint</code> is used as is. Pointing the pipelines at the debug exporter or deleting a pipeline would leave a pipeline without Dash0, and a second Dash0 exporter under another name would be a different component, so this task asks for <code>otlp_grpc/dash0</code> in both. This game checks the wiring, not the settings, so the headers and endpoints are the next question's business."
        }
      },
      {
        "intro": "The Collector config reads the Dash0 [[token|auth-token]] from an environment variable. The checkout service's [[SDK]] needs it as well, and the team is arguing about where it goes. In the examples the token is the made-up <code>auth_token_example</code>.",
        "question": "Where does the Dash0 auth token go?",
        "choice": {
          "id": "otlp-token",
          "choices": [
            {
              "key": "header",
              "label": "In an <code>Authorization: Bearer</code> header: <code>OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer auth_token_example</code> in an SDK",
              "why": "Dash0 reads the auth token from an <code>Authorization: Bearer</code> header. The OTLP exporter has a headers setting for exactly this: <code>OTEL_EXPORTER_OTLP_HEADERS</code> in an SDK, a list of key=value pairs, and the <code>headers_setter</code> extension with the exporter's <code>auth</code> setting in a Collector. Read the value from an environment variable or a secret instead of writing it into a file."
            },
            {
              "key": "url",
              "label": "In the endpoint URL, as a query parameter appended to the address the exporter sends the spans, metrics and logs to",
              "why": "The endpoint is only an address. Dash0 reads the token from the <code>Authorization</code> header, and a token in a URL tends to end up in logs and config files."
            },
            {
              "key": "resource",
              "label": "As a resource attribute such as <code>auth.token</code> on the service's Resource, and it travels with the telemetry",
              "why": "Resource attributes describe what produces the telemetry and travel with it as data, so the token would be sent along with every batch. Authentication is a header on the request, not part of the data."
            }
          ]
        }
      }
    ]
  }
};
