import { NextRequest, NextResponse } from "next/server";
import { createWorkflow } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { componentId, market } = body as { componentId: string; market: string };
  if (!componentId || !market) {
    return NextResponse.json({ error: "componentId and market are required" }, { status: 400 });
  }
  try {
    const workflow = createWorkflow(componentId, market);
    return NextResponse.json(workflow, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
