# Role D — Frontend: Stakeholder & Trust Experience

You own the stakeholder review page and everything about making the app's
reasoning *inspectable* — evidence, uncertainty, and the full audit trail.
This is the surface most directly tied to the "honesty and uncertainty"
(Epic 7) and "traceability and auditability" (Epic 8) evaluation criteria.

Read `docs/PROJECT_BRIEF.md` first. Run `npm run dev`, open
`http://localhost:3000/stakeholder/wf_battery_demo/sh_design` directly
(that's a stakeholder with a pending review in the seed data) and click
through the approve/reject flow before changing anything.

## What already exists (v0, working)

- `src/app/stakeholder/[workflowId]/[stakeholderId]/page.tsx` — the
  stakeholder's view: a "summary so far" AI panel, a read-only list of all
  requirements in the workflow with evidence badges and a per-factor bar
  "chart" of the score breakdown, and a review form per requirement
  assigned to this stakeholder (free-text expert opinion + approve/not
  approve). Submitting disables the form and timestamps it — this already
  round-trips to `PATCH /api/reviews/:id` → `submitReview()` in `db.ts` →
  writes an audit log entry → the PM's workflow page picks it up on next
  refresh.
- `src/components/EvidenceBadge.tsx` — strong/moderate/weak pill, used on
  both the PM and stakeholder pages. Shared with Role C.
- `src/components/AuditLogPanel.tsx` — the append-only log list (actor
  type, actor name, action, rationale, timestamp), color-coded by actor
  type (ai/pm/stakeholder). Currently lives inside the PM workflow page's
  sidebar.
- Note there's currently no login/auth — `stakeholderId` is just a route
  param. That's intentional for v0; don't build auth, it's out of scope for
  the hackathon.

## Your tasks, in priority order

### 1. Standalone audit trail / traceability view (US-8.1, 8.4)
Right now `AuditLogPanel` only appears embedded in the PM workflow page.
Build a dedicated, filterable view — either a route like
`/workflow/[componentId]/audit` or a modal/drawer triggered from the
workflow page. Must support (US-8.4): filter by requirement, actor type,
action type, and date range. Each entry already has everything needed
(`AuditLogEntry` in `types.ts`) — this is a filtering/UI task, not a data
task. A "jump to full evidence chain" affordance (US-8.1: requirement →
scoring → consolidation → signals → source records) is the stretch version
— clicking a requirement in the log could open the evidence accordion
already built into the PM workflow page (`signals.map(...)` section),
scrolled/highlighted to the relevant signal.

### 2. Export the audit log (US-8.4)
A "Download CSV" or "Download JSON" button on your audit trail view, pulling
from `GET /api/workflows/:id/audit-log`. Client-side CSV generation (no
backend change needed) is enough — `entries.map(e => [...]).join(',')`
plus a `Blob`/`<a download>` is the whole feature.

### 3. Limitations panel, promoted and reusable (US-7.3)
The PM workflow page already renders an `AISummary` of type `"limitations"`
inline near the bottom. Consider: does this need its own visible affordance
higher up the page (a persistent banner/badge) rather than being the last
thing a PM scrolls to? You own the call — the goal is "I know the data's
reach" being obvious, not buried. Also surface it on the stakeholder page
if there's a workflow-level limitations summary by the time Role B's real
summaries are wired in.

### 4. Low-confidence queue (US-7.2)
A "needs your decision" view: requirements where `evidenceLevel === "weak"`
or `status === "challenged"`, surfaced prominently rather than mixed into
the main requirement list. Could be a filter/tab on the PM workflow page's
requirement list, or a small counter badge in the header. Coordinate with
Role C since this touches the page they also own — this is a good joint
task if either of you finishes early.

### 5. Source reliability filter (US-1.3, depends on Role A's ingestion)
Once Role A's ingestion assigns `reliability` tiers to real sources, add a
filter control on the evidence/sources accordion (already on the PM
workflow page) to show/hide by `first_party` / `official` / `review_site` /
`forum`.

## Guardrails

- Stakeholder review submission is one-shot by design (disabled after
  submit, per the "PR reviewer" mental model) — don't add an edit-after-
  submit flow unless the team explicitly decides reviewers should be able
  to revise, since that changes the audit log semantics (Role A would need
  to add a new action type).
- Anything you show as "AI-generated" should visually read as such — reuse
  the violet/sky color convention already used for AI-sourced panels
  (`AuditLogPanel`'s `ACTOR_COLOR.ai`, the sky-tinted decision-trail panel)
  rather than inventing a new convention.
- Don't fetch the full audit log on every keystroke if you add filtering —
  fetch once per workflow, filter client-side; the log is small enough
  (tens of entries) for this hackathon's scope.

## Files you own

```
src/app/stakeholder/[workflowId]/[stakeholderId]/page.tsx
src/components/AuditLogPanel.tsx
src/components/ReviewerRow.tsx
```
`EvidenceBadge.tsx` is shared with Role C — coordinate before changing its
props.
