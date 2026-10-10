# BMW Requirements Copilot (v0)

AI-assisted product requirement derivation, prioritization and human-in-the-loop
review for BMW's "AI for Product Decision Making" hackathon challenge.

Read [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) first — it has the challenge,
our concept, and how user stories map to what's built. Then read your role doc in
`docs/`.

## Stack

- Next.js 14 (App Router, pinned for Node 18 compatibility — don't bump to 15/16
  mid-hackathon unless everyone upgrades Node to 20+)
- TypeScript, Tailwind CSS 3
- In-memory data store (`src/lib/db.ts`), seeded on boot (`src/lib/seed.ts`) —
  no DB setup required to start working
- Mocked AI layer (`src/lib/ai.ts`) — every function returns realistic
  deterministic output so the app works end-to-end with no API key; swap in
  real Claude calls without touching anything above that layer

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000. Requires Node >=18.17 (Node 20+ also fine).

## Project structure

```
src/
  lib/
    types.ts        # shared domain types — the team contract, read this first
    db.ts            # in-memory store + all read/write functions (Role A owns)
    seed.ts          # demo data: one fully-populated "battery" workflow
    ai.ts            # mocked AI functions (Role B replaces internals)
    api-client.ts    # typed fetch wrappers — frontend only talks to the API through here
  app/
    page.tsx                                # landing page (car hotspots)
    workflow/[componentId]/page.tsx         # PM workflow view (Role C)
    stakeholder/[workflowId]/[stakeholderId]/page.tsx  # stakeholder review (Role D)
    api/...                                 # REST routes, thin wrappers around lib/db.ts
  components/        # shared UI: EvidenceBadge, PipelineStrip, AuditLogPanel, RequirementCard, ReviewerRow, CarHotspotViewer
```

## Demo data

The seed pre-populates a **Battery & Charging** workflow for the BMW 5 Series
(Europe market) with 3 requirements, 4 stakeholders, partially-submitted
reviews, and ~17 audit log entries telling a believable story: AI derives a
vague first draft → PM challenges it → AI revises with a concrete target →
stakeholders review → PM is mid-decision. This is what you see immediately on
`npm run dev`, no setup needed. The other 5 components (exterior, interior,
windows, steering, engine) have no workflow yet, to demo the "create new"
flow from the landing page.

## Known tradeoffs (intentional, for a 15-17h build)

- In-memory store, not a real DB. Swap-out point is clearly marked in `db.ts`.
- AI layer is mocked with templated text, not live Claude calls. Swap-out
  point is clearly marked in `ai.ts`, with the exact input/output shape Role
  B needs to preserve.
- Next.js pinned to 14.2.35 (not latest) for Node 18 compatibility across the
  team. `npm audit` will show Next.js platform CVEs fixed only in 15+ — not a
  concern for a localhost demo, but don't deploy this build publicly without
  upgrading first.
- Single demo vehicle/component fully fleshed out rather than breadth across
  all 6 components — depth over breadth for the judged demo.
