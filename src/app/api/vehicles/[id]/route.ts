import { NextRequest, NextResponse } from "next/server";
import { getVehicle } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const vehicle = getVehicle(params.id);
  if (!vehicle) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(vehicle);
}
