"""Tests for exporting Inspect logs to collaborative review JSON."""

import hashlib
import json
from pathlib import Path

import pytest
from inspect_ai import eval
from jsonschema import Draft202012Validator

from evalmerge.cli import main
from evalmerge.export import export_eval_log
from examples.hello_eval import MOCK_RESPONSE, hello_eval


@pytest.fixture(scope="module")
def eval_log_path(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Create one real Inspect log shared by the exporter tests."""
    log_dir = tmp_path_factory.mktemp("inspect-logs")
    logs = eval(
        hello_eval(),
        model="mockllm/model",
        log_dir=str(log_dir),
        display="none",
    )

    assert logs[0].location is not None
    return Path(logs[0].location)


def test_exported_document_matches_schema(eval_log_path: Path, tmp_path: Path) -> None:
    """The exporter should create a valid, review-focused document."""
    output_path = tmp_path / "review.json"
    export_eval_log(eval_log_path, output_path)

    document = json.loads(output_path.read_text(encoding="utf-8"))
    schema_path = Path("schemas/review-document.schema.json")
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(document)

    assert document["schema_version"] == "1.0"
    assert document["evaluation"]["task"] == "hello_eval"
    assert (
        document["evaluation"]["source"]["sha256"]
        == hashlib.sha256(eval_log_path.read_bytes()).hexdigest()
    )
    assert len(document["samples"]) == 2

    samples_by_id = {sample["id"]: sample for sample in document["samples"].values()}
    assert set(samples_by_id) == {"greeting", "status"}
    assert all(
        sample["output"]["completion"] == MOCK_RESPONSE
        for sample in samples_by_id.values()
    )
    assert all(
        sample["scores"]["exact"]["value"] == "C" for sample in samples_by_id.values()
    )
    assert all(sample["reviews"] == {} for sample in samples_by_id.values())


def test_export_refuses_to_overwrite_without_force(
    eval_log_path: Path, tmp_path: Path
) -> None:
    """An existing review document should be protected by default."""
    output_path = tmp_path / "review.json"
    export_eval_log(eval_log_path, output_path)

    with pytest.raises(FileExistsError, match="--force"):
        export_eval_log(eval_log_path, output_path)

    assert export_eval_log(eval_log_path, output_path, force=True) == output_path


def test_cli_exports_to_default_path(
    eval_log_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The console entry point should derive a useful default filename."""
    output_path = eval_log_path.with_suffix(".review.json")

    assert main(["export", str(eval_log_path)]) == 0
    assert output_path.is_file()
    assert str(output_path) in capsys.readouterr().out
