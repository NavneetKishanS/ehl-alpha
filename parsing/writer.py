"""Write per-page Markdown, full.md, manifest.json, and document.json."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from docling_core.types.doc import (
    DocItemLabel,
    DoclingDocument,
    FormulaItem,
    PictureItem,
    TableItem,
    TextItem,
)
from docling_core.types.doc.base import ImageRefMode

from parsing.models import FigureRecord, PageResult


PAGE_MARKER = "<!-- PAGE {page_no} -->"


def short_caption(caption: str, limit: int = 120) -> str:
    text = " ".join((caption or "").split())
    if not text:
        return "figure"
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _replace_image_placeholders(
    markdown: str,
    figures: list[FigureRecord],
) -> str:
    """Replace Docling image placeholders with named local figure links."""
    if not figures:
        return markdown

    queue = list(figures)
    patterns = [
        r"<!--\s*image\s*-->",
        r"!\[.*?\]\([^)]+\)",
    ]

    def _next_figure_md() -> str:
        if not queue:
            return "<!-- image -->"
        fig = queue.pop(0)
        alt = f"Figure {fig.figure_id}: {short_caption(fig.caption)}"
        return f"![{alt}](images/{fig.filename})"

    out = markdown
    for pattern in patterns:
        while queue and re.search(pattern, out, flags=re.IGNORECASE):
            out = re.sub(pattern, lambda _m: _next_figure_md(), out, count=1, flags=re.IGNORECASE)

    # Append any remaining figures that Docling didn't emit as placeholders.
    if queue:
        extras = "\n\n".join(
            f"![Figure {fig.figure_id}: {short_caption(fig.caption)}](images/{fig.filename})"
            for fig in queue
        )
        out = (out.rstrip() + "\n\n" + extras + "\n") if out.strip() else extras + "\n"

    return out


def _ensure_formulas_as_latex(markdown: str, doc: DoclingDocument, page_no: int) -> str:
    """Best-effort: if formulas exist but weren't rendered, append LaTeX blocks."""
    formulas: list[str] = []
    for item, _level in doc.iterate_items(page_no=page_no):
        if isinstance(item, FormulaItem) or getattr(item, "label", None) == DocItemLabel.FORMULA:
            text = (getattr(item, "text", None) or "").strip()
            if text and text not in markdown:
                formulas.append(text)
    if not formulas:
        return markdown
    blocks = []
    for formula in formulas:
        if formula.startswith("$$") or formula.startswith("$"):
            blocks.append(formula)
        else:
            blocks.append(f"$$\n{formula}\n$$")
    return markdown.rstrip() + "\n\n" + "\n\n".join(blocks) + "\n"


def _table_is_complex(table: TableItem) -> bool:
    data = table.data
    if data is None:
        return False
    for cell in data.table_cells or []:
        if (getattr(cell, "row_span", 1) or 1) > 1:
            return True
        if (getattr(cell, "col_span", 1) or 1) > 1:
            return True
    return False


def _upgrade_complex_tables_to_html(
    markdown: str, doc: DoclingDocument, page_no: int
) -> str:
    """Prefer HTML for merged-cell / complex tables (Markdown loses spans)."""
    out = markdown
    for item, _level in doc.iterate_items(page_no=page_no):
        if not isinstance(item, TableItem) and getattr(item, "label", None) != DocItemLabel.TABLE:
            continue
        table: TableItem = item  # type: ignore[assignment]
        if not _table_is_complex(table):
            continue
        try:
            md_table = table.export_to_markdown(doc=doc)
            html_table = table.export_to_html(doc=doc, add_caption=False)
        except Exception:  # noqa: BLE001
            continue
        if md_table and html_table and md_table in out:
            out = out.replace(md_table, html_table.strip(), 1)
    return out


def render_page_markdown(
    doc: DoclingDocument,
    page_no: int,
    figures: list[FigureRecord],
) -> str:
    raw = doc.export_to_markdown(
        page_no=page_no,
        image_mode=ImageRefMode.PLACEHOLDER,
        image_placeholder="<!-- image -->",
        include_annotations=True,
    )
    md = _replace_image_placeholders(raw or "", figures)
    md = _upgrade_complex_tables_to_html(md, doc, page_no)
    md = _ensure_formulas_as_latex(md, doc, page_no)
    return md.strip() + "\n"


def write_page_markdown(pages_dir: Path, page_no: int, markdown: str) -> Path:
    pages_dir.mkdir(parents=True, exist_ok=True)
    path = pages_dir / f"p{page_no:03d}.md"
    path.write_text(markdown, encoding="utf-8")
    return path


def write_full_markdown(
    out_dir: Path,
    pages: list[PageResult],
) -> Path:
    """Concatenate non-skipped pages with clear page markers."""
    chunks: list[str] = []
    for page in pages:
        if page.skipped:
            continue
        chunks.append(PAGE_MARKER.format(page_no=page.page_no))
        chunks.append(page.markdown.rstrip())
        chunks.append("")
    path = out_dir / "full.md"
    path.write_text("\n".join(chunks).rstrip() + "\n", encoding="utf-8")
    return path


def write_manifest(out_dir: Path, pages: list[PageResult]) -> Path:
    entries = [page.to_manifest_entry() for page in pages]
    path = out_dir / "manifest.json"
    path.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def write_document_json(out_dir: Path, doc: DoclingDocument) -> Path:
    path = out_dir / "document.json"
    doc.save_as_json(path, image_mode=ImageRefMode.PLACEHOLDER)
    return path


def page_text_length(doc: DoclingDocument, page_no: int) -> int:
    parts: list[str] = []
    for item, _level in doc.iterate_items(page_no=page_no):
        if isinstance(item, (TextItem, FormulaItem)) or getattr(item, "label", None) in {
            DocItemLabel.TEXT,
            DocItemLabel.PARAGRAPH,
            DocItemLabel.SECTION_HEADER,
            DocItemLabel.TITLE,
            DocItemLabel.LIST_ITEM,
            DocItemLabel.CAPTION,
            DocItemLabel.FORMULA,
        }:
            text = getattr(item, "text", None) or ""
            parts.append(text)
    return len(" ".join(parts))


def count_labels(doc: DoclingDocument, page_no: int) -> dict[str, int]:
    counts = {"tables": 0, "figures": 0, "formulas": 0}
    for item, _level in doc.iterate_items(page_no=page_no):
        label = getattr(item, "label", None)
        if isinstance(item, TableItem) or label == DocItemLabel.TABLE:
            counts["tables"] += 1
        elif isinstance(item, PictureItem) or label in {
            DocItemLabel.PICTURE,
            DocItemLabel.CHART,
        }:
            counts["figures"] += 1
        elif isinstance(item, FormulaItem) or label == DocItemLabel.FORMULA:
            counts["formulas"] += 1
    return counts


def save_page_image(
    doc: DoclingDocument,
    page_no: int,
    page_images_dir: Path,
) -> str | None:
    page = doc.pages.get(page_no) if hasattr(doc, "pages") else None
    if page is None or getattr(page, "image", None) is None:
        return None
    try:
        pil = page.image.pil_image
    except Exception:  # noqa: BLE001
        return None
    if pil is None:
        return None
    page_images_dir.mkdir(parents=True, exist_ok=True)
    filename = f"p{page_no:03d}.png"
    pil.convert("RGB").save(page_images_dir / filename, format="PNG")
    return f"page_images/{filename}"


def manifest_summary(pages: list[PageResult]) -> dict[str, Any]:
    return {
        "pages": len(pages),
        "skipped": sum(1 for p in pages if p.skipped),
        "quality_flagged": sum(1 for p in pages if p.quality_flagged),
        "figures": sum(p.num_figures for p in pages),
        "tables": sum(p.num_tables for p in pages),
        "formulas": sum(p.num_formulas for p in pages),
    }
