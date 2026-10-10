import { NextRequest, NextResponse } from "next/server";
import { listSignals, listSources } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({
    signals: listSignals(params.id),
    sources: listSources(params.id),
  });
}
