"""Integration test against a tiny generated PDF (no OpenAI calls)."""

from __future__ import annotations

from pathlib import Path

import pytest

from parsing.config import Settings
from parsing.pipeline import run_pipeline
from tests.fixtures.make_sample_pdf import build_sample_pdf

FIXTURE_PDF = Path(__file__).parent / "fixtures" / "sample.pdf"


@pytest.fixture(scope="module")
def sample_pdf() -> Path:
    return build_sample_pdf(FIXTURE_PDF)


def test_pipeline_parses_sample_pdf(sample_pdf: Path, tmp_path_factory):
    out_root = tmp_path_factory.mktemp("out")
    settings = Settings(
        openai_api_key="your-key-here",
        openai_base_url="https://api.openai.com/v1",
        openai_vision_model="",
        caption_timeout_s=30.0,
        caption_concurrency=1,
        caption_max_retries=1,
        caption_backoff_s=0.1,
        batch_size=2,
        images_scale=1.5,
        page_image_scale=1.5,
    )

    result = run_pipeline(
        pdf_path=sample_pdf,
        out_root=out_root,
        settings=settings,
        pages_spec="1-4",
        enable_captions=False,
        dry_run=False,
    )

    doc_dir = result.doc_dir
    assert (doc_dir / "full.md").exists()
    assert (doc_dir / "manifest.json").exists()
    assert (doc_dir / "document.json").exists()
    assert (doc_dir / "pages" / "p002.md").exists()
    assert not (doc_dir / "cache").exists()
    assert not (doc_dir / "run_meta.json").exists()

    skipped = [p for p in result.pages if p.skipped]
    assert skipped, "expected at least one skipped page in the sample PDF"

    page_files = sorted((doc_dir / "pages").glob("p*.md"))
    assert len(page_files) == 4

    p2 = (doc_dir / "pages" / "p002.md").read_text(encoding="utf-8")
    assert "Results" in p2 or "Range" in p2 or "Trim" in p2


def test_dry_run_prints_estimate(sample_pdf: Path, tmp_path, capsys):
    settings = Settings(
        openai_api_key="your-key-here",
        openai_base_url="https://api.openai.com/v1",
        openai_vision_model="",
        caption_timeout_s=30.0,
        caption_concurrency=1,
        caption_max_retries=1,
        caption_backoff_s=0.1,
        batch_size=2,
        images_scale=1.5,
        page_image_scale=1.5,
    )
    run_pipeline(
        pdf_path=sample_pdf,
        out_root=tmp_path,
        settings=settings,
        pages_spec="1-2",
        enable_captions=False,
        dry_run=True,
    )
    captured = capsys.readouterr().out
    assert "dry-run" in captured
    assert "figures found" in captured
