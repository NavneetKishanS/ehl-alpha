import { NextRequest, NextResponse } from "next/server";
import { listReviews } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json(listReviews(params.id));
}
