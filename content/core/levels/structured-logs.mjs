// Text of levels/structured-logs.mjs (docs/CONTENT.md).
// Sort labels must not give the bucket away: the rule is in levels/structured-logs.mjs and test/sort-tells.test.mjs.
export default {
  "id": "structured-logs",
  "name": "Structured logs",
  "sub": "Fields, not sentences",
  "rewardTitle": "Log reader",
  "play": {
    "finish": "You can read a log record by its fields: message in the Body, facts in Attributes, the source in the Resource, and the level as a number you can filter on. You keep your logger and add an appender.",
    "steps": [
      {
        "intro": "Payments at Kettle &amp; Co declined a card, and the logs tell you. A log record is more than a line of text: the data model gives it separate fields. Here are twelve pieces of one record.",
        "question": "Pick a piece, then say which field of the record it belongs in.",
        "sort": {
          "id": "sl-sort",
          "buckets": [
            {
              "id": "body",
              "label": "Body"
            },
            {
              "id": "attributes",
              "label": "Attributes"
            },
            {
              "id": "severity",
              "label": "Severity"
            },
            {
              "id": "resource",
              "label": "Resource"
            },
            {
              "id": "trace",
              "label": "Trace context"
            }
          ],
          "items": [
            {
              "id": "msg-declined",
              "label": "\"Payment declined by provider\"",
              "why": "The message a person reads. The Body holds the message of the record: a human-readable string, or structured data.",
              "whyNot": {
                "severity": "Severity is a short level label such as WARN or ERROR. This is a sentence about what happened.",
                "resource": "A Resource is the same for every record from a source. This sentence is about one event.",
                "trace": "Trace context holds IDs that tie a record to a request. It holds no message text.",
                "attributes": "Attributes are key and value pairs, facts about the event. This is a sentence for a person to read, with no key and no value."
              }
            },
            {
              "id": "order-id",
              "label": "order.id = 8841",
              "why": "A fact about this one event, as a key and a value. Attributes hold additional information about the specific event occurrence, and they can differ from record to record.",
              "whyNot": {
                "severity": "An order ID is not a level such as WARN or ERROR.",
                "trace": "An order ID is a business fact, not a trace or span ID.",
                "body": "The message says what happened. The order is a fact about it, and a fact you may want to filter on is hard to use as text inside a sentence.",
                "resource": "A Resource describes the source and is the same for every record from it. Orders differ from record to record, so it cannot go there."
              }
            },
            {
              "id": "severity-text",
              "label": "SeverityText: WARN",
              "why": "The level as the source wrote it, the original string. It is one of the two severity fields of a record.",
              "whyNot": {
                "body": "The Body is the message. WARN is one short level label, not a message that explains the event.",
                "resource": "WARN on one record can be ERROR on the next.",
                "trace": "WARN is not the ID of a trace or a span.",
                "attributes": "The level of a record has fields of its own in the data model, so it is not added as one more key and value."
              }
            },
            {
              "id": "service-name",
              "label": "service.name = payments",
              "why": "It says which service emitted the record, and it is the same on every record the service emits. The Resource describes the source of the log.",
              "whyNot": {
                "body": "This is a key and a value, not a sentence.",
                "severity": "service.name says nothing about how serious a record is.",
                "trace": "This is not a trace or span ID.",
                "attributes": "It does not describe this event. It describes the source, and it is the same for every record from it."
              }
            },
            {
              "id": "trace-id",
              "label": "TraceId: 4bf92f3577b34da6a3ce929d0e0e4736",
              "why": "The ID of the trace the record was written in, as defined by W3C Trace Context. It is a field of the record, set for logs that are part of request processing.",
              "whyNot": {
                "body": "A trace ID is 32 hex characters that machines use to match records, not a sentence.",
                "severity": "Nothing in a trace ID says how serious anything is.",
                "resource": "Each request has its own trace ID, so it is not fixed for a source the way a Resource is.",
                "attributes": "The record has a field of its own for this ID, so it is not a key you add. That field is how a backend can link the record to its trace."
              }
            },
            {
              "id": "msg-retry",
              "label": "\"Retrying in 2 seconds\"",
              "why": "Another message for a person to read: the Body.",
              "whyNot": {
                "severity": "This is a sentence, not a level such as WARN.",
                "resource": "A retry message is about one moment, so it is not the same on every record.",
                "trace": "A sentence is not an ID.",
                "attributes": "Attributes are key and value facts. This is a sentence for a reader, with no key and no value."
              }
            },
            {
              "id": "payment-method",
              "label": "payment.method = card",
              "why": "Another fact about this one event. It can be card on one record and another method on the next, which is what attributes are for.",
              "whyNot": {
                "severity": "card is a value, not a level such as WARN or ERROR.",
                "trace": "card is not a trace or span ID.",
                "body": "It is a fact you may want to filter and count by. Words in a message are text to search, not a field you can query.",
                "resource": "It varies from record to record. A Resource stays the same for the source, so it cannot go there."
              }
            },
            {
              "id": "severity-number",
              "label": "SeverityNumber: 13",
              "why": "The normalised level: an integer from 1 to 24. 13 is the first number of the WARN range, 13 to 16.",
              "whyNot": {
                "body": "13 is an integer, not a message for a person.",
                "resource": "13 can be 17 on the next record.",
                "trace": "13 is not the ID of a trace or a span.",
                "attributes": "It is the other half of the level, which has fields of its own in the record. It is not a key you add."
              }
            },
            {
              "id": "pod-name",
              "label": "k8s.pod.name = payments-6c5d9",
              "why": "The pod is part of the source that emits the record, and it stays the same for the life of the producer. That is a resource attribute.",
              "whyNot": {
                "body": "A pod name is not a sentence about what happened.",
                "severity": "A pod name says nothing about how serious a record is.",
                "trace": "A pod name is not a trace or span ID.",
                "attributes": "The pod is the same for every record the process emits. It describes the producer, not this event."
              }
            },
            {
              "id": "span-id",
              "label": "SpanId: 00f067aa0ba902b7",
              "why": "The ID of the span the record was written in. Like TraceId, it is a field of the record.",
              "whyNot": {
                "body": "A span ID is 16 hex characters for machines, not a sentence to read.",
                "severity": "A span ID is just 16 hex characters. It carries no level.",
                "resource": "A span ID changes with each operation.",
                "attributes": "The record has a field of its own for this ID. It is not a key you add."
              }
            },
            {
              "id": "retry-attempt",
              "label": "retry.attempt = 1",
              "why": "The attempt this record is about, a fact about this one event. The next record can say 2.",
              "whyNot": {
                "severity": "An attempt count is not a level such as WARN or ERROR.",
                "trace": "An attempt number is not a trace or span ID.",
                "body": "A number you may want to filter on is hard to use as a word in a sentence.",
                "resource": "It changes from one record to the next, and a Resource does not."
              }
            },
            {
              "id": "trace-flags",
              "label": "TraceFlags: 01",
              "why": "The trace flags of the trace the record belongs to, as defined by W3C Trace Context. 01 is the sampled flag. It is a field of the record, with TraceId and SpanId.",
              "whyNot": {
                "body": "01 is one flag byte, not text for a person.",
                "severity": "01 is one flag byte. It carries no level.",
                "resource": "These flags can differ from one request to the next.",
                "attributes": "The record has a field of its own for the flags, as it does for the trace ID and the span ID. It is not a key you add."
              }
            }
          ]
        }
      },
      {
        "intro": "Support wants every decline for order 8841, and a count of declines by payment method. The code currently writes one sentence per decline.",
        "question": "How should the decline be recorded?",
        "choice": {
          "id": "sl-attrs",
          "choices": [
            {
              "key": "all-in-body",
              "label": "One sentence with everything in it: <code>Payment declined for order 8841 by card, attempt 1</code>",
              "why": "It reads well, but to count declines by payment method someone has to take the sentence apart again, and a reworded message breaks that. Facts you want to filter on are better as attributes."
            },
            {
              "key": "short-message",
              "label": "A short message in the Body, with <code>order.id</code> and <code>payment.method</code> as Attributes",
              "why": "The Body holds the message and the Attributes hold additional information about this specific event, which can vary from record to record. Support can then filter by <code>order.id</code> and group by <code>payment.method</code> without taking a sentence apart. Structured logs mean a consistent schema of named, typed fields, not only text that happens to be JSON."
            },
            {
              "key": "on-resource",
              "label": "As resource attributes, set once on the Resource, so the records of the service carry them",
              "why": "A Resource is fixed for a source: every record from it has the same Resource. An order and a payment method differ from record to record, so they cannot be set once on the source."
            }
          ]
        }
      },
      {
        "intro": "The on-call dashboard should show \"warning or worse\" from every service. The Java services write <code>WARN</code>, the Python ones <code>warning</code>, and one team writes <code>Warn</code>.",
        "question": "What should the filter use?",
        "choice": {
          "id": "sl-severity",
          "choices": [
            {
              "key": "text",
              "label": "Filter on <code>SeverityText</code> equal to <code>WARN</code> in uppercase",
              "why": "SeverityText is the original string from the source: one library writes <code>WARN</code>, another <code>warning</code>, another <code>Warn</code>. A filter on one spelling misses the others."
            },
            {
              "key": "number",
              "label": "Filter on <code>SeverityNumber</code> of 13 or more",
              "why": "SeverityNumber is normalised to the same scale for every source, from 1 to 24, and smaller means less severe. WARN is 13 to 16, ERROR 17 to 20 and FATAL 21 to 24, so 13 or more is \"warning or worse\" whatever the source called it. The text stays as the original string the source wrote."
            },
            {
              "key": "body",
              "label": "Search the Body for the word <code>warn</code>, in any letter case",
              "why": "The Body is the message, which can be any text and can say \"warn\" about something harmless, or not say it at all. Severity has fields of its own."
            }
          ]
        }
      },
      {
        "intro": "A teammate read about the Logs Bridge API and wants to rewrite every <code>logger.warn(...)</code> in checkout to call it directly, so that the logs reach OpenTelemetry.",
        "question": "What do you tell them?",
        "choice": {
          "id": "sl-bridge",
          "choices": [
            {
              "key": "call-bridge",
              "label": "Replace the logging calls with direct calls to the Logs Bridge API",
              "why": "The Logs Bridge API is provided for logging library authors, to build appenders. As an application developer you are not meant to call it directly for ordinary log lines."
            },
            {
              "key": "keep-logger",
              "label": "Keep your logging library and configure a log appender (a bridge) that sends its records to OpenTelemetry",
              "why": "The Logs Bridge API is for logging library authors, who build appenders that map their library's records onto the OpenTelemetry log data model. You keep the logger your code already uses, and add the appender to your setup. The specification does say the Logs API can also be used directly by applications, for example to emit structured events, but that is not the usual route for the log lines you already write."
            },
            {
              "key": "collector-only",
              "label": "Nothing in the application: logs only reach OpenTelemetry through the Collector reading files",
              "why": "Reading files or standard output with the Collector is one route. The other is an appender in the application, which sends records to OpenTelemetry and can attach the trace context."
            }
          ]
        }
      }
    ]
  }
};
