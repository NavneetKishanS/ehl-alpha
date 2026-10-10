"""CLI entry point: ``python -m parsing.run --pdf ...``."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from parsing.config import Settings
from parsing.pipeline import run_pipeline


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m parsing.run",
        description=(
            "Parse a PDF with Docling into per-page Markdown, figures, "
            "manifest, and lossless JSON for later LLM field extraction."
        ),
    )
    parser.add_argument("--pdf", required=True, type=Path, help="Path to input PDF")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("output"),
        help="Output root directory (default: output/)",
    )
    parser.add_argument(
        "--pages",
        type=str,
        default=None,
        help="Page range, e.g. 1-20 or 1,3,5-8 (1-based, inclusive)",
    )
    parser.add_argument(
        "--no-captions",
        action="store_true",
        help="Skip OpenAI vision captioning",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse without calling OpenAI; print figure / caption estimates",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Debug logging",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )

    settings = Settings.from_env()
    enable_captions = not args.no_captions and not args.dry_run

    try:
        result = run_pipeline(
            pdf_path=args.pdf,
            out_root=args.out,
            settings=settings,
            pages_spec=args.pages,
            enable_captions=enable_captions,
            dry_run=args.dry_run,
        )
    except Exception as exc:  # noqa: BLE001
        logging.error("%s", exc)
        return 1

    print(f"Wrote outputs to {result.doc_dir}")
    print(
        f"Pages: {len(result.pages)} | figures: {result.figure_count} | "
        f"skipped: {sum(1 for p in result.pages if p.skipped)} | "
        f"quality_flagged: {sum(1 for p in result.pages if p.quality_flagged)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
