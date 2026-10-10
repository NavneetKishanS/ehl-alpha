import { NextRequest, NextResponse } from "next/server";
import { getWorkflow } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const workflow = getWorkflow(params.id);
  if (!workflow) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(workflow);
}
