"""Heuristics for marking likely-irrelevant pages as skipped."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PageStats:
    page_no: int
    text_length: int
    num_tables: int
    num_figures: int
    num_formulas: int
    page_area: float | None = None
    largest_figure_area: float | None = None


@dataclass(frozen=True)
class SkipDecision:
    skipped: bool
    reason: str | None = None


# Tunable thresholds — kept module-level so tests can assert against them.
MIN_MEANINGFUL_TEXT = 80
NEAR_EMPTY_TEXT = 40
FULL_PAGE_IMAGE_RATIO = 0.55
TITLE_SLIDE_MAX_TEXT = 220
TITLE_SLIDE_MAX_FIGURES = 2


def should_skip_page(stats: PageStats) -> SkipDecision:
    """Return whether a page looks like cover art, a divider, or near-empty.

    Pages are never deleted — callers only mark ``skipped: true`` in the
    manifest and omit them from ``full.md``.
    """
    if stats.text_length <= NEAR_EMPTY_TEXT and stats.num_tables == 0:
        if stats.num_figures >= 1:
            return SkipDecision(True, "near_empty_with_image")
        return SkipDecision(True, "near_empty")

    if (
        stats.page_area
        and stats.largest_figure_area
        and stats.page_area > 0
        and (stats.largest_figure_area / stats.page_area) >= FULL_PAGE_IMAGE_RATIO
        and stats.text_length < MIN_MEANINGFUL_TEXT
        and stats.num_tables == 0
    ):
        return SkipDecision(True, "full_page_image")

    # Title / divider / cover: little text, no tables/formulas, at most a
    # couple of decorative images (figures optional — title-only covers count).
    if (
        stats.text_length < MIN_MEANINGFUL_TEXT
        and stats.text_length <= TITLE_SLIDE_MAX_TEXT
        and stats.num_tables == 0
        and stats.num_formulas == 0
        and stats.num_figures <= TITLE_SLIDE_MAX_FIGURES
    ):
        return SkipDecision(True, "title_or_divider_slide")

    return SkipDecision(False, None)
