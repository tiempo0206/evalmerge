"""A deterministic two-sample Inspect AI evaluation.

Run from the repository root with:

    inspect eval examples/hello_eval.py --model mockllm/model --log-dir logs
"""

from inspect_ai import Task, task
from inspect_ai.dataset import Sample
from inspect_ai.scorer import exact
from inspect_ai.solver import generate

MOCK_RESPONSE = "Default output from mockllm/model"


@task
def hello_eval() -> Task:
    """Create a tiny evaluation that requires no external model credentials."""
    return Task(
        dataset=[
            Sample(
                id="greeting",
                input="Respond to this greeting: Hello, EvalMerge!",
                target=MOCK_RESPONSE,
            ),
            Sample(
                id="status",
                input="Report whether the offline evaluation pipeline is ready.",
                target=MOCK_RESPONSE,
            ),
        ],
        solver=[generate()],
        scorer=exact(),
    )
