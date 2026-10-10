import { NextRequest, NextResponse } from "next/server";
import { updateWeights } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { weights } = body as { weights: Record<string, number> };
  if (!weights) return NextResponse.json({ error: "weights is required" }, { status: 400 });
  try {
    const requirement = updateWeights(params.id, weights, { type: "pm", id: "pm_demo", name: "Product Manager" });
    return NextResponse.json(requirement);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
