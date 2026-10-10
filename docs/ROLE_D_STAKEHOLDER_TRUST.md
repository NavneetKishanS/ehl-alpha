# Role D — Frontend: Stakeholder & Trust Experience

You own the stakeholder review page, the Evidence Explorer, and the audit
trail — everything about making the app's reasoning *inspectable*. Read
`docs/PROJECT_BRIEF.md` and `docs/DATA_SETUP.md` first, run
`npm run ingest` (see that doc), then `npm run dev` and click through
`/stakeholder/wf_g60_battery/sh_design` and `/evidence` before changing
anything — both already run end to end against the real 13,771-row
dataset.

## What already exists (v0, working, real data)

- `src/app/stakeholder/[workflowId]/[stakeholderId]/page.tsx` — the
  stakeholder's view: a "summary so far" AI panel, a real customer-study
  comparison chart (`GroupedBarChart`) when the workflow's component maps
  to a benchmarked category, a read-only requirement list with evidence
  badges and real per-factor score bars (`MetricBar`), and a review form
  per requirement assigned to this stakeholder. Submitting disables the
  form and timestamps it, round-trips to `PATCH /api/reviews/:id` →
  `submitReview()` in `db.ts` → audit log entry → the PM's workflow page
  picks it up on next refresh.
- **`src/app/evidence/page.tsx` — the Evidence Explorer, already built**:
  a filterable, paginated table over all 13,771 real feedback rows
  (vehicle, component, feedback type, country, free-text search), backed
  by `GET /api/feedback` and `GET /api/feedback/facets`
  (`src/app/api/feedback/**`). This is your base to extend, not a
  from-scratch task — see tasks below.
- `src/components/charts/MetricBar.tsx` and `GroupedBarChart.tsx` — real
  SVG charts (gridlines, axis labels, no div-width-as-bar-chart), used on
  the stakeholder page and ready to reuse anywhere else you need one.
- `src/components/EvidenceBadge.tsx` — strong/moderate/weak pill, shared
  with Role C.
- `src/components/AuditLogPanel.tsx` — the append-only log list, already
  has an actor-type filter (all/ai/pm/stakeholder) built in. Currently
  lives embedded in the PM workflow page's sidebar only.
- No login/auth — `stakeholderId` is just a route param. Intentional for
  v0, don't build auth.

## Your tasks, in priority order

### 1. Audit log CSV/JSON export (US-8.4)
No export button exists yet. Add one to wherever `AuditLogPanel` renders,
pulling from `GET /api/workflows/:id/audit-log`. Client-side generation
(`entries.map(...).join(',')` + `Blob` + `<a download>`) is the whole
feature, no backend change needed.

### 2. Standalone/dedicated audit trail view (US-8.1)
`AuditLogPanel` only appears embedded in the PM workflow page's sidebar
today. A dedicated route or drawer with more room — plus a "jump to full
evidence chain" affordance (requirement → scoring → signals → source
records, US-8.1) — would strengthen traceability. The evidence accordion
already on the workflow page (grouped by signal, sorted by frequency) is
the thing to deep-link into.

### 3. Low-confidence / needs-decision queue (US-7.2)
A view surfacing requirements where `evidenceLevel === "weak"` or
`status === "challenged"` across *all* workflows, not just the one you're
currently looking at — right now a PM has to visit each workflow to find
these. Could be a new route (`/needs-review`) querying across workflows,
or a counter badge on the landing page per vehicle. Coordinate with Role C
if it touches the landing page.

### 4. Evidence Explorer: drill-down from a signal
The workflow page's evidence accordion shows up to 8 sample sources per
signal; the Evidence Explorer shows all matching rows. Wire a link from an
accordion entry straight into `/evidence?vehicleCode=...&component=...`
with the theme pre-filled into the search box — currently the link only
pre-filters by vehicle+component, not by theme/category.

### 5. Source reliability filter refinement (US-1.3)
`FeedbackRecord`/`SourceRecord` already carry `reliability` for web
sources once Role A's enrichment step (`docs/ROLE_A_BACKEND.md` task 2)
lands real external data — today everything in the real pipeline is
`first_party` (internal verbatims), so a reliability filter on the
Evidence Explorer has nothing to differentiate yet. Revisit once Role A's
web sources exist.

## Guardrails

- Stakeholder review submission is one-shot by design (disabled after
  submit) — don't add an edit-after-submit flow without coordinating with
  Role A, since it changes audit log semantics.
- AI-sourced content uses a left-accent-bar convention (sky=summary,
  violet=overview, amber=limitations/uncertainty) — reuse it, don't invent
  a new visual language for AI content.
- The Evidence Explorer currently reads `src/data/feedback.json` fresh on
  every request (`loadFeedback()` in `src/lib/realData.ts`) — fine at 14k
  rows for a hackathon demo. If you add more filters, filter client-side
  against an already-fetched page rather than adding more round-trips per
  keystroke.

## Files you own

```
src/app/stakeholder/[workflowId]/[stakeholderId]/page.tsx
src/app/evidence/page.tsx
src/app/api/feedback/**
src/components/AuditLogPanel.tsx
src/components/ReviewerRow.tsx
src/components/charts/*.tsx
```
`EvidenceBadge.tsx` is shared with Role C — coordinate before changing its
props.
