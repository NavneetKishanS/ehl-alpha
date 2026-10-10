import { NextRequest, NextResponse } from "next/server";
import { getRequirement, updateRequirementStatus } from "@/lib/db";
import { regenerateDecisionTrail } from "@/lib/aiSummaries";
import type { Actor, Requirement } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const requirement = getRequirement(params.id);
  if (!requirement) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(requirement);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { status, rationale } = body as { status: Requirement["status"]; rationale: string };
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });
  if ((status === "rejected" || status === "postponed" || status === "challenged") && !rationale) {
    return NextResponse.json({ error: "rationale is required for reject/postpone/challenge" }, { status: 400 });
  }
  const actor: Actor = { type: "pm", id: "pm_demo", name: "Product Manager" };
  let requirement: Requirement;
  try {
    requirement = updateRequirementStatus(params.id, status, actor, rationale ?? "PM decision.");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
  // Every PM decision gets narrated in the decision-trail summary.
  await regenerateDecisionTrail(requirement.workflowId, requirement.id);
  return NextResponse.json(requirement);
}
