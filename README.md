# BMW Requirements Copilot

AI-assisted product requirement derivation, prioritization and human-in-the-loop
review for BMW's "AI for Product Decision Making" hackathon challenge.

Read [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) first — it has the challenge,
our concept, and how user stories map to what's built. Then
[`docs/DATA_SETUP.md`](docs/DATA_SETUP.md) to get the real datasets running
locally. Then read your role doc in `docs/`.

## Stack

- Next.js 14 (App Router, pinned for Node 18 compatibility — don't bump to 15/16
  mid-hackathon unless everyone upgrades Node to 20+)
- TypeScript, Tailwind CSS 3
- In-memory data store (`src/lib/db.ts`), seeded from **real BMW hackathon
  data** (13,771 verbatims, sales volumes, customer-study benchmarks) via
  `npm run ingest` — see [`docs/DATA_SETUP.md`](docs/DATA_SETUP.md). Falls
  back to a small hand-written mock if the real data isn't present locally,
  so nobody is blocked.
- AI layer (`src/lib/ai.ts`) targets **OpenAI** (the team's budget). Every
  function is currently a deterministic mock so the app works end-to-end
  with no API key; requirement scoring itself is already real/deterministic
  from the ingested data (see `src/lib/deriveRequirements.ts`) — the mocked
  functions are the narrative/summary layer on top. See
  [`docs/ROLE_B_AI.md`](docs/ROLE_B_AI.md).

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000. Requires Node >=18.17 (Node 20+ also fine).

For the real data (strongly recommended — see
[`docs/DATA_SETUP.md`](docs/DATA_SETUP.md)):

```bash
# copy the 8 dataset files into data-raw/, convert the 3 PDFs with pdftotext, then:
npm run ingest
```

## Project structure

```
src/
  lib/
    types.ts            # shared domain types — the team contract, read this first
    db.ts                # in-memory store + all read/write functions (Role A owns)
    seed.ts              # assembles real workflows from src/data/*.json, or falls back to a mock
    realData.ts          # loader for the ingested JSON fixtures
    deriveRequirements.ts # deterministic requirement derivation + scoring from real data
    ai.ts                # mocked AI functions (Role B replaces internals, targets OpenAI)
    api-client.ts        # typed fetch wrappers — frontend only talks to the API through here
  app/
    page.tsx                                # landing page (car hotspots, vehicle switcher)
    workflow/[componentId]/page.tsx         # PM workflow view (Role C)
    stakeholder/[workflowId]/[stakeholderId]/page.tsx  # stakeholder review (Role D)
    evidence/page.tsx                       # Evidence Explorer — filterable table over all real feedback (Role D)
    api/...                                 # REST routes, thin wrappers around lib/db.ts
  components/
    charts/              # MetricBar, GroupedBarChart — real SVG charts, no charting library
    ...                  # EvidenceBadge, PipelineStrip, AuditLogPanel, RequirementCard, ReviewerRow, CarHotspotViewer
scripts/
  ingest-real-data.ts    # offline pipeline: data-raw/*.xlsx,*.PDF -> src/data/*.json
  lib/componentMap.ts    # maps BMW's 226 real VFC feedback categories onto our 6 components
data-raw/                # gitignored — the real BMW datasets, copy your own in
src/data/                # gitignored — ingest script output, regenerate with `npm run ingest`
```

## Demo data

With real data ingested: 3 vehicle lines (BMW 1/5/7 Series), ~17 of 18
possible component workflows populated from real signals, a dedicated
Evidence Explorer over all 13,771 real feedback rows, and one fully
narrated flagship workflow (BMW 5 Series · Battery & Charging) showing
the PM-challenge → AI-revision → stakeholder-review loop end to end,
grounded in real numbers. See [`docs/DATA_SETUP.md`](docs/DATA_SETUP.md)
for exactly how each dataset becomes app data.

Without real data (fallback): one hand-written "battery" workflow for the
BMW 5 Series, enough to demo the mechanics with placeholder numbers.

## Known tradeoffs (intentional, for a 15-17h build)

- In-memory store, not a real DB. Swap-out point is clearly marked in `db.ts`.
- AI narrative layer (`ai.ts`) is mocked with templated text, not live OpenAI
  calls, by default — scoring itself is already real/deterministic. Swap-out
  points are documented in `ai.ts` and `docs/ROLE_B_AI.md`.
- Equipment PDF parsing stops at section-level text chunks, not a structured
  per-trim feature matrix — see the "known gap" note in `docs/DATA_SETUP.md`.
- `competitive_gap`/`sales_relevance`/`strategic_fit` score factors are
  computed per-component, not per-requirement-theme (customer-study and
  sales data isn't granular enough for the latter) — so requirements for the
  same component share those three factor values. Documented in each
  factor's `rationale` field, visible in the UI.
- Next.js pinned to 14.2.35 (not latest) for Node 18 compatibility across the
  team. `npm audit` will show Next.js platform CVEs fixed only in 15+ — not a
  concern for a localhost demo, but don't deploy this build publicly without
  upgrading first. Same applies to the `xlsx` package (dev-only, used by the
  ingestion script against trusted local files).
- **The real BMW datasets, and anything derived from them, must never be
  committed** — `data-raw/` and `src/data/*.json` are gitignored. Code that
  reads them is fine to commit; the data itself is not.
