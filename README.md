# EvalMerge

EvalMerge is an experimental local-first collaborative review workflow for
[Inspect AI](https://inspect.aisi.org.uk/) evaluation logs. The planned review
state will use [Automerge](https://automerge.org/) so multiple reviewers can
work offline and merge their annotations without losing changes.

The repository currently contains a reproducible two-sample Inspect evaluation
and a command-line exporter that turns its `.eval` log into review-focused JSON.
Both run locally without an external model API key.

## Quick start

Create and activate an isolated Python environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

Run the tests:

```bash
pytest
```

Run the example evaluation:

```bash
inspect eval examples/hello_eval.py \
  --model mockllm/model \
  --log-dir logs
```

The command writes a real `.eval` log under `logs/`. These generated logs are
ignored by Git because they are runtime artifacts rather than source code.

Export that log to a collaborative review document:

```bash
evalmerge export logs/YOUR_LOG.eval
```

By default this creates `logs/YOUR_LOG.review.json`. Choose another location
with `--output`, and use `--force` only when you intentionally want to replace
an existing export:

```bash
evalmerge export logs/YOUR_LOG.eval \
  --output exports/hello.review.json
```

The exported document contains the prompts, targets, model completions, scores,
and an empty review map for each sample. Its format is explained in
[`docs/review-document.md`](docs/review-document.md) and validated by
[`schemas/review-document.schema.json`](schemas/review-document.schema.json).

## Offline Automerge demo

Install the TypeScript workspace:

```bash
cd automerge-review
npm install
```

From that directory, give Alice and Bob separate offline copies of an exported
review document and merge their independent reviews:

```bash
npm run demo -- ../logs/YOUR_LOG.review.json
```

The command writes `YOUR_LOG.merged.json`. The core implementation also saves
and loads Automerge's binary format so complete CRDT history can be persisted.

## Project journals

Daily progress, verification evidence, decisions, and next tasks are maintained
separately for [Inspect AI](docs/project-logs/inspect-ai.md),
[Automerge](docs/project-logs/automerge.md), and
[EvalMerge](docs/project-logs/evalmerge.md).

## Current milestone

- [x] Reproducible two-sample Inspect task
- [x] No external model credentials required
- [x] Automated task and end-to-end evaluation tests
- [x] Export selected fields from an `.eval` log
- [x] Version and validate the review-document format
- [x] Represent reviewer annotations in an Automerge document
- [x] Merge independent offline annotations
- [x] Detect concurrent same-key review conflicts
- [ ] Resolve conflicts and compute reviewer consensus
