"""Docling PDF conversion helpers.

API names are verified against the installed ``docling`` package (2.137+).
"""

from __future__ import annotations

from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    PictureDescriptionApiOptions,
    TableFormerMode,
    TableStructureOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import DoclingDocument
from pypdf import PdfReader

from parsing.captions import DEFAULT_CAPTION_PROMPT
from parsing.config import Settings


def count_pdf_pages(pdf_path: Path) -> int:
    reader = PdfReader(str(pdf_path))
    return len(reader.pages)


def parse_page_range(spec: str | None, total_pages: int) -> list[int]:
    """Parse ``1-20``, ``1,3,5``, or ``1-5,10`` into 1-based page numbers."""
    if not spec or not spec.strip():
        return list(range(1, total_pages + 1))

    pages: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start_s, end_s = part.split("-", 1)
            start, end = int(start_s), int(end_s)
            if start > end:
                start, end = end, start
            for p in range(start, end + 1):
                if 1 <= p <= total_pages:
                    pages.add(p)
        else:
            p = int(part)
            if 1 <= p <= total_pages:
                pages.add(p)
    return sorted(pages)


def _build_pipeline_options(
    settings: Settings,
    *,
    enable_captions: bool,
    generate_page_images: bool,
) -> PdfPipelineOptions:
    options = PdfPipelineOptions(
        do_table_structure=True,
        do_ocr=True,
        do_formula_enrichment=True,
        do_code_enrichment=False,
        generate_picture_images=True,
        generate_page_images=generate_page_images,
        images_scale=settings.images_scale,
        do_picture_description=enable_captions,
        enable_remote_services=enable_captions,
    )
    options.table_structure_options = TableStructureOptions(
        do_cell_matching=True,
        mode=TableFormerMode.ACCURATE,
    )

    if enable_captions:
        settings.require_vision_config()
        options.picture_description_options = PictureDescriptionApiOptions(
            url=f"{settings.openai_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            params={"model": settings.openai_vision_model},
            timeout=settings.caption_timeout_s,
            concurrency=settings.caption_concurrency,
            prompt=DEFAULT_CAPTION_PROMPT,
            provenance="openai-vision",
        )

    return options


def build_converter(
    settings: Settings,
    *,
    enable_captions: bool = False,
    generate_page_images: bool = True,
) -> DocumentConverter:
    pipeline_options = _build_pipeline_options(
        settings,
        enable_captions=enable_captions,
        generate_page_images=generate_page_images,
    )
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )


def convert_page_range(
    converter: DocumentConverter,
    pdf_path: Path,
    start_page: int,
    end_page: int,
):
    """Convert an inclusive 1-based page range."""
    return converter.convert(
        str(pdf_path),
        page_range=(start_page, end_page),
        raises_on_error=False,
    )


def merge_documents(docs: list[DoclingDocument]) -> DoclingDocument | None:
    if not docs:
        return None
    if len(docs) == 1:
        return docs[0]
    return DoclingDocument.concatenate(docs)
