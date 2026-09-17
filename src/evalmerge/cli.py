"""Command-line interface for EvalMerge."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

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

    parser.error(f"unknown command: {args.command}")
