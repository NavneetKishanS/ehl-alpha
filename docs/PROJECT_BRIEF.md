# Project brief

## The challenge (BMW Group)

> What should the next generation of a BMW vehicle offer its customers? Build
> an AI-powered application that helps product managers derive, justify, and
> prioritize customer requirements for a successor vehicle. Ground your
> proposals in customer feedback, BMW product and sales data, and relevant web
> research — while keeping the product manager firmly in control of every
> decision.

Scope: BMW 1/5/7 Series (or a combination), Europe/China/US (or a subset),
3-5 years out. For each vehicle we get customer feedback (verbatims),
equipment data, sales volumes, and a customer study; we may enrich with
external sources (competitor info, reviews, market/tech trends).

**What judges want to see** (from the brief, verbatim):
1. A concept + working prototype showing AI supporting identification,
   formulation and prioritization of customer-facing requirements.
2. A representative set of requirements with clear evidence and reasoning.
3. A transparent decision-support experience: PM can review, challenge,
   modify, approve, or reject AI proposals, with evidence/assumptions/
   uncertainties/decisions visible and traceable throughout.

**Explicitly out of scope**: engineering specs, regulatory requirements,
detailed business-case calculations. Focus on customer value.

**Internal framing** (from BMW's own PM keynote, for flavor/credibility in
the demo narrative): the real process goes from ~1 billion findings → ~1,000
requirements → one car. A "requirement" = a customer-relevant attribute of
the car. The real pipeline is: situation analysis → AI structures/clusters/
contextualizes findings → requirements definition (baseline: previous BMW
model, portfolio, sales volume, competition, customer/public feedback,
trends) → specification & quantification (measurable targets, e.g. "range:
600 or 700 mi?") → prioritization → documentation → requirements tracking.
Our workflow pipeline stages mirror this shape.

## Our concept

Three views:

1. **Landing page** — a BMW 5 Series with hotspot dots on components
   (exterior, interior, windows, steering, powertrain, battery). Click a dot:
   open its requirements workflow if one exists, or start a new one.
2. **PM workflow page** (per component) — a GitHub-Actions-style pipeline
   strip (ingest → enrich → extract → derive → score → stakeholder review →
   PM decision → deploy), an AI-generated decision-trail summary, the
   requirement list with explainable scores and adjustable weights, a
   PR-reviewer-style stakeholder panel with an AI overview of where
   reviewers agree/disagree, and a live audit trail sidebar.
3. **Stakeholder review page** — summary of the requirement + evidence
   (charts from real score factors), the AI's running decision-trail
   summary, a free-text expert-opinion field, and approve/not-approve.

**The mechanism that ties it together**: every stage transition, every AI
proposal, every PM decision (approve/reject/postpone/**challenge**), and
every stakeholder review is written to an **append-only audit log**
(`src/lib/types.ts` → `AuditLogEntry`). The AI summaries shown on both the PM
and stakeholder pages are (in the real version) generated *from* that log —
when a PM disagrees and asks for changes, the next AI summary should
narrate what was asked, what was proposed, what the PM pushed back on, and
how the proposal changed. The v0 seed data (`src/lib/seed.ts`) hand-writes
one such story for the battery/charging requirement so the mechanism is
demoable without live AI calls; Role B's job is to make it real.

## User stories → what we're building (prioritized for 15-17h)

We will not build all 9 epics to full depth. Priority order for the time box:

**Must have for the demo (Epics 6, 8, 9, slice of 3/4):**
- US-6.1, 6.2, 6.4 — PM can approve/reject/postpone/challenge with required
  rationale on reject/postpone; evidence shown next to every decision.
  (Built in v0: `RequirementCard`, `PATCH /api/requirements/:id`.)
- US-6.3 — PM challenges a score/rationale, AI re-assesses and states
  whether it changed. (Built in v0 as a mock: `POST /api/requirements/:id/challenge`.)
- US-8.1, 8.2, 8.3, 8.5 — full trace, append-only, actor+timestamp+old/new
  value+rationale on every entry, AI vs human distinguished.
  (Built in v0: `AuditLogEntry`, `logAction()`, `AuditLogPanel`.)
- US-9.1 — defined workflow with stage ownership (ai/pm/stakeholder) shown.
  (Built in v0: `Stage`, `PipelineStrip`.)
- US-3.1, 3.3 — requirements have id, description, linked findings/sources,
  evidence level, assumptions, uncertainties, category, status "Proposed".
  (Built in v0, seeded.)
- US-4.1, 4.2, 4.3 — explainable weighted score, live-adjustable weights,
  evidence level shown next to score. (Built in v0: `scoreFactors`,
  weight sliders in `RequirementCard`.)
- US-7.1, 7.2, 7.3 — missing/thin/contradictory evidence surfaced; weak
  evidence flagged; limitations panel. (Built in v0: `EvidenceBadge`,
  `AISummary` type "limitations".)

**Should have, reach during the build (Epics 1, 2, 5):**
- US-1.1 — real dataset upload/ingestion (v0 only has seeded sources).
- US-2.1 through 2.7 — real signal clustering from uploaded verbatims
  (v0 has a mock `extractSignals()` in `ai.ts`).
- US-5.1 — vehicle/derivative/market selector (v0 only has market at
  workflow-creation time).

**Could have, only if time remains (Epic 1.4, 5.4, 9.2, 9.4, 9.5):**
- Config-driven new data sources, onboarding another model/market without
  code changes, re-running the pipeline on new data with a diff view,
  exporting approved requirements to CSV/Jira.

## Evaluation criteria mapping (from the brief's organizers)

| Criterion | Primary epics | Where in this repo |
|---|---|---|
| Decision and scoring logic | Epic 4, US-7.1 | `scoreFactors`, `EvidenceBadge`, weight sliders |
| Workflow and human decision-making | Epic 6, US-9.1 | `PipelineStrip`, `RequirementCard` actions |
| Traceability and auditability | Epic 8, US-2.6 | `AuditLogPanel`, `logAction()` |
| Solution quality, usability, feasibility | Epics 3, 5, US-4.2 | requirement cards, live weight sliders |
| Innovation, scalability, business impact | US-1.4, 5.4, 9.2 | talk track for the pitch — be honest that this is a v0, point at the swap-out points as the scalability story |

## Non-goals for this hackathon

Do not spend time on: engineering specs, regulatory/homologation detail,
business-case ROI math, auth/accounts, a real database, production
deployment hardening. If in doubt, cut it — a working, honest, traceable
narrow slice beats a broad, flaky one.
