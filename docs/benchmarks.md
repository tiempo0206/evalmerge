# Reproducible benchmarks

EvalMerge includes two benchmarks: a model-facing structured-output reliability
task and a systems-facing Automerge wire-size experiment. Both have controlled,
credential-free modes so CI can verify the measurement pipeline without making
claims about a hosted model.

## ContractBench 1.0

`evalmerge.contract_reliability` contains 10 versioned cases covering booleans,
integers, enums, nested objects, ordered arrays, nullable values, Unicode,
numeric typing, additional-property rejection, and nested mappings.

The custom Inspect AI scorer applies three checks in order:

1. the completion must be raw, parseable JSON;
2. the parsed value must satisfy the case's Draft 2020-12 JSON Schema; and
3. the schema-valid value must equal the requested semantic result.

Failures are labeled `invalid_json`, `schema_violation`, or
`semantic_mismatch`, and each score carries machine-readable check results plus
an explanation for human review.

Run the controlled baselines and export them directly for Review Studio:

```bash
evalmerge benchmark \
  --profile conformant \
  --summary-output benchmarks/results/contract-conformant.json \
  --force

evalmerge benchmark \
  --profile brittle \
  --summary-output benchmarks/results/contract-brittle.json \
  --force
```

The conformant control passes 10/10. The brittle control passes 6/10 and
deliberately produces one invalid-JSON failure, two schema violations, and one
semantic mismatch. These results validate the scorer; they are not presented as
measurements of a production model.

To evaluate a configured model instead, run:

```bash
inspect eval examples/contract_reliability.py --model PROVIDER/MODEL
```

## Automerge sync wire size 1.0

The systems benchmark creates deterministic review documents with 10, 100, and
1000 samples. It bootstraps a second peer, adds the first human review, warms the
shared history to six changes, and then measures one more review. Each row
compares sync-protocol traffic with the complete binary document at that stage.

```bash
cd automerge-review
npm run benchmark:sync -- \
  --output ../benchmarks/results/automerge-sync-wire-size.json \
  --force
```

| Samples | First review vs snapshot | Steady sync | Steady snapshot | Reduction |
| ------: | -----------------------: | ----------: | --------------: | --------: |
|      10 |        2,625 / 2,470 B |       482 B |         3,046 B |    84.18% |
|     100 |      12,718 / 12,563 B |       492 B |        13,162 B |    96.26% |
|    1000 |    115,642 / 115,486 B |       492 B |       116,167 B |    99.58% |

The first-review result is intentionally retained. Automerge sync v2 sends a
compressed full document when the number of missing changes exceeds one third
of the current change graph. A newly imported evaluation has only one initial
change, so its first review crosses that threshold and has small protocol
overhead relative to a full snapshot. Once the shared history is established,
the same review-shaped update remains roughly 0.5 KB while the document grows.

Durations in the committed JSON are observations from one local run and are not
portable latency claims. Wire bytes, message counts, convergence, and the
first-versus-steady-state behavior are the primary measurements.
