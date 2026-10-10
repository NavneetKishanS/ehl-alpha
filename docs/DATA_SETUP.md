# Real data setup

The app is grounded in the real BMW hackathon datasets: 13,771 real customer
feedback rows across three vehicle lines, real sales volumes, real
multi-market customer-study benchmarks, and the real official equipment/
pricing documents. **None of this is in git** — it's confidential hackathon
material, not something to publish on a public repo. Every teammate needs
their own local copy.

## One-time setup (everyone, ~2 minutes)

1. Get the dataset files from wherever the team shared them (`F70_feedback_hackathon.xlsx`, `G60_feedback_hackathon.xlsx`, `G70_feedback_hackathon.xlsx`, `F70_G60_G68_G70_customer_studies.xlsx`, `sales_volumes.xlsx`, `F70_OptionList.PDF`, `G60_OptionList.PDF`, `G70_OptionList.PDF`).
2. Copy all 8 files into `data-raw/` at the repo root (gitignored — create the folder if it doesn't exist).
3. Convert the 3 PDFs to text (needs `poppler`: `brew install poppler` on macOS):
   ```bash
   cd data-raw
   for f in F70_OptionList G60_OptionList G70_OptionList; do
     pdftotext -layout "$f.PDF" "$f.txt"
   done
   cd ..
   ```
4. Run the ingestion pipeline:
   ```bash
   npm run ingest
   ```
   This writes `src/data/*.json` (also gitignored). Restart `npm run dev` to pick it up.

Without this, the app still runs — `src/lib/seed.ts` falls back to a small
hand-written mock workflow so nobody is blocked waiting on file access. You'll
know you're on the fallback if the landing page shows only one vehicle
("BMW 5 Series") with one workflow instead of three vehicles with ~17
workflows.

## What's actually in the data

| File | Rows/sheets | What it is |
|---|---|---|
| `{F70,G60,G70}_feedback_hackathon.xlsx` | ~4,000-5,000 rows each, sheet `Feedback_Explorer` | Real customer verbatims with BMW's own **VFC (Vehicle Feedback Classification)** taxonomy already applied: `Feedback Type` (Likes/Wants/Difficult to Use/Defect), `Vfc level2 Name` / `Vfc level3 Name` (226 real categories), country, engine type (ICE/BEVE/PHEV). |
| `sales_volumes.xlsx` | 3 sheets (`F70`, `G60_G68`, `G70`), 4 rows each | 2024/2025/2030(est.) sales volume by market. |
| `F70_G60_G68_G70_customer_studies.xlsx` | `CN_EU_2025` (36 categories × 5 models, direct 0-10 means), `US_2025` (satisfaction-bucket distributions for G60/G70) | Customer-study ratings comparing BMW models to each other — **not** external competitors. |
| `{F70,G60,G70}_OptionList.PDF` | Official BMW price/equipment configurator documents (German) | Standard/optional equipment by trim. |

F70 = 1 Series, G60 = 5 Series (G68 is its China long-wheelbase variant),
G70 = 7 Series.

## How ingestion turns this into the app's data model

See `scripts/ingest-real-data.ts` (the pipeline) and `scripts/lib/componentMap.ts`
(the category mapping) for the actual code. The short version:

1. **Feedback → FeedbackRecord[]**: straight column mapping, written to `src/data/feedback.json`. This is what powers the Evidence Explorer (`/evidence`).
2. **Component mapping**: BMW's 226 `Vfc level2 Name` categories are mapped onto our 6 landing-page components (exterior/interior/windows/steering/engine/battery) by keyword rules in `componentMap.ts` — deterministic and auditable on purpose, not an LLM call. Unmatched categories go to a `general` bucket (still browsable in the Evidence Explorer, just no landing-page hotspot).
3. **Signals**: feedback grouped by `(vehicleCode, component, theme)`, with real frequency counts and a `Feedback Type` breakdown standing in for sentiment — written to `src/data/signals.json`.
4. **Requirements**: `src/lib/deriveRequirements.ts` picks up to 4 signals per component (prioritizing pain points, then customer-requested gaps, then strengths worth protecting) and scores them **deterministically** — no LLM involved in v0's scoring. See that file's top comment for exactly which factors are real data vs. which are placeholders (`effort_inverse` is always a flat placeholder; `competitive_gap`/`strategic_fit` are the two factors Role B should eventually upgrade to a real LLM call with cited evidence — see `docs/ROLE_B_AI.md`).
5. **Sales relevance / competitive gap**: computed from real `sales_volumes.xlsx` growth and real `customer-study` cross-model comparisons — see the `STUDY_CATEGORY_KEYWORDS` mapping in `deriveRequirements.ts` for how customer-study categories (a *different* taxonomy than VFC) are matched to our 6 components.
6. **Equipment PDFs**: chunked by section header into raw text excerpts (`src/data/equipment-chunks.json`) for citation. **Known gap**: this does not parse the standard/optional equipment matrix into a structured per-trim feature table — the PDF's column-aligned layout (10+ trim columns, "■" markers) is brittle to parse reliably from `pdftotext -layout` output in the time available. If someone wants to extend this: the raw text is at `data-raw/*_OptionList.txt` after the pdftotext step, and the "AUSGEWÄHLTE SERIENAUSSTATTUNGEN" sections contain the matrix.

## The one hand-authored piece

Everything above is data-driven. The one exception: the BMW 5 Series /
Battery & Charging workflow (`wf_g60_battery`) has a scripted PM-challenge
→ AI-revision → stakeholder-review narrative layered on top of its
real top requirement, so the demo has a complete decision-trail story to
walk through even before Role B wires in live OpenAI calls. The requirement
title/numbers it references are computed live from real data (re-running
`npm run ingest` will shift them if the source data changes); only the
stakeholder dialogue and PM's challenge text are scripted. See
`buildFlagshipNarrative()` in `src/lib/seed.ts`.

## If you need to re-derive the mapping decisions

`scripts/lib/componentMap.ts`'s keyword rules were built by inspecting the
full 226-category list once (`node -e` one-liner over the parsed xlsx — not
checked in, but trivial to re-run with `XLSX.readFile` + a `Counter`-style
tally). If a re-ingest surfaces a miscategorized theme, the fix is a keyword
rule or an `OVERRIDES` entry in that file, not a code path change.
