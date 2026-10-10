# Role A — Backend & Data Platform

You own `src/lib/types.ts`, `src/lib/db.ts`, `src/lib/seed.ts`, and everything
under `src/app/api/`. You are the team's dependency: Roles C and D build
against `src/lib/api-client.ts`, which already wraps every endpoint that
exists in v0. If you change a response shape, you change `api-client.ts` in
the same commit and shout in the team channel — that file is the contract.

Read `docs/PROJECT_BRIEF.md` first for the full picture. This doc is your
task list.

## What already exists (v0, working)

- Full type model in `src/lib/types.ts` — Vehicle, VehicleComponent,
  Workflow/Stage, Requirement/ScoreFactor, Signal, SourceRecord, Stakeholder,
  StakeholderReview, AuditLogEntry, AISummary. Read this file top to bottom
  before changing anything; it's the shared vocabulary.
- In-memory store (`src/lib/db.ts`) with full CRUD + an append-only audit
  log. Every mutation function (`createWorkflow`, `updateStage`,
  `updateRequirementStatus`, `updateWeights`, `submitReview`,
  `addAISummary`) already calls `logAction()` — keep this invariant for
  anything new you add: **no mutation without a log entry**.
- Seed data (`src/lib/seed.ts`) for one fully-populated "battery" workflow.
  This is what makes the demo work without real datasets.
- REST routes for everything in `api-client.ts` — vehicles, components,
  workflows (get/create/by-component), requirements (list/get/patch/
  weights/challenge), signals+sources, audit log, AI summaries,
  stakeholders, reviews.

## Your tasks, roughly in priority order

### 1. Real dataset ingestion (US-1.1, 1.2, 1.3)
Right now sources are hand-seeded. Build:
- `POST /api/workflows/:id/ingest` accepting the four dataset types
  (verbatims, equipment, sales, customer study) as CSV/JSON upload or pasted
  text. Each record becomes a `SourceRecord` with `datasetType`,
  `reliability` (first_party for all internal data), `title`, `excerpt`,
  `retrievedAt`. Malformed rows get flagged in the response, not silently
  dropped (AC in US-1.1) — return `{ imported: n, flagged: [...] }`.
- A minimal web-enrichment step (US-1.2): even a stubbed call to a search
  API or a hardcoded set of competitor data points is fine for the demo —
  the important part is every web `SourceRecord` has `url`, `retrievedAt`,
  and a `reliability` tier (`review_site` / `forum` / `official`), and the
  UI (Role C) can filter by it.
- Wire the `ingest` and `enrich` stages in `Workflow.stages` to flip from
  `pending` → `active` → `complete` as this runs, via `updateStage()`
  (already exists).

### 2. Replace in-memory store with something durable (stretch)
Only if ingestion + everything else is solid with time to spare. SQLite via
`better-sqlite3` or `drizzle` is the fastest path that still ships before a
hackathon deadline — avoid standing up Postgres unless someone already has
it running. Keep every exported function signature in `db.ts` identical;
this should be invisible to Roles B/C/D.

### 3. Multi-market / multi-vehicle support (US-5.1, 5.4)
`Workflow.market` is already a single string set at creation. If time
allows, support comparing requirements across markets for the same
component (US-5.2) — this is a new read endpoint
(`GET /api/components/:id/workflows` returning all market-variant
workflows for a component), not a schema change.

### 4. Pipeline re-run / versioning (US-9.2, 9.3)
Stretch goal: when new data lands, re-run extraction/derivation and show
what changed vs. the last run. Only attempt after everything above is solid
— this is a "could have."

## Guardrails

- Keep `logAction()` calls accurate: `oldValue`/`newValue` should be real
  values, not placeholders — Role B's AI summaries and the audit trail UI
  both depend on these being meaningful, not decorative.
- Don't let the demo break: the seeded "battery" workflow (`wf_battery_demo`)
  is what gets shown to judges if live ingestion isn't finished in time.
  Never modify `seed.ts` in a way that removes that narrative; add new seed
  vehicles/components alongside it instead of replacing it.
- `nanoid` is already a dependency for generating ids — use it instead of
  `Math.random()` or `Date.now()` for anything id-like.

## Files you own

```
src/lib/types.ts
src/lib/db.ts
src/lib/seed.ts
src/app/api/**
```
Coordinate before touching `src/lib/api-client.ts` or `src/lib/ai.ts` —
those are Role B/C/D's primary integration points into your work.
