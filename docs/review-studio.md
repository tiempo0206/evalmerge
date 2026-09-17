# Review Studio

Review Studio is EvalMerge's local-first browser interface for inspecting model
outputs and recording human judgments. It connects the Python Inspect AI export
pipeline to the TypeScript Automerge collaboration layer without introducing a
review server.

## Start the interface

From the repository root:

```bash
cd automerge-review
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Use **Load demo** to explore the interface or
**Import document** to open a JSON file created by `evalmerge export`. A binary
`.automerge` file exported by the studio can also be imported later.

## Review workflow

1. Select a sample from the queue or narrow the queue by text and decision.
2. Compare the input and target with the model completion and automated scores.
3. Enter a stable reviewer ID, choose `pass`, `fail`, or `unsure`, and explain
   the judgment in the comment field.
4. Watch the reviewed count, agreement rate, consensus decision, and arbitration
   count update immediately.
5. If concurrent peers changed the same reviewer key, inspect every retained
   version and record the resolver, reason, selected value, and resolution time.

## Persistence and exports

Every edit is an Automerge change. The studio saves the complete binary CRDT to
browser local storage under `evalmerge.review-document.v1`; refreshing the page
therefore preserves causal history rather than only the current JSON snapshot.

- **Export JSON** creates a readable document for analysis and interchange.
- **Export CRDT** creates a lossless `.automerge` file containing change
  history and conflict metadata.
- **Reset** removes the current document from this browser only.

JSON export is disabled whenever a sample has an unresolved Automerge conflict.
This guard prevents a plain JSON snapshot from hiding one of the concurrent
values. CRDT export remains enabled so the full state can always be backed up or
sent to another peer.

## Local-first boundary

The interface has no API server, telemetry, remote fonts, or model calls. It
reads user-selected files and writes state only to the current browser profile.
Running the Vite development server serves static application assets; evaluation
content is processed in the browser and is not uploaded.

## Verification

`npm run check` runs formatting, strict TypeScript checking, 17 Vitest cases,
and the production build. The storage tests round-trip arbitrary bytes and a
real Automerge document with history. A Python contract test validates the
built-in demo against the same JSON Schema used by exported Inspect logs.

The browser acceptance path verifies that the demo loads two samples, a human
review changes consensus and summary metrics, filtering follows the decision,
and the review is still present after a full page reload.
