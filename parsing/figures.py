"""Extract picture/chart images from a Docling document."""

from __future__ import annotations

import logging
from pathlib import Path

from docling_core.types.doc import DocItemLabel, DoclingDocument, PictureItem
from PIL import Image

from parsing.models import FigureRecord
from parsing.captions import VisionCaptioner

logger = logging.getLogger(__name__)


def figure_filename(page_no: int, index: int) -> str:
    return f"p{page_no:03d}_fig{index:02d}.png"


def _item_page_no(item: PictureItem) -> int | None:
    if not item.prov:
        return None
    return item.prov[0].page_no


def _item_area(item: PictureItem) -> float | None:
    if not item.prov:
        return None
    bbox = item.prov[0].bbox
    try:
        return abs(float(bbox.r) - float(bbox.l)) * abs(float(bbox.t) - float(bbox.b))
    except Exception:  # noqa: BLE001
        return None


def _caption_from_annotations(item: PictureItem, doc: DoclingDocument) -> str:
    # Prefer Docling picture-description annotations.
    for ann in item.annotations or []:
        kind = getattr(ann, "kind", None)
        text = getattr(ann, "text", None)
        if kind == "description" and isinstance(text, str) and text.strip():
            return text.strip()

    # Fall back to linked caption text nodes.
    try:
        linked = item.caption_text(doc)
        if linked and linked.strip():
            return linked.strip()
    except Exception:  # noqa: BLE001
        pass
    return ""


def extract_figures_for_pages(
    doc: DoclingDocument,
    page_numbers: list[int],
    images_dir: Path,
    *,
    captioner: VisionCaptioner | None = None,
    existing_captions: dict[str, str] | None = None,
) -> dict[int, list[FigureRecord]]:
    """Save figures as PNGs and return per-page figure records."""
    images_dir.mkdir(parents=True, exist_ok=True)
    existing_captions = existing_captions or {}
    page_set = set(page_numbers)
    per_page: dict[int, list[FigureRecord]] = {p: [] for p in page_numbers}
    pending_captions: list[tuple[str, Image.Image]] = []

    counters: dict[int, int] = {p: 0 for p in page_numbers}

    for item, _level in doc.iterate_items():
        if not isinstance(item, PictureItem) and getattr(item, "label", None) not in {
            DocItemLabel.PICTURE,
            DocItemLabel.CHART,
        }:
            continue
        page_no = _item_page_no(item)  # type: ignore[arg-type]
        if page_no is None or page_no not in page_set:
            continue

        counters[page_no] = counters.get(page_no, 0) + 1
        index = counters[page_no]
        filename = figure_filename(page_no, index)
        fig_id = filename[:-4]
        out_path = images_dir / filename

        pil = item.get_image(doc)  # type: ignore[union-attr]
        if pil is None and getattr(item, "image", None) is not None:
            try:
                pil = item.image.pil_image  # type: ignore[union-attr]
            except Exception:  # noqa: BLE001
                pil = None

        if pil is None:
            logger.warning("No raster for figure %s on page %s", fig_id, page_no)
            continue

        if not isinstance(pil, Image.Image):
            logger.warning("Unexpected image type for %s: %s", fig_id, type(pil))
            continue

        pil.convert("RGB").save(out_path, format="PNG")

        caption = existing_captions.get(fig_id) or _caption_from_annotations(
            item, doc  # type: ignore[arg-type]
        )
        if not caption and captioner is not None:
            pending_captions.append((fig_id, pil.copy()))

        per_page.setdefault(page_no, []).append(
            FigureRecord(
                figure_id=fig_id,
                filename=filename,
                page_no=page_no,
                index=index,
                caption=caption,
                area=_item_area(item),  # type: ignore[arg-type]
            )
        )

    if pending_captions and captioner is not None:
        filled = captioner.caption_many(pending_captions)
        for page_no, figs in per_page.items():
            for fig in figs:
                if not fig.caption and fig.figure_id in filled:
                    fig.caption = filled[fig.figure_id]

    return per_page


def count_figures(doc: DoclingDocument, page_numbers: list[int] | None = None) -> int:
    page_set = set(page_numbers) if page_numbers is not None else None
    count = 0
    for item, _level in doc.iterate_items():
        if not isinstance(item, PictureItem) and getattr(item, "label", None) not in {
            DocItemLabel.PICTURE,
            DocItemLabel.CHART,
        }:
            continue
        page_no = _item_page_no(item)  # type: ignore[arg-type]
        if page_set is not None and page_no not in page_set:
            continue
        count += 1
    return count
