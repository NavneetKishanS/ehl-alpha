# Role A — Backend & Data Platform

You own `src/lib/types.ts`, `src/lib/db.ts`, `src/lib/seed.ts`,
`src/lib/realData.ts`, `src/lib/deriveRequirements.ts`,
`scripts/ingest-real-data.ts`, `scripts/lib/componentMap.ts`, and everything
under `src/app/api/`. You are the team's dependency: Roles C and D build
against `src/lib/api-client.ts`, which already wraps every endpoint that
exists in v0. If you change a response shape, you change `api-client.ts` in
the same commit and shout in the team channel — that file is the contract.

Read `docs/PROJECT_BRIEF.md` and `docs/DATA_SETUP.md` first. This doc is
your task list. **Run `npm run ingest` before you do anything else** (see
`docs/DATA_SETUP.md`) — v0 is built around the real datasets, not mock data.

## What already exists (v0, working, grounded in real data)

- Full type model in `src/lib/types.ts` — Vehicle, VehicleComponent,
  Workflow/Stage, Requirement/ScoreFactor, Signal, SourceRecord,
  FeedbackRecord, SalesVolume, CustomerStudyScore, Stakeholder,
  StakeholderReview, AuditLogEntry, AISummary. Read this file top to bottom
  before changing anything; it's the shared vocabulary.
- In-memory store (`src/lib/db.ts`) with full CRUD + an append-only audit
  log. Every mutation function (`createWorkflow`, `updateStage`,
  `updateRequirementStatus`, `updateWeights`, `submitReview`,
  `addAISummary`) already calls `logAction()` — keep this invariant for
  anything new you add: **no mutation without a log entry**.
- **Real ingestion pipeline** (`scripts/ingest-real-data.ts`): parses the 3
  feedback datasets (13,771 real verbatims), sales volumes, and
  multi-market customer studies into `src/data/*.json`. `npm run ingest` to
  run it. See `docs/DATA_SETUP.md` for the full pipeline explanation.
- **Deterministic requirement derivation** (`src/lib/deriveRequirements.ts`):
  turns real signals into scored, evidence-backed `Requirement` objects —
  no LLM involved. This already covers most of what a naive "AI scoring"
  implementation would do, and it's more defensible (every number traces
  to a formula you can point at, not a model's opinion).
- `src/lib/seed.ts` assembles real workflows for all 3 vehicle lines from
  the ingested JSON (`buildRealSeed()`), falling back to a small
  hand-written mock (`buildMockSeed()`) if a teammate hasn't run ingestion
  yet. **Never break the fallback path** — it's what keeps the app
  runnable for anyone without `data-raw/` access yet.
- REST routes for everything in `api-client.ts` — vehicles, components,
  workflows (get/create/by-component), requirements (list/get/patch/
  weights/challenge), signals+sources, audit log, AI summaries,
  stakeholders, reviews, feedback (filtered/paginated, for the Evidence
  Explorer), customer-study comparisons.

## Your tasks, roughly in priority order

### 1. Live ingestion endpoint (US-1.1, 1.3) — upgrade from offline to in-app
Right now ingestion is an offline script (`npm run ingest`), run once by
each teammate against local files. If time allows, build
`POST /api/workflows/:id/ingest` so a PM can upload a new dataset from the
UI and see it flow through without a dev re-running a script. Reuse the
parsing logic already in `scripts/ingest-real-data.ts` — extract the
column-mapping into a shared function both the script and the route can
call. Add the malformed-row flagging the current script skips (AC in
US-1.1): return `{ imported: n, flagged: [...] }` instead of silently
coercing bad rows.

### 2. Web enrichment (US-1.2) — currently missing entirely
There is no external/web `SourceRecord` in the real data pipeline — only
BMW's own 4 datasets. If time allows, add a minimal enrichment step (even
a stubbed/hardcoded set of competitor data points for one or two
components) so every component's evidence isn't 100% internal. Every web
`SourceRecord` needs `url`, `retrievedAt`, and a `reliability` tier
(`review_site`/`forum`/`official`) — the type already supports this, Role
D's Evidence Explorer filter already expects it.

### 3. Multi-market workflows (US-5.1, 5.2)
Each component currently has exactly one active workflow, pinned to one
"primary market" picked in `seed.ts` (`PRIMARY_MARKET`). Real sales data
supports comparing e.g. BMW 5 Series across Europe/China/USA — if time
allows, let a component have one workflow per market and add
`GET /api/components/:id/workflows` returning all of them, so Role C can
build a market switcher on the workflow page.

### 4. Equipment PDF structured parsing (known gap, see `docs/DATA_SETUP.md`)
Currently just text chunks by section. A real per-trim feature matrix
would strengthen competitive/equipment-gap evidence meaningfully — only
attempt this if everything else is solid, it's a brittle parsing problem
(see the doc for specifics on why it was skipped).

### 5. Replace in-memory store with something durable (stretch)
Only if everything else is solid with time to spare. SQLite via
`better-sqlite3` or `drizzle` is the fastest path that still ships before a
hackathon deadline. Keep every exported function signature in `db.ts`
identical; this should be invisible to Roles B/C/D. At 13.7k feedback rows
plus derived data, the in-memory store is already doing real work — this
is a "nice to have for demo-day crash resilience," not an urgent fix.

## Guardrails

- Keep `logAction()` calls accurate: `oldValue`/`newValue` should be real
  values, not placeholders — Role B's AI summaries and the audit trail UI
  both depend on these being meaningful, not decorative.
- **Never commit `data-raw/` or `src/data/*.json`** — both are gitignored
  on purpose, this is confidential BMW hackathon data. Code that reads
  them is fine to commit; the data itself is not. If `git status` ever
  shows either as untracked-but-stageable, something's wrong with
  `.gitignore` — fix the ignore rule, don't `git add -f`.
- Don't let the demo break: the flagship "battery" workflow narrative
  (`buildFlagshipNarrative()` in `seed.ts`) is what gets shown to judges.
  It rebases itself onto whatever the real data computes as the #1 battery
  finding, so re-running ingestion is safe — but don't remove the
  mechanism itself.
- `nanoid` is already a dependency for generating ids — use it instead of
  `Math.random()` or `Date.now()` for anything id-like.

## Files you own

```
src/lib/types.ts
src/lib/db.ts
src/lib/seed.ts
src/lib/realData.ts
src/lib/deriveRequirements.ts
scripts/ingest-real-data.ts
scripts/lib/componentMap.ts
src/app/api/**
```
Coordinate before touching `src/lib/api-client.ts` or `src/lib/ai.ts` —
those are Role B/C/D's primary integration points into your work.
