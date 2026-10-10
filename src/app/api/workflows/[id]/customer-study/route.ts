import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, getComponent } from "@/lib/db";
import { loadCustomerStudy } from "@/lib/realData";
import { STUDY_CATEGORY_KEYWORDS } from "@/lib/deriveRequirements";
import type { ComponentKey } from "@/lib/types";

// Real customer-study benchmark rows relevant to this workflow's component,
// across all regions that have data — the cross-model comparison chart on
// the PM/stakeholder pages reads from here.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const workflow = getWorkflow(params.id);
  if (!workflow) return NextResponse.json({ error: "not found" }, { status: 404 });
  const component = getComponent(workflow.componentId);
  if (!component) return NextResponse.json([]);

  const keywords = STUDY_CATEGORY_KEYWORDS[component.key as ComponentKey] ?? [];
  const study = loadCustomerStudy();
  const rows = study.filter((r) => keywords.some((k) => r.category.toLowerCase().includes(k)));
  return NextResponse.json(rows);
}
