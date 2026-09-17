"""Convert Inspect AI evaluation logs into collaborative review documents."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from inspect_ai.log import EvalLog, EvalSample, read_eval_log

SCHEMA_VERSION = "1.1"
DOCUMENT_TYPE = "evalmerge.review"


def _sha256(path: Path) -> str:
    """Return the SHA-256 digest for a file without loading it all into memory."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sample_key(sample: EvalSample, index: int) -> str:
    """Return a stable JSON-map key for an Inspect sample."""
    if sample.uuid:
        return sample.uuid

    identity = json.dumps(
        {
            "id": sample.id,
            "epoch": sample.epoch,
            "input": sample.model_dump(mode="json", include={"input"})["input"],
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:16]
    return f"sample-{index}-{digest}"


def _review_sample(sample: EvalSample, index: int) -> tuple[str, dict[str, Any]]:
    """Select review-relevant fields from one verbose Inspect sample."""
    sample_data = sample.model_dump(
        mode="json",
        include={"id", "epoch", "input", "target", "metadata"},
        exclude_none=True,
    )
    output = sample.output.model_dump(
        mode="json",
        include={"model", "completion"},
        exclude_none=True,
    )
    scores = {
        name: score.model_dump(
            mode="json",
            include={"value", "answer", "explanation", "metadata"},
            exclude_none=True,
        )
        for name, score in (sample.scores or {}).items()
    }
    key = _sample_key(sample, index)

    return key, {
        "sample_uuid": sample.uuid,
        **sample_data,
        "output": output,
        "scores": scores,
        "reviews": {},
        "resolutions": {},
    }


def build_review_document(log: EvalLog, source_path: Path) -> dict[str, Any]:
    """Build a deterministic, JSON-compatible review document from an eval log."""
    if not source_path.is_file():
        raise FileNotFoundError(f"Inspect log does not exist: {source_path}")
    if not log.samples:
        raise ValueError("Inspect log contains no samples to review")

    samples: dict[str, dict[str, Any]] = {}
    for index, sample in enumerate(log.samples):
        key, review_sample = _review_sample(sample, index)
        if key in samples:
            raise ValueError(f"Inspect log contains duplicate sample key: {key}")
        samples[key] = review_sample

    return {
        "schema_version": SCHEMA_VERSION,
        "document_type": DOCUMENT_TYPE,
        "evaluation": {
            "eval_id": log.eval.eval_id,
            "task": log.eval.task,
            "model": log.eval.model,
            "created": log.eval.created,
            "status": log.status,
            "source": {
                "filename": source_path.name,
                "sha256": _sha256(source_path),
            },
        },
        "samples": samples,
    }


def default_output_path(source_path: Path) -> Path:
    """Return the default review-document path for an Inspect log."""
    return source_path.with_suffix(".review.json")


def export_eval_log(
    source_path: Path,
    output_path: Path | None = None,
    *,
    force: bool = False,
) -> Path:
    """Read an Inspect log and atomically write its review document."""
    source_path = source_path.expanduser().resolve()
    output_path = (
        (output_path or default_output_path(source_path)).expanduser().resolve()
    )

    if source_path == output_path:
        raise ValueError("Output path must be different from the source log")
    if output_path.exists() and not force:
        raise FileExistsError(
            f"Output already exists: {output_path}. Use --force to replace it."
        )

    log = read_eval_log(str(source_path))
    document = build_review_document(log, source_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=output_path.parent,
            prefix=f".{output_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            json.dump(document, temporary, ensure_ascii=False, indent=2)
            temporary.write("\n")
            temporary_path = Path(temporary.name)
        os.replace(temporary_path, output_path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()

    return output_path
