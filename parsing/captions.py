"""OpenAI-compatible vision captioning with retries, backoff, and concurrency.

Used as a robust fallback / fill-in when Docling's picture-description step
leaves a figure without a usable caption.
"""

from __future__ import annotations

import base64
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

from parsing.config import Settings

logger = logging.getLogger(__name__)

DEFAULT_CAPTION_PROMPT = (
    "You are captioning a figure extracted from a technical document. "
    "In 2-4 sentences, state: (1) figure type (chart, diagram, photo, table "
    "image, schematic, etc.), (2) axes/labels/units if present, (3) key "
    "numbers or callouts, and (4) the main takeaway. Be concrete; do not invent "
    "values you cannot see."
)


class VisionCaptioner:
    def __init__(self, settings: Settings, prompt: str | None = None):
        self.settings = settings
        self.prompt = prompt or DEFAULT_CAPTION_PROMPT
        self.url = f"{settings.openai_base_url}/chat/completions"

    def caption_image(self, image: Image.Image | Path) -> str:
        if isinstance(image, Path):
            with Image.open(image) as im:
                return self._caption_pil(im.convert("RGB"))
        return self._caption_pil(image.convert("RGB"))

    def caption_many(
        self, items: list[tuple[str, Image.Image | Path]]
    ) -> dict[str, str]:
        """Caption many images; returns map id -> caption (empty string on failure)."""
        if not items:
            return {}

        results: dict[str, str] = {}
        workers = max(1, self.settings.caption_concurrency)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(self.caption_image, image): fig_id
                for fig_id, image in items
            }
            for fut in as_completed(futures):
                fig_id = futures[fut]
                try:
                    results[fig_id] = fut.result()
                except Exception as exc:  # noqa: BLE001 — keep pipeline alive
                    logger.error("Caption failed for %s: %s", fig_id, exc)
                    results[fig_id] = ""
        return results

    def _caption_pil(self, image: Image.Image) -> str:
        self.settings.require_vision_config()
        buf = BytesIO()
        image.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        payload = {
            "model": self.settings.openai_vision_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64}"},
                        },
                        {"type": "text", "text": self.prompt},
                    ],
                }
            ],
            "max_tokens": 300,
        }
        headers = {
            "Authorization": f"Bearer {self.settings.openai_api_key}",
            "Content-Type": "application/json",
        }

        last_error: Exception | None = None
        attempts = max(1, self.settings.caption_max_retries)
        for attempt in range(attempts):
            try:
                resp = requests.post(
                    self.url,
                    headers=headers,
                    json=payload,
                    timeout=self.settings.caption_timeout_s,
                )
                if resp.status_code in {429, 500, 502, 503, 504}:
                    raise RuntimeError(
                        f"transient HTTP {resp.status_code}: {resp.text[:200]}"
                    )
                resp.raise_for_status()
                data = resp.json()
                text = (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
                return (text or "").strip()
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt + 1 >= attempts:
                    break
                sleep_for = self.settings.caption_backoff_s * (2**attempt)
                logger.warning(
                    "Caption attempt %s/%s failed (%s); retrying in %.1fs",
                    attempt + 1,
                    attempts,
                    exc,
                    sleep_for,
                )
                time.sleep(sleep_for)

        raise RuntimeError(f"Captioning failed after {attempts} attempts: {last_error}")
