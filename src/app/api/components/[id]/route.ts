import { NextRequest, NextResponse } from "next/server";
import { getComponent } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const component = getComponent(params.id);
  if (!component) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(component);
}
