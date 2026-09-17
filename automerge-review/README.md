# EvalMerge Automerge review core

This TypeScript workspace turns an exported EvalMerge JSON document into an
Automerge CRDT. It demonstrates offline-first review without requiring a server.

## Core operations

- `createReviewDocument` imports review JSON and upgrades version 1.0 to 1.1.
- `forkReviewDocument` creates an offline peer with its own actor ID.
- `addReview` records one review as an immutable Automerge change.
- `mergeReviewDocuments` checks the evaluation identity before merging peers.
- `getReviewConflicts` exposes concurrent writes to the same reviewer key.
- `resolveReviewConflict` selects a value and records the complete audit trail.
- `computeSampleConsensus` counts conflict-free votes for one sample.
- `buildConsensusReport` identifies pending and arbitration samples.
- `syncReviewDocuments` exchanges incremental peer-to-peer sync messages.
- Sync state encoding and decoding supports process restarts and reconnection.
- `saveReviewDocument` and `loadReviewDocument` persist complete CRDT history.
- `saveReviewToStorage` and `loadReviewFromStorage` preserve that binary history
  in browser storage instead of flattening the document to JSON.

Independent reviewers use different map keys and merge without losing edits.
Two devices that concurrently replace the same reviewer key produce a real CRDT
conflict; both values remain inspectable until the application resolves them.

## Run checks

```bash
npm install
npm run check
```

`check` runs Prettier verification, strict TypeScript checking, and Vitest.

## Run the Review Studio

```bash
npm run dev
```

Open <http://127.0.0.1:5173>. Import an EvalMerge `*.review.json` document or
select **Load demo** for a zero-setup walkthrough. Reviews are stored locally as
an Automerge binary document and survive a page refresh.

The interface calculates consensus as edits are recorded, surfaces unresolved
same-key conflicts, and requires a resolver identity and reason before selecting
a winning version. JSON export is disabled while a conflict is unresolved so a
lossy snapshot cannot silently discard an alternative; binary CRDT export stays
available for recovery and peer exchange.

Production assets can be generated with `npm run build`. The app uses bundled
code and system fonts, so reviewing does not require a network connection or a
backend service.

## Run the offline demo

First export an Inspect log from the repository root. Then run:

```bash
npm run demo -- ../logs/YOUR_LOG.review.json
```

The demo establishes a peer session, takes both peers offline, exchanges their
incremental changes after reconnection, creates and synchronizes a concurrent
edit, resolves that conflict, synchronizes the resolution, computes consensus,
and writes `YOUR_LOG.merged.json`.

It also reports the number and total bytes of sync messages so protocol behavior
is observable rather than hidden behind the final state.

## Consensus policy

Unresolved same-key conflicts are excluded from the vote. A sample needs
arbitration when it has an unresolved conflict, a tie, an `unsure` majority, or
agreement below the configured threshold. Unreviewed samples are tracked
separately as pending work.
