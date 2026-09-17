"""Command-line interface for EvalMerge."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from evalmerge.benchmark import run_controlled_benchmark, write_benchmark_summary
from evalmerge.export import export_eval_log


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="evalmerge",
        description="Prepare Inspect AI evaluation logs for collaborative review.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser(
        "export", help="convert an Inspect .eval log to review JSON"
    )
    export_parser.add_argument("source", type=Path, help="path to an Inspect .eval log")
    export_parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="output path (default: SOURCE.review.json)",
    )
    export_parser.add_argument(
        "--force", action="store_true", help="replace an existing output file"
    )

    benchmark_parser = subparsers.add_parser(
        "benchmark",
        help="run a credential-free structured-output reliability baseline",
    )
    benchmark_parser.add_argument(
        "--profile",
        choices=("conformant", "brittle"),
        default="brittle",
        help="controlled response profile (default: brittle)",
    )
    benchmark_parser.add_argument(
        "--log-dir",
        type=Path,
        default=Path("logs"),
        help="Inspect log directory (default: logs)",
    )
    benchmark_parser.add_argument(
        "--summary-output",
        type=Path,
        help="optional path for a stable JSON summary",
    )
    benchmark_parser.add_argument(
        "--no-export",
        action="store_true",
        help="do not create a Review Studio JSON document",
    )
    benchmark_parser.add_argument(
        "--force",
        action="store_true",
        help="replace existing summary or review output files",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the EvalMerge command-line interface."""
    parser = _parser()
    args = parser.parse_args(argv)

    if args.command == "export":
        try:
            output_path = export_eval_log(args.source, args.output, force=args.force)
        except (OSError, ValueError) as error:
            print(f"evalmerge: error: {error}", file=sys.stderr)
            return 1
        print(f"Exported review document: {output_path}")
        return 0

    if args.command == "benchmark":
        try:
            log_path, summary = run_controlled_benchmark(args.profile, args.log_dir)
            review_path = None
            if not args.no_export:
                review_path = export_eval_log(log_path, force=args.force)
            if args.summary_output:
                write_benchmark_summary(
                    summary,
                    args.summary_output,
                    force=args.force,
                )
        except (OSError, RuntimeError, ValueError) as error:
            print(f"evalmerge: error: {error}", file=sys.stderr)
            return 1

        print(f"Inspect log: {log_path}")
        if review_path is not None:
            print(f"Review document: {review_path}")
        if args.summary_output:
            print(f"Benchmark summary: {args.summary_output}")
        print(json.dumps(summary.to_dict(), sort_keys=True))
        return 0

    parser.error(f"unknown command: {args.command}")
