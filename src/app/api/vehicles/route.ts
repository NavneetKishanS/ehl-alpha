import { NextResponse } from "next/server";
import { listVehicles } from "@/lib/db";

export async function GET() {
  return NextResponse.json(listVehicles());
}
