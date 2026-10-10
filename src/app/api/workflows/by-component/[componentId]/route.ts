import { NextRequest, NextResponse } from "next/server";
import { getWorkflowByComponent } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { componentId: string } }) {
  const workflow = getWorkflowByComponent(params.componentId);
  if (!workflow) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(workflow);
}
