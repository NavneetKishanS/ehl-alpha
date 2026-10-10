import { NextRequest, NextResponse } from "next/server";
import { listAISummaries } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json(listAISummaries(params.id));
}
