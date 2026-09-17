# EvalMerge Automerge review core

This TypeScript workspace turns an exported EvalMerge JSON document into an
Automerge CRDT. It demonstrates offline-first review without requiring a server.

## Core operations

- `createReviewDocument` imports version 1.0 review JSON into Automerge.
- `forkReviewDocument` creates an offline peer with its own actor ID.
- `addReview` records one review as an immutable Automerge change.
- `mergeReviewDocuments` checks the evaluation identity before merging peers.
- `getReviewConflicts` exposes concurrent writes to the same reviewer key.
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

The demo forks one base document, lets Alice and Bob review the first sample
offline, merges both branches, and writes `YOUR_LOG.merged.json`.
