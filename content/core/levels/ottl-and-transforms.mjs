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
              "label": "One statement: <code>set(span.attributes[\"app.customer.id\"], span.attributes[\"cust\"])</code>",
              "why": "That copies the value. The old key is not touched, so every span ends up with both <code>cust</code> and <code>app.customer.id</code>."
            },
            {
              "key": "set-then-delete",
              "label": "Two statements, in this order: <code>set</code> the new key from the old one, then <code>delete_key</code> the old key",
              "why": "The OTTL function list has no rename function, so this way of renaming is a copy followed by a delete. The statements run in the order they are listed, so the copy has to come first. The transform processor README shows a second way, one <code>replace_all_patterns</code> statement on the <code>\"key\"</code>, but only the set and delete pair is on offer here."
            },
            {
              "key": "delete-then-set",
              "label": "Two statements, the other way round: <code>delete_key</code> the old key, then <code>set</code> the new key from the old value",
              "why": "Statements run in the order listed. After the delete there is nothing left to copy, so the value is lost."
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
              "label": "Add a Dash0 spam filter on the spans that carry <code>user.email</code>: it strips that attribute and keeps the rest of each span",
              "why": "A spam filter does not strip one attribute and keep the span. It matches whole spans, logs or data points and drops them, so you would lose the spans as well."
            },
            {
              "key": "pipeline",
              "label": "Redact in the Collector pipeline, before the exporter sends it. A spam filter drops whole points after they arrive and cannot edit one attribute",
              "why": "The transform processor changes the data before it leaves the cluster. A Dash0 spam filter is the backend-side drop: it drops whole spans, logs or data points that match, at ingestion, so it cannot remove one attribute. The data has already left the cluster by then, a drop cannot be recovered, and filtered telemetry still carries the ingest charge. In the Collector, dropping whole telemetry is the filter processor's job, which drops what matches before anything is sent."
            },
            {
              "key": "filter-processor",
              "label": "Add the filter processor to the Collector with a condition on <code>user.email</code>: it removes the attribute from the matching spans and keeps the spans",
              "why": "The filter processor is the Collector-side drop: it drops whole spans, logs or data points that match its conditions, before anything is sent. It does not edit one attribute, so the spans would be lost with the email. Changing an attribute is the transform processor's job."
            },
            {
              "key": "spam-drop-all",
              "label": "Add a spam filter for those spans: they are dropped, and nothing about the customer is kept, and dropped data costs nothing",
              "why": "The spans have already reached Dash0, and filtered telemetry still passes through ingest and carries the ingest charge: a spam filter reduces what is stored, not what you send. It also drops the whole span, not only the email."
            }
          ]
        }
      }
    ]
  }
};
