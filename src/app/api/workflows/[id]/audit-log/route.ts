import { NextRequest, NextResponse } from "next/server";
import { getAuditLog } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json(getAuditLog(params.id));
}
