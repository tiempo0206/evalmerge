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
- `saveReviewDocument` and `loadReviewDocument` persist complete CRDT history.

Independent reviewers use different map keys and merge without losing edits.
Two devices that concurrently replace the same reviewer key produce a real CRDT
conflict; both values remain inspectable until the application resolves them.

## Run checks

```bash
npm install
npm run check
```

`check` runs Prettier verification, strict TypeScript checking, and Vitest.

## Run the offline demo

First export an Inspect log from the repository root. Then run:

```bash
npm run demo -- ../logs/YOUR_LOG.review.json
```

The demo merges Alice and Bob's independent reviews, creates a concurrent edit
for one reviewer, resolves that conflict, computes consensus, and writes
`YOUR_LOG.merged.json`.

## Consensus policy

Unresolved same-key conflicts are excluded from the vote. A sample needs
arbitration when it has an unresolved conflict, a tie, an `unsure` majority, or
agreement below the configured threshold. Unreviewed samples are tracked
separately as pending work.
