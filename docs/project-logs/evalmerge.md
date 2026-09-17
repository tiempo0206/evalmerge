# EvalMerge project journal

Repository: <https://github.com/tiempo0206/evalmerge>

## 2026-09-17

### Completed

1. Created the public standalone repository and Python package skeleton.
2. Added a deterministic two-sample Inspect AI task and end-to-end test.
3. Added Ruff, Pytest, MIT licensing, documentation, and GitHub Actions.
4. Implemented the `evalmerge export` command for `.eval` to review JSON.
5. Added atomic output writes, overwrite protection, stable sample keys, source
   hashing, a versioned JSON Schema, and exporter tests.
6. Produced and inspected a real two-sample review document.
7. Added the `automerge-review` TypeScript workspace using Automerge 3.5.
8. Implemented offline forks for Alice and Bob, lossless merge for independent
   reviews, conflict inspection for same-key edits, and binary save/load support.
9. Added separate Python and Node CI jobs and created daily journals for all
   three repositories.

### Verification

- Python tests: 5 passed.
- Python lint and formatting: passed.
- Real Inspect export: 2 samples, schema version 1.0.
- TypeScript formatting and strict typecheck: passed.
- Vitest: 4 passed.
- Live Alice/Bob merge: passed; both reviews survived.
- Merged JSON validation against schema 1.0: passed.
- GitHub Actions: Python and Automerge jobs both passed.

### Decisions and lessons

- Keep the Python evaluation boundary and TypeScript CRDT boundary connected by
  a small, versioned JSON contract.
- Use JSON only as the initial interchange format. Automerge's binary format
  preserves change history and is the correct offline persistence format.
- Keep generated logs, exports, dependencies, and build output outside Git.

### Next tasks

- Add explicit conflict resolution and reviewer consensus computation.
- Add Automerge sync-message exchange between two simulated peers.
- Build a small local review interface once the core merge semantics are stable.
