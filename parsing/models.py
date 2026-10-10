"""In-memory page/figure records used while assembling outputs."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class FigureRecord:
    figure_id: str
    filename: str
    page_no: int
    index: int
    caption: str = ""
    area: float | None = None


@dataclass
class PageResult:
    page_no: int
    text_length: int = 0
    num_tables: int = 0
    num_figures: int = 0
    num_formulas: int = 0
    skipped: bool = False
    skip_reason: str | None = None
    quality_flagged: bool = False
    quality_reasons: list[str] = field(default_factory=list)
    markdown: str = ""
    figures: list[FigureRecord] = field(default_factory=list)
    page_image: str | None = None

    def to_manifest_entry(self) -> dict[str, Any]:
        return {
            "page": self.page_no,
            "text_length": self.text_length,
            "num_tables": self.num_tables,
            "num_figures": self.num_figures,
            "num_formulas": self.num_formulas,
            "quality_flagged": self.quality_flagged,
            "quality_reasons": self.quality_reasons,
            "skipped": self.skipped,
            "skip_reason": self.skip_reason,
            "page_image": self.page_image,
        }
