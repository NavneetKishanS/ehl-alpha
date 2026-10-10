// Regenerates the AI summaries shown on the PM workflow page and the
// stakeholder review page from the live audit log, so they narrate what
// actually happened (challenges, re-assessments, decisions, reviews) instead
// of the seeded text. Called from the challenge / status / review routes and
// from POST /api/workflows/:id/ai-summaries.
//
// Server-only (reaches the OpenAI API through ai.ts).

import {
  addAISummary,
  getAuditLog,
  getRequirement,
  listAISummaries,
  listRequirements,
  listReviews,
  listStakeholders,
} from "./db";
import { summarizeDecisionTrail, summarizeStakeholderReviews, type AIText } from "./ai";
import type { AISummary, AuditLogEntry, Requirement } from "./types";

// AISummary is workflow-scoped, so each regeneration focuses on one
// requirement: the one passed in, else the one most recently acted on, else
// the top-scored one.
function focusRequirement(workflowId: string, requirementId?: string | null): Requirement | undefined {
  if (requirementId) {
    const req = getRequirement(requirementId);
    if (req?.workflowId === workflowId) return req;
  }
  const requirements = listRequirements(workflowId);
  const log = getAuditLog(workflowId);
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].targetType !== "requirement") continue;
    const req = requirements.find((r) => r.id === log[i].targetId);
    if (req) return req;
  }
  return requirements[0];
}

function logsFor(requirement: Requirement): AuditLogEntry[] {
  const reviewIds = new Set(
    listReviews(requirement.workflowId)
      .filter((r) => r.requirementId === requirement.id)
      .map((r) => r.id),
  );
  return getAuditLog(requirement.workflowId).filter(
    (l) =>
      l.targetId === requirement.id ||
      (l.targetType === "review" && reviewIds.has(l.targetId)) ||
      l.targetType === "stage" ||
      // workflow-level "summary regenerated" entries are bookkeeping, not decisions
      (l.targetType === "workflow" && l.action !== "ai_summary_generated"),
  );
}

// Ids of summaries that came from the deterministic fallback, not a model.
// Kept on globalThis like the store so it survives dev-mode hot reload.
const globalForFallbacks = globalThis as unknown as { __ehlFallbackSummaryIds?: Set<string> };
const fallbackSummaryIds = (globalForFallbacks.__ehlFallbackSummaryIds ??= new Set<string>());

// A fallback (template) result never overwrites a seeded or model-written
// summary of the same type — e.g. the seeded flagship narrative stays put if
// the API is down mid-demo. It only replaces nothing or an older fallback.
function save(workflowId: string, type: AISummary["type"], result: AIText, basedOnLogIds: string[]): AISummary | null {
  const existing = listAISummaries(workflowId).find((s) => s.type === type);
  if (!result.live && existing && !fallbackSummaryIds.has(existing.id)) return null;
  const summary = addAISummary({ workflowId, type, content: result.text, basedOnLogIds }, result.model);
  if (!result.live) fallbackSummaryIds.add(summary.id);
  return summary;
}

export async function regenerateDecisionTrail(workflowId: string, requirementId?: string | null): Promise<AISummary | null> {
  const requirement = focusRequirement(workflowId, requirementId);
  if (!requirement) return null;
  const relatedLogs = logsFor(requirement);

  // Only hand over the previous summary if it was about this requirement.
  const relatedIds = new Set(relatedLogs.map((l) => l.id));
  const previous = listAISummaries(workflowId).find(
    (s) => s.type === "decision_trail" && s.basedOnLogIds.some((id) => relatedIds.has(id)),
  );

  const result = await summarizeDecisionTrail({ requirement, relatedLogs, previousSummary: previous?.content ?? null });
  return save(workflowId, "decision_trail", result, relatedLogs.map((l) => l.id));
}

export async function regenerateStakeholderOverview(workflowId: string, requirementId?: string | null): Promise<AISummary | null> {
  const requirement = focusRequirement(workflowId, requirementId);
  const reviews = listReviews(workflowId).filter((r) => !requirement || r.requirementId === requirement.id);
  if (reviews.length === 0) return null;

  const result = await summarizeStakeholderReviews({ reviews, stakeholders: listStakeholders(), requirement });
  const reviewIds = new Set(reviews.map((r) => r.id));
  const basedOnLogIds = getAuditLog(workflowId)
    .filter((l) => l.targetType === "review" && reviewIds.has(l.targetId))
    .map((l) => l.id);
  return save(workflowId, "stakeholder_overview", result, basedOnLogIds);
}
