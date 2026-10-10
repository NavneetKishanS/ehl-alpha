# Milestones (15-17h build)

v0 already exists on `main` as of kickoff — and it's further along than a
typical hackathon starting point: landing page with a vehicle switcher
across all 3 BMW lines, PM workflow page, stakeholder review page, an
Evidence Explorer over real data, in-memory store, mocked AI layer (OpenAI
target), and **real BMW data already flowing through a deterministic
derivation+scoring pipeline** — 13,771 real verbatims, real sales volumes,
real customer-study benchmarks, ~17 real component workflows across 3
vehicle lines, one fully narrated flagship workflow (BMW 5 Series /
Battery & Charging). All wired end to end and verified working. Everyone
starts from a running, data-grounded app, not a blank repo or a mock demo.

Times are elapsed-from-kickoff, not wall-clock — shift to fit your actual
start time. Each role's detailed task list is in its own doc
(`ROLE_A_BACKEND.md`, `ROLE_B_AI.md`, `ROLE_C_PM_FRONTEND.md`,
`ROLE_D_STAKEHOLDER_TRUST.md`).

## H0 — Kickoff (30 min)
- Everyone: clone, `npm install`. Get the real dataset files (see
  `docs/DATA_SETUP.md`) into `data-raw/`, run `npm run ingest`, then
  `npm run dev` and click through all views against the real data. Confirm
  you understand the demo narrative in `docs/PROJECT_BRIEF.md` before
  writing code.
- Agree on branch strategy: short-lived feature branches off `main`, small
  PRs, merge often (every 1-2h) to avoid a brutal integration at H14. A
  stale branch in a 16h hackathon is a dead branch.
- Role A: get an OpenAI API key into the team's hands for Role B (budget:
  $70/person — see `docs/ROLE_B_AI.md` for why that's plenty).
- Everyone: confirm Node version (`node -v`) — 18.17+ required, 20+ fine.
- **Reminder**: `data-raw/` and `src/data/*.json` are gitignored on
  purpose — confidential hackathon data, never `git add -f` them.

## H0:30 - H4 — Parallel build, independent tracks
- **Role A**: live in-app ingestion endpoint (US-1.1, upgrading the
  offline `npm run ingest` script) with malformed-row flagging; web
  enrichment stub (US-1.2, currently missing entirely — every source today
  is internal BMW data).
- **Role B**: wire the OpenAI SDK, get `summarizeDecisionTrail()`
  producing real output against the real battery audit log (already has
  real numbers baked in from `buildFlagshipNarrative()` — your job is to
  make the narration live instead of templated). This is the
  highest-leverage function in the app — prioritize it over everything
  else in your doc.
- **Role C**: real car visual for the landing page (static image + hotspot
  overlay, minimum; 360 viewer if time allows). This is the first thing
  judges see — don't let it stay a wireframe SVG past H4.
- **Role D**: audit log CSV export + dedicated audit trail view (US-8.1,
  8.4) — the embedded sidebar version with actor filtering already exists,
  this is about a standalone/exportable view.

**Checkpoint H4**: everyone demos their piece to the group, 2 min each.
Merge anything stable into `main`.

## H4 - H8 — Integration + depth
- **Role A**: wire real `ingest`/`enrich` stage transitions to the pipeline
  strip so Role C's UI shows real progress, not just seeded "complete"
  states. Start on multi-market support if ingestion is solid.
- **Role B**: `reassessChallenge()` and `summarizeStakeholderReviews()` real
  implementations. Test the full "PM challenges → AI re-assesses → states
  whether it changed" loop live against the UI.
- **Role C**: pipeline strip polish, live-refresh on stage changes, start
  the sensitivity view (US-4.4) if the weight-slider mechanic needs it to
  feel complete.
- **Role D**: audit log CSV export, low-confidence queue (US-7.2).

**Checkpoint H8 (roughly halfway)**: full run-through as a group, PM
persona end to end: land → open/create a workflow → review requirements →
challenge one → see stakeholder reviews come in → approve. Fix anything
that breaks this path before adding more features — this path *is* the
demo.

## H8 - H12 — Breadth + second component
- Get a second component (beyond battery) demo-ready end to end, ideally
  one where the PM *rejects* a requirement (shows the full decision
  spectrum, not just approve). Role A seeds/ingests it, Role B's AI
  functions run against it for real, Roles C/D confirm the UI holds up
  with different data shapes (e.g. a requirement with zero stakeholder
  reviews yet, or all-reject).
- Epic 2 signal extraction (`extractSignals`, Role B) from real verbatims,
  if ingestion (Role A) is ready.
- Stretch items from each role's doc, time permitting, in the priority
  order listed there — don't start a role's "stretch" section if their
  "must have" isn't demo-stable yet.

## H12 - H14 — Feature freeze, bug bash
- **No new features after H12** unless something is badly broken. Switch
  entirely to: click through every view on a clean `npm install && npm run
  dev`, fix what's broken, tighten copy, fix loading/empty states.
- Confirm `npx tsc --noEmit` and `npx next lint` are both clean.
- Confirm the demo narrative survives a hard refresh at every step (no
  state that only exists because of a specific click order).

## H14 - H16 — Demo prep
- Write the 3-minute demo script: landing page (show the concept) → open
  battery workflow (show pipeline + AI summary) → challenge a requirement
  live (show the AI re-assessment loop — this is your best "wow" moment) →
  switch to stakeholder view, submit a review (show it land back in the PM
  view's audit trail) → show the audit log / traceability view (prove the
  "transparent decision-support" claim from the brief).
- Record a fallback screen capture of the full demo in case live demo
  breaks — `npm run build && npm run start` once to confirm production
  build works, not just dev mode.
- Prepare the pitch framing around the evaluation criteria table in
  `docs/PROJECT_BRIEF.md` — name-check "decision and scoring logic",
  "traceability and auditability", etc. explicitly, since that's literally
  how this gets scored.

## H16 - H17 — Buffer
Things go wrong. This hour exists so that when they do, you're not cutting
into demo prep.
