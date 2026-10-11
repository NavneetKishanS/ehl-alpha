import { NextRequest, NextResponse } from "next/server";
import { assignReviewers } from "@/lib/db";

// PM tags stakeholders to review this requirement. Body: { stakeholderIds: string[] }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const stakeholderIds = Array.isArray(body.stakeholderIds) ? (body.stakeholderIds as string[]) : [];
  if (stakeholderIds.length === 0) {
    return NextResponse.json({ error: "stakeholderIds must be a non-empty array" }, { status: 400 });
  }
  try {
    const created = assignReviewers(params.id, stakeholderIds, { type: "pm", id: "pm_demo", name: "Product Manager" });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
