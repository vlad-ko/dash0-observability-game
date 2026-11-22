// Text of levels/ottl-and-transforms.mjs (docs/CONTENT.md).
// The spot lines follow the note in the Step 2 comment of levels/ottl-and-transforms.mjs.
export default {
  "id": "ottl-and-transforms",
  "name": "OTTL and transforms",
  "sub": "Before it leaves",
  "rewardTitle": "Data scrubber",
  "play": {
    "finish": "You can rename, redact and drop in the Collector with OTTL and the filter processor. Redact before the exporter sends: a Dash0 spam filter drops whole points at ingestion, and it cannot edit one attribute.",
    "steps": [
      {
        "intro": "The [[Collector]] can change telemetry on its way through. The <b>transform processor</b> does it with statements in OTTL, the OpenTelemetry Transformation Language: a function, such as <code>set</code> or <code>delete_key</code>, and optionally a <code>where</code> condition. Statements run in the order they are listed. The checkout spans carry a custom [[attribute]] <code>cust</code>, and the data team wants it called <code>app.customer.id</code>.",
        "question": "Which statements rename an attribute?",
        "choice": {
          "id": "ottl-rename",
          "choices": [
            {
              "key": "set-only",
              "label": "<code>set(span.attributes[\"app.customer.id\"], span.attributes[\"cust\"])</code> alone, which leaves the old key untouched",
              "why": "That copies the value. The old key is not touched, so every span ends up with both <code>cust</code> and <code>app.customer.id</code>."
            },
            {
              "key": "set-then-delete",
              "label": "<code>set(span.attributes[\"app.customer.id\"], span.attributes[\"cust\"])</code>, then <code>delete_key(span.attributes, \"cust\")</code> removing the old key",
              "why": "The OTTL function list has no rename function, so this way of renaming is a copy followed by a delete. The statements run in the order they are listed, so the copy has to come first. The transform processor README shows a second way, one <code>replace_all_patterns</code> statement on the <code>\"key\"</code>, but only the set and delete pair is on offer here."
            },
            {
              "key": "delete-then-set",
              "label": "Two statements the other way round, <code>delete_key(span.attributes, \"cust\")</code> and then <code>set(span.attributes[\"app.customer.id\"], span.attributes[\"cust\"])</code>",
              "why": "Statements run in the order listed. After the delete there is nothing left to copy, so the value is lost."
            },
            {
              "key": "replace-key",
              "label": "A single <code>replace_all_patterns(span.attributes, \"key\", \"^cust$\", \"app.customer.id\")</code> that renames the key",
              "why": "In <code>key</code> mode the function replaces the part of a key that matches the pattern, so the anchored pattern turns <code>cust</code> into the new name in one statement. The transform processor README shows the same call to rename a resource attribute."
            },
            {
              "key": "set-delete-matching",
              "label": "<code>set(span.attributes[\"app.customer.id\"], span.attributes[\"cust\"])</code>, and next <code>delete_matching_keys(span.attributes, \"^cust$\")</code> dropping the old key at once",
              "why": "<code>delete_matching_keys</code> removes every key that matches a regex pattern, and the anchored pattern matches only <code>cust</code>. Run after the copy, it leaves the value under the new key alone."
            },
            {
              "key": "value-mode",
              "label": "A single <code>replace_all_patterns(span.attributes, \"value\", \"cust\", \"app.customer.id\")</code>, which changes values and leaves the key",
              "why": "In <code>value</code> mode the function replaces text inside the values of the map. The key stays <code>cust</code>, and a value that contains the word is changed."
            },
            {
              "key": "rename-function",
              "label": "A single <code>rename(span.attributes[\"cust\"], \"app.customer.id\")</code> that moves the old key and keeps what it holds",
              "why": "The OTTL function list has no <code>rename</code> function, so the statement does not parse and the processor does not start."
            },
            {
              "key": "delete-wrong-case",
              "label": "<code>set(span.attributes[\"app.customer.id\"], span.attributes[\"cust\"])</code>, then <code>delete_key(span.attributes, \"Cust\")</code> for the old key",
              "why": "Attribute keys are matched exactly, so <code>Cust</code> is not <code>cust</code>. The delete finds nothing and the span keeps both keys."
            },
            {
              "key": "delete-new",
              "label": "<code>set(span.attributes[\"app.customer.id\"], span.attributes[\"cust\"])</code>, then <code>delete_key(span.attributes, \"app.customer.id\")</code> on the new key",
              "why": "The second statement removes the key that was just created. The old key stays, and the value is back where it started."
            }
          ]
        }
      },
      {
        "intro": "Now the part legal cares about. Checkout puts the customer's email on every span as <code>user.email</code>, and it must not leave the [[cluster]]. Eight statements were proposed for the span context of the transform processor, and some of them do not remove it.",
        "question": "Spot the statements that would leave the email on the exported span.",
        "spot": {
          "id": "ottl-spot",
          "lines": [
            {
              "id": "delete-email",
              "text": "delete_key(span.attributes, \"user.email\")"
            },
            {
              "id": "resource-map",
              "text": "delete_key(resource.attributes, \"user.email\")"
            },
            {
              "id": "copy-only",
              "text": "set(span.attributes[\"customer.email\"], span.attributes[\"user.email\"])"
            },
            {
              "id": "mask-set",
              "text": "set(span.attributes[\"user.email\"], \"REDACTED\")"
            },
            {
              "id": "keep-keys",
              "text": "keep_keys(span.attributes, [\"http.route\", \"http.request.method\", \"url.path\"])"
            },
            {
              "id": "admin-only",
              "text": "delete_key(span.attributes, \"user.email\") where span.attributes[\"http.route\"] == \"/admin\""
            },
            {
              "id": "delete-matching",
              "text": "delete_matching_keys(span.attributes, \"(?i).*email.*\")"
            },
            {
              "id": "typo-key",
              "text": "set(span.attributes[\"user.mail\"], \"REDACTED\")"
            }
          ],
          "whyNot": {
            "delete-email": "It removes the key from the span attributes, where the email is. After it runs the span has no <code>user.email</code>.",
            "mask-set": "A redaction does not have to delete: this overwrites the value, so the span keeps the key and loses the email.",
            "keep-keys": "An allowlist: only the three listed keys stay, so <code>user.email</code> goes with everything else. It is heavy-handed, but nothing leaks.",
            "delete-matching": "It deletes every span attribute whose key matches the pattern, <code>user.email</code> included, and any other key with email in it."
          },
          "explain": "Four statements leave the email on the span. <code>delete_key(resource.attributes, ...)</code> is valid but deletes from another map: the email is in <code>span.attributes</code>. The <code>set</code> that makes a copy under <code>customer.email</code> is half a rename, so the email now sits under two keys. The <code>where</code> clause on the admin route makes the delete run only for those spans, and every other span keeps it. And <code>user.mail</code> is a misspelled key: the statement runs without an error and sets a new attribute, while <code>user.email</code> stays. Statements do not fail when they miss, so a leak only shows when you read what is exported."
        }
      },
      {
        "intro": "The email is in logs too, so the platform team wrote a [[processor]], <code>transform/pii</code>, that deletes it from spans and from [[log records]]. The Collector will not start, and nothing is redacted yet.",
        "question": "Fix the config so the Collector starts and <code>transform/pii</code> runs in both the traces and the logs pipeline.",
        "configure": {
          "id": "ottl-config",
          "hint": "A processor changes data only in the pipelines that list it, and a pipeline can only list a processor that is defined, spelled exactly. The email travels in more than one signal, so check every pipeline's processor list, not only the one that stops the Collector.",
          "explain": "A processor works on the data between the receivers and the exporters, so it has to be listed in every pipeline that carries what it removes, or that pipeline sends the data as it is. Here the email is on spans and in logs, so <code>transform/pii</code> goes in <code>traces</code> and <code>logs</code>, before the exporter sends anything out of the cluster. The given lists <code>transform/redact</code> in logs, which is not defined, so the Collector will not start; fixing only that name leaves traces unredacted. Defining <code>transform/redact</code> as well, deleting the processor, or putting it in a new pipeline beside the old ones would all leave a pipeline exporting the email. The statements are not graded here (this game checks the wiring, not the settings), which is why the spot step checked them, and where the processor sits among the others is the order level."
        }
      },
      {
        "intro": "The new config is rolling out, but spans with the email are already in Dash0. Someone suggests a spam filter, the backend-side drop, instead of the Collector change.",
        "question": "Can a Dash0 spam filter do the redaction?",
        "choice": {
          "id": "ottl-backend",
          "choices": [
            {
              "key": "spam-strip",
              "label": "Create a Dash0 spam filter on the spans that carry <code>user.email</code>, and it strips that attribute from each span",
              "why": "A spam filter does not strip one attribute and keep the span. It matches whole spans, logs or data points and drops them, so you would lose the spans as well."
            },
            {
              "key": "pipeline",
              "label": "Redact the email in the pipeline, because a spam filter drops whole points and cannot edit one part of a span",
              "why": "The transform processor changes the data before it leaves the cluster. A Dash0 spam filter is the backend-side drop: it drops whole spans, logs or data points that match, at ingestion, so it cannot remove one attribute. The data has already left the cluster by then, a drop cannot be recovered, and filtered telemetry still carries the ingest charge. In the Collector, dropping whole telemetry is the [[filter processor]]'s job, which drops what matches before anything is sent."
            },
            {
              "key": "filter-processor",
              "label": "Add the filter processor with a condition on <code>user.email</code> that removes the attribute and leaves the spans",
              "why": "The filter processor is the Collector-side drop: it drops whole spans, logs or data points that match its conditions, before anything is sent. It does not edit one attribute, so the spans would be lost with the email. Changing an attribute is the transform processor's job."
            },
            {
              "key": "spam-drop-all",
              "label": "Set up a spam filter for those spans, so they are dropped and nothing about the customer is kept, the email too",
              "why": "The spans have already reached Dash0, and filtered telemetry still passes through ingest and carries the ingest charge: a spam filter reduces what is stored, not what you send. It also drops the whole span, not only the email."
            },
            {
              "key": "transform-first",
              "label": "No, strip <code>user.email</code> with the transform step at the source, ahead of any span shipping",
              "why": "The transform processor changes attributes in the Collector, before anything leaves the cluster. A spam filter only drops whole spans, logs or data points that match, at ingestion."
            },
            {
              "key": "attributes-delete",
              "label": "Use the attributes processor and its delete action, which removes the email field of a span in transit",
              "why": "The attributes processor has a <code>delete</code> action that deletes an attribute from the input data, so the span goes on without it. A spam filter cannot edit a span, it can only drop it."
            },
            {
              "key": "spam-mask",
              "label": "A spam filter on <code>user.email</code> masks the value, while the spans stay and show a placeholder instead",
              "why": "A spam filter has no masking. It matches whole spans, logs or data points and drops them during ingestion."
            },
            {
              "key": "spam-cleans-stored",
              "label": "A saved spam filter also cleans the spans already stored, email included",
              "why": "A spam filter acts on telemetry as it arrives, before it is stored. It does not go back and change what is already there."
            },
            {
              "key": "view-hide",
              "label": "Hide the field in a saved view, so that nobody who opens a span sees the email",
              "why": "Hiding a column changes what is displayed. The email has left the cluster and sits in storage with every span."
            },
            {
              "key": "dash0-runs-processors",
              "label": "The platform runs the Collector's processors, and a transform can handle the email of a span there",
              "why": "At ingestion Dash0 applies its own controls, such as spam filters that drop data; the Collector's processors are ones you run in the Collector."
            },
            {
              "key": "exporter-exclude",
              "label": "Give the <code>otlp_grpc</code> exporter a setting that lists fields, such as the email, to leave out of each span",
              "why": "The OTLP exporter has settings for the endpoint, TLS, compression, retries and queueing, and none that removes attributes. Changing data is the work of a processor."
            },
            {
              "key": "rotate-token",
              "label": "Rotate the auth token, since the spans sent with the old token vanish with it, email and all",
              "why": "Auth tokens authenticate and authorise users and services that send telemetry. A token does not edit what a span carries."
            }
          ]
        }
      }
    ]
  }
};
