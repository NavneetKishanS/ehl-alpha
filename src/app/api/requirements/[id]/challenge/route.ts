import { NextRequest, NextResponse } from "next/server";
import { getRequirement, logAction, updateRequirementStatus } from "@/lib/db";
import { reassessChallenge } from "@/lib/ai";

// PM challenges an AI-generated score/rationale with their own argument;
// the (mocked) AI re-assesses and states whether the challenge changed
// anything, per US-6.3. Always logged either way.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { argument } = body as { argument: string };
  if (!argument) return NextResponse.json({ error: "argument is required" }, { status: 400 });

  const requirement = getRequirement(params.id);
  if (!requirement) return NextResponse.json({ error: "not found" }, { status: 404 });

  updateRequirementStatus(params.id, "challenged", { type: "pm", id: "pm_demo", name: "Product Manager" }, argument);

  const result = reassessChallenge(requirement, argument);

  logAction({
    workflowId: requirement.workflowId,
    actor: { type: "ai", id: "ai_engine", name: "Requirements Copilot", model: "claude-sonnet-5" },
    action: "ai_summary_generated",
    targetType: "requirement",
    targetId: requirement.id,
    oldValue: null,
    newValue: { changed: result.changed },
    rationale: result.explanation,
  });

  return NextResponse.json(result);
}
