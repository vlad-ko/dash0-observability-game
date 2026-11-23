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
        "intro": "Payments at Kettle &amp; Co declined a card, and the logs tell you. A log record is more than a line of text: the data model gives it separate fields. Here are twelve pieces of the records it wrote.",
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
              "why": "The level as the source wrote it, the original string. The data model gives it a severity field of its own, SeverityText.",
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
            },
            {
              "id": "msg-timeout",
              "label": "\"Card provider did not answer in time\"",
              "why": "A message a person reads, about what happened. The Body holds the message of the record.",
              "whyNot": {
                "severity": "Severity is a short level label such as WARN or ERROR. This is a sentence about what happened.",
                "resource": "A Resource is the same for every record from a source. This sentence is about one event.",
                "trace": "Trace context holds IDs that tie a record to a request. It holds no message text.",
                "attributes": "Attributes are key and value pairs. This is a sentence for a person to read, with no key and no value."
              }
            },
            {
              "id": "payment-amount",
              "label": "payment.amount = 42.50",
              "why": "A fact about this one payment, as a key and a value. The next record can carry another amount, which is what Attributes are for.",
              "whyNot": {
                "severity": "An amount is not a level such as WARN or ERROR.",
                "trace": "An amount is a business fact, not a trace or span ID.",
                "body": "It is a number you may want to filter or add up. Inside a sentence it is text to search, not a field you can query.",
                "resource": "Each payment has its own amount. A Resource is the same for every record from the source, so it cannot go there."
              }
            },
            {
              "id": "severity-text-error",
              "label": "SeverityText: ERROR",
              "why": "The level as the source wrote it, the original string. The data model gives it a severity field of its own, SeverityText.",
              "whyNot": {
                "body": "The Body is the message. ERROR is one short level label, not a message that explains the event.",
                "resource": "ERROR on one record can be INFO on the next.",
                "trace": "ERROR is not the ID of a trace or a span.",
                "attributes": "The level of a record has fields of its own in the data model, so it is not added as one more key and value."
              }
            },
            {
              "id": "service-version",
              "label": "service.version = 3.2.0",
              "why": "The version of the payments code that emitted the record. It is the same on every record that process emits, so it describes the source: the Resource.",
              "whyNot": {
                "body": "This is a key and a value, not a sentence.",
                "severity": "A version says nothing about how serious a record is.",
                "trace": "A version is not a trace or span ID.",
                "attributes": "It does not describe this event. It describes the source, and it is the same for every record from it."
              }
            },
            {
              "id": "trace-id-other",
              "label": "TraceId: 0af7651916cd43dd8448eb211c80319c",
              "why": "The ID of the trace another record was written in, as defined by W3C Trace Context. Each request has its own, and it is a field of the record.",
              "whyNot": {
                "body": "A trace ID is 32 hex characters that machines use to match records, not a sentence.",
                "severity": "Nothing in a trace ID says how serious anything is.",
                "resource": "Each request has its own trace ID, so it is not fixed for a source the way a Resource is.",
                "attributes": "The record has a field of its own for this ID, so it is not a key you add."
              }
            },
            {
              "id": "msg-refund",
              "label": "\"Refund sent to the customer\"",
              "why": "Another message for a person to read, so it goes in the Body.",
              "whyNot": {
                "severity": "This is a sentence, not a level such as WARN.",
                "resource": "A refund message is about one event, so it is not the same on every record.",
                "trace": "A sentence is not an ID.",
                "attributes": "Attributes are key and value facts. This is a sentence for a reader, with no key and no value."
              }
            },
            {
              "id": "payment-currency",
              "label": "payment.currency = EUR",
              "why": "Another fact about this one payment. It can be EUR on one record and another currency on the next, so it is an attribute.",
              "whyNot": {
                "severity": "EUR is a currency, not a level such as WARN or ERROR.",
                "trace": "EUR is not a trace or span ID.",
                "body": "It is a fact you may want to filter and count by. Words in a message are text to search, not a field you can query.",
                "resource": "It varies from payment to payment. A Resource stays the same for the source, so it cannot go there."
              }
            },
            {
              "id": "severity-number-error",
              "label": "SeverityNumber: 17",
              "why": "The normalised level: an integer from 1 to 24. 17 is the first number of the ERROR range, 17 to 20.",
              "whyNot": {
                "body": "17 is an integer, not a message for a person.",
                "resource": "17 can be 9 on the next record.",
                "trace": "17 is not the ID of a trace or a span.",
                "attributes": "It is the other half of the level, which has fields of its own in the record. It is not a key you add."
              }
            },
            {
              "id": "namespace",
              "label": "k8s.namespace.name = shop",
              "why": "The namespace the payments pod runs in. It is the same on every record the process emits, so it is part of the source: a resource attribute.",
              "whyNot": {
                "body": "A namespace is not a sentence about what happened.",
                "severity": "A namespace says nothing about how serious a record is.",
                "trace": "A namespace is not a trace or span ID.",
                "attributes": "The namespace is the same for every record the process emits. It describes the producer, not this event."
              }
            },
            {
              "id": "span-id-other",
              "label": "SpanId: b7ad6b7169203331",
              "why": "The ID of the span another record was written in. Each operation has its own, and like TraceId it is a field of the record.",
              "whyNot": {
                "body": "A span ID is 16 hex characters for machines, not a sentence to read.",
                "severity": "A span ID is just 16 hex characters. It carries no level.",
                "resource": "A span ID changes with each operation.",
                "attributes": "The record has a field of its own for this ID. It is not a key you add."
              }
            },
            {
              "id": "customer-id",
              "label": "customer.id = 5512",
              "why": "The customer this payment is for, a fact about this one event. The next record can name another customer.",
              "whyNot": {
                "severity": "A customer ID is not a level such as WARN or ERROR.",
                "trace": "A customer ID is a business fact, not a trace or span ID.",
                "body": "An ID you may want to filter on is hard to use as a word in a sentence.",
                "resource": "It changes from one payment to the next, and a Resource does not."
              }
            },
            {
              "id": "trace-flags-unsampled",
              "label": "TraceFlags: 00",
              "why": "The trace flags of the request the record was written in, as defined by W3C Trace Context. 00 leaves the sampled flag unset. It is still a field of the record, with TraceId and SpanId.",
              "whyNot": {
                "body": "00 is one flag byte, not text for a person.",
                "severity": "00 is one flag byte. It carries no level.",
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
              "why": "The Body holds the message and the Attributes hold additional information about this specific event, which can vary from record to record. Support can then filter by <code>order.id</code> and group by <code>payment.method</code> without taking a sentence apart. [[Structured logs]] mean a consistent schema of named, typed fields, not only text that happens to be JSON."
            },
            {
              "key": "on-resource",
              "label": "As resource attributes, set once on the Resource, so the records of the service carry them",
              "why": "A Resource is fixed for a source: every record from it has the same Resource. An order and a payment method differ from record to record, so they cannot be set once on the source."
            },
            {
              "key": "named-attrs",
              "label": "Write one message for each decline, and give the order and the payment method fields of their own",
              "why": "The Body carries the message, and the Attributes carry additional information about this specific event, which can differ from record to record. Support can filter on one named field and group by another without taking the text apart."
            },
            {
              "key": "pairs-on-record",
              "label": "Log <code>Payment declined</code> and add details such as order 8841 and the card used as key and value pairs",
              "why": "Key and value pairs on the record are its Attributes. Each decline is then one record with a short message and facts that can be filtered, counted and grouped on."
            },
            {
              "key": "facts-out-of-text",
              "label": "Make the facts attributes of the record, so Support can filter on them and count by them",
              "why": "A fact you want to filter or count by should be a field of its own. The Attributes of a log record hold such facts as named values, and the Body is left for the message a person reads."
            },
            {
              "key": "regex-in-dashboard",
              "label": "Keep the message in the Body and pull the facts out as attributes with a dashboard regular expression",
              "why": "A regular expression has to be kept in step with the wording of every message, and a reworded message breaks it. The record has Attributes for facts like these, so they can be queried as they are."
            },
            {
              "key": "pairs-in-body",
              "label": "Write key and value pairs into the Body text, for example <code>order.id=8841 payment.method=card</code>",
              "why": "The Body is still one string, so the pairs have to be parsed out again before anyone can filter or group on them. Semistructured text like this does not guarantee a stable schema either. Attributes are the fields of the record for facts like these."
            },
            {
              "key": "order-as-trace-id",
              "label": "Put the order number in the TraceId field, so that every record of one order shares an ID",
              "why": "TraceId is the ID of a trace, as defined by W3C Trace Context, and it is set for logs that are part of request processing. An order number is not a trace ID, so a backend that follows it to a trace finds nothing."
            },
            {
              "key": "method-as-severity",
              "label": "Put the payment method in SeverityText, such as <code>CARD</code>, so that it has a field of its own",
              "why": "SeverityText is the original string of the level at the source, such as WARN. A payment method says nothing about severity, and a filter on the level would then return payment methods."
            },
            {
              "key": "three-records",
              "label": "Write three records for a decline: one for the order, one for the method and one for the message",
              "why": "One decline is one event, so it should be one record. Split in three, the facts are no longer tied together, and a count of records would count every decline three times."
            },
            {
              "key": "count-in-metric",
              "label": "Count the declines in a metric, with the payment method as an attribute",
              "why": "A metric keeps counts, not the individual declines that Support wants for one order. Facts about single events are what the Attributes of a log record hold."
            },
            {
              "key": "scope-attributes",
              "label": "Set the facts <code>order.id</code> and <code>payment.method</code> as attributes of the InstrumentationScope of the logger",
              "why": "The InstrumentationScope describes the scope that emitted the log, and all records from one scope share it. An order and a method differ from record to record, so they cannot be set once on it."
            },
            {
              "key": "service-per-order",
              "label": "Give the service a new name, for example <code>service.name = order-8841</code>, as a resource attribute for the order",
              "why": "The service name is part of the Resource, which describes the source of the log, so it is the same for every record from that source. Naming a source after one order would need a new source for every order."
            },
            {
              "key": "message-per-method",
              "label": "Write a different message in the Body for each payment method, such as <code>Card declined</code>, and group on it",
              "why": "Grouping on message text breaks when the wording changes, and the order is still missing from the record. A method is a value, and values belong in the Attributes."
            },
            {
              "key": "raise-to-error",
              "label": "Raise the declines to ERROR, so that Support can find them by severity and count them",
              "why": "Severity says how serious a record is, not which order or method it is about. A filter on ERROR returns every error from every service, and still gives no count by payment method."
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
              "why": "SeverityText is the original string from the source: one library writes <code>WARN</code>, another <code>warning</code>, another <code>Warn</code>. A filter on one spelling misses every other spelling."
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
            },
            {
              "key": "number-range",
              "label": "Filter on <code>SeverityNumber</code> from 13 to 24, which keeps WARN at 13 to 16 and everything higher",
              "why": "The data model normalises severity to a number from 1 to 24: WARN is 13 to 16, ERROR 17 to 20 and FATAL 21 to 24. A range from 13 up is every record at warning or worse, whatever each library calls its level."
            },
            {
              "key": "number-from-warn",
              "label": "Compare the numeric severity from <code>WARN</code> upwards in any service",
              "why": "Every source maps its own level onto the same numbers, so a query on the number does not care whether a record said WARN, warning or Warn. The data model says comparisons of severity should use SeverityNumber."
            },
            {
              "key": "severity-range",
              "label": "Filter on the <code>WARN</code> severity range and the ranges above it in Dash0",
              "why": "Dash0 groups logs into severity ranges, from FATAL down to TRACE, and OpenTelemetry specifies those ranges by the severity number. Picking the three upper ranges gives warning or worse across all sources."
            },
            {
              "key": "lower-case-text",
              "label": "Lower-case the severity text and filter on <code>warn</code>",
              "why": "The Python services write <code>warning</code>, and lower-casing only settles the capitals of <code>Warn</code> and <code>WARN</code>. Records that say <code>warning</code>, and everything worse than a warning, are still missed. The number does not depend on any spelling."
            },
            {
              "key": "number-equals-13",
              "label": "Filter on <code>SeverityNumber</code> equal to 13",
              "why": "13 is only the first number of the WARN range, which runs from 13 to 16. Records at 14, 15 and 16 are missed, and so are all the errors and fatals."
            },
            {
              "key": "number-at-most-16",
              "label": "Filter on <code>SeverityNumber</code> of 16 or less, the range up to the end of WARN",
              "why": "Smaller numbers are less severe. This keeps the debug and info records and drops every error, so the comparison runs the wrong way for warning or worse."
            },
            {
              "key": "number-warn-only",
              "label": "Filter on the severity number of 13 to 16 for the whole WARN range and nothing above it",
              "why": "13 to 16 is the WARN range alone. Warning or worse also includes ERROR at 17 to 20 and FATAL at 21 to 24, which this filter drops."
            },
            {
              "key": "number-from-17",
              "label": "Filter on <code>SeverityNumber</code> of 17 or more and skip the 13 to 16 range",
              "why": "17 is the first number of the ERROR range, so this drops every warning. The dashboard is meant to show warnings as well."
            },
            {
              "key": "number-from-9",
              "label": "Filter on the severity number from 9 and above, which lets every INFO record in",
              "why": "9 to 12 is the INFO range, for an event that happened. A filter from 9 up lets informational records in, and they are not warnings."
            },
            {
              "key": "text-as-strings",
              "label": "Compare the severity text as strings, from <code>WARN</code> upwards",
              "why": "Text has no order that follows how serious a record is. In alphabetical order FATAL and ERROR sort before WARN, so they are left out. The data model says comparisons of severity should use the number."
            },
            {
              "key": "has-exception",
              "label": "Filter for any record that carries an <code>exception.type</code> attribute, the mark of a problem",
              "why": "Exception attributes describe an error or exception attached to a record. Many warnings carry none, so they are missed, and an error logged without an exception is missed as well."
            },
            {
              "key": "event-name",
              "label": "Filter on <code>EventName</code> of <code>warning</code> or <code>error</code>",
              "why": "EventName identifies the class or type of an event, and it is optional. It is not a level, so it says nothing about how serious a record is."
            },
            {
              "key": "trace-flags-level",
              "label": "Read the severity from <code>TraceFlags</code>, where <code>01</code> marks any warning or worse",
              "why": "TraceFlags holds the W3C trace flags, and the only flag defined is the sampled flag. It says nothing about severity."
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
              "why": "The Logs Bridge API is for logging library authors, who build [[appenders]] that map their library's records onto the OpenTelemetry log data model. You keep the logger your code already uses, and add the appender to your setup. The specification does say the [[Logs API]] can also be used directly by applications, for example to emit structured events, but that is not the usual route for the log lines you already write."
            },
            {
              "key": "collector-only",
              "label": "Nothing in the application: logs only reach OpenTelemetry through the Collector reading files",
              "why": "Reading files or standard output with the Collector is one route. The other is an appender in the application, which sends records to OpenTelemetry and can attach the trace context."
            },
            {
              "key": "leave-calls",
              "label": "Leave each <code>logger.warn</code> call in checkout alone, and connect OpenTelemetry once when the application starts",
              "why": "Application developers only need to configure the appender and the SDK at start-up. The appender uses the Logs API to bridge the library's records onto the OpenTelemetry log data model, so no logging statement has to change."
            },
            {
              "key": "appender-and-sdk",
              "label": "Configure the OpenTelemetry integration for the service, and every log statement gains the trace context too",
              "why": "A log appender bridges an existing logging library to OpenTelemetry. With the SDK it can add the trace context of the active span to each record and send the records over OTLP, and the logging statements stay as they are."
            },
            {
              "key": "library-bridge",
              "label": "Let the library's appender do the bridging, since that API is for library authors",
              "why": "Logging library authors use the Logs Bridge API to build appenders. As an application developer you use your preferred logging library and configure its appender, instead of calling the API yourself."
            },
            {
              "key": "api-for-legacy",
              "label": "Call the OpenTelemetry Logs API directly in every service, because log appenders are only meant for legacy code",
              "why": "The Logs API was primarily designed for library authors to build appenders. For applications that already use a logging library, an appender is the simplest way to emit logs with their trace context."
            },
            {
              "key": "own-bridge",
              "label": "Write your own appender from your library's logger to OpenTelemetry for checkout",
              "why": "Building appenders is the job of the logging library authors, who use the Logs Bridge API for it. The OpenTelemetry language SDKs already offer an appender, so an application only configures it."
            },
            {
              "key": "own-logger-provider",
              "label": "Configure a <code>LoggerProvider</code> and a <code>Logger</code> in checkout, and call them beside each <code>logger.warn</code>",
              "why": "The Logger Provider and the Logger are part of the Logs Bridge API, and they should only be used by the author of a logging library. Calling them beside every logging call would also add a second call to each line."
            },
            {
              "key": "json-printing-library",
              "label": "Configure your logging library to print JSON, and OpenTelemetry reads the records from the process",
              "why": "Printing JSON sends nothing to OpenTelemetry. Records reach it through a log appender in the application, or through a Collector that reads the files or standard output."
            },
            {
              "key": "span-around-call",
              "label": "Wrap each <code>logger.warn</code> in a span, so that the record is exported together with the span",
              "why": "A span belongs to the trace signal and does not carry log records. Log records are sent by a log record exporter, which an appender feeds."
            },
            {
              "key": "appender-in-collector",
              "label": "Install a log appender in the Collector, which then turns the application's log calls into OpenTelemetry records",
              "why": "An appender belongs to the application's logging library, where the log call is made. The Collector only sees what is sent to it or written to a file, so it never sees the call."
            },
            {
              "key": "api-replaces-library",
              "label": "Replace your logging library with the OpenTelemetry Logs API in every service, to get its full set of features",
              "why": "Existing logging libraries generally provide a much richer set of features than the Logs API defines. Replacing them gives those up, and an appender gets the records into OpenTelemetry without that cost."
            },
            {
              "key": "debug-level",
              "label": "Configure the logger at DEBUG level and every record it writes reaches OpenTelemetry without further setup",
              "why": "A level decides which records the library emits, not where they go. Nothing reaches OpenTelemetry until an appender is configured."
            },
            {
              "key": "dependency-only",
              "label": "Add the Logs Bridge API as a dependency of checkout (no other change)",
              "why": "A dependency alone connects nothing. Records are bridged only when a log appender is configured with the SDK at start-up, and the Bridge API itself is meant for library authors."
            },
            {
              "key": "hand-written-post",
              "label": "Post each warning to the OTLP endpoint with a hand-written HTTP call beside the log line",
              "why": "That adds new code at every call site, which is what an appender avoids. The appender and the SDK already convert the records, enrich them and send them over OTLP."
            }
          ]
        }
      }
    ]
  }
};
