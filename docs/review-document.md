# Review document format

EvalMerge converts an Inspect AI `.eval` log into a smaller JSON document that
contains the information a human reviewer needs. The document is deliberately
compatible with Automerge's JSON-like data model.

## Top-level structure

```json
{
  "schema_version": "1.1",
  "document_type": "evalmerge.review",
  "evaluation": {},
  "samples": {}
}
```

`evaluation` identifies the Inspect run and records the source log filename and
SHA-256 digest. The digest lets a reviewer verify that two review documents came
from the same immutable evaluation log.

`samples` is a map keyed by Inspect's sample UUID. Each value contains the
original input, target, model completion, automated scores, an initially empty
`reviews` map, and an initially empty `resolutions` audit map.

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

The exporter leaves `reviews` empty. Automerge adds and merges review entries.

## Conflict resolution audit

Concurrent writes to the same reviewer key remain visible through Automerge's
conflict API. Resolving such a conflict writes the selected review back after
observing every conflicting value. This removes the active conflict while
preserving the original alternatives in `resolutions`:

```json
{
  "resolutions": {
    "alice": {
      "resolved_by": "lead-reviewer",
      "resolved_at": "2026-09-17T11:30:00Z",
      "reason": "The first review used the published rubric.",
      "selected_review": {
        "label": "pass",
        "comment": "Meets the rubric.",
        "updated_at": "2026-09-17T11:00:00Z"
      },
      "conflicting_reviews": [
        {
          "label": "pass",
          "comment": "Meets the rubric.",
          "updated_at": "2026-09-17T11:00:00Z"
        },
        {
          "label": "fail",
          "comment": "Second device edit.",
          "updated_at": "2026-09-17T11:01:00Z"
        }
      ]
    }
  }
}
```

Version 1.1 introduces this optional map. The schema remains compatible with
version 1.0 documents, and the Automerge importer upgrades them in memory.

## Contract

The machine-readable contract is
[`schemas/review-document.schema.json`](../schemas/review-document.schema.json).
Breaking changes require a new `schema_version`.
