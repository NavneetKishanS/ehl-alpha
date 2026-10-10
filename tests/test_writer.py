from pathlib import Path

from parsing.models import FigureRecord, PageResult
from parsing.writer import (
    PAGE_MARKER,
    short_caption,
    write_full_markdown,
    write_manifest,
    write_page_markdown,
)


def test_short_caption_truncates():
    assert short_caption("hello world") == "hello world"
    long = "x" * 200
    assert len(short_caption(long, limit=40)) == 40
    assert short_caption(long, limit=40).endswith("…")


def test_write_page_and_full_markdown(tmp_path: Path):
    pages_dir = tmp_path / "pages"
    write_page_markdown(pages_dir, 1, "# Page one\n\nHello\n")
    write_page_markdown(pages_dir, 2, "# Page two\n\nSkipped body\n")
    write_page_markdown(pages_dir, 3, "# Page three\n\nTable here\n")

    pages = [
        PageResult(page_no=1, markdown="# Page one\n\nHello\n", skipped=False),
        PageResult(
            page_no=2,
            markdown="# Page two\n\nSkipped body\n",
            skipped=True,
            skip_reason="near_empty",
        ),
        PageResult(
            page_no=3,
            markdown="# Page three\n\nTable here\n",
            skipped=False,
            num_tables=1,
        ),
    ]
    full_path = write_full_markdown(tmp_path, pages)
    text = full_path.read_text(encoding="utf-8")
    assert PAGE_MARKER.format(page_no=1) in text
    assert PAGE_MARKER.format(page_no=3) in text
    assert "Skipped body" not in text
    assert "Table here" in text


def test_write_manifest_includes_skip_and_quality(tmp_path: Path):
    pages = [
        PageResult(
            page_no=1,
            text_length=12,
            num_figures=1,
            skipped=True,
            skip_reason="near_empty_with_image",
            quality_flagged=True,
            quality_reasons=["very_low_text_with_content"],
            figures=[
                FigureRecord(
                    figure_id="p001_fig01",
                    filename="p001_fig01.png",
                    page_no=1,
                    index=1,
                    caption="A cover photo",
                )
            ],
        )
    ]
    path = write_manifest(tmp_path, pages)
    data = path.read_text(encoding="utf-8")
    assert '"skipped": true' in data
    assert "near_empty_with_image" in data
    assert "very_low_text_with_content" in data
