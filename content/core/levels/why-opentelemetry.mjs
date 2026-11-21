// Text of levels/why-opentelemetry.mjs (docs/CONTENT.md).
// A run(ctx) level: levels/why-opentelemetry.mjs reads each entry of "run" as say.<name> (docs/CONTENT.md section 11). The sources of the package names in the options are in levels/why-opentelemetry.mjs.
export default {
  "id": "why-opentelemetry",
  "name": "Why OpenTelemetry",
  "sub": "API, SDK, OTLP, Collector and conventions",
  "rewardTitle": "Part namer",
  "run": {
    "partsIntro": "OpenTelemetry is not one thing but a set of vendor-neutral parts. Before you instrument anything, learn which part does what.",
    "partsQuestion": "Which part of OpenTelemetry is each one?",
    "parts": {
      "id": "otel-parts",
      "hint": "Ask who writes code against it: a library author, an app that installs it, or nobody at all.",
      "buckets": [
        {
          "id": "api",
          "label": "API"
        },
        {
          "id": "sdk",
          "label": "SDK"
        },
        {
          "id": "otlp",
          "label": "OTLP"
        },
        {
          "id": "collector",
          "label": "Collector"
        },
        {
          "id": "semconv",
          "label": "Semantic conventions"
        }
      ],
      "items": [
        {
          "id": "wire",
          "label": "The wire format sent to port 4318",
          "why": "4318 is the default port for OTLP over HTTP, the protocol that carries telemetry between SDKs, Collectors and backends.",
          "whyNot": {
            "api": "The API is what code calls to make telemetry. It does not define the bytes on the wire.",
            "sdk": "The SDK processes and exports telemetry inside the application. It does not define the bytes on the wire.",
            "collector": "A Collector is a process that speaks the wire format. It is not the format itself.",
            "semconv": "Semantic conventions name attributes. They do not define how telemetry is sent."
          }
        },
        {
          "id": "start-span",
          "label": "<code>tracer.startActiveSpan('charge')</code> in a shared library",
          "why": "Starting a span is an API call. The library makes it without knowing which SDK, if any, the application installs.",
          "whyNot": {
            "sdk": "A shared library does not pick the SDK. The application installs it, and the library only starts the span.",
            "otlp": "OTLP is a protocol for sending data. Starting a span does not choose a protocol.",
            "collector": "The Collector is a separate process. A line of code in a library cannot start one.",
            "semconv": "Semantic conventions name attributes. They do not start spans."
          }
        },
        {
          "id": "method",
          "label": "The name <code>http.request.method</code>",
          "why": "Semantic conventions fix attribute names like this one, so every library and backend means the same thing by them.",
          "whyNot": {
            "api": "The API creates telemetry. It does not fix what an attribute is called.",
            "sdk": "The SDK samples, batches and exports. It does not decide the standard names.",
            "otlp": "OTLP carries attributes of any name. It does not say what each name means.",
            "collector": "A Collector can rename attributes, but it does not define the standard name."
          }
        },
        {
          "id": "pipeline",
          "label": "A separate process that receives, filters and forwards telemetry",
          "why": "That is the Collector: it runs as its own process between your services and a backend.",
          "whyNot": {
            "api": "The API is code you call inside a process. This is a separate process.",
            "sdk": "The SDK runs inside the application's process. This runs outside it.",
            "otlp": "OTLP is the protocol that process speaks, not the process.",
            "semconv": "Semantic conventions are names. They do not run, receive or forward anything."
          }
        },
        {
          "id": "batch",
          "label": "Batch span processor and sampler settings",
          "why": "Batching and sampling are SDK work, set up by the application that installs the SDK.",
          "whyNot": {
            "api": "The API only defines calls such as starting a span. It does no batching or sampling, and without more behind it its calls record nothing.",
            "otlp": "OTLP is the protocol. It does not decide when spans are batched or which are kept.",
            "collector": "A Collector can batch and sample too, but a batch span processor and a sampler are set up where the spans are created, in code or with environment variables such as <code>OTEL_TRACES_SAMPLER</code>. They are not a separate process.",
            "semconv": "Semantic conventions are names for attributes. They do not control batching or sampling."
          }
        }
      ]
    },
    "partsReason": "Sort every item to continue.",
    "dependsOnIntro": "The payments team ships <code>kettle-payments-client</code>, a library used by 30 services. They want it to emit [[spans]].",
    "dependsOnQuestion": "Which OpenTelemetry package should the library depend on?",
    "dependsOn": [
      {
        "key": "sdk",
        "label": "The SDK (<code>@opentelemetry/sdk-node</code>), which gives the library tracing out of the box",
        "why": "The SDK is the application's choice: how to sample, batch and export. A library that brings it makes those choices for all 30 services."
      },
      {
        "key": "api",
        "label": "The API (<code>@opentelemetry/api</code>), with the SDK left for each application to install",
        "why": "Libraries depend only on the OTel API; only the application installs the SDK. Without an SDK, API calls are no-ops: they record nothing and cost almost nothing. Each of the 30 services picks its own SDK."
      },
      {
        "key": "exporter",
        "label": "An OTLP exporter (<code>@opentelemetry/exporter-trace-otlp-http</code>), to send its spans to a backend",
        "why": "Exporting is SDK work, set up by the application. A library that exports on its own decides for all 30 services where their telemetry goes."
      },
      {
        "key": "collector",
        "label": "The Collector, added as a dependency, to filter the library's spans before it exports them",
        "why": "There is no Collector package for a library to depend on: the Collector is a separate process that runs between your services and a backend."
      }
    ],
    "dependsOnReason": "Pick the right answer to finish the level.",
    "finish": "You know which part of OpenTelemetry does what, and why a shared library depends only on the API."
  }
};
