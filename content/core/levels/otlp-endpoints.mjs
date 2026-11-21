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
              "label": "4317 is the OTLP/gRPC port, and OTLP/HTTP uses 4318, hence use <code>http://collector:4318</code> in its place",
              "why": "OTLP has two transports with their own default ports: 4317 for OTLP/[[gRPC]] and 4318 for OTLP/HTTP. An HTTP exporter pointed at the gRPC port is not understood by it. Also remember the difference in shape: a gRPC endpoint is a host and a port with no path, while an HTTP base endpoint gets the signal path added."
            },
            {
              "key": "same-port",
              "label": "Both OTLP/gRPC and OTLP/HTTP get handled on port 4317, and 4318 is for metrics, so the protocol is not at fault",
              "why": "Each OTLP transport has its own default port, 4317 for gRPC and 4318 for HTTP. A client has to use the one that matches its protocol."
            },
            {
              "key": "needs-path",
              "label": "The port suits the HTTP protocol, but the endpoint has to end in <code>/v1/traces</code>, unlike gRPC on 4318 itself",
              "why": "With <code>OTEL_EXPORTER_OTLP_ENDPOINT</code> an OTLP/HTTP exporter adds the signal path itself, so the general variable is a base URL. The wrong port is the problem here."
            },
            {
              "key": "mismatch",
              "label": "The protocol and the port disagree, as http/protobuf is served on 4318 while 4317 listens for gRPC, so it fails",
              "why": "OTLP/gRPC and OTLP/HTTP have separate default ports, 4317 and 4318, and a client has to use the port of its own protocol. The variables name OTLP/HTTP and the gRPC port."
            },
            {
              "key": "port-or-protocol",
              "label": "Either fix the port to 4318 for HTTP, or switch the protocol to grpc and keep port 4317 as it is",
              "why": "The two settings do not match, and fixing either side makes them match: OTLP/HTTP is on 4318 and OTLP/gRPC on 4317."
            },
            {
              "key": "protocol-invalid",
              "label": "The protocol value is wrong: only grpc and http/json exist, sitting on ports 4317 as well as 4318",
              "why": "The accepted values are <code>grpc</code>, <code>http/protobuf</code> and <code>http/json</code>. The OTLP exporter specification also makes <code>http/protobuf</code> the default transport."
            },
            {
              "key": "ports-swapped",
              "label": "The ports are swapped: 4317 is for OTLP/HTTP and 4318 for gRPC, hence the protocol is the problem",
              "why": "It is the other way round: OTLP/gRPC defaults to 4317 and OTLP/HTTP to 4318."
            },
            {
              "key": "needs-https",
              "label": "OTLP/HTTP needs TLS, which moves the URL to https on port 4318 and leaves gRPC on 4317",
              "why": "An OTLP/HTTP exporter uses the scheme it is given, and SDKs default their endpoint variables to the <code>http</code> scheme. A plain <code>http</code> URL is fine."
            },
            {
              "key": "set-on-collector",
              "label": "The protocol variable should be set on the Collector too, so gRPC shifts off port 4317 onto 4318 there",
              "why": "<code>OTEL_EXPORTER_OTLP_PROTOCOL</code> configures the exporter in the SDK. The Collector's OTLP receiver has separate gRPC and HTTP endpoints, 4317 and 4318 by default."
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
              "label": "To <code>http://collector:4318/</code>, the root path: a per-signal URL is used as is, untouched",
              "why": "The per-signal variables are used as they are: the exporter adds no path, so a URL with no path means the root path. Only with the general <code>OTEL_EXPORTER_OTLP_ENDPOINT</code> does the exporter add <code>/v1/traces</code>, <code>/v1/metrics</code> or <code>/v1/logs</code> to the base URL. So a per-signal URL has to carry <code>/v1/traces</code> itself, because that is the path the receiver serves."
            },
            {
              "key": "adds-path",
              "label": "To <code>http://otel:4318/v1/traces</code>, as the general variable does, with the path added",
              "why": "The exporter adds <code>/v1/traces</code> only for the general variable, <code>OTEL_EXPORTER_OTLP_ENDPOINT</code>. A per-signal variable takes precedence over it and its URL is used without any change."
            },
            {
              "key": "rejected",
              "label": "Nowhere, since the exporter refuses a path-less URL and logs an error at startup",
              "why": "Nothing requires a path. The exporter accepts the URL and sends to it as it is, and a URL with no path means the root path."
            },
            {
              "key": "exactly-written",
              "label": "Exactly as typed, since the <code>/v1/traces</code> path is a courtesy of the general variable alone",
              "why": "For <code>OTEL_EXPORTER_OTLP_TRACES_ENDPOINT</code> the URL MUST be used as it is. Only a base URL from <code>OTEL_EXPORTER_OTLP_ENDPOINT</code> gets the signal path appended."
            },
            {
              "key": "no-path-root",
              "label": "With no path given, the exporter targets the bare slash of that host and port",
              "why": "The OTLP exporter specification says that when a URL has no path part, the root path is used, and that <code>/v1/traces</code> is added only for the non-signal-specific variable."
            },
            {
              "key": "needs-general",
              "label": "To localhost, since this variable is read only together with the general one, whatever the path",
              "why": "A per-signal variable takes precedence over the general one and works on its own."
            },
            {
              "key": "default-endpoint",
              "label": "To the default endpoint with <code>/v1/traces</code>, since a missing path makes the value ignored",
              "why": "The per-signal variable is not ignored: it is the one used for traces, and it is used as it is."
            },
            {
              "key": "https-upgrade",
              "label": "To an https URL on 4318, as a path of slash lets the exporter upgrade the scheme",
              "why": "The exporter uses the scheme in the URL it is given. It does not change it according to the port."
            },
            {
              "key": "signal-name",
              "label": "To the <code>/otlp</code> path of that host, as the exporter adds its own name as a suffix",
              "why": "A per-signal URL is not changed at all. Where a path is added, for the general variable, it is <code>v1/traces</code>."
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
              "label": "In the endpoint URL as a query parameter on the request line and no Authorization at all, nothing else carrying it",
              "why": "The endpoint is only an address. Dash0 reads the token from the <code>Authorization</code> header, and a token in a URL tends to end up in logs and config files."
            },
            {
              "key": "resource",
              "label": "As a field on the <code>Resource</code> and sent without an Authorization header present in the telemetry",
              "why": "Resource attributes describe what produces the telemetry and travel with it as data, so the token would be sent along with every batch. Authentication is a header on the request, not part of the data."
            },
            {
              "key": "bearer-pairs",
              "label": "Attached by the client as a one-off Authorization header with the scheme word",
              "why": "The headers setting takes key=value pairs separated by commas. Dash0's own examples set <code>Authorization=Bearer</code> followed by the token there."
            },
            {
              "key": "collector-auth",
              "label": "In the Collector config, where <code>headers_setter</code> adds the Authorization credential to all it forwards",
              "why": "The <code>headers_setter</code> extension can add a header such as <code>Authorization</code> to the exporter's requests, and its value can come from the environment. The SDK sets the same header with its own headers setting."
            },
            {
              "key": "span-attribute",
              "label": "As an attribute on spans that the platform matches to the organisation instead of reading an Authorization header value",
              "why": "Attributes are telemetry data. Dash0 authenticates the request through its header, and an attribute would be stored with every span."
            },
            {
              "key": "baggage",
              "label": "In the W3C <code>baggage</code> header: each hop a call passes can attach it in place of Authorization itself",
              "why": "Baggage is propagated to every downstream service, and so is anything put in it, which would leak the token. It carries context, not credentials."
            },
            {
              "key": "dataset-header",
              "label": "In the <code>Dash0-Dataset</code> header: it holds the secret as well as the dataset name, replacing the usual header",
              "why": "In Dash0's examples that header names the dataset, such as <code>default</code>, and the token goes in <code>Authorization</code>."
            },
            {
              "key": "api-key-header",
              "label": "In a header called <code>X-Api-Key</code>, the way many backends read a key, rather than Authorization",
              "why": "Dash0 reads the token from the <code>Authorization</code> header as a bearer value, not from a custom key header."
            }
          ]
        }
      }
    ]
  }
};
