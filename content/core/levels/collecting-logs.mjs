// Text of levels/collecting-logs.mjs (docs/CONTENT.md).
export default {
  "id": "collecting-logs",
  "name": "Collecting logs",
  "sub": "Files, lines and records",
  "rewardTitle": "Log collector",
  "play": {
    "finish": "You can get logs into the pipeline: an appender and OTLP for code you own, the file_log receiver for files you cannot change, wired into a logs pipeline, split with multiline and parsed with operators.",
    "steps": [
      {
        "intro": "Two Kettle &amp; Co services log in different ways. Orders is the team's own code and prints one JSON object per line to standard output. Shipping runs a vendor's label-printer agent that nobody can change: it writes plain text lines to <code>/var/log/shipping/agent.log</code>. The platform team wants both in Dash0, and wants orders' records linked to their [[traces]].",
        "question": "How should orders' logs reach Dash0?",
        "choice": {
          "id": "col-route",
          "choices": [
            {
              "key": "otlp-appender",
              "label": "Add an OpenTelemetry log appender to orders' logger, so its records go out over OTLP",
              "why": "The records leave the app already structured, with TraceId and SpanId taken from the active span, and there are no files to tail, rotate or parse. The cost is a change to the app, and the log is no longer a local file you can read. Tailing standard output with the Collector is the other route, and it is the one for code you cannot change, like shipping's agent: it needs no change to the app, but the Collector has to parse every line back into fields, and that may not be reliable when the format is loose."
            },
            {
              "key": "tail-adds-context",
              "label": "Tail its stdout file with <code>file_log</code>: the Collector can tell which trace a line belongs to",
              "why": "A line in a file has no execution context of its own. The Collector can add resource attributes such as the pod, but a trace ID is there only if the application wrote it into the line, as a <code>trace_id</code> field in the JSON, and the Collector then parses it out. Matching by time alone is the most basic form of correlation, not the trace context."
            },
            {
              "key": "otlp-no-logs",
              "label": "Logs cannot go over OTLP, which carries traces and metrics, so orders has to keep writing files",
              "why": "[[OTLP]] carries logs as well as traces and metrics. The logs specification describes applications sending log records straight to the Collector over OTLP, through a log appender for their logging library."
            },
            {
              "key": "sdk-and-appender",
              "label": "Let the application send the logs straight to the Collector and keep the trace and span IDs",
              "why": "The appender takes the trace context from the active span, so the records are linked, and OTLP delivers them without a file to tail, rotate or parse. The change is in the application, which the team owns."
            },
            {
              "key": "otlp-target",
              "label": "Change the app's logging target from standard output to a network destination that brings context along",
              "why": "Sending logs direct to the Collector is the second route of the logs specification. Small, localised changes to the code change the logging target, and the logs come out well-defined and highly structured. The cost is the local file, and the destination must accept OTLP."
            },
            {
              "key": "structured-over-otlp",
              "label": "Send structured records over OTLP, so there is no file, no line parsing and no rotation for <code>file_log</code>",
              "why": "For code you own, OTLP removes the parsers and the tailing and keeps the trace context. Tailing is the route for code you cannot change, like the vendor's agent."
            },
            {
              "key": "match-by-timestamp",
              "label": "Keep standard output and let the Collector add trace IDs by matching timestamps to spans",
              "why": "Matching by time is the most basic form of correlation. A trace ID comes from the span a log call ran in, so the application, which sees that span, has to write it."
            },
            {
              "key": "forwarder",
              "label": "Run a log forwarder next to orders to ship its output, as that is how request context reaches the logs",
              "why": "A forwarder reads lines, as the Collector does, and the lines carry no request context unless the application wrote it in. It is another way to collect files and adds no context."
            },
            {
              "key": "plain-text-lines",
              "label": "Switch orders' output to plain text, since the Collector parses text more reliably than JSON",
              "why": "Parsing may not be reliable when the output format is not well-defined, and JSON with a defined schema is a formally structured format. Plain text is the case that needs parsers to get the fields back."
            },
            {
              "key": "log-to-file",
              "label": "Write the logs to a file instead of standard output, giving the Collector a stable place for the context",
              "why": "A line in a file has no execution context of its own. The Collector can add resource attributes such as the pod, but not the span the call ran in. The file also has to be tailed, rotated and parsed, and the records would still carry no trace context unless the app wrote it."
            },
            {
              "key": "same-route-as-shipping",
              "label": "Use shipping's route, tailing a file with <code>file_log</code>, so that one setup serves both services",
              "why": "Tailing a file is the route for code you cannot change, like the vendor's agent. For code the team owns, an appender needs no files and no parsing, and it carries the trace context, which tailing a file would not add unless the app wrote it into the line."
            },
            {
              "key": "stamping-sidecar",
              "label": "Add a sidecar that stamps a trace ID on each line before it forwards the line on",
              "why": "A sidecar cannot know which span a log call ran in, because only the application process knows that. Whatever it stamped would not be the trace the line belongs to."
            },
            {
              "key": "syslog-adds-ids",
              "label": "Send the output through syslog, and syslog adds the context by itself when it forwards it",
              "why": "The syslog format has a place for the trace ID, the span ID and the trace flags, but the application has to record them there. The format does not fill them in."
            },
            {
              "key": "traces-only",
              "label": "Drop the logs and rely on spans, since spans already carry the same facts",
              "why": "The platform team wants the logs in Dash0, linked to their traces, and a link needs logs to link. Logs and traces are separate signals, and one does not replace the other."
            },
            {
              "key": "trace-id-on-resource",
              "label": "Put the trace ID on the Resource, so that the service's records all carry it",
              "why": "The Resource is the same for every record from a source, and a trace ID is different for every request. It is a field of the log record, taken from the active span."
            },
            {
              "key": "start-at-beginning",
              "label": "Keep standard output and set <code>start_at</code> to <code>beginning</code> on the <code>file_log</code> receiver, so that nothing is missed",
              "why": "start_at only says where the receiver begins reading, and the default is the end of the file. It does not change what the lines contain, so they still carry no trace context."
            }
          ]
        }
      },
      {
        "intro": "Shipping's file has to be read by the [[Collector]]. The platform team defined a <code>file_log/shipping</code> [[receiver]] and wired a <code>logs</code> [[pipeline]] to Dash0, but no shipping record arrives: the Collector would not start.",
        "question": "Fix the config so <code>file_log/shipping</code> feeds the logs pipeline, which exports to Dash0.",
        "configure": {
          "id": "col-config",
          "hint": "A pipeline list must match a receiver's id exactly. The id is the type, plus a slash and a name when there is one. Compare the id where the receiver is defined with the one the logs pipeline lists, character by character, and change the list, not the definition. Keep the file receiver; do not swap in another.",
          "explain": "A receiver reads nothing until a pipeline lists it, and a pipeline can only list what is defined, spelled the same: <code>file_log</code> and <code>file_log/shipping</code> are different components, because the part after the slash names an instance. Defined but not listed, the receiver reads nothing; listed but not defined, the Collector refuses to start. Pointing the logs pipeline at <code>otlp</code> instead would start the Collector too, but shipping's file would never be read, so the task needs <code>file_log/shipping</code> in the logs pipeline, which exports to Dash0. The receiver produces logs, so it belongs in a logs pipeline, and it is a [[contrib]] component. Older configs call it <code>filelog</code>: the receiver was renamed to <code>file_log</code>, and the old name is kept as a deprecated alias. Its settings do the reading: <code>include</code> says which files, and <code>start_at</code> where to begin (the default is the end of the file, so lines already there are skipped). This game checks the wiring, not the settings; the next steps are about two more of them."
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
            },
            {
              "key": "start-on-timestamp",
              "label": "Begin one new record wherever a line opens with the date and time of an event",
              "why": "The receiver ends an entry where the pattern says the next one starts, so the stack frames stay with the line above them. The block takes exactly one of <code>line_start_pattern</code> and <code>line_end_pattern</code>, and here it is the start pattern."
            },
            {
              "key": "frames-join-above",
              "label": "Describe the top of a stack trace with a <code>pattern</code> so the frames beneath stay attached",
              "why": "By default an entry ends at every newline. A start pattern that matches the beginning of an entry, the timestamp, makes the lines that do not match belong to the entry before them."
            },
            {
              "key": "split-while-reading",
              "label": "Join the lines in the receiver as the file is read, before any <code>operator</code> touches the trace",
              "why": "The split happens as the file is read, before any operator runs, so it is where one stack trace becomes one entry. The operators then see the whole trace."
            },
            {
              "key": "end-pattern-frames",
              "label": "Use a <code>multiline</code> block, with a <code>line_end_pattern</code> that matches the stack frames of every trace",
              "why": "An end pattern says which line closes an entry. A pattern that matches the frames closes an entry at the first frame, and every later frame closes one of its own, so the trace is still in pieces."
            },
            {
              "key": "both-patterns",
              "label": "Set both a <code>line_start_pattern</code> and a <code>line_end_pattern</code> for the timestamp line of every entry",
              "why": "The <code>multiline</code> block must contain exactly one of <code>line_start_pattern</code> and <code>line_end_pattern</code>, so a block with both is not what the receiver expects."
            },
            {
              "key": "json-parser-joins",
              "label": "Join the lines with a <code>json_parser</code> operator, since a stack trace is one block of text",
              "why": "A <code>json_parser</code> reads a string as JSON, and a stack trace is not JSON. Operators also work on entries that are already split, so they cannot join lines."
            },
            {
              "key": "bigger-max-size",
              "label": "Raise <code>max_log_size</code> so that the whole trace is read as a single piece of text",
              "why": "<code>max_log_size</code> caps how large an entry may be, and by default an entry above it is split. It does not decide where an entry ends, which is at each newline unless <code>multiline</code> says otherwise."
            },
            {
              "key": "start-at-beginning",
              "label": "Read the whole file from the <code>beginning</code> with <code>start_at</code> so the trace arrives whole and unbroken",
              "why": "<code>start_at</code> says where the receiver begins reading when it starts. Reading from the beginning still splits the file at each newline."
            },
            {
              "key": "shorter-poll",
              "label": "Shorten <code>poll_interval</code> to read the lines of a trace in the same poll of the folder",
              "why": "The poll interval is the time between filesystem polls. Lines read in one poll are still split at each newline into entries of their own."
            },
            {
              "key": "set-encoding",
              "label": "Choose <code>utf-8</code> as the <code>encoding</code> so that the line breaks inside the trace stay put when the file is read",
              "why": "<code>encoding</code> says how the bytes of the file are read, and <code>utf-8</code> is already the default. It has no say in where an entry ends."
            },
            {
              "key": "match-every-line",
              "label": "Set <code>multiline</code>, with a <code>line_start_pattern</code> that matches every line of the file",
              "why": "A start pattern begins a new entry at each line that matches it. A pattern that matches every line begins one at every line, so each line is an entry again."
            },
            {
              "key": "omit-the-pattern",
              "label": "Use <code>omit_pattern</code> to strip the timestamp from each line and let the remaining lines join into one entry",
              "why": "<code>omit_pattern</code> only leaves the start or end pattern out of each entry. It belongs to a <code>multiline</code> block and does not decide where entries start."
            },
            {
              "key": "one-line-traces",
              "label": "Make the vendor's agent print each stack trace on one line before it writes the file",
              "why": "Nobody can change the vendor's agent, which is why the Collector reads its file at all. The receiver has to put the entry together itself."
            }
          ]
        }
      },
      {
        "intro": "Shipping's records now arrive whole, but each one is a single long line of text with no [[severity number|severity]]: nothing reads the <code>ERROR</code> in it. The first line of an entry looks like this: <code>2026-11-01 03:07:41 ERROR label printer offline: port 9100 refused</code>.",
        "question": "Where do you parse the level out of the line?",
        "choice": {
          "id": "col-parse",
          "choices": [
            {
              "key": "collector-regex",
              "label": "In the Collector: add a <code>regex_parser</code> operator to the receiver, with a <code>severity</code> block",
              "why": "[[Operators|filelog-operator]] run on each entry inside the receiver. The named groups of the regular expression become attributes, and the <code>severity</code> block sets the record's severity from the group it names, here the level. The entry is several lines long, so the expression turns on the <code>s</code> flag, <code>(?s)</code>, to let <code>.</code> match a newline; without it the message group stops at the first line break. Shipping's agent cannot be changed, so the Collector is the only place to parse it. Where you own the code, the better place is the source: write JSON, or export over OTLP with the severity already set."
            },
            {
              "key": "agent-config",
              "label": "In the vendor's agent: change its log format to JSON, then read the level as a field",
              "why": "Nobody can change the vendor's agent, which is why the Collector reads its file at all. Where you do own the code, writing JSON, or exporting over OTLP, beats parsing text back into fields."
            },
            {
              "key": "receiver-knows",
              "label": "Nowhere: the <code>file_log</code> receiver reads the word <code>ERROR</code> and sets the severity on its own",
              "why": "The receiver reads text and does nothing with it. With no operator that parses the level, the record has no severity number: the line is the Body. Dash0 documents UNSPECIFIED as the severity range of records that arrive without one, which is common for pod logs read with the file_log receiver."
            },
            {
              "key": "receiver-operators",
              "label": "Read the level with a capture group while the file is read and map it onto the scale",
              "why": "Operators run on each entry inside the receiver. A <code>regex_parser</code> turns its named groups into attributes, and its <code>severity</code> block sets the record's severity number from the group that holds the level."
            },
            {
              "key": "regex-to-number",
              "label": "In the receiver, with a parser operator that turns <code>ERROR</code> into a number",
              "why": "Nothing reads the level in a plain text line until an operator parses it. The <code>severity</code> block of the parser sets the severity from the group, so the word ERROR becomes a number in the ERROR range, 17 to 20."
            },
            {
              "key": "where-it-is-read",
              "label": "Parse the log level on the way in since the vendor's agent cannot be changed",
              "why": "Shipping's agent writes plain text that nobody can change, so the Collector has to turn the text into fields as it reads the file. Where you own the code, writing JSON or exporting over OTLP with the severity set is better."
            },
            {
              "key": "json-parser-level",
              "label": "Add a <code>json_parser</code> operator to the receiver, as the line has a field called <code>ERROR</code>",
              "why": "A <code>json_parser</code> reads a string as JSON, and this line is plain text. The parse fails, and by default the entry is sent on as it was."
            },
            {
              "key": "regex-without-severity",
              "label": "Add a <code>regex_parser</code> with a named group for the level and no <code>severity</code> block",
              "why": "Named capture groups become attributes. The <code>severity</code> block is what sets the record's severity from a group, so without it the level is only an attribute and the severity number stays empty."
            },
            {
              "key": "filter-processor",
              "label": "Use a <code>filter</code> processor in the Collector to turn the word <code>ERROR</code> into a severity",
              "why": "The filter processor drops telemetry. It does not parse it, and a parser operator in the receiver is what turns text into fields."
            },
            {
              "key": "batch-reads-level",
              "label": "Let the batch processor in the Collector read the level while it groups the records",
              "why": "The batch processor places records into batches, which helps compression and cuts the number of outgoing connections. It reads nothing out of the text."
            },
            {
              "key": "start-at-level",
              "label": "Switch <code>start_at</code> to <code>beginning</code> to read the level from the start of the file",
              "why": "<code>start_at</code> decides where in the file reading begins. The text of a line is the same wherever reading starts, and nothing in it is parsed."
            },
            {
              "key": "resource-severity",
              "label": "Add a <code>severity</code> entry with the value <code>ERROR</code> to the receiver's <code>resource</code> setting",
              "why": "The <code>resource</code> setting adds fixed key and value pairs to the Resource of every entry. It would give every record one level, whatever its line says."
            },
            {
              "key": "rewrite-the-file",
              "label": "Rewrite the vendor's log file with a script that swaps the level word for a number before it is read",
              "why": "That is a second parser outside the Collector, and it edits a file that the agent is still writing to. The receiver has operators for exactly this job."
            },
            {
              "key": "include-error",
              "label": "Put <code>ERROR</code> in the <code>include</code> setting to read only the error lines",
              "why": "<code>include</code> is a list of file glob patterns that choose which files are read, not which lines. It sets no severity."
            },
            {
              "key": "file-path-attribute",
              "label": "Turn on the file path attribute so that each record carries the path of the log file",
              "why": "That adds the path of the file as an attribute of the record. The path says where a record was read from, and nothing about how serious its line is."
            },
            {
              "key": "time-parser",
              "label": "Add a <code>time_parser</code> operator, which reads the level along with the time",
              "why": "A <code>time_parser</code> is a simple parser that reads a timestamp into the Timestamp field of the record. A level is read by severity parsing, which is a different job."
            }
          ]
        }
      },
      {
        "intro": "The notifications team never wrote a parser either. Their plain text lines reach Dash0 with no [[severity number|severity]], and one message repeats thousands of times with a different order number in it.",
        "question": "What does Dash0 do with those unstructured records?",
        "choice": {
          "id": "col-dash0",
          "choices": [
            {
              "key": "log-ai",
              "label": "Log AI infers a severity for them and groups similar messages into patterns, with the variable parts as named attributes",
              "why": "[[Log AI]] works on unstructured messages as they are ingested. It infers a severity where none is set, and it extracts patterns: the variable parts, such as order numbers, become placeholders in the pattern and named attributes you can filter and group by (the [[Patterns view]], and the <code>dash0.log.pattern</code> attribute). It never overrides a severity that is already set, and it leaves structured logs such as JSON to JSON log processing. It relies on resource attributes, so on Kubernetes the <code>k8sattributes</code> processor still matters. A parser in the Collector stays the precise fix; Log AI is for text nobody parsed."
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
            },
            {
              "key": "severity-and-one-pattern",
              "label": "Log AI figures out a level for each blank record and gives the order number a field",
              "why": "Log AI infers a severity for unstructured messages and extracts patterns. The variable part, the order number, becomes a named attribute and the rest of the message is one pattern, so you can filter and group by that attribute."
            },
            {
              "key": "finds-the-pattern",
              "label": "Log AI clusters the repeated message under one template, so the order is a placeholder",
              "why": "Recurring patterns are identified as logs are ingested, and the variable parts are extracted as named attributes, which can be strings, numbers or booleans. Both the pattern and the attributes are available for queries and filters."
            },
            {
              "key": "fills-the-gap",
              "label": "Dash0 fills the gap itself as the text arrives and asks for no Collector config",
              "why": "Log AI infers a severity for unstructured messages as they are ingested, so Dash0 needs no parser or other Collector setting for that. A parser in the Collector is still the better fix when you can write one."
            },
            {
              "key": "all-unspecified",
              "label": "All the records land in the UNSPECIFIED range, and the order numbers stay inside the message text",
              "why": "Records collected without a severity number get the UNSPECIFIED range, but Log AI fills in a severity for unstructured messages as they are ingested, and extracts the variable parts as attributes."
            },
            {
              "key": "row-per-order",
              "label": "The Patterns view shows a separate row per order number it sees in the messages",
              "why": "Patterns cluster records with similar message bodies and replace variable parts such as IDs with placeholders. Thousands of messages that differ only by order number are one pattern."
            },
            {
              "key": "reads-as-json",
              "label": "Each line is read as structured fields and the words of the message become a field of their own",
              "why": "JSON log processing handles logs whose body is a JSON document. These lines are plain text, and Log AI works on unstructured messages by finding patterns in them."
            },
            {
              "key": "kubernetes-only",
              "label": "Log AI handles the logs that come from Kubernetes workloads alone, and leaves the rest untouched",
              "why": "Log AI depends on resource attributes being present. Where the telemetry has them it works on unstructured logs, and Kubernetes workloads are one place they come from, through the k8sattributes processor."
            },
            {
              "key": "define-patterns-first",
              "label": "Log AI sets the severity and the patterns after you define the patterns by hand in the settings",
              "why": "As logs are ingested, Log AI identifies recurring patterns and infers severities on its own. Nobody has to define the patterns first."
            },
            {
              "key": "metric-per-order",
              "label": "Log AI creates a metric for each order number it finds in the messages, one series per order",
              "why": "The variable parts of a message become named attributes of the log record, which you filter and group by. They are not turned into metrics."
            },
            {
              "key": "keeps-first-only",
              "label": "The first record of the message is kept and the copies are dropped to save space",
              "why": "Patterns group the records and show a count for each pattern, and you can still filter to the records that match one."
            },
            {
              "key": "json-logs-only",
              "label": "Log AI works only on JSON logs, because it needs fields to group by and the other logs have none",
              "why": "It is the other way round. Log AI is designed for unstructured logs, and logs with a structured body such as JSON are handled separately, by JSON log processing."
            },
            {
              "key": "replaces-body",
              "label": "Log AI replaces each message with its pattern, so the original text is no longer shown",
              "why": "The pattern and the extracted attributes are made available for querying next to the record. In the Log Patterns tab, hovering shows which pattern was mined and where the extracted attributes come from, so the original structured data and what Log AI extracted from the body stay apart."
            },
            {
              "key": "needs-trace-id",
              "label": "Log AI skips a record that has no trace ID, so unlinked entries are left alone and untouched",
              "why": "Log AI works on unstructured messages and depends on resource attributes, not on a trace ID."
            }
          ]
        }
      }
    ]
  }
};
