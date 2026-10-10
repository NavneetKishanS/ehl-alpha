import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, listAISummaries } from "@/lib/db";
import { regenerateDecisionTrail, regenerateStakeholderOverview } from "@/lib/aiSummaries";
import type { AISummary } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json(listAISummaries(params.id));
}

// Regenerate summaries on demand from the current audit log.
// Body (optional): { requirementId?: string, types?: ("decision_trail" | "stakeholder_overview")[] }
// Returns only the summaries that were actually (re)generated.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getWorkflow(params.id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    requirementId?: string;
    types?: AISummary["type"][];
  };
  const types = body.types?.length ? body.types : ["decision_trail", "stakeholder_overview"];
  const generated = await Promise.all([
    types.includes("decision_trail") ? regenerateDecisionTrail(params.id, body.requirementId) : null,
    types.includes("stakeholder_overview") ? regenerateStakeholderOverview(params.id, body.requirementId) : null,
  ]);
  return NextResponse.json(generated.filter((s): s is AISummary => s !== null));
}
