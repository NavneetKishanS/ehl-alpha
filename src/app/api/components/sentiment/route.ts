import { NextRequest, NextResponse } from "next/server";
import { hasRealData, loadFeedback } from "@/lib/realData";
import type { ComponentSentiment } from "@/lib/types";

// Likes vs. complaints (Difficult to Use + Defect) per component for one
// vehicle, from the real ingested feedback. Drives the hotspot colours.
export async function GET(req: NextRequest) {
  const vehicleId = req.nextUrl.searchParams.get("vehicleId") ?? "";
  const code = vehicleId.replace(/^veh_/, "").toUpperCase();
  const out: Record<string, ComponentSentiment> = {};
  if (!hasRealData() || !code) return NextResponse.json(out);
  for (const r of loadFeedback()) {
    if (r.vehicleCode !== code) continue;
    const s = (out[r.component] ??= { likes: 0, complaints: 0 });
    if (r.feedbackType === "Likes") s.likes++;
    else if (r.feedbackType === "Difficult to Use" || r.feedbackType === "Defect") s.complaints++;
  }
  return NextResponse.json(out);
}
