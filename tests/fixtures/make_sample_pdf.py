"""Generate a tiny multi-page PDF for integration tests."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image as PILImage
from PIL import ImageDraw
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle


def _make_chart_png() -> bytes:
    img = PILImage.new("RGB", (640, 360), color=(245, 245, 245))
    draw = ImageDraw.Draw(img)
    draw.rectangle([40, 40, 600, 320], outline=(30, 30, 30), width=2)
    # Simple bar chart
    bars = [(120, 220), (240, 140), (360, 180), (480, 100)]
    for x, top in bars:
        draw.rectangle([x, top, x + 60, 300], fill=(40, 100, 180))
    draw.text((50, 10), "Range by trim (mi)", fill=(0, 0, 0))
    draw.text((120, 305), "Base", fill=(0, 0, 0))
    draw.text((240, 305), "Sport", fill=(0, 0, 0))
    draw.text((360, 305), "Long", fill=(0, 0, 0))
    draw.text((480, 305), "M Sport", fill=(0, 0, 0))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def build_sample_pdf(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=letter)
    width, height = letter
    chart = ImageReader(BytesIO(_make_chart_png()))

    # Page 1 — cover / mostly image-like (title slide)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2, height / 2 + 40, "Sample Technical Report")
    c.setFont("Helvetica", 12)
    c.drawCentredString(width / 2, height / 2, "Cover page (should be skippable)")
    c.drawImage(chart, inch, inch, width=width - 2 * inch, height=2.2 * inch)
    c.showPage()

    # Page 2 — text + table + formula-like content
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(inch, height - inch, "Results")
    c.setFont("Helvetica", 11)
    text = c.beginText(inch, height - 1.4 * inch)
    text.textLines(
        [
            "This page contains a simple results table and a formula.",
            "Energy efficiency is reported as a percentage of rated capacity.",
            "The relationship used in the study is E = m c^2 for illustration.",
        ]
    )
    c.drawText(text)

    data = [
        ["Trim", "Range (mi)", "Optional"],
        ["Base", "280", "No"],
        ["Sport", "260", "Yes"],
        ["Long", "320", "Yes"],
    ]
    table = Table(data, colWidths=[1.5 * inch, 1.5 * inch, 1.2 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        )
    )
    table.wrapOn(c, width, height)
    table.drawOn(c, inch, height - 4.2 * inch)

    c.setFont("Helvetica-Oblique", 11)
    c.drawString(inch, height - 4.8 * inch, "Formula: E = m * c^2")
    c.drawImage(chart, inch, inch, width=4.5 * inch, height=2.5 * inch)
    c.setFont("Helvetica", 9)
    c.drawString(inch, inch - 14, "Figure: Range by trim")
    c.showPage()

    # Page 3 — near-empty
    c.setFont("Helvetica", 10)
    c.drawString(inch, height - inch, " ")
    c.showPage()

    # Page 4 — denser text page (wrapped so layout does not clip)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(inch, height - inch, "Discussion")
    c.setFont("Helvetica", 10)
    y = height - 1.4 * inch
    for i in range(1, 12):
        line = (
            f"Paragraph {i}: Customer feedback highlights charging speed, "
            f"range anxiety, and cabin noise under highway loads."
        )
        c.drawString(inch, y, line[:95])
        y -= 18
        if len(line) > 95:
            c.drawString(inch, y, line[95:])
            y -= 18
    c.showPage()

    c.save()
    return path


if __name__ == "__main__":
    out = Path(__file__).with_name("sample.pdf")
    build_sample_pdf(out)
    print(out)
