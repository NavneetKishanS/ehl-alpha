"""Load runtime configuration from `.env.local` then `.env`."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_REPO_ROOT = Path(__file__).resolve().parent.parent


def load_env(repo_root: Path | None = None) -> None:
    """Load `.env.local` first, then fall back to `.env` for missing keys."""
    root = repo_root or _REPO_ROOT
    # override=False keeps values already present in the process environment.
    load_dotenv(root / ".env.local", override=False)
    load_dotenv(root / ".env", override=False)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


@dataclass(frozen=True)
class Settings:
    openai_api_key: str
    openai_base_url: str
    openai_vision_model: str
    caption_timeout_s: float
    caption_concurrency: int
    caption_max_retries: int
    caption_backoff_s: float
    batch_size: int
    images_scale: float
    page_image_scale: float

    @classmethod
    def from_env(cls, repo_root: Path | None = None) -> "Settings":
        load_env(repo_root)
        return cls(
            openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
            openai_base_url=os.getenv(
                "OPENAI_BASE_URL", "https://api.openai.com/v1"
            ).rstrip("/"),
            openai_vision_model=os.getenv("OPENAI_VISION_MODEL", "").strip(),
            caption_timeout_s=_env_float("CAPTION_TIMEOUT_S", 60.0),
            caption_concurrency=_env_int("CAPTION_CONCURRENCY", 2),
            caption_max_retries=_env_int("CAPTION_MAX_RETRIES", 4),
            caption_backoff_s=_env_float("CAPTION_BACKOFF_S", 1.5),
            batch_size=_env_int("PARSE_BATCH_SIZE", 5),
            images_scale=_env_float("IMAGES_SCALE", 2.0),
            page_image_scale=_env_float("PAGE_IMAGE_SCALE", 2.0),
        )

    def require_vision_config(self) -> None:
        missing = []
        if not self.openai_api_key or self.openai_api_key == "your-key-here":
            missing.append("OPENAI_API_KEY")
        if not self.openai_vision_model:
            missing.append("OPENAI_VISION_MODEL")
        if missing:
            raise RuntimeError(
                "Missing required vision config: "
                + ", ".join(missing)
                + ". Set them in .env.local (see .env.example)."
            )
