# Inspect AI project journal

Repository: <https://github.com/tiempo0206/inspect_ai>

## 2026-09-17

### Completed

1. Forked the official Inspect AI repository into the personal GitHub account.
2. Cloned the fork to `upstream/inspect_ai` and configured both `origin` and
   `upstream` remotes.
3. Created the upstream development environment and installed its dependencies.
4. Ran a focused upstream test successfully to verify the local setup.
5. Studied the current `Task`, `Sample`, `generate`, `exact`, and `EvalLog` APIs.
6. Built a deterministic two-sample evaluation using `mockllm/model`, requiring
   no external credentials.
7. Executed the evaluation and verified two completed samples with an exact
   mean score of `1.000`.
8. Implemented an exporter that reads a real `.eval` file and selects the
   prompts, targets, completions, automated scores, and sample identifiers.
9. Added a versioned JSON Schema and a SHA-256 link to the immutable source log.
10. Upgraded the exporter to schema 1.1 with an empty per-sample conflict
    resolution map while retaining schema compatibility with version 1.0.
11. Added a schema-validated browser fixture so the Review Studio demo and real
    Inspect exports are checked against one shared data contract.
12. Created ContractBench 1.0: 10 versioned structured-output cases covering
    types, enums, nesting, ordering, nullability, Unicode, and strict key sets.
13. Implemented a custom scorer that separates invalid JSON, Schema violations,
    and schema-valid semantic mismatches with auditable explanations.
14. Added controlled conformant and brittle model profiles to test the complete
    evaluation pipeline without credentials, while keeping the task runnable
    against any configured Inspect model.

### Verification

- Focused upstream test: passed.
- EvalMerge Python tests: 11 passed.
- Ruff lint and formatting: passed.
- GitHub Actions Python job: passed.

### Decisions and lessons

- Use Inspect's built-in mock model for infrastructure tests so CI remains
  deterministic and free of secrets.
- Keep raw `.eval` logs out of Git because they are generated runtime artifacts.
- Export only review-relevant fields; event traces remain available in the
  original log when deeper debugging is needed.
- Keep conflict and consensus logic outside Inspect; the `.eval` file remains
  the immutable source of model-run evidence.
- Reuse the production schema for demo fixtures so the UI cannot drift away
  from the actual Inspect export format.
- Treat controlled mock profiles as scorer calibration, not model-quality
  evidence; label them explicitly in every result and document.

### Next tasks

- Run ContractBench against at least two production models with fixed settings.
- Expand the benchmark only after reviewing real-model failure clusters.
- Identify a focused upstream issue suitable for a small Inspect AI pull request.
