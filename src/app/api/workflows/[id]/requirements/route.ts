import { NextRequest, NextResponse } from "next/server";
import { listRequirements } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json(listRequirements(params.id));
}
