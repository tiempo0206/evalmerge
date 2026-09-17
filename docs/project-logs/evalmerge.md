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
10. Released review-document schema 1.1 with backwards-compatible resolution
    audit maps and upgraded EvalMerge to version 0.4.0.
11. Added conflict resolution, majority voting, agreement ratios, pending review
    tracking, and arbitration reports.
12. Re-ran the complete Inspect export and Automerge demo against a real log.
13. Added bounded incremental peer synchronization, traffic metrics, and
    serializable sync state for reconnection after process restarts.
14. Replaced direct demo merges with four sync sessions covering handshake,
    offline review exchange, conflict exchange, and resolution propagation.
15. Upgraded EvalMerge to version 0.5.0 and the Automerge core to 0.3.0.
16. Built Review Studio, a responsive local interface for sample inspection,
    human judgments, consensus summaries, conflict resolution, and audit review.
17. Added JSON and `.automerge` imports, guarded JSON export, lossless CRDT
    export, and browser persistence of the complete Automerge binary history.
18. Added a schema-validated two-sample browser demo, storage tests, production
    builds, and a real-browser acceptance walkthrough.
19. Removed remote font dependencies, documented the local-first privacy
    boundary, and upgraded EvalMerge to 0.6.0 and the review core to 0.4.0.

### Verification

- Python tests: 7 passed.
- Python lint and formatting: passed.
- Real Inspect export: 2 samples, schema version 1.1.
- TypeScript formatting and strict typecheck: passed.
- Vitest: 17 passed across four test files.
- Live Alice/Bob merge: passed; both reviews survived.
- Review documents for schema versions 1.0 and 1.1: validation passed.
- GitHub Actions: Python and Automerge jobs both passed.
- Real schema 1.1 output: conflict audit valid and consensus was 2/3 `pass`.
- Real sync traffic: 12 messages and approximately 5.9 KB; final peers converged.
- Vite production build: passed; Automerge WASM emitted as a local asset.
- Dependency audit: 0 vulnerabilities.
- Browser acceptance: demo loaded 2 samples; review changed the summary to 1
  reviewed with 100% agreement; pass filtering and refresh persistence passed.
- Browser console after the configuration fix: no new application errors.

### Decisions and lessons

- Keep the Python evaluation boundary and TypeScript CRDT boundary connected by
  a small, versioned JSON contract.
- Use JSON only as the initial interchange format. Automerge's binary format
  preserves change history and is the correct offline persistence format.
- Keep generated logs, exports, dependencies, and build output outside Git.
- Persist the binary CRDT in the browser; JSON is an interchange view and must
  not silently flatten unresolved alternatives.
- Keep all page assets local so offline review has no hidden network dependency.

### Next tasks

- Replace the deterministic mock task with a meaningful reliability benchmark.
- Add configurable quorum and consensus-policy presets.
- Benchmark sync performance with larger Inspect logs.
- Define the authenticated transport boundary for remote peers.
