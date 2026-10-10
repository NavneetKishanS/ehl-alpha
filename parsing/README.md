# Document parsing (Docling)

Converts PDFs into per-page Markdown, extracted figures, lossless Docling
JSON, and a quality/skip manifest — ready for a later LLM field-extraction
step (not included here).

## Setup

```bash
uv venv .venv-parsing
source .venv-parsing/bin/activate
uv pip install -r requirements-parsing.txt
cp .env.example .env.local   # then paste OPENAI_API_KEY + OPENAI_VISION_MODEL
```

## Run

```bash
# Cost estimate only (no OpenAI calls)
python -m parsing.run --pdf path/to/report.pdf --pages 1-20 --dry-run

# Parse without captions
python -m parsing.run --pdf path/to/report.pdf --pages 1-20 --no-captions --out output/

# Full parse with vision captions (requires .env.local)
python -m parsing.run --pdf path/to/report.pdf --pages 1-20 --out output/
```

Outputs land in `output/<doc_name>/`:

- `pages/pNNN.md` — one Markdown file per page
- `full.md` — non-skipped pages concatenated with page markers
- `document.json` — Docling lossless JSON
- `manifest.json` — per-page stats, `skipped`, quality flags
- `images/pNNN_figNN.png` — extracted figures
- `page_images/pNNN.png` — full-page renders for quality-flagged pages only

## Tests

```bash
source .venv-parsing/bin/activate
pytest -q
```
