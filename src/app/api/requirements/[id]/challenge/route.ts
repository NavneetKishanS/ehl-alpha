import { NextRequest, NextResponse } from "next/server";
import { getRequirement, getSourcesByIds, listSignals, logAction, updateRequirementStatus, updateScoreFactors } from "@/lib/db";
import { reassessChallenge } from "@/lib/ai";
import { regenerateDecisionTrail } from "@/lib/aiSummaries";
import type { Actor } from "@/lib/types";

// PM challenges an AI-generated score/rationale with their own argument;
// the AI re-assesses and states whether the challenge changed anything, per
// US-6.3. Always logged either way, and the decision-trail summary is
// regenerated so it narrates the challenge and its outcome.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { argument } = body as { argument: string };
  if (!argument?.trim()) return NextResponse.json({ error: "argument is required" }, { status: 400 });

  const requirement = getRequirement(params.id);
  if (!requirement) return NextResponse.json({ error: "not found" }, { status: 404 });

  updateRequirementStatus(params.id, "challenged", { type: "pm", id: "pm_demo", name: "Product Manager" }, argument);

  const linkedSignalIds = new Set(requirement.linkedSignalIds);
  const result = await reassessChallenge(requirement, argument, {
    sources: getSourcesByIds(requirement.linkedSourceIds),
    signals: listSignals(requirement.workflowId).filter((s) => linkedSignalIds.has(s.id)),
  });

  const aiActor: Actor = { type: "ai", id: "ai_engine", name: "Requirements Copilot", model: result.model };
  const scoreBefore = requirement.score;

  logAction({
    workflowId: requirement.workflowId,
    actor: aiActor,
    action: "ai_summary_generated",
    targetType: "requirement",
    targetId: requirement.id,
    oldValue: null,
    newValue: { kind: "challenge_reassessment", changed: result.changed, verdict: result.verdict, citedSourceIds: result.citedSourceIds },
    rationale: result.explanation,
  });

  if (result.changed) {
    const changeList = result.factorChanges.map((c) => `${c.label} ${c.oldRawValue} -> ${c.newRawValue}`);
    if (result.evidenceLevel) changeList.push(`evidence ${result.evidenceLevel.from} -> ${result.evidenceLevel.to}`);
    updateScoreFactors(
      requirement.id,
      {
        factorUpdates: result.factorChanges.map((c) => ({
          key: c.key,
          rawValue: c.newRawValue,
          rationale: `${c.rationale} (revised after PM challenge; was ${c.oldRawValue})`,
        })),
        evidenceLevel: result.evidenceLevel?.to,
      },
      aiActor,
      `Re-scored after PM challenge: ${changeList.join(", ")}.`,
    );
  }

  await regenerateDecisionTrail(requirement.workflowId, requirement.id);

  return NextResponse.json({
    changed: result.changed,
    explanation: result.explanation,
    verdict: result.verdict,
    factorChanges: result.factorChanges,
    evidenceLevel: result.evidenceLevel,
    citedSourceIds: result.citedSourceIds,
    scoreBefore,
    scoreAfter: getRequirement(requirement.id)?.score ?? scoreBefore,
    model: result.model,
    live: result.live,
  });
}
