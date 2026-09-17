# EvalMerge

EvalMerge is an experimental local-first collaborative review workflow for
[Inspect AI](https://inspect.aisi.org.uk/) evaluation logs. The planned review
state will use [Automerge](https://automerge.org/) so multiple reviewers can
work offline and merge their annotations without losing changes.

The repository currently contains the first reproducible milestone: a
two-sample Inspect evaluation that runs entirely with Inspect's built-in mock
model and therefore needs no API key.

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

## Current milestone

- [x] Reproducible two-sample Inspect task
- [x] No external model credentials required
- [x] Automated task and end-to-end evaluation tests
- [ ] Export selected fields from an `.eval` log
- [ ] Represent reviewer annotations in an Automerge document
- [ ] Merge offline annotations and compute consensus
