# Automerge project journal

Repository: <https://github.com/tiempo0206/automerge>

## 2026-09-17

### Completed

1. Forked the official Automerge repository into the personal GitHub account.
2. Cloned the fork to `upstream/automerge` and configured `origin` and `upstream`.
3. Installed and selected the Rust toolchain required by the repository.
4. Ran `cargo fmt --check` successfully.
5. Ran the core Rust test suite: 187 passed, 0 failed, and 1 ignored.
6. Investigated the JavaScript lint failure and confirmed that it comes from the
   upstream ESLint 10 configuration transition already covered by upstream pull
   request #1544; no duplicate change was created.
7. Studied Automerge 3.5 APIs for `from`, `clone`, `change`, `merge`, `save`,
   `load`, `toJS`, and `getConflicts` directly from the upstream source.
8. Designed the review data as UUID-keyed maps so independent reviewer edits
   target different CRDT keys.
9. Added a TypeScript integration that forks two offline documents, records
   independent reviews, merges them, and exposes true same-key conflicts.

### Verification

- Rust formatting: passed.
- Rust core tests: 187 passed, 0 failed, 1 ignored.
- TypeScript formatting and strict typecheck: passed.
- Vitest: 4 passed.
- Live Alice/Bob merge: both reviewer entries preserved.
- Merged output: valid against review-document schema 1.0.

### Decisions and lessons

- A CRDT does not mean conflicts never exist. Independent map-key edits merge
  naturally, while concurrent writes to the same reviewer key remain available
  through `getConflicts` for an explicit product decision.
- Clone the shared base before offline editing so each peer receives a distinct
  actor ID and preserves causal history.
- Compare the Inspect evaluation ID and source SHA-256 before merging documents.

### Next tasks

- Add a conflict-resolution operation that records who resolved a conflict.
- Explore Automerge sync messages instead of exchanging complete documents.
- Select a non-duplicated upstream issue after the existing ESLint migration lands.
