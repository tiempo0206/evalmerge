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
10. Added conflict resolution that selects an observed value and preserves the
    resolver, reason, timestamp, selected value, and all original alternatives.
11. Added conflict-aware consensus, configurable agreement thresholds, pending
    review tracking, and an arbitration queue.
12. Extended the live demo to create a real conflict, resolve it, and compute a
    two-of-three `pass` decision.
13. Implemented the stateful Automerge sync protocol with bounded rounds,
    directional message counts, and byte-level traffic metrics.
14. Added serialized sync-state persistence so a peer can restart and resume an
    existing relationship without forgetting the remote state.
15. Reworked the live demo to synchronize offline reviews, conflicts, and the
    final resolution entirely through sync messages rather than direct merge.
16. Added browser-safe base64 encoding around Automerge's binary save/load APIs
    and tests proving complete document history survives local storage.
17. Built the Review Studio integration for live edits, consensus, conflict
    inspection, auditable resolution, JSON snapshots, and binary CRDT backups.
18. Configured Vite's WASM pipeline explicitly and removed the obsolete
    top-level-await workaround so development and production share one stable
    initialization path.
19. Added deterministic actor IDs for repeatable systems experiments without
    changing the default random-actor behavior used by the application.
20. Built a wire-size benchmark for 10, 100, and 1000-sample review documents.
21. Investigated an initially negative result and traced it to Automerge v2's
    full-document threshold when missing changes exceed one third of history.
22. Extended the experiment to report both first-review and steady-state costs,
    preserving the early-session trade-off alongside later bandwidth savings.

### Verification

- Rust formatting: passed.
- Rust core tests: 187 passed, 0 failed, 1 ignored.
- TypeScript formatting and strict typecheck: passed.
- Vitest: 21 passed across core, consensus, sync, browser-storage, and benchmark
  suites.
- Live Alice/Bob merge: both reviewer entries preserved.
- Merged output: valid against review-document schema 1.0.
- GitHub Actions Automerge job: passed on Node 24.
- Live conflict resolution: `pass vs fail -> pass`; audit retained both values.
- Consensus demo: 2 of 3 counted reviews voted `pass`.
- Incremental sync demo: 12 messages and approximately 5.9 KB across four
  sessions (compressed byte count varies slightly with generated actor IDs).
- A second unchanged sync sends zero messages and zero bytes.
- Serialized peer state resumed successfully after a simulated restart.
- Binary browser-storage round trip retained a real review and its history.
- Browser refresh restored the review; consensus remained `pass` at 100%.
- Production WASM build passed and `npm audit` reported 0 vulnerabilities.
- First review after import: sync traffic was 0.14%–6.28% larger than a full
  snapshot because the v2 threshold intentionally selected full-document sync.
- After six shared changes: one new review used 482–492 bytes, reducing transfer
  by 84.18% at 10 samples, 96.26% at 100, and 99.58% at 1000.

### Decisions and lessons

- A CRDT does not mean conflicts never exist. Independent map-key edits merge
  naturally, while concurrent writes to the same reviewer key remain available
  through `getConflicts` for an explicit product decision.
- Clone the shared base before offline editing so each peer receives a distinct
  actor ID and preserves causal history.
- Compare the Inspect evaluation ID and source SHA-256 before merging documents.
- Treat binary Automerge state as the durable local form and disable lossy JSON
  export until every concurrent same-key value has been resolved.
- Measure CRDT behavior by history shape as well as document size; a single huge
  import change behaves differently from an established collaborative session.

### Next tasks

- Add policy tests for larger reviewer panels and configurable quorum.
- Add authenticated transport around the binary sync messages.
- Test long-running sessions with compaction and multiple concurrent peers.
- Select a non-duplicated upstream issue after the existing ESLint migration lands.
