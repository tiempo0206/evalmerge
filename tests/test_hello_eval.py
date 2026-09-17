"""Tests for the first reproducible Inspect AI evaluation."""

from inspect_ai import eval

from examples.hello_eval import MOCK_RESPONSE, hello_eval


def test_hello_eval_has_two_stable_samples() -> None:
    """The tutorial task should expose two addressable review samples."""
    evaluation = hello_eval()

    assert len(evaluation.dataset) == 2
    assert [sample.id for sample in evaluation.dataset] == ["greeting", "status"]
    assert all(sample.target == MOCK_RESPONSE for sample in evaluation.dataset)


def test_hello_eval_runs_without_external_credentials(tmp_path) -> None:
    """The built-in mock model should produce a complete, scored eval log."""
    logs = eval(
        hello_eval(),
        model="mockllm/model",
        log_dir=str(tmp_path),
        display="none",
    )

    assert len(logs) == 1
    assert logs[0].status == "success"
    assert logs[0].samples is not None
    assert len(logs[0].samples) == 2
    assert all(sample.output.completion == MOCK_RESPONSE for sample in logs[0].samples)
    assert all(sample.scores for sample in logs[0].samples)
