# Role B — AI / Intelligence

You own `src/lib/ai.ts`. Read `docs/PROJECT_BRIEF.md` and
`docs/DATA_SETUP.md` first, then run `npm run ingest` (see that doc) so
you're testing against real data, not the mock fallback.

**Important framing shift from a typical "AI hackathon app":** scoring and
signal extraction are already real and deterministic —
`src/lib/deriveRequirements.ts` computes `customer_impact`, `frequency`,
`sales_relevance`, `evidence_strength` straight from the ingested BMW
data, with zero LLM calls, and `scripts/lib/componentMap.ts` uses BMW's own
226-category VFC taxonomy instead of asking a model to cluster verbatims
from scratch. **Don't reimplement either of these with an LLM** — a
formula a judge can audit beats a model's opinion, and re-deriving what's
already deterministic just burns budget for a worse result. Your job is
everything *on top of* that real foundation: narrative generation,
re-assessment under challenge, and the two score factors that are
genuinely judgment calls (`competitive_gap`, `strategic_fit`).

## Budget: OpenAI, $70/person

Use the OpenAI SDK (`npm install openai`) with structured outputs
(`response_format: { type: "json_schema" }`, or `zodResponseFormat` from
`openai/helpers/zod`) for anything whose result gets parsed into a typed
object — never regex a free-text response. Keep `OPENAI_API_KEY` in
`.env.local` (template at `.env.local.example`) and only call the SDK
server-side (API routes or this file), never from a client component.

Because scoring/clustering are already deterministic, real LLM calls here
are per-signal or per-requirement — tens to low hundreds of calls for the
whole demo, not per-verbatim (thousands). Budget is not the constraint:
- **gpt-4.1-mini**: fine for `summarizeStakeholderReviews()` and the
  mechanical parts of `extractSignals()`/`deriveRequirement()` if you
  extend those beyond the deterministic pipeline.
- **gpt-4.1**: use for `summarizeDecisionTrail()` and `reassessChallenge()`
  — these are the two functions a judge will see triggered live in a demo
  (the PM-challenge loop), worth the better model.

## How v0 fakes what you're about to make real

`src/lib/seed.ts`'s `buildFlagshipNarrative()` hand-writes one believable
story on the BMW 5 Series / Battery & Charging workflow: an AI-drafted
requirement that restated a complaint instead of being actionable, a PM
challenge, an AI revision citing the real frequency/concentration numbers,
stakeholder reviews, and three `AISummary` entries (`decision_trail`,
`stakeholder_overview`, `limitations`) with pre-written narrative text —
but every number it references (verbatim count, sentiment concentration,
requirement title) is computed live from real data, so re-running
`npm run ingest` doesn't break the story. Your job is to make the *mocked
functions in `ai.ts`* produce that same quality of narrative, generated
for real from the live data instead of templated.

## Your tasks, in priority order

### 1. `summarizeDecisionTrail()` — the most demo-critical function
Input: a `Requirement` + its related `AuditLogEntry[]`. Real
implementation: pass the ordered log entries (especially
`requirement_challenged` entries and the AI's own prior summaries) to
OpenAI and ask for a narrative of what was asked, what was proposed, what
changed and why. Test it by calling `POST /api/requirements/:id` with
`status: "challenged"` and a rationale, then regenerating the summary and
confirming it reflects the new log entry. **This answers "what happens
when a PM disagrees" live, in front of judges** — prioritize it over
everything else in this doc.

### 2. `reassessChallenge()` (US-6.3)
Already wired to `POST /api/requirements/:id/challenge`
(`src/app/api/requirements/[id]/challenge/route.ts`). Must return
`{ changed: boolean, explanation: string }` — US-6.3's acceptance
criterion explicitly requires stating whether the challenge changed the
result, and why. Prompt the model with the requirement's current
`scoreFactors`/`evidenceLevel` and the PM's free-text argument; have it
either adjust `scoreFactors`/`evidenceLevel` (coordinate a new
`updateEvidenceLevel`-style setter with Role A if so) or explain why
nothing changes.

### 3. `summarizeStakeholderReviews()` — the "PR reviewer" AI overview
Input: all `StakeholderReview[]` for a requirement. Real implementation:
synthesize where reviewers agree/disagree and *why*, distinguishing a
process objection (like Legal's in the seeded narrative) from a product
objection. Renders directly in the PM workflow page's stakeholder panel.

### 4. `competitive_gap` and `strategic_fit` — the two genuinely-judgment score factors
Look at `competitiveGap()` and `strategicFit()` in
`src/lib/deriveRequirements.ts`. Both are currently crude defaults (a
customer-study cross-model comparison for gap, a flat
battery/steering-get-70-else-50 heuristic for fit) — these are the
legitimate upgrade targets for an LLM call, specifically because they
require judgment a formula can't give you (is this strategically
important? how big is the gap vs. a real external competitor, not just a
sibling BMW model?). If you do this, keep the same contract: return
`{ value: 0-100, rationale: string, citedSourceIds?: string[] }` and log
the rationale to the audit trail — a bare number with no trace is exactly
what the brief warns against ("make clear where conclusions are based on
evidence vs. assumptions").

### 5. `extractSignals()` and `deriveRequirement()` — only if you want to go beyond the deterministic pipeline
These exist in `ai.ts` as mocks but **the real pipeline doesn't use them**
— `deriveRequirements.ts` does the real work without an LLM. Only touch
these if you want to add an LLM-authored *description* on top of the
template-generated ones in `descriptionFor()` (`deriveRequirements.ts`) —
e.g. a more polished requirement write-up that still cites the same real
verbatims. Don't let this become re-deriving what's already real.

### 6. Contradiction flagging (US-2.7) — currently unpopulated
`Signal.contradicts: string[]` exists in the type and in every ingested
signal, but `scripts/ingest-real-data.ts` never populates it. When two
signals for the same component have opposing sentiment on a related theme
(e.g. a "too many screens" pain point alongside a "love the display" like),
flag it — either a keyword-similarity pass in the ingestion script
(deterministic, cheap) or an LLM pass if the themes aren't textually
similar enough for keywords to catch. Coordinate with Role A since this
touches `scripts/ingest-real-data.ts`, which they own.

## Guardrails

- Every mocked function's docstring in `ai.ts` says exactly what real
  behavior is expected and what shape to return — change bodies, not
  signatures, unless you coordinate with whoever's consuming them.
- Never let an AI call block the UI with no feedback. For judge-facing
  demo reliability, consider pre-generating and caching the flagship
  workflow's `AISummary` entries (call once, store via `addAISummary()`)
  rather than regenerating them live on every page load — the seeded
  narrative is already your fallback if a live call fails mid-demo.

## Files you own

```
src/lib/ai.ts
```
You'll also touch `src/app/api/requirements/[id]/challenge/route.ts`,
`src/lib/deriveRequirements.ts`'s `competitiveGap()`/`strategicFit()`
(coordinate with Role A, who owns that file), and possibly
`scripts/ingest-real-data.ts` for contradiction flagging (also Role A's
file — coordinate).
