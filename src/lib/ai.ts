// AI layer. Every function here is a MOCK that returns deterministic,
// template-based output so the rest of the app works end-to-end without an
// API key. Role B's job is to replace each function body with a real call
// to the OpenAI API, keeping the same input/output shape.
//
// Suggested real implementation: OpenAI SDK (`npm install openai`), using
// the Responses API with `response_format: { type: "json_schema" }` (or
// `zodResponseFormat`) so the model's output is constrained to the same
// return shape, not parsed out of free text.
//
// Model choice matters for the $70/person OpenAI budget: the deterministic
// scoring in src/lib/deriveRequirements.ts already does the expensive part
// (frequency/evidence/sales_relevance) with zero LLM calls, by using BMW's
// own VFC taxonomy as pre-clustering instead of asking a model to cluster
// 14k raw verbatims. That means real LLM calls here are only ever
// per-signal or per-requirement (tens to low hundreds), not per-verbatim
// (thousands) — so budget is not the constraint, quality is:
//   - gpt-4.1-mini: fine for summarizeStakeholderReviews() and the
//     mechanical parts of extractSignals()/deriveRequirement() if you end
//     up needing an LLM pass there.
//   - gpt-4.1: use for summarizeDecisionTrail() and reassessChallenge() —
//     these are the two functions judges will see live in a demo, worth
//     the better model.
// Keep the key in .env.local as OPENAI_API_KEY (see .env.local.example)
// and only call the SDK from server-side code (API routes / this file),
// never from a client component.

import type { AuditLogEntry, Requirement, Signal, SourceRecord, StakeholderReview } from "./types";

export interface DecisionTrailInput {
  requirement: Requirement;
  relatedLogs: AuditLogEntry[];
}

/**
 * MOCK. Replace with: OpenAI call that reads relatedLogs and produces a
 * narrative of what was asked, what was proposed, what the PM pushed back
 * on, and how the proposal changed as a result.
 */
export function summarizeDecisionTrail(input: DecisionTrailInput): string {
  const { requirement, relatedLogs } = input;
  const challenges = relatedLogs.filter((l) => l.action === "requirement_challenged");
  if (challenges.length === 0) {
    return `No PM challenges yet on "${requirement.title}". Proposed with ${requirement.evidenceLevel} evidence from ${requirement.linkedSourceIds.length} source(s).`;
  }
  const latest = challenges[challenges.length - 1];
  return `PM challenged "${requirement.title}": "${latest.rationale}". The requirement was revised in response — see the audit log for the exact before/after.`;
}

export interface StakeholderOverviewInput {
  reviews: StakeholderReview[];
}

/**
 * MOCK. Replace with: OpenAI call that reads all reviews for a requirement
 * (or workflow) and produces a short synthesis of where reviewers agree,
 * disagree, and why — the "AI overview of who says what" from the brief.
 */
export function summarizeStakeholderReviews(input: StakeholderOverviewInput): string {
  const { reviews } = input;
  const submitted = reviews.filter((r) => r.decision !== "pending");
  const approvals = submitted.filter((r) => r.decision === "approve").length;
  const rejections = submitted.filter((r) => r.decision === "reject").length;
  const pending = reviews.length - submitted.length;
  if (submitted.length === 0) return "No stakeholder reviews submitted yet.";
  return `${approvals} approve, ${rejections} reject, ${pending} pending. ${
    rejections > 0
      ? `Rejection rationale: "${submitted.find((r) => r.decision === "reject")?.expertOpinion}"`
      : "No objections raised."
  }`;
}

/**
 * MOCK. Replace with: OpenAI call that re-evaluates a requirement's score
 * or rationale given the PM's specific argument, and states explicitly
 * whether the challenge changed the result (per US-6.3).
 */
export function reassessChallenge(requirement: Requirement, pmArgument: string): {
  changed: boolean;
  explanation: string;
} {
  const mentionsEvidence = /evidence|source|data|proof/i.test(pmArgument);
  return {
    changed: mentionsEvidence,
    explanation: mentionsEvidence
      ? `Re-assessed "${requirement.title}" against your argument. Found additional/clarified evidence grounds — adjusting evidence level and rationale accordingly.`
      : `Re-assessed "${requirement.title}" against your argument. The existing evidence base already accounts for this; score and rationale unchanged, but your objection is logged against the requirement for the audit trail.`,
  };
}

export interface ClusterInput {
  verbatims: { id: string; text: string }[];
}

/**
 * MOCK. Replace with: OpenAI call (or embeddings + clustering) that groups
 * verbatims into themes. Returns partial Signal objects; caller assigns ids.
 */
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

/**
 * MOCK. Replace with: OpenAI call that turns a signal + its sources into a
 * draft Requirement (title, description, category, evidence level,
 * assumptions, uncertainties) per US-3.1.
 */
export function deriveRequirement(input: DeriveInput): Pick<Requirement, "title" | "description" | "evidenceLevel" | "assumptions" | "uncertainties"> {
  return {
    title: `Draft requirement from "${input.signal.theme}"`,
    description: "Mock derivation — replace with OpenAI call grounded in linked sources.",
    evidenceLevel: input.sources.length >= 3 ? "strong" : input.sources.length === 2 ? "moderate" : "weak",
    assumptions: [],
    uncertainties: ["Generated by mock deriveRequirement(); not yet reviewed."],
  };
}
