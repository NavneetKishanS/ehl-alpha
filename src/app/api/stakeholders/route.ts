import { NextResponse } from "next/server";
import { listStakeholders } from "@/lib/db";

export async function GET() {
  return NextResponse.json(listStakeholders());
}
