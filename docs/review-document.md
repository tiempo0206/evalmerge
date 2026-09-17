# Review document format

EvalMerge converts an Inspect AI `.eval` log into a smaller JSON document that
contains the information a human reviewer needs. The document is deliberately
compatible with Automerge's JSON-like data model.

## Top-level structure

```json
{
  "schema_version": "1.0",
  "document_type": "evalmerge.review",
  "evaluation": {},
  "samples": {}
}
```

`evaluation` identifies the Inspect run and records the source log filename and
SHA-256 digest. The digest lets a reviewer verify that two review documents came
from the same immutable evaluation log.

`samples` is a map keyed by Inspect's sample UUID. Each value contains the
original input, target, model completion, automated scores, and an initially
empty `reviews` map.

## Why maps instead of arrays?

Automerge records changes to individual keys. If Alice and Bob independently
add reviews under their own reviewer IDs, those edits touch different map keys
and can normally merge without a conflict. Positional array edits would be more
fragile because insertions and reordering affect shared positions.

The intended review shape is:

```json
{
  "reviews": {
    "alice": {
      "label": "pass",
      "comment": "The answer follows the requested format.",
      "updated_at": "2026-09-17T10:30:00Z"
    }
  }
}
```

The initial exporter leaves `reviews` empty. The next milestone will use
Automerge to add and merge those review entries.

## Contract

The machine-readable contract is
[`schemas/review-document.schema.json`](../schemas/review-document.schema.json).
Breaking changes require a new `schema_version`.
