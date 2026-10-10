import { NextRequest, NextResponse } from "next/server";
import { listComponents } from "@/lib/db";

export async function GET(req: NextRequest) {
  const vehicleId = req.nextUrl.searchParams.get("vehicleId");
  if (!vehicleId) {
    return NextResponse.json({ error: "vehicleId is required" }, { status: 400 });
  }
  return NextResponse.json(listComponents(vehicleId));
}
