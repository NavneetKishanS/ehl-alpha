import { NextResponse } from "next/server";
import { hasRealData, loadFeedback } from "@/lib/realData";

// Distinct filter values for the Evidence Explorer's dropdowns, with
// counts, computed from the real data rather than hardcoded — if a new
// vehicle or country shows up in a re-ingest, the filters pick it up for
// free.
export async function GET() {
  if (!hasRealData()) return NextResponse.json({ vehicleCodes: [], components: [], feedbackTypes: [], countries: [] });

  const rows = loadFeedback();
  const count = <T extends string>(values: (T | null)[]) => {
    const m = new Map<string, number>();
    for (const v of values) {
      if (!v) continue;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  };

  return NextResponse.json({
    vehicleCodes: count(rows.map((r) => r.vehicleCode)),
    components: count(rows.map((r) => r.component)),
    feedbackTypes: count(rows.map((r) => r.feedbackType)),
    countries: count(rows.map((r) => r.country)),
  });
}
