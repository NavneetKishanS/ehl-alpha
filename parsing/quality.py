"""Quality heuristics for pages that look badly parsed."""

from __future__ import annotations

from dataclasses import dataclass, field

from docling_core.types.doc import (
    DocItemLabel,
    DoclingDocument,
    FormulaItem,
    PictureItem,
    TableItem,
    TextItem,
)


@dataclass
class QualityReport:
    flagged: bool
    reasons: list[str] = field(default_factory=list)

    def add(self, reason: str) -> None:
        if reason not in self.reasons:
            self.reasons.append(reason)
        self.flagged = True


def _table_has_empty_or_inconsistent_grid(table: TableItem) -> list[str]:
    reasons: list[str] = []
    data = table.data
    if data is None:
        return ["table_missing_data"]

    num_rows = data.num_rows or 0
    num_cols = data.num_cols or 0
    cells = data.table_cells or []

    if num_rows == 0 or num_cols == 0:
        reasons.append("table_empty_grid")
        return reasons

    expected = num_rows * num_cols
    if not cells:
        reasons.append("table_empty_grid")
        return reasons

    # Count cells that look empty and detect sparse / inconsistent grids.
    empty = 0
    for cell in cells:
        text = (getattr(cell, "text", None) or "").strip()
        if not text:
            empty += 1

    if empty == len(cells):
        reasons.append("table_all_cells_empty")
    elif empty / max(len(cells), 1) >= 0.7:
        reasons.append("table_mostly_empty_cells")

    # Merged cells make len(cells) < expected; a large surplus is suspicious.
    if len(cells) > expected * 1.5:
        reasons.append("table_inconsistent_grid")
    elif len(cells) < max(expected * 0.35, 1) and expected >= 4:
        reasons.append("table_sparse_grid")

    return reasons


def _formula_failed(formula: FormulaItem) -> bool:
    text = (formula.text or "").strip()
    orig = (getattr(formula, "orig", None) or "").strip()
    if not text:
        return True
    # Docling leaves failed formula enrichment as empty / placeholder-like text.
    failed_markers = ("formula not", "unable to", "<!--", "[failed")
    lowered = text.lower()
    if any(m in lowered for m in failed_markers):
        return True
    if text in {"$", "$$", "\\", "?"} and not orig:
        return True
    return False


def assess_page_quality(
    doc: DoclingDocument,
    page_no: int,
    *,
    text_length: int,
    ocr_score: float | None = None,
    has_text_layer_hint: bool = True,
) -> QualityReport:
    """Flag pages that are likely poorly parsed."""
    report = QualityReport(flagged=False)

    for item, _level in doc.iterate_items(page_no=page_no):
        if isinstance(item, TableItem) or getattr(item, "label", None) == DocItemLabel.TABLE:
            for reason in _table_has_empty_or_inconsistent_grid(item):  # type: ignore[arg-type]
                report.add(reason)
        elif isinstance(item, FormulaItem) or getattr(item, "label", None) == DocItemLabel.FORMULA:
            if _formula_failed(item):  # type: ignore[arg-type]
                report.add("formula_failed")

    if has_text_layer_hint and text_length < 40:
        # Low extracted text on a page that still has a text layer / content.
        has_structure = False
        for item, _level in doc.iterate_items(page_no=page_no):
            if isinstance(item, (TableItem, PictureItem, FormulaItem, TextItem)):
                has_structure = True
                break
        if has_structure:
            report.add("very_low_text_with_content")

    if ocr_score is not None and ocr_score < 0.45:
        report.add(f"low_ocr_confidence:{ocr_score:.2f}")

    return report
