"""Inspect AI entry point for the EvalMerge structured-output benchmark.

Run with any configured model:

    inspect eval examples/contract_reliability.py --model PROVIDER/MODEL

For credential-free controlled baselines, use `evalmerge benchmark` instead.
"""

from inspect_ai import Task, task

from evalmerge.benchmark import contract_reliability_task


@task
def contract_reliability() -> Task:
    """Evaluate JSON syntax, schema compliance, and semantic correctness."""
    return contract_reliability_task()
