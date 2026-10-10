# Role C — Frontend: PM Experience

You own the landing page and the PM workflow page — the two views a
product manager actually lives in. v0 has a complete, working first draft
of both; your job is to take them from "functionally correct" to
"demo-impressive" and extend them as Role A/B's backend/AI work lands.

Read `docs/PROJECT_BRIEF.md` first. Run `npm run dev` and click through
both pages before changing anything — the data flow (landing → create or
open workflow → pipeline → requirements → stakeholder panel → audit log)
already works end to end against the seeded "battery" data.

## What already exists (v0, working)

- `src/app/page.tsx` — landing page. Fetches vehicle + components, renders
  `CarHotspotViewer` with clickable dots, falls back to a plain grid of
  component cards below it. Clicking a dot with no workflow opens a
  "create workflow" modal (market picker → `POST /api/workflows`).
- `src/components/CarHotspotViewer.tsx` — **placeholder** car: an inline SVG
  silhouette with hotspots positioned by `{xPct, yPct}` from
  `VehicleComponent.hotspot`. This is the component to replace with a real
  360 viewer or a proper BMW 5 Series asset.
- `src/app/workflow/[componentId]/page.tsx` — the PM workflow page:
  `PipelineStrip` (stage pipeline), AI decision-trail summary, requirement
  list (`RequirementCard` — score breakdown with live weight sliders,
  approve/reject/postpone/challenge actions), stakeholder review panel
  (`ReviewerRow` list + AI overview) scoped to the selected requirement,
  evidence/sources accordion, limitations panel, and a sticky audit log
  sidebar (`AuditLogPanel`).
- All data access goes through `src/lib/api-client.ts` — don't `fetch()`
  directly in a page/component, add a method there instead if you need a
  new endpoint (coordinate with Role A).

## Your tasks, in priority order

### 1. Real 360 car viewer (the landing page's headline visual)
Replace `CarSilhouette` inside `CarHotspotViewer.tsx`. Options, fastest
first:
- A single high-quality static image (front-3/4 view) with the same
  `{xPct, yPct}` hotspot overlay — zero new dependencies, looks far better
  than the SVG placeholder, lowest risk.
- A real 360 spin (frame sequence + drag-to-rotate, or an embed) if time
  allows — keep the hotspot *positions* driven by data
  (`VehicleComponent.hotspot`), not hardcoded per-frame, or hotspots will
  drift when the car rotates. If you go this route, hotspots probably only
  need to render on the default/front-3-4 frame for v0; don't over-build.
Either way: the "blue dot = has workflow, gray dot = create new" affordance
already works (`CarHotspotViewer` colors by `component.workflowId`) — keep
it.

### 2. Pipeline strip polish (US-9.1)
`PipelineStrip.tsx` already shows stage status (pending/active/complete/
blocked) with hover tooltips (owner, timestamps). As Role A wires real
`ingest`/`enrich` stage transitions, confirm the strip updates live
(poll or re-fetch on an interval, or add a manual refresh button — v0 has
neither, pick whichever is faster to ship). Consider a "re-run pipeline"
button once Role A's US-9.2 lands.

### 3. Sensitivity view (US-4.4, stretch)
`RequirementCard` already lets the PM drag weight sliders and see the score
recompute live (`computeLiveScore`) before saving. For US-4.4, add a view
showing which requirements change rank most as weights shift — this is
naturally a small chart (e.g. a rank-change table or sparkline per
requirement) on the workflow page. Don't build a generic charting library
integration for this — a handful of divs with computed widths (see the bar
"chart" pattern already used in the stakeholder page) is enough.

### 4. Multi-requirement stakeholder panel
Right now the stakeholder review panel on the workflow page scopes to one
`selectedReq` at a time (click a requirement card to select it). If you
have time, consider a workflow-level view that shows review status across
*all* requirements at a glance (e.g. a small reviewer-x-requirement grid),
similar to a PR's "required reviewers" list — only worth it if Role A has
wired multiple requirements with multiple reviews by then.

### 5. Market/vehicle switcher (US-5.1, depends on Role A)
Once Role A exposes multiple workflows per component (different markets),
add a market selector on the workflow page header.

## Guardrails

- Every write action (approve/reject/postpone/challenge/weights) already
  calls `onRequirementChanged` → triggers a full `refresh()` of audit log +
  summaries. Don't bypass this — the audit trail updating live after every
  PM action is core to the demo narrative, not a nice-to-have.
- Reject/postpone require a rationale — this is enforced client-side in
  `RequirementCard` *and* server-side in the API route. Don't remove either
  check.
- Keep the dark theme (`bmw` color tokens in `tailwind.config.ts`) — it's
  already wired through every component.

## Files you own

```
src/app/page.tsx
src/app/workflow/[componentId]/page.tsx
src/components/CarHotspotViewer.tsx
src/components/PipelineStrip.tsx
src/components/RequirementCard.tsx
```
`AuditLogPanel.tsx`, `EvidenceBadge.tsx`, and `ReviewerRow.tsx` are shared
with Role D — coordinate before changing their props.
