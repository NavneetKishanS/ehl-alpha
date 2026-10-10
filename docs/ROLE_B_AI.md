# Role B — AI / Intelligence

You own `src/lib/ai.ts` and the "intelligence" behind the pipeline: turning
raw signals into requirements, scoring them explainably, summarizing
decision history, and re-assessing when the PM pushes back. This is the
feature the judges are most explicitly evaluating ("decision and scoring
logic", "AI supports identification, formulation and prioritization").

Read `docs/PROJECT_BRIEF.md` first. Read `src/lib/ai.ts` in full before
writing anything — every function there is a mock with a docstring saying
exactly what real behavior should replace it, and the exact input/output
shape to preserve so Roles A/C/D don't need to change their code when you
swap in real calls.

## How v0 fakes what you're about to make real

The seed data (`src/lib/seed.ts`) hand-writes a believable story for the
"battery" workflow: an AI-drafted requirement that was too vague, a PM
challenge, an AI revision citing specific sources, stakeholder reviews, and
three `AISummary` entries (`decision_trail`, `stakeholder_overview`,
`limitations`) with pre-written narrative text. This is what lets the whole
app demo convincingly before any real AI is wired in. Your job is to make
the mocked functions in `ai.ts` produce *that same quality of narrative*,
generated from real data instead of hand-written.

## Setup

Use the Anthropic SDK with model `claude-sonnet-5`. Get an API key from
whoever on the team has one; store it in `.env.local` as
`ANTHROPIC_API_KEY` (already gitignored). Keep all AI calls server-side
(inside API routes or `lib/ai.ts`, never from a client component) so the
key never ships to the browser.

```bash
npm install @anthropic-ai/sdk
```

## Your tasks, in priority order

### 1. `summarizeDecisionTrail()` (US-9.3, and the "AI summary updates
when PM asks for changes" mechanic from the brief)
Input: a `Requirement` + its related `AuditLogEntry[]` (already wired —
see how `GET /api/workflows/:id/ai-summaries` and the seed seed this).
Real implementation: pass the ordered log entries (especially
`requirement_challenged` and the AI's own prior summaries) to Claude and
ask for a narrative of what was asked, what was proposed, what changed and
why. **This is the single most demo-critical function** — it's the thing
that answers "what happens when a PM disagrees" live, in front of judges.
Test it by calling `POST /api/requirements/:id` with `status: "challenged"`
and a rationale, then regenerating the summary and confirming it reflects
the new log entry.

### 2. `reassessChallenge()` (US-6.3)
Already wired to `POST /api/requirements/:id/challenge`
(`src/app/api/requirements/[id]/challenge/route.ts`). Must return
`{ changed: boolean, explanation: string }` — the AC in US-6.3 explicitly
requires stating whether the challenge changed the result, and why. Prompt
Claude with the requirement's current scoreFactors/evidence and the PM's
free-text argument; have it either adjust `scoreFactors`/`evidenceLevel`
(if so, also call `updateWeights` or extend `db.ts` with a
`updateEvidenceLevel` setter — coordinate with Role A) or explain why
nothing changes.

### 3. `summarizeStakeholderReviews()` (the "PR reviewer" AI overview)
Input: all `StakeholderReview[]` for a requirement. Real implementation:
synthesize where reviewers agree/disagree and *why*, distinguishing a
process objection (like Legal's in the seed data) from a product objection.
This renders directly in the PM workflow page's stakeholder panel.

### 4. `extractSignals()` and `deriveRequirement()` (Epics 2 and 3)
Only once ingestion (Role A) produces real `SourceRecord[]` from uploaded
verbatims. `extractSignals` clusters verbatims into themes with frequency/
sentiment (US-2.1); `deriveRequirement` turns one signal + its sources into
a draft requirement with evidence level, assumptions, uncertainties
(US-3.1). Evidence level should be a real function of source count/
reliability, not vibes — e.g. strong = 3+ sources including first-party,
moderate = 2, weak = 1 or web-only. Keep regulatory/engineering/pricing
findings out of the requirement list (US-3.4) — if a theme is clearly
engineering-only ("battery thermal management"), route it to a
"not a customer requirement" bucket instead of forcing a requirement out of
it; this may need a new field on `Signal` or a new status — coordinate with
Role A before changing `types.ts`.

### 5. Contradiction flagging (US-2.7)
`Signal.contradicts: string[]` already exists in the type but is unused in
seed data beyond being empty arrays. When two signals have opposing
sentiment on a related theme (e.g. "too many screens" vs. "love the
display"), populate this and surface it — Role C can render a warning
badge once this field is populated.

## Guardrails

- Every mocked function's docstring tells you the exact real behavior
  expected and what shape to return — don't change function signatures,
  only bodies, unless you coordinate with whoever's consuming them.
- Use structured output (tool use / JSON mode) for anything whose result
  gets parsed into a typed object (scores, evidence levels) — don't parse
  free text with regex.
- Never let an AI call block the UI with no feedback — if a real call is
  slow, the route should still respond; consider calling these from a
  server action with a loading state Role C/D can show, rather than making
  every page load wait on a live model call. For judge-facing demo
  reliability, consider pre-generating and caching key `AISummary` entries
  for the seeded "battery" workflow rather than regenerating them live
  every page load.

## Files you own

```
src/lib/ai.ts
```
You'll also touch `src/app/api/requirements/[id]/challenge/route.ts` and
possibly add new routes for triggering ingestion→extraction→derivation —
coordinate those additions with Role A.
