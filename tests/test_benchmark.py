"""Tests for the structured-output reliability benchmark."""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from evalmerge.benchmark import (
    BENCHMARK_ID,
    BENCHMARK_VERSION,
    BenchmarkSummary,
    load_contract_cases,
    scripted_profile_outputs,
    write_benchmark_summary,
)
from evalmerge.cli import main


def test_contract_cases_are_unique_and_satisfy_their_schemas() -> None:
    """Every committed expected answer should satisfy its own contract."""
    cases = load_contract_cases()

    assert len(cases) == 10
    assert len({case.id for case in cases}) == len(cases)
    assert len({case.category for case in cases}) == len(cases)
    for case in cases:
        Draft202012Validator(case.schema).validate(case.expected)


def test_conformant_profile_replays_all_expected_values() -> None:
    """The positive control should emit the exact expected JSON values."""
    cases = load_contract_cases()
    outputs = scripted_profile_outputs("conformant")

    assert len(outputs) == len(cases)
    assert [json.loads(output.completion) for output in outputs] == [
        case.expected for case in cases
    ]


def test_brittle_benchmark_runs_exports_and_reports_failures(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """The controlled baseline should exercise all three failure classes."""
    log_dir = tmp_path / "logs"
    summary_path = tmp_path / "brittle-summary.json"

    assert (
        main(
            [
                "benchmark",
                "--profile",
                "brittle",
                "--log-dir",
                str(log_dir),
                "--summary-output",
                str(summary_path),
            ]
        )
        == 0
    )

    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    assert summary == {
        "accuracy": 0.6,
        "benchmark": BENCHMARK_ID,
        "failures": {
            "invalid_json": 1,
            "schema_violation": 2,
            "semantic_mismatch": 1,
        },
        "passed": 6,
        "profile": "brittle",
        "total": 10,
        "version": BENCHMARK_VERSION,
    }

    logs = list(log_dir.glob("*.eval"))
    review_documents = list(log_dir.glob("*.review.json"))
    assert len(logs) == 1
    assert len(review_documents) == 1

    review = json.loads(review_documents[0].read_text(encoding="utf-8"))
    schema = json.loads(
        Path("schemas/review-document.schema.json").read_text(encoding="utf-8")
    )
    Draft202012Validator(schema).validate(review)
    assert len(review["samples"]) == 10
    failure_types = {
        score["metadata"].get("failure_type")
        for sample in review["samples"].values()
        for score in sample["scores"].values()
    }
    assert failure_types == {
        None,
        "invalid_json",
        "schema_violation",
        "semantic_mismatch",
    }
    output = capsys.readouterr().out
    assert "Review document:" in output
    assert '"accuracy": 0.6' in output


def test_summary_writer_protects_existing_evidence(tmp_path: Path) -> None:
    """A benchmark evidence file should not be replaced accidentally."""
    summary_path = tmp_path / "summary.json"
    summary_path.write_text("original\n", encoding="utf-8")

    with pytest.raises(FileExistsError, match="--force"):
        write_benchmark_summary(
            BenchmarkSummary(
                benchmark=BENCHMARK_ID,
                version=BENCHMARK_VERSION,
                profile="conformant",
                total=10,
                passed=10,
                accuracy=1.0,
                failures={},
            ),
            summary_path,
        )

    assert summary_path.read_text(encoding="utf-8") == "original\n"
