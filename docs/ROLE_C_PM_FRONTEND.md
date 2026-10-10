# Role C — Frontend: PM Experience

You own the landing page and the PM workflow page. Both already run end to
end against real data (13,771 real verbatims across 3 vehicle lines) with a
denser, data-table-like visual language — not a chat-app look. Read
`docs/PROJECT_BRIEF.md` and `docs/DATA_SETUP.md` first, run
`npm run ingest` (see that doc), then `npm run dev` and click through both
pages before changing anything.

## What already exists (v0, working, real data)

- `src/app/page.tsx` — landing page. Vehicle switcher across all 3 vehicle
  lines (BMW 1/5/7 Series), car hotspot viewer, component grid below it
  showing real "N/6 components have an active workflow" counts. Clicking a
  dot with no workflow opens a "create workflow" modal
  (market picker → `POST /api/workflows`).
- `src/components/CarHotspotViewer.tsx` — **still the placeholder** SVG car
  silhouette with hotspots positioned by `{xPct, yPct}`. This is the
  single biggest visual upgrade left — see task 1.
- `src/app/workflow/[componentId]/page.tsx` — the PM workflow page: real
  vehicle/component name header (fetched via `api.getComponent`/
  `api.getVehicle`, not parsed from the URL), `PipelineStrip`, AI
  decision-trail summary (left-accent-bar style, not a gradient bubble),
  requirement list (`RequirementCard` — dense bordered cards, score
  breakdown with live weight sliders, approve/reject/postpone/challenge
  actions), stakeholder review panel scoped to the selected requirement,
  a real evidence accordion sorted by frequency with sentiment-color dots,
  limitations panel, sticky audit log sidebar with an actor-type filter,
  and a link to the Evidence Explorer pre-filtered to this
  vehicle/component.
- Visual language: bordered panels (not `rounded-xl` cards), monospace for
  numbers/ids/status strings, left-accent-bar treatment for AI-sourced
  content (sky=AI summary, violet=AI overview, amber=limitations/
  uncertainty) instead of full-tint gradient backgrounds. Keep this
  convention for anything new you add — it's what keeps the app reading as
  an internal tool rather than a generated chat UI.
- All data access goes through `src/lib/api-client.ts` — don't `fetch()`
  directly in a page/component, add a method there instead if you need a
  new endpoint (coordinate with Role A).

## Your tasks, in priority order

### 1. Real 360 car viewer — the landing page's headline visual, still a placeholder
Replace `CarSilhouette` inside `CarHotspotViewer.tsx`. Fastest path: a
single high-quality static image (front-3/4 view) per vehicle line, with
the same `{xPct, yPct}` hotspot overlay swapped per vehicle — zero new
dependencies. A real 360 spin (frame sequence + drag-to-rotate) is the
stretch version; keep hotspot *positions* driven by data, not hardcoded
per-frame. The "blue dot = has workflow, gray dot = create new" affordance
already works — keep it, and note hotspot coordinates may need per-vehicle
tuning once you're not on a generic silhouette (F70/G60/G70 have different
proportions).

### 2. Pipeline strip + live stage progress
`PipelineStrip.tsx` already shows stage status with hover tooltips. As
Role A wires a live ingestion endpoint (currently `npm run ingest` is
offline), confirm the strip reflects real `ingest`/`enrich` transitions —
right now `enrich` is permanently `pending` since there's no web-enrichment
step yet (see `docs/ROLE_A_BACKEND.md` task 2). Consider a "re-run
pipeline" button once that lands.

### 3. Sensitivity view (US-4.4, stretch)
`RequirementCard` already lets the PM drag weight sliders and see the
score recompute live before saving (`computeLiveScore`). For US-4.4, add a
view showing which requirements change rank most as weights shift — a
small rank-change table using the existing `MetricBar` component
(`src/components/charts/MetricBar.tsx`) is enough, don't reach for a
charting library.

### 4. Multi-requirement stakeholder panel
The stakeholder review panel on the workflow page scopes to one
`selectedReq` at a time. A workflow-level view showing review status
across *all* requirements at a glance (reviewer-x-requirement grid) is
worth it once Role A's multi-market work lands more requirements per
workflow — not urgent at today's ~4 requirements/workflow.

### 5. Market switcher (depends on Role A's task 3)
Once Role A exposes multiple workflows per component (one per market), add
a market selector to the workflow page header next to the existing
vehicle/component name.

## Guardrails

- Every write action (approve/reject/postpone/challenge/weights) already
  calls `onRequirementChanged` → triggers a full `refresh()` of audit log +
  summaries. Don't bypass this.
- Reject/postpone require a rationale — enforced client-side in
  `RequirementCard` *and* server-side in the API route. Don't remove
  either check.
- `competitive_gap`/`sales_relevance`/`strategic_fit` are identical across
  all requirements in the same workflow by design (computed per-component,
  not per-requirement — see each factor's `rationale` text). This is
  correct, not a bug — don't "fix" it into fake per-requirement variation.
- If you touch layout with a grid/flex container, remember: a grid/flex
  item has an implicit `min-width: auto`, so a wide descendant (anything
  with `overflow-x-auto`, e.g. `PipelineStrip`) can silently stretch the
  whole page. Add `min-w-0` to the containing column if you see horizontal
  scroll appear — this already bit us once (see the `body`'s `flex
  flex-col` removal in `layout.tsx` and `min-w-0` on the workflow page's
  grid columns).

## Files you own

```
src/app/page.tsx
src/app/workflow/[componentId]/page.tsx
src/components/CarHotspotViewer.tsx
src/components/PipelineStrip.tsx
src/components/RequirementCard.tsx
```
`AuditLogPanel.tsx`, `EvidenceBadge.tsx`, `ReviewerRow.tsx`, and
`charts/*.tsx` are shared with Role D — coordinate before changing their
props.
