"""Reproducible structured-output reliability benchmark for Inspect AI."""

from __future__ import annotations

import json
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import asdict, dataclass
from importlib.resources import files
from pathlib import Path
from typing import Any, Literal, cast

from inspect_ai import Task, eval
from inspect_ai.dataset import Sample
from inspect_ai.model import GenerateConfig, ModelOutput, get_model
from inspect_ai.scorer import (
    CORRECT,
    INCORRECT,
    Score,
    Target,
    accuracy,
    scorer,
    stderr,
)
from inspect_ai.solver import TaskState, generate
from jsonschema import Draft202012Validator

BENCHMARK_ID = "evalmerge.contract_reliability"
BENCHMARK_VERSION = "1.0"
Profile = Literal["conformant", "brittle"]


@dataclass(frozen=True)
class ContractCase:
    """One structured-output contract and its expected semantic value."""

    id: str
    category: str
    prompt: str
    expected: Any
    schema: dict[str, Any]


@dataclass(frozen=True)
class BenchmarkSummary:
    """Stable, serializable result summary for one controlled profile."""

    benchmark: str
    version: str
    profile: Profile
    total: int
    passed: int
    accuracy: float
    failures: dict[str, int]

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-compatible representation."""
        return asdict(self)


def load_contract_cases() -> tuple[ContractCase, ...]:
    """Load and validate the versioned benchmark cases bundled with EvalMerge."""
    resource = files("evalmerge").joinpath("data/structured_output_cases.json")
    payload = json.loads(resource.read_text(encoding="utf-8"))
    if payload.get("benchmark") != BENCHMARK_ID:
        raise ValueError("unexpected benchmark identifier")
    if payload.get("version") != BENCHMARK_VERSION:
        raise ValueError("unsupported benchmark version")

    cases = tuple(ContractCase(**case) for case in payload.get("cases", []))
    if not cases:
        raise ValueError("benchmark contains no cases")
    if len({case.id for case in cases}) != len(cases):
        raise ValueError("benchmark case IDs must be unique")

    for case in cases:
        Draft202012Validator.check_schema(case.schema)
        Draft202012Validator(case.schema).validate(case.expected)
    return cases


def _json_path(error_path: Sequence[object]) -> str:
    return "$" + "".join(
        f"[{part}]" if isinstance(part, int) else f".{part}" for part in error_path
    )


@scorer(metrics=[accuracy(), stderr()])
def contract_compliance():
    """Score syntax, JSON Schema compliance, and exact semantic correctness."""

    async def score(state: TaskState, target: Target) -> Score:
        completion = state.output.completion.strip()
        metadata = state.metadata or {}
        schema = cast(dict[str, Any], metadata.get("schema"))
        expected = json.loads(target.text)

        try:
            parsed = json.loads(completion)
        except json.JSONDecodeError as error:
            return Score(
                value=INCORRECT,
                answer=completion,
                explanation=(
                    f"Invalid JSON at line {error.lineno}, column {error.colno}: "
                    f"{error.msg}"
                ),
                reason="invalid_response_format",
                metadata={
                    "failure_type": "invalid_json",
                    "valid_json": False,
                    "schema_compliant": False,
                    "semantic_match": False,
                },
            )

        errors = sorted(
            Draft202012Validator(schema).iter_errors(parsed),
            key=lambda item: tuple(str(part) for part in item.absolute_path),
        )
        if errors:
            first = errors[0]
            return Score(
                value=INCORRECT,
                answer=json.dumps(parsed, ensure_ascii=False, sort_keys=True),
                explanation=(
                    f"Schema violation at {_json_path(first.absolute_path)}: "
                    f"{first.message}"
                ),
                reason="invalid_response_format",
                metadata={
                    "failure_type": "schema_violation",
                    "valid_json": True,
                    "schema_compliant": False,
                    "semantic_match": False,
                },
            )

        if parsed != expected:
            return Score(
                value=INCORRECT,
                answer=json.dumps(parsed, ensure_ascii=False, sort_keys=True),
                explanation="Schema-valid output does not match the requested value.",
                reason="semantic_mismatch",
                metadata={
                    "failure_type": "semantic_mismatch",
                    "valid_json": True,
                    "schema_compliant": True,
                    "semantic_match": False,
                },
            )

        return Score(
            value=CORRECT,
            answer=json.dumps(parsed, ensure_ascii=False, sort_keys=True),
            explanation="Valid JSON, schema compliant, and semantically correct.",
            metadata={
                "failure_type": None,
                "valid_json": True,
                "schema_compliant": True,
                "semantic_match": True,
            },
        )

    return score


def contract_reliability_task() -> Task:
    """Create the public Inspect task for structured-output reliability."""
    cases = load_contract_cases()
    samples = [
        Sample(
            id=case.id,
            input=(
                "Follow the output contract exactly. Do not use Markdown fences or "
                f"explanatory text.\n\n{case.prompt}"
            ),
            target=json.dumps(case.expected, ensure_ascii=False, sort_keys=True),
            metadata={"category": case.category, "schema": case.schema},
        )
        for case in cases
    ]
    return Task(
        dataset=samples,
        solver=[generate()],
        scorer=contract_compliance(),
        config=GenerateConfig(temperature=0),
        name="contract_reliability",
        version=BENCHMARK_VERSION,
        metadata={"benchmark": BENCHMARK_ID, "case_count": len(samples)},
        tags=["structured-output", "reliability", "local-first"],
    )


_BRITTLE_OVERRIDES: Mapping[str, str] = {
    "severity-triage": '```json\n{"severity":"high","escalate":true}\n```',
    "ordered-remediation": '{"steps":["isolate","patch"]}',
    "rate-limit-delay": ('{"retry_after_seconds":"30","rate_limited":true}'),
    "service-health-map": ('{"services":{"api":"degraded","worker":"degraded"}}'),
}


def scripted_profile_outputs(profile: Profile) -> list[ModelOutput]:
    """Create deterministic outputs used to validate the benchmark pipeline."""
    if profile not in ("conformant", "brittle"):
        raise ValueError(f"unsupported benchmark profile: {profile}")

    model_name = f"mockllm/evalmerge-{profile}"
    outputs: list[ModelOutput] = []
    for case in load_contract_cases():
        content = json.dumps(case.expected, ensure_ascii=False, separators=(",", ":"))
        if profile == "brittle":
            content = _BRITTLE_OVERRIDES.get(case.id, content)
        outputs.append(ModelOutput.from_content(model_name, content))
    return outputs


def run_controlled_benchmark(
    profile: Profile,
    log_dir: Path,
) -> tuple[Path, BenchmarkSummary]:
    """Run a no-credential baseline and return its Inspect log and summary."""
    model_name = f"mockllm/evalmerge-{profile}"
    model = get_model(
        model_name,
        custom_outputs=scripted_profile_outputs(profile),
        memoize=False,
    )
    logs = eval(
        contract_reliability_task(),
        model=model,
        log_dir=str(log_dir),
        display="none",
        max_samples=1,
    )
    log = logs[0]
    if log.status != "success" or log.samples is None or log.location is None:
        raise RuntimeError("controlled benchmark did not produce a complete log")

    failures: Counter[str] = Counter()
    passed = 0
    for sample in log.samples:
        if not sample.scores or "contract_compliance" not in sample.scores:
            raise RuntimeError(f"sample {sample.id} has no contract score")
        score = sample.scores["contract_compliance"]
        if score.value == CORRECT:
            passed += 1
        else:
            failure_type = (score.metadata or {}).get("failure_type", "unknown")
            failures[str(failure_type)] += 1

    total = len(log.samples)
    summary = BenchmarkSummary(
        benchmark=BENCHMARK_ID,
        version=BENCHMARK_VERSION,
        profile=profile,
        total=total,
        passed=passed,
        accuracy=passed / total,
        failures=dict(sorted(failures.items())),
    )
    return Path(log.location), summary


def write_benchmark_summary(
    summary: BenchmarkSummary,
    output: Path,
    *,
    force: bool = False,
) -> Path:
    """Write a deterministic benchmark summary without accidental overwrite."""
    if output.exists() and not force:
        raise FileExistsError(
            f"output already exists: {output}; pass --force to replace it"
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f".{output.name}.tmp")
    temporary.write_text(
        f"{json.dumps(summary.to_dict(), indent=2, sort_keys=True)}\n",
        encoding="utf-8",
    )
    temporary.replace(output)
    return output
