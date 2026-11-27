// OTLP/HTTP JSON encoder for traces, logs and metrics, pure, no dependencies.
// Spec: https://opentelemetry.io/docs/specs/otlp/ (OTLP/HTTP, "JSON Protobuf Encoding"):
//   - traceId / spanId are lowercase hex strings (not base64, unlike the protobuf mapping);
//   - *TimeUnixNano are decimal strings (a uint64 does not fit a double);
//   - int64 attribute values are decimal strings (`intValue`), bools `boolValue`,
//     doubles `doubleValue`, strings `stringValue`;
//   - enums (span kind, status code) are integers.
// Contract: docs/DASH0-LAB.md §Encoder. Bad input throws; nothing is silently dropped.

export const SERVICE_NAME = 'oncall-game';
export const SERVICE_VERSION = '0.1.0';
export const SDK_NAME = 'oncall-game-otlp';
export const SDK_LANGUAGE = 'webjs';
export const SESSION_ATTR = 'session.id';
// The resource attributes every exported batch carries; the same for every session.
export const RESOURCE_ATTRIBUTES = Object.freeze({
  'service.name': SERVICE_NAME,
  'service.version': SERVICE_VERSION,
  'telemetry.sdk.name': SDK_NAME,
  'telemetry.sdk.language': SDK_LANGUAGE,
  'telemetry.sdk.version': SERVICE_VERSION,
});

export const SPAN_KIND = Object.freeze({
  unspecified: 0,
  internal: 1,
  server: 2,
  client: 3,
  producer: 4,
  consumer: 5,
});
export const STATUS_CODE = Object.freeze({ unset: 0, ok: 1, error: 2 });

const NANOS_PER_MS = 1_000_000n;
const HEX = { trace: /^[0-9a-f]{32}$/, span: /^[0-9a-f]{16}$/ };

// Epoch milliseconds (fractions allowed) -> decimal-string nanoseconds, exact in BigInt.
export function msToUnixNano(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`bad timestamp: ${ms}`);
  }
  const whole = Math.floor(ms);
  const frac = Math.round((ms - whole) * 1e6);
  return String(BigInt(whole) * NANOS_PER_MS + BigInt(frac));
}

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

// A bigint outside int64 would be sent as a wrong or rejected intValue/asInt: refuse it.
function int64String(v) {
  if (v < INT64_MIN || v > INT64_MAX) throw new RangeError('bigint is outside the int64 range');
  return String(v);
}

function anyValue(v) {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { boolValue: v };
  if (typeof v === 'bigint') return { intValue: int64String(v) };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new RangeError('non-finite attribute value');
    if (!Number.isInteger(v)) return { doubleValue: v };
    // An integer beyond 2^53 has already lost precision: refuse rather than send a wrong int64.
    if (!Number.isSafeInteger(v)) throw new RangeError('integer attribute is not a safe integer');
    return { intValue: String(v) };
  }
  throw new TypeError(`unsupported attribute value type: ${v === null ? 'null' : typeof v}`);
}

function attributes(obj) {
  return Object.entries(obj ?? {}).map(([key, value]) => ({ key, value: anyValue(value) }));
}

function enumOf(table, v, what, fallback) {
  if (v === undefined) return fallback;
  if (Number.isInteger(v) && Object.values(table).includes(v)) return v;
  const key = typeof v === 'string' ? v.toLowerCase() : v;
  if (Object.hasOwn(table, key)) return table[key];
  throw new RangeError(`unknown ${what}: ${String(v)}`);
}

// The one rule for "this span is in error": code 2, or the string 'error' in any case. Throws
// RangeError on a code the encoder would refuse, so callers decide what an unreadable status means.
export function isErrorStatus(status) {
  return enumOf(STATUS_CODE, status?.code, 'status code', STATUS_CODE.unset) === STATUS_CODE.error;
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function hexId(v, kind) {
  if (typeof v !== 'string' || !HEX[kind].test(v)) throw new TypeError(`bad ${kind}Id`);
  return v;
}

function encodeSpan(d, stamp) {
  const span = {
    traceId: hexId(d.traceId, 'trace'),
    spanId: hexId(d.spanId, 'span'),
    name: d.name,
    kind: enumOf(SPAN_KIND, d.kind, 'span kind', SPAN_KIND.internal),
    startTimeUnixNano: msToUnixNano(d.startMs),
    endTimeUnixNano: msToUnixNano(d.endMs),
    // The stamp goes on last, so a draft attribute with the same key cannot win.
    attributes: attributes({ ...d.attributes, ...stamp }),
  };
  if (typeof d.name !== 'string' || d.name === '') throw new TypeError('span needs a name');
  if (d.parentSpanId != null) span.parentSpanId = hexId(d.parentSpanId, 'span');
  if (d.events?.length) {
    span.events = d.events.map((e) => ({
      timeUnixNano: msToUnixNano(e.timeMs),
      name: e.name,
      attributes: attributes(e.attributes),
    }));
  }
  const code = enumOf(STATUS_CODE, d.status?.code, 'status code', STATUS_CODE.unset);
  if (code !== STATUS_CODE.unset) {
    span.status = { code };
    if (d.status.message != null) span.status.message = d.status.message;
  }
  return span;
}

// The checks every signal shares: a batch without a service name or scope is refused, never
// shipped anonymous.
function checkEnvelope({ resource, scope, stamp }) {
  const serviceName = isPlainObject(resource) ? resource['service.name'] : undefined;
  if (typeof serviceName !== 'string' || serviceName === '') {
    throw new TypeError('resource needs a non-empty service.name');
  }
  if (!isPlainObject(scope) || typeof scope.name !== 'string' || scope.name === '') {
    throw new TypeError('scope needs a non-empty name');
  }
  if (scope.version !== undefined && typeof scope.version !== 'string') {
    throw new TypeError('scope version must be a string');
  }
  if (!isPlainObject(stamp)) throw new TypeError('stamp must be a plain object');
}

// drafts: [{traceId, spanId, parentSpanId?, name, kind?, startMs, endMs, attributes?,
//   events?: [{name, timeMs, attributes?}], status?: {code: 'ok'|'error'|n, message?}}]
// resource: {key: value}; scope: {name, version}; stamp: {key: value} put on every span, winning
// over a draft attribute of the same key. -> an ExportTraceServiceRequest (JSON-ready), one
// resource, one scope. Any service can use this; encodeTraces is the browser game's wrapper.
export function encodeResourceSpans(drafts, { resource, scope, stamp = {} } = {}) {
  if (!Array.isArray(drafts) || drafts.length === 0) throw new RangeError('no spans to encode');
  checkEnvelope({ resource, scope, stamp });
  return {
    resourceSpans: [
      {
        resource: { attributes: attributes(resource) },
        scopeSpans: [
          {
            scope: { name: scope.name, version: scope.version },
            spans: drafts.map((d) => encodeSpan(d, stamp)),
          },
        ],
      },
    ],
  };
}

// The browser game's wrapper: its fixed resource and scope, and session.id on every span.
export function encodeTraces(drafts, { sessionId }) {
  if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('sessionId required');
  return encodeResourceSpans(drafts, {
    resource: RESOURCE_ATTRIBUTES,
    scope: { name: SERVICE_NAME, version: SERVICE_VERSION },
    stamp: { [SESSION_ATTR]: sessionId },
  });
}

// Log severity (https://github.com/open-telemetry/opentelemetry-proto/blob/v1.11.1/opentelemetry/proto/logs/v1/logs.proto,
// SeverityNumber): the lowest number of each range; 1..24 are accepted as they are.
export const SEVERITY = Object.freeze({ trace: 1, debug: 5, info: 9, warn: 13, error: 17, fatal: 21 });

// Aggregation temporality (metrics.proto, AggregationTemporality): 0 is unspecified and refused.
export const TEMPORALITY = Object.freeze({ delta: 1, cumulative: 2 });

function severityNumber(v) {
  if (Number.isInteger(v) && v >= 1 && v <= 24) return v;
  const key = typeof v === 'string' ? v.toLowerCase() : v;
  if (typeof key === 'string' && Object.hasOwn(SEVERITY, key)) return SEVERITY[key];
  throw new RangeError(`unknown severity: ${String(v)}`);
}

function encodeLogRecord(r, stamp) {
  if (!isPlainObject(r)) throw new TypeError('log record must be an object');
  if (typeof r.body !== 'string') throw new TypeError('log body must be a string');
  const time = msToUnixNano(r.timeMs);
  const out = {
    timeUnixNano: time,
    // Observed time defaults to the event time: this encoder emits a record at the moment it is made.
    observedTimeUnixNano: r.observedMs === undefined ? time : msToUnixNano(r.observedMs),
    severityNumber: severityNumber(r.severity),
    body: { stringValue: r.body },
    attributes: attributes({ ...r.attributes, ...stamp }),
  };
  if (r.severityText !== undefined) {
    if (typeof r.severityText !== 'string') throw new TypeError('severityText must be a string');
    out.severityText = r.severityText;
  } else if (typeof r.severity === 'string') {
    out.severityText = r.severity.toUpperCase();
  }
  if (r.traceId != null) out.traceId = hexId(r.traceId, 'trace');
  if (r.spanId != null) out.spanId = hexId(r.spanId, 'span');
  return out;
}

// records: [{timeMs, observedMs?, severity: 'info'|...|1..24, severityText?, body: string,
//   attributes?, traceId?, spanId?}]; resource, scope and stamp as encodeResourceSpans.
// -> an ExportLogsServiceRequest (JSON-ready), one resource, one scope. The stamp wins over a
// record attribute of the same key.
export function encodeResourceLogs(records, { resource, scope, stamp = {} } = {}) {
  if (!Array.isArray(records) || records.length === 0) throw new RangeError('no log records to encode');
  checkEnvelope({ resource, scope, stamp });
  return {
    resourceLogs: [
      {
        resource: { attributes: attributes(resource) },
        scopeLogs: [
          {
            scope: { name: scope.name, version: scope.version },
            logRecords: records.map((r) => encodeLogRecord(r, stamp)),
          },
        ],
      },
    ],
  };
}

function encodePoint(p, stamp) {
  if (!isPlainObject(p)) throw new TypeError('metric point must be an object');
  const out = { timeUnixNano: msToUnixNano(p.timeMs), attributes: attributes({ ...p.attributes, ...stamp }) };
  if (p.startMs !== undefined) out.startTimeUnixNano = msToUnixNano(p.startMs);
  const v = p.value;
  if (typeof v === 'bigint') out.asInt = int64String(v);
  else if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError('metric value must be a finite number');
  else if (Number.isSafeInteger(v)) out.asInt = String(v);
  // Any other finite number, including an integer-valued one beyond 2^53, is exactly a double.
  else out.asDouble = v;
  return out;
}

// metrics: [{name, description?, unit?, type: 'gauge'|'sum', temporality?: 'delta'|'cumulative'|1|2,
//   monotonic?: boolean, points: [{value, timeMs, startMs?, attributes?}]}]. A sum must say its
// temporality and monotonicity: neither has a safe default. Histograms are not encoded.
// resource, scope and stamp as encodeResourceSpans; the stamp lands on every point last.
// -> an ExportMetricsServiceRequest (JSON-ready).
export function encodeResourceMetrics(metrics, { resource, scope, stamp = {} } = {}) {
  if (!Array.isArray(metrics) || metrics.length === 0) throw new RangeError('no metrics to encode');
  checkEnvelope({ resource, scope, stamp });
  const encodeMetric = (m) => {
    if (!isPlainObject(m)) throw new TypeError('metric must be an object');
    if (typeof m.name !== 'string' || m.name === '') throw new TypeError('metric needs a name');
    if (!Array.isArray(m.points) || m.points.length === 0) throw new RangeError('metric has no points');
    const out = { name: m.name };
    for (const field of ['description', 'unit']) {
      if (m[field] === undefined) continue;
      if (typeof m[field] !== 'string') throw new TypeError(`metric ${field} must be a string`);
      out[field] = m[field];
    }
    const dataPoints = m.points.map((p) => encodePoint(p, stamp));
    if (m.type === 'gauge') {
      out.gauge = { dataPoints };
    } else if (m.type === 'sum') {
      if (m.temporality === undefined) throw new TypeError('a sum needs a temporality');
      if (typeof m.monotonic !== 'boolean') throw new TypeError('a sum needs monotonic true or false');
      out.sum = {
        dataPoints,
        aggregationTemporality: enumOf(TEMPORALITY, m.temporality, 'temporality'),
        isMonotonic: m.monotonic,
      };
    } else {
      throw new RangeError(`unsupported metric type: ${String(m.type)}`);
    }
    return out;
  };
  return {
    resourceMetrics: [
      {
        resource: { attributes: attributes(resource) },
        scopeMetrics: [
          {
            scope: { name: scope.name, version: scope.version },
            metrics: metrics.map(encodeMetric),
          },
        ],
      },
    ],
  };
}
