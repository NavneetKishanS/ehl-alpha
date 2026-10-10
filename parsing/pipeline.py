"""Orchestrate Docling parsing into a clean output directory."""

from __future__ import annotations

import logging
import shutil
from dataclasses import dataclass
from pathlib import Path

from docling_core.types.doc import DoclingDocument

from parsing.captions import VisionCaptioner
from parsing.config import Settings
from parsing.converter import (
    build_converter,
    convert_page_range,
    count_pdf_pages,
    merge_documents,
    parse_page_range,
)
from parsing.figures import count_figures, extract_figures_for_pages
from parsing.filters import PageStats, should_skip_page
from parsing.models import PageResult
from parsing.quality import assess_page_quality
from parsing.writer import (
    count_labels,
    page_text_length,
    render_page_markdown,
    save_page_image,
    write_document_json,
    write_full_markdown,
    write_manifest,
    write_page_markdown,
)

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    doc_dir: Path
    pages: list[PageResult]
    figure_count: int
    estimated_caption_calls: int
    dry_run: bool


def _doc_name(pdf_path: Path) -> str:
    return pdf_path.stem


def _batches(pages: list[int], batch_size: int) -> list[list[int]]:
    size = max(1, batch_size)
    return [pages[i : i + size] for i in range(0, len(pages), size)]


def _page_area(doc: DoclingDocument, page_no: int) -> float | None:
    page = doc.pages.get(page_no)
    if page is None or page.size is None:
        return None
    try:
        return float(page.size.width) * float(page.size.height)
    except Exception:  # noqa: BLE001
        return None


def _ocr_score(conv_result, page_no: int) -> float | None:
    conf = getattr(conv_result, "confidence", None)
    if conf is None:
        return None
    pages = getattr(conf, "pages", None) or {}
    scores = pages.get(page_no)
    if scores is None:
        return None
    value = getattr(scores, "ocr_score", None)
    return float(value) if value is not None else None


def run_pipeline(
    pdf_path: Path,
    out_root: Path,
    settings: Settings,
    *,
    pages_spec: str | None = None,
    enable_captions: bool = True,
    dry_run: bool = False,
) -> PipelineResult:
    pdf_path = pdf_path.resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(pdf_path)

    total_pages = count_pdf_pages(pdf_path)
    page_numbers = parse_page_range(pages_spec, total_pages)
    if not page_numbers:
        raise ValueError("No pages selected for conversion.")

    doc_dir = out_root / _doc_name(pdf_path)
    if doc_dir.exists():
        shutil.rmtree(doc_dir)
    images_dir = doc_dir / "images"
    pages_dir = doc_dir / "pages"
    page_images_dir = doc_dir / "page_images"
    for d in (doc_dir, images_dir, pages_dir):
        d.mkdir(parents=True, exist_ok=True)

    want_captions = enable_captions and not dry_run
    captioner = VisionCaptioner(settings) if want_captions else None
    converter = build_converter(
        settings,
        enable_captions=want_captions,
        generate_page_images=True,
    )

    page_results: list[PageResult] = []
    batch_docs: list[DoclingDocument] = []
    figure_count_total = 0
    estimated_caption_calls = 0

    for batch in _batches(page_numbers, settings.batch_size):
        start, end = batch[0], batch[-1]
        logger.info("Converting pages %s-%s", start, end)
        result = convert_page_range(converter, pdf_path, start, end)
        doc = result.document
        batch_docs.append(doc)

        figures_by_page = extract_figures_for_pages(
            doc,
            batch,
            images_dir,
            captioner=captioner if want_captions else None,
        )

        if dry_run:
            figs = count_figures(doc, batch)
            figure_count_total += figs
            estimated_caption_calls += figs

        for page_no in batch:
            labels = count_labels(doc, page_no)
            text_len = page_text_length(doc, page_no)
            figs = figures_by_page.get(page_no, [])
            largest = max((f.area or 0.0) for f in figs) if figs else None
            stats = PageStats(
                page_no=page_no,
                text_length=text_len,
                num_tables=labels["tables"],
                num_figures=labels["figures"],
                num_formulas=labels["formulas"],
                page_area=_page_area(doc, page_no),
                largest_figure_area=largest,
            )
            skip = should_skip_page(stats)
            quality = assess_page_quality(
                doc,
                page_no,
                text_length=text_len,
                ocr_score=_ocr_score(result, page_no),
                has_text_layer_hint=True,
            )

            markdown = render_page_markdown(doc, page_no, figs)
            write_page_markdown(pages_dir, page_no, markdown)

            page_image_rel = None
            if quality.flagged:
                page_image_rel = save_page_image(doc, page_no, page_images_dir)

            page_results.append(
                PageResult(
                    page_no=page_no,
                    text_length=text_len,
                    num_tables=labels["tables"],
                    num_figures=labels["figures"],
                    num_formulas=labels["formulas"],
                    skipped=skip.skipped,
                    skip_reason=skip.reason,
                    quality_flagged=quality.flagged,
                    quality_reasons=quality.reasons,
                    markdown=markdown,
                    figures=figs,
                    page_image=page_image_rel,
                )
            )
            if not dry_run:
                figure_count_total += labels["figures"]

    if not dry_run:
        figure_count_total = sum(p.num_figures for p in page_results)

    write_full_markdown(doc_dir, page_results)
    write_manifest(doc_dir, page_results)

    merged = merge_documents(batch_docs)
    if merged is not None:
        write_document_json(doc_dir, merged)
    else:
        (doc_dir / "document.json").write_text("{}\n", encoding="utf-8")

    if dry_run:
        print(
            f"[dry-run] figures found: {figure_count_total}; "
            f"estimated caption API calls: {estimated_caption_calls}"
        )

    return PipelineResult(
        doc_dir=doc_dir,
        pages=page_results,
        figure_count=figure_count_total,
        estimated_caption_calls=estimated_caption_calls,
        dry_run=dry_run,
    )
