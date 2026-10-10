import { NextRequest, NextResponse } from "next/server";
import { getRequirement, updateRequirementStatus } from "@/lib/db";
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
  try {
    const requirement = updateRequirementStatus(params.id, status, actor, rationale ?? "PM decision.");
    return NextResponse.json(requirement);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
