// AI layer. Real OpenAI calls, each with a deterministic fallback so the app
// keeps working end-to-end without an API key or when a request fails
// mid-demo.
//
// What is live when OPENAI_API_KEY is set (see .env.local.example):
//   - summarizeDecisionTrail()      strong model  narrative of one requirement's audit trail
//   - reassessChallenge()           strong model  US-6.3: PM challenges, AI re-assesses, says whether it changed
//   - summarizeStakeholderReviews() fast model    the "PR reviewer" overview of who says what, and why
//   - assessJudgmentFactors()       strong model  competitive_gap / strategic_fit with citations, precomputed
//                                                 by `npm run ai:factors` (scripts/ai-judgment-factors.ts)
// Every result carries `model` and `live`, so the audit trail never passes
// template text off as model output (`live: false` => FALLBACK_MODEL).
//
// Scoring and clustering stay deterministic in src/lib/deriveRequirements.ts
// on purpose (docs/ROLE_B_AI.md): a formula a judge can audit beats a model's
// opinion. The model only ever touches the judgment-call factors.
//
// Server-only: never import this from a client component.

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  AuditLogEntry,
  CustomerStudyScore,
  EvidenceLevel,
  Requirement,
  Signal,
  SourceRecord,
  Stakeholder,
  StakeholderReview,
} from "./types";
import type { StrategyExcerpt } from "./strategyContext";

// ---------- client ----------

export const FALLBACK_MODEL = "deterministic-fallback";

export function strongModel(): string {
  return process.env.OPENAI_MODEL_STRONG || "gpt-4.1";
}

export function fastModel(): string {
  return process.env.OPENAI_MODEL_FAST || "gpt-4.1-mini";
}

let cachedClient: OpenAI | undefined;

function client(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey === "your-key-here") return null;
  // OPENAI_BASE_URL is picked up from the environment by the SDK itself.
  return (cachedClient ??= new OpenAI({ apiKey, timeout: 25_000, maxRetries: 1 }));
}

export function liveAIAvailable(): boolean {
  return client() !== null;
}

class AIUnavailableError extends Error {}

function fallbackReason(e: unknown): string {
  if (e instanceof AIUnavailableError) return "no OPENAI_API_KEY configured";
  const message = e instanceof Error ? e.message : String(e);
  console.warn(`[ai] OpenAI call failed, using deterministic fallback: ${message}`);
  return message;
}

async function generateText(model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const c = client();
  if (!c) throw new AIUnavailableError();
  const res = await c.chat.completions.create({
    model,
    temperature: 0.2,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("empty completion");
  return text;
}

async function generateObject<S extends z.ZodTypeAny>(
  model: string,
  schema: S,
  schemaName: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<z.infer<S>> {
  const c = client();
  if (!c) throw new AIUnavailableError();
  const res = await c.chat.completions.parse({
    model,
    temperature: 0.2,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: zodResponseFormat(schema, schemaName),
  });
  const message = res.choices[0]?.message;
  if (message?.refusal) throw new Error(`model refused: ${message.refusal}`);
  if (!message?.parsed) throw new Error("no structured output returned");
  return message.parsed as z.infer<S>;
}

/** Text produced by the AI layer, labeled with where it actually came from. */
export interface AIText {
  text: string;
  model: string; // the OpenAI model, or FALLBACK_MODEL
  live: boolean; // false => deterministic template, not model output
}

// ---------- shared prompt formatting ----------

function compact(value: unknown, max = 240): string {
  const s = typeof value === "string" ? value : JSON.stringify(value) ?? "null";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function trimText(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function describeActor(entry: AuditLogEntry): string {
  if (entry.actor.type === "ai") return `AI (${entry.actor.model ?? "model n/a"})`;
  if (entry.actor.type === "pm") return `PM (${entry.actor.name})`;
  return `Stakeholder ${entry.actor.name}`;
}

function formatLogEntry(entry: AuditLogEntry): string {
  const hasValues = entry.oldValue != null || entry.newValue != null;
  const values = hasValues ? ` | before: ${compact(entry.oldValue)} | after: ${compact(entry.newValue)}` : "";
  return `- ${entry.timestamp.slice(0, 16).replace("T", " ")} · ${describeActor(entry)} · ${entry.action}${values} | rationale: ${entry.rationale}`;
}

function describeRequirement(r: Requirement): string {
  const factors = r.scoreFactors
    .map((f) => `  - ${f.key} (${f.label}): raw=${f.rawValue}, weight=${Math.round(f.weight * 100)}% — ${f.rationale}`)
    .join("\n");
  const list = (items: string[]) => (items.length ? items.map((i) => `  - ${i}`).join("\n") : "  (none)");
  return [
    `Title: ${r.title}`,
    `Description: ${r.description}`,
    `Status: ${r.status} · Category: ${r.category} · Evidence level: ${r.evidenceLevel} · Weighted score: ${r.score.toFixed(1)}/100 · Effort: ${r.effort}`,
    `Score factors:\n${factors}`,
    `Assumptions:\n${list(r.assumptions)}`,
    `Uncertainties:\n${list(r.uncertainties)}`,
  ].join("\n");
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ===========================================================================
// 1. Decision trail
// ===========================================================================

export interface DecisionTrailInput {
  requirement: Requirement;
  relatedLogs: AuditLogEntry[]; // chronological, oldest first
  previousSummary?: string | null;
}

const DECISION_TRAIL_SYSTEM = `You write the "decision trail" summary in a BMW requirements copilot. Product managers and stakeholders read it to understand how a customer requirement got to where it is now.

Write one paragraph of 4-7 sentences, plain prose, no markdown, no bullet points, past tense for events, present tense for the current state. Cover, in chronological order and only where the audit trail contains it:
1. What the AI originally proposed and on what evidence (keep the real numbers: verbatim counts, percentages, scores).
2. What the PM pushed back on — paraphrase or quote the PM briefly.
3. How the AI responded, and whether the score, evidence level or rationale actually changed (give exact before -> after values when the trail has them; say plainly if nothing changed).
4. Where stakeholders stand, distinguishing a process objection (e.g. sign-off, claim substantiation) from a product objection (customer value, feasibility).
5. The current status and the decision still open for the PM.

Rules: use only facts present in the requirement and audit trail; never invent numbers, names, reviewers or events. Attribute every score change to the audit entry that records it (score_recomputed entries carry the before/after values) — never to a neighbouring event, and never to an event with a higher entry number. Refer to people by role or function (PM, Engineering, Legal), not as "the log". If a previous summary is supplied, the audit trail wins wherever they disagree.`;

/**
 * Narrates how a requirement evolved: what was proposed, what the PM pushed
 * back on, how the AI responded and whether anything changed. Regenerated
 * after every challenge, PM decision and stakeholder review
 * (src/lib/aiSummaries.ts).
 */
export async function summarizeDecisionTrail(input: DecisionTrailInput): Promise<AIText> {
  const { requirement, relatedLogs, previousSummary } = input;
  const logs = relatedLogs.slice(-60);
  const user = [
    `REQUIREMENT\n${describeRequirement(requirement)}`,
    `AUDIT TRAIL (numbered in chronological order, ${logs.length} entries)\n${
      logs.map((l, i) => `#${i + 1} ${formatLogEntry(l).slice(2)}`).join("\n") || "(empty)"
    }`,
    previousSummary ? `PREVIOUS DECISION-TRAIL SUMMARY (may be outdated)\n${previousSummary}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const model = strongModel();
    const text = await generateText(model, DECISION_TRAIL_SYSTEM, user, 450);
    return { text, model, live: true };
  } catch (e) {
    fallbackReason(e);
    return { text: decisionTrailFallback(requirement, logs), model: FALLBACK_MODEL, live: false };
  }
}

function decisionTrailFallback(requirement: Requirement, logs: AuditLogEntry[]): string {
  const forReq = (action: AuditLogEntry["action"]) => logs.filter((l) => l.action === action && l.targetId === requirement.id);
  const parts: string[] = [];

  const proposed = forReq("requirement_proposed")[0];
  parts.push(
    proposed
      ? `AI proposed "${requirement.title}": ${trimText(proposed.rationale, 220)}`
      : `"${requirement.title}" was proposed with ${requirement.evidenceLevel} evidence from ${requirement.linkedSourceIds.length} linked source(s).`,
  );

  const challenges = forReq("requirement_challenged");
  if (challenges.length > 0) {
    const latest = challenges[challenges.length - 1];
    const times = challenges.length === 1 ? "once" : `${challenges.length} times`;
    parts.push(`The PM challenged it ${times}; most recently: "${trimText(latest.rationale, 220)}".`);
  }

  const rescored = forReq("score_recomputed");
  if (rescored.length > 0) {
    parts.push(`Score inputs were revised ${rescored.length} time(s); latest: ${trimText(rescored[rescored.length - 1].rationale, 220)}`);
  }

  const reviews = logs.filter((l) => l.action === "stakeholder_review_submitted");
  if (reviews.length > 0) {
    const decisionOf = (l: AuditLogEntry) => (l.newValue as { decision?: string } | null)?.decision;
    const approvals = reviews.filter((l) => decisionOf(l) === "approve").length;
    const rejections = reviews.filter((l) => decisionOf(l) === "reject").length;
    parts.push(`${reviews.length} stakeholder review(s) submitted: ${approvals} approve, ${rejections} reject.`);
  }

  const decisions = logs.filter(
    (l) =>
      l.targetId === requirement.id &&
      ["requirement_approved", "requirement_rejected", "requirement_postponed"].includes(l.action),
  );
  if (decisions.length > 0) {
    const latest = decisions[decisions.length - 1];
    parts.push(`The PM ${latest.action.replace("requirement_", "")} it: "${trimText(latest.rationale, 200)}".`);
  }

  parts.push(`Current status: ${requirement.status}, score ${requirement.score.toFixed(1)}.`);
  return parts.join(" ");
}

// ===========================================================================
// 2. Stakeholder overview
// ===========================================================================

export interface StakeholderOverviewInput {
  reviews: StakeholderReview[];
  stakeholders?: Stakeholder[];
  requirement?: Requirement | null;
}

const STAKEHOLDER_OVERVIEW_SYSTEM = `You write the "AI overview" above a stakeholder review panel in a BMW requirements copilot — like a summary of pull-request reviews. The reader is the product manager deciding whether to approve the requirement.

Write 3-5 sentences, plain prose, no markdown. Say where reviewers agree and why, and where they disagree and why. For every objection, state whether it is a process objection (sign-off, claim substantiation, governance — it constrains how the requirement ships) or a product objection (customer value, feasibility, cost — it questions the requirement itself), and whether it blocks the requirement or only a part of it. Name reviewers by function (Engineering, Sales, Design, Legal). Mention who has not responded yet, if anyone — the header line states exactly who is pending. End with the one question the PM has to resolve.

Use only what the reviewers wrote; do not add opinions of your own.`;

/**
 * Synthesizes where reviewers agree/disagree and why, separating process
 * objections from product objections. Returns a fixed sentence (not a model
 * call) when nobody has submitted yet.
 */
export async function summarizeStakeholderReviews(input: StakeholderOverviewInput): Promise<AIText> {
  const { reviews, stakeholders = [], requirement } = input;
  const nameOf = (id: string) => stakeholders.find((s) => s.id === id)?.name ?? id;
  const submitted = reviews.filter((r) => r.decision !== "pending");
  const pending = reviews.filter((r) => r.decision === "pending");

  if (submitted.length === 0) {
    const waiting = pending.length ? ` Waiting on: ${pending.map((r) => nameOf(r.stakeholderId)).join(", ")}.` : "";
    return { text: `No stakeholder reviews submitted yet.${waiting}`, model: FALLBACK_MODEL, live: false };
  }

  const reviewLines = reviews
    .map((r) => {
      const sh = stakeholders.find((s) => s.id === r.stakeholderId);
      const who = sh ? `${sh.name} (${sh.expertise.replace(/_/g, " ")})` : r.stakeholderId;
      if (r.decision === "pending") return `- ${who}: PENDING (no response yet)`;
      return `- ${who}: ${r.decision.toUpperCase()} — "${r.expertOpinion || "(no comment)"}"`;
    })
    .join("\n");
  const pendingNote = pending.length
    ? `Pending: ${pending.map((r) => nameOf(r.stakeholderId)).join(", ")}.`
    : "Pending: none — every assigned reviewer has responded.";
  const user = [
    requirement ? `REQUIREMENT\nTitle: ${requirement.title}\nDescription: ${requirement.description}` : null,
    `REVIEWS (${submitted.length} of ${reviews.length} responded. ${pendingNote})\n${reviewLines}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const model = fastModel();
    const text = await generateText(model, STAKEHOLDER_OVERVIEW_SYSTEM, user, 320);
    return { text, model, live: true };
  } catch (e) {
    fallbackReason(e);
    const approvals = submitted.filter((r) => r.decision === "approve");
    const rejections = submitted.filter((r) => r.decision === "reject");
    const parts = [`${approvals.length} approve, ${rejections.length} reject, ${pending.length} pending.`];
    if (approvals.length) parts.push(`Approved by ${approvals.map((r) => nameOf(r.stakeholderId)).join(", ")}.`);
    for (const r of rejections) parts.push(`${nameOf(r.stakeholderId)} rejected: "${trimText(r.expertOpinion, 200)}"`);
    if (pending.length) parts.push(`Still waiting on ${pending.map((r) => nameOf(r.stakeholderId)).join(", ")}.`);
    return { text: parts.join(" "), model: FALLBACK_MODEL, live: false };
  }
}

// ===========================================================================
// 3. Challenge re-assessment (US-6.3)
// ===========================================================================

// Factors a PM challenge may move. The rest (customer_impact, frequency,
// sales_relevance, evidence_strength) are computed from BMW data by an
// auditable formula; a PM who disagrees with their importance adjusts the
// weights, not the inputs.
export const ADJUSTABLE_FACTOR_KEYS = ["competitive_gap", "strategic_fit", "effort_inverse"] as const;

// Mirrors the evidence_strength mapping in deriveRequirements.ts.
const EVIDENCE_STRENGTH_VALUE: Record<EvidenceLevel, number> = { strong: 90, moderate: 65, weak: 35 };
const EVIDENCE_RANK: Record<EvidenceLevel, number> = { weak: 0, moderate: 1, strong: 2 };

export interface ChallengeContext {
  sources?: SourceRecord[]; // the requirement's linked sources
  signals?: Signal[]; // the requirement's linked signals
}

export interface FactorChange {
  key: string;
  label: string;
  oldRawValue: number;
  newRawValue: number;
  rationale: string;
}

export interface ChallengeReassessment {
  changed: boolean;
  explanation: string;
  verdict: "upheld" | "partially_upheld" | "not_upheld" | "not_assessed";
  factorChanges: FactorChange[];
  evidenceLevel: { from: EvidenceLevel; to: EvidenceLevel } | null;
  citedSourceIds: string[];
  model: string;
  live: boolean;
}

const ReassessmentSchema = z.object({
  verdict: z.enum(["upheld", "partially_upheld", "not_upheld"]),
  explanation: z.string(),
  factorUpdates: z.array(
    z.object({
      key: z.enum(ADJUSTABLE_FACTOR_KEYS),
      newRawValue: z.number().int(),
      rationale: z.string(),
    }),
  ),
  evidenceLevel: z.enum(["strong", "moderate", "weak"]).nullable(),
  citedSourceIds: z.array(z.string()),
});

const REASSESS_SYSTEM = `You re-assess a customer requirement in a BMW requirements copilot after the product manager (PM) challenges it. The PM stays in control; your job is an honest second look, not agreement.

What you may change:
- competitive_gap, strategic_fit, effort_inverse (0-100 each) — only when the PM's argument gives a concrete, relevant reason. Give each change a one-sentence rationale.
- evidenceLevel — only DOWNWARD (strong -> moderate -> weak), and only if the argument exposes a real weakness in the evidence (skewed sample, duplicates, off-topic verbatims). Set null to leave it unchanged.

What you must not change: customer_impact, frequency, sales_relevance and evidence_strength are computed from BMW data by an auditable formula. If the PM's point is really that one of these matters more or less, say so and point them to the weight sliders instead.

Decide the verdict: upheld (the argument holds and you changed something), partially_upheld (part of it holds), not_upheld (the existing evidence already accounts for it, or the argument is not supported). Changing a score just because the PM pushed back is a failure; so is dismissing a valid point.

The explanation (2-4 sentences, plain prose) is shown to the PM directly after the words "Result changed:" or "Result unchanged:", so do not start with either phrase. Reference the specific factor values, verbatims or numbers you relied on. Where your reasoning rests on the PM's assertion rather than the data, say so. Put the ids of any verbatims you relied on in citedSourceIds; never cite an id that is not listed.`;

/**
 * Re-evaluates a requirement against the PM's argument and states whether
 * the challenge changed the result. Returns proposed changes; the caller
 * applies them (db.updateScoreFactors) and logs them. `changed` reflects
 * only changes that survive validation, not what the model claimed.
 */
export async function reassessChallenge(
  requirement: Requirement,
  pmArgument: string,
  context: ChallengeContext = {},
): Promise<ChallengeReassessment> {
  const sources = (context.sources ?? []).slice(0, 10);
  const signals = context.signals ?? [];
  const user = [
    `REQUIREMENT\n${describeRequirement(requirement)}`,
    signals.length
      ? `LINKED SIGNALS\n${signals.map((s) => `- "${s.theme}": ${s.frequency} verbatims, overall sentiment ${s.sentiment}`).join("\n")}`
      : null,
    sources.length
      ? `LINKED SOURCES\n${sources.map((s) => `- [${s.id}] (${s.datasetType}/${s.reliability}${s.country ? `/${s.country}` : ""}) ${trimText(s.excerpt, 320)}`).join("\n")}`
      : null,
    `PM'S CHALLENGE\n${pmArgument}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let parsed: z.infer<typeof ReassessmentSchema>;
  const model = strongModel();
  try {
    parsed = await generateObject(model, ReassessmentSchema, "challenge_reassessment", REASSESS_SYSTEM, user, 700);
  } catch (e) {
    const reason = fallbackReason(e);
    return {
      changed: false,
      explanation: `Live AI re-assessment was not available (${reason}), so nothing was changed automatically. Your challenge is recorded on the audit trail; "${requirement.title}" keeps its score of ${requirement.score.toFixed(1)} until you or a reviewer change it.`,
      verdict: "not_assessed",
      factorChanges: [],
      evidenceLevel: null,
      citedSourceIds: [],
      model: FALLBACK_MODEL,
      live: false,
    };
  }

  const factorChanges: FactorChange[] = [];
  for (const update of parsed.factorUpdates) {
    const factor = requirement.scoreFactors.find((f) => f.key === update.key);
    if (!factor || factorChanges.some((c) => c.key === update.key)) continue;
    const newRawValue = clampScore(update.newRawValue);
    if (newRawValue === factor.rawValue) continue;
    factorChanges.push({ key: factor.key, label: factor.label, oldRawValue: factor.rawValue, newRawValue, rationale: update.rationale });
  }

  let evidenceLevel: ChallengeReassessment["evidenceLevel"] = null;
  if (parsed.evidenceLevel && EVIDENCE_RANK[parsed.evidenceLevel] < EVIDENCE_RANK[requirement.evidenceLevel]) {
    evidenceLevel = { from: requirement.evidenceLevel, to: parsed.evidenceLevel };
    const strength = requirement.scoreFactors.find((f) => f.key === "evidence_strength");
    const newRawValue = EVIDENCE_STRENGTH_VALUE[parsed.evidenceLevel];
    if (strength && strength.rawValue !== newRawValue) {
      factorChanges.push({
        key: strength.key,
        label: strength.label,
        oldRawValue: strength.rawValue,
        newRawValue,
        rationale: `Evidence downgraded ${requirement.evidenceLevel} -> ${parsed.evidenceLevel} after the PM's challenge.`,
      });
    }
  }

  const changed = factorChanges.length > 0 || evidenceLevel !== null;
  let explanation = parsed.explanation.trim();
  if (!changed && (parsed.factorUpdates.length > 0 || parsed.evidenceLevel)) {
    explanation += " (No score input actually moved: the proposed values matched the current ones or would have raised the evidence level, which a challenge cannot do.)";
  }

  const knownIds = new Set(sources.map((s) => s.id));
  return {
    changed,
    explanation,
    verdict: parsed.verdict,
    factorChanges,
    evidenceLevel,
    citedSourceIds: parsed.citedSourceIds.filter((id) => knownIds.has(id)),
    model,
    live: true,
  };
}

// ===========================================================================
// 4. Judgment-call score factors: competitive_gap, strategic_fit
// ===========================================================================

export interface JudgmentFactor {
  value: number; // 0-100
  rationale: string;
  citedSourceIds: string[]; // verbatim source ids (src_...) and/or strategy excerpt ids (bmwgr25-...)
  basis: "evidence" | "mixed" | "assumption";
}

export interface JudgmentInput {
  requirement: Requirement;
  vehicleName: string;
  componentLabel: string;
  market: string;
  studyRows: CustomerStudyScore[]; // customer-study rows matched to this component, all models
  competitorMentions: { sourceId: string; text: string; country?: string }[];
  strategy: StrategyExcerpt[];
}

export interface JudgmentResult {
  competitive_gap: JudgmentFactor;
  strategic_fit: JudgmentFactor;
  model: string;
}

const JudgmentFactorSchema = z.object({
  value: z.number().int(),
  rationale: z.string(),
  citedSourceIds: z.array(z.string()),
  basis: z.enum(["evidence", "mixed", "assumption"]),
});

const JudgmentSchema = z.object({
  competitive_gap: JudgmentFactorSchema,
  strategic_fit: JudgmentFactorSchema,
});

const JUDGMENT_SYSTEM = `You score two judgment-call factors for one customer requirement in a BMW requirements copilot. Each is 0-100 and feeds a weighted priority score that the product manager can inspect, so every number needs a traceable reason.

competitive_gap — how far BMW is behind competitors on what this requirement addresses (higher = bigger gap to close).
- 50 = parity, or no usable evidence. 65-85 = customers report competitors doing this clearly better. 15-35 = BMW clearly leads.
- You get (a) a formula baseline that compares this BMW model with SIBLING BMW models in a customer study — not external competitors — and (b) customer verbatims that name competitor brands.
- Move away from the baseline only when verbatims make a concrete, on-topic comparison, and say how many do. A brand mentioned in passing ("I came from an Audi") is not a comparison.

strategic_fit — how directly the requirement serves BMW Group's stated strategy, judged only from the supplied BMW Group Report 2025 excerpts.
- 50 = no stated link. 65-85 = directly serves a named strategic focus. Above 85 only for a named flagship priority (e.g. Gen6 range/charging, Panoramic iDrive). Below 40 only if it works against a stated direction.
- Consider the target market: the report describes different dynamics for Europe, the USA and China.

For both: rationale is 1-3 concrete sentences. Cite the ids you relied on (verbatims as src_..., report excerpts as bmwgr25-...); never cite an id that is not supplied. basis = "evidence" if the cited data carries the score, "mixed" if partly your general knowledge, "assumption" if mostly general knowledge — and say so in the rationale.`;

/**
 * Scores competitive_gap and strategic_fit with cited evidence. Returns null
 * when live AI is unavailable — the deterministic baselines in
 * deriveRequirements.ts then stay in place untouched. Called offline by
 * scripts/ai-judgment-factors.ts; results are cached and applied at seed
 * time by src/lib/aiFactors.ts.
 */
export async function assessJudgmentFactors(input: JudgmentInput): Promise<JudgmentResult | null> {
  const { requirement, vehicleName, componentLabel, market, studyRows, competitorMentions, strategy } = input;
  const baseline = (key: string) => {
    const f = requirement.scoreFactors.find((x) => x.key === key);
    return f ? `raw=${f.rawValue} — ${f.rationale}` : "(not present)";
  };
  const user = [
    `CONTEXT\nVehicle: ${vehicleName} (successor planning, 3-5 years out) · Component: ${componentLabel} · Target market: ${market}`,
    `REQUIREMENT\n${describeRequirement(requirement)}`,
    `FORMULA BASELINES\n- competitive_gap: ${baseline("competitive_gap")}\n- strategic_fit: ${baseline("strategic_fit")}`,
    `CUSTOMER STUDY (0-10 means, BMW models only; "distribution_derived" = lower precision)\n${
      studyRows.map((r) => `- ${r.region} · ${r.model} · ${r.category}: ${r.mean.toFixed(2)} (${r.methodology})`).join("\n") || "(no matching rows)"
    }`,
    `CUSTOMER VERBATIMS NAMING COMPETITORS\n${
      competitorMentions.map((m) => `- [${m.sourceId}]${m.country ? ` (${m.country})` : ""} ${trimText(m.text, 400)}`).join("\n") || "(none found)"
    }`,
    `BMW GROUP REPORT 2025 EXCERPTS\n${strategy.map((s) => `- [${s.id}] p. ${s.page}, ${s.topic}: ${s.text}`).join("\n")}`,
  ].join("\n\n");

  const model = strongModel();
  let parsed: z.infer<typeof JudgmentSchema>;
  try {
    parsed = await generateObject(model, JudgmentSchema, "judgment_factors", JUDGMENT_SYSTEM, user, 700);
  } catch (e) {
    fallbackReason(e);
    return null;
  }

  const allowed = new Set([...competitorMentions.map((m) => m.sourceId), ...strategy.map((s) => s.id)]);
  const clean = (f: z.infer<typeof JudgmentFactorSchema>): JudgmentFactor => ({
    value: clampScore(f.value),
    rationale: f.rationale.trim(),
    citedSourceIds: Array.from(new Set(f.citedSourceIds.filter((id) => allowed.has(id)))),
    basis: f.basis,
  });
  return { competitive_gap: clean(parsed.competitive_gap), strategic_fit: clean(parsed.strategic_fit), model };
}

// ===========================================================================
// 5. Not used by the real pipeline (see docs/ROLE_B_AI.md task 5)
// ===========================================================================
// Signal extraction and requirement derivation are deterministic in
// scripts/ingest-real-data.ts and src/lib/deriveRequirements.ts. These mocks
// stay only so older call sites keep compiling.

export interface ClusterInput {
  verbatims: { id: string; text: string }[];
}

/** MOCK — the real pipeline clusters with BMW's VFC taxonomy, not an LLM. */
export function extractSignals(input: ClusterInput): Pick<Signal, "theme" | "frequency" | "sentiment" | "sampleVerbatims">[] {
  return [
    {
      theme: "Needs manual clustering review — mock extractor",
      frequency: input.verbatims.length,
      sentiment: "mixed",
      sampleVerbatims: input.verbatims.slice(0, 3).map((v) => v.text),
    },
  ];
}

export interface DeriveInput {
  signal: Signal;
  sources: SourceRecord[];
}

/** MOCK — the real pipeline derives requirements in deriveRequirements.ts. */
export function deriveRequirement(input: DeriveInput): Pick<Requirement, "title" | "description" | "evidenceLevel" | "assumptions" | "uncertainties"> {
  return {
    title: `Draft requirement from "${input.signal.theme}"`,
    description: "Mock derivation — the real pipeline derives requirements deterministically in deriveRequirements.ts.",
    evidenceLevel: input.sources.length >= 3 ? "strong" : input.sources.length === 2 ? "moderate" : "weak",
    assumptions: [],
    uncertainties: ["Generated by mock deriveRequirement(); not yet reviewed."],
  };
}
