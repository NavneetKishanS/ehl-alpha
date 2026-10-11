import { NextResponse } from "next/server";
import { buildSpec } from "@/lib/spec/buildSpec";

export const dynamic = "force-dynamic";

// GET /api/vehicles/:id/spec — the vehicle-level requirements specification.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const spec = buildSpec(params.id);
  if (!spec) return NextResponse.json({ error: "vehicle not found" }, { status: 404 });
  return NextResponse.json(spec);
}
