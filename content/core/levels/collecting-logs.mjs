// Text of levels/collecting-logs.mjs (docs/CONTENT.md).
export default {
  "id": "collecting-logs",
  "name": "Collecting logs",
  "sub": "Files, lines and records",
  "rewardTitle": "Log collector",
  "play": {
    "finish": "You can get logs into the pipeline: an appender and OTLP for code you own, the filelog receiver for files you cannot change, wired into a logs pipeline, split with multiline and parsed with operators.",
    "steps": [
      {
        "intro": "Two Kettle &amp; Co services log in different ways. Orders is the team's own code and prints one JSON object per line to standard output. Shipping runs a vendor's label-printer agent that nobody can change: it writes plain text lines to <code>/var/log/shipping/agent.log</code>. The platform team wants both in Dash0, and wants orders' records linked to their traces.",
        "question": "How should orders' logs reach Dash0?",
        "choice": {
          "id": "col-route",
          "choices": [
            {
              "key": "otlp-appender",
              "label": "Add an OpenTelemetry log appender to orders' logger, so its records are exported over OTLP",
              "why": "The records leave the app already structured, with TraceId and SpanId taken from the active span, and there are no files to tail, rotate or parse. The cost is a change to the app, and the log is no longer a local file you can read. Tailing standard output with the Collector is the other route, and it is the one for code you cannot change, like shipping's agent: it needs no change to the app, but the Collector has to parse every line back into fields, and that may not be reliable when the format is loose."
            },
            {
              "key": "tail-adds-context",
              "label": "Tail its stdout file with <code>filelog</code>: the Collector can tell which trace a line belongs to",
              "why": "A line in a file has no execution context of its own. The Collector can add resource attributes such as the pod, but a trace ID is there only if the application wrote it into the line, as a <code>trace_id</code> field in the JSON, and the Collector then parses it out. Matching by time alone is the most basic form of correlation, not the trace context."
            },
            {
              "key": "otlp-no-logs",
              "label": "Logs cannot go over OTLP, which carries traces and metrics, so orders has to keep writing files",
              "why": "OTLP carries logs as well as traces and metrics. The logs specification describes applications sending log records straight to the Collector over OTLP, through a log appender for their logging library."
            }
          ]
        }
      },
      {
        "intro": "Shipping's file has to be read by the Collector. The platform team defined a <code>filelog/shipping</code> receiver and wired a <code>logs</code> pipeline to Dash0, but no shipping record arrives: the Collector would not start.",
        "question": "Fix the config so <code>filelog/shipping</code> feeds the logs pipeline, which exports to Dash0.",
        "configure": {
          "id": "col-config",
          "hint": "A pipeline list must match a receiver's id exactly. The id is the type, plus a slash and a name when there is one. Compare the id where the receiver is defined with the one the logs pipeline lists, character by character, and change the list, not the definition. Keep the file receiver; do not swap in another.",
          "explain": "A receiver reads nothing until a pipeline lists it, and a pipeline can only list what is defined, spelled the same: <code>filelog</code> and <code>filelog/shipping</code> are different components, because the part after the slash names an instance. Defined but not listed, the receiver reads nothing; listed but not defined, the Collector refuses to start. Pointing the logs pipeline at <code>otlp</code> instead would start the Collector too, but shipping's file would never be read, so the task needs <code>filelog/shipping</code> in the logs pipeline, which exports to Dash0. The receiver produces logs, so it belongs in a logs pipeline, and it is a contrib component. Its settings do the reading: <code>include</code> says which files, and <code>start_at</code> where to begin (the default is the end of the file, so lines already there are skipped). This game checks the wiring, not the settings; the next steps are about two more of them."
        }
      },
      {
        "intro": "The config is right and shipping's lines are flowing. Then the agent crashes and prints a stack trace, and Dash0 shows every line of it as a record of its own. This is what is in the file:",
        "question": "How do you keep one stack trace together as one record?",
        "code": "2026-11-01 03:07:41 ERROR label printer offline: port 9100 refused\njava.net.ConnectException: Connection refused\n    at com.labelco.agent.Printer.open(Printer.java:88)\n    at com.labelco.agent.Queue.flush(Queue.java:41)\n2026-11-01 03:07:46 INFO reconnecting to printer",
        "choice": {
          "id": "col-multiline",
          "choices": [
            {
              "key": "line-start",
              "label": "Set <code>multiline</code> on the receiver, with a <code>line_start_pattern</code> that matches the beginning of an entry: the timestamp",
              "why": "By default the receiver ends an entry at every newline. With <code>multiline</code> it ends an entry where the pattern says the next one starts, so the lines that do not begin with a timestamp stay with the entry before them. The block takes exactly one of <code>line_start_pattern</code> and <code>line_end_pattern</code>. The split happens as the file is read, before any operator runs, so the parser then sees the whole stack trace as one entry."
            },
            {
              "key": "frame-pattern",
              "label": "Set <code>multiline</code> with a <code>line_start_pattern</code> that matches the stack frames: <code>^\\s+at </code>",
              "why": "The start pattern has to match the line an entry begins with, and a frame is not where an entry begins. A pattern that matches frames starts a new entry at every frame, so the trace is still cut into pieces, and the next record's timestamp line is glued onto the last frame."
            },
            {
              "key": "parser-joins",
              "label": "Add a <code>regex_parser</code> operator for the first line, and the lines under it will follow it into the same entry",
              "why": "Operators work on entries that are already split. With no <code>multiline</code>, every line is an entry of its own by the time a parser sees it, so a parser cannot join them."
            }
          ]
        }
      },
      {
        "intro": "Shipping's records now arrive whole, but each one is a single long line of text with no severity number: nothing reads the <code>ERROR</code> in it. The first line of an entry looks like this: <code>2026-11-01 03:07:41 ERROR label printer offline: port 9100 refused</code>.",
        "question": "Where do you parse the level out of the line?",
        "choice": {
          "id": "col-parse",
          "choices": [
            {
              "key": "collector-regex",
              "label": "In the Collector: add a <code>regex_parser</code> operator to the receiver, with a <code>severity</code> block",
              "why": "Operators run on each entry inside the receiver. The named groups of the regular expression become attributes, and the <code>severity</code> block sets the record's severity from the group it names, here the level. The entry is several lines long, so the expression turns on the <code>s</code> flag, <code>(?s)</code>, to let <code>.</code> match a newline; without it the message group stops at the first line break. Shipping's agent cannot be changed, so the Collector is the only place to parse it. Where you own the code, the better place is the source: write JSON, or export over OTLP with the severity already set."
            },
            {
              "key": "agent-config",
              "label": "In the vendor's agent: change its log format to JSON, then read the level as a field",
              "why": "Nobody can change the vendor's agent, which is why the Collector reads its file at all. Where you do own the code, writing JSON, or exporting over OTLP, beats parsing text back into fields."
            },
            {
              "key": "receiver-knows",
              "label": "Nowhere: the <code>filelog</code> receiver reads the word <code>ERROR</code> and sets the severity on its own",
              "why": "The receiver reads text and does nothing with it. With no operator that parses the level, the record has no severity number: the line is the Body. Dash0 documents UNSPECIFIED as the severity range of records that arrive without one, which is common for pod logs read with the filelog receiver."
            }
          ]
        }
      },
      {
        "intro": "The notifications team never wrote a parser either. Their plain text lines reach Dash0 with no severity number, and one message repeats thousands of times with a different order number in it.",
        "question": "What does Dash0 do with those unstructured records?",
        "choice": {
          "id": "col-dash0",
          "choices": [
            {
              "key": "log-ai",
              "label": "Log AI infers a severity for them and groups similar messages into patterns, with the variable parts as named attributes",
              "why": "Log AI works on unstructured messages as they are ingested. It infers a severity where none is set, and it extracts patterns: the variable parts, such as order numbers, become placeholders in the pattern and named attributes you can filter and group by (the Patterns view, and the <code>dash0.log.pattern</code> attribute). It never overrides a severity that is already set, and it leaves structured logs such as JSON to JSON log processing. It relies on resource attributes, so on Kubernetes the <code>k8sattributes</code> processor still matters. A parser in the Collector stays the precise fix; Log AI is for text nobody parsed."
            },
            {
              "key": "rewrites-all",
              "label": "Log AI replaces the severity you set in the Collector, and in JSON logs, with its own guess",
              "why": "It does not. A severity that is explicitly set is respected, and structured logs are handled separately, by JSON log processing."
            },
            {
              "key": "needs-parser",
              "label": "Without a parser in the Collector, the records stay plain text with no severity",
              "why": "Dash0 does not wait for a parser. Log AI infers a severity and extracts patterns from unstructured messages as they are ingested. A parser in the Collector is still the better fix when you can write one."
            }
          ]
        }
      }
    ]
  }
};
