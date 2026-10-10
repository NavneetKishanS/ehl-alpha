import { NextRequest, NextResponse } from "next/server";
import { hasRealData, loadFeedback } from "@/lib/realData";
import { countryToMarket, type MarketCode } from "@/lib/market";

// Serves the raw ingested feedback for the Evidence Explorer (US-8.1/8.4
// style traceability, one level below the aggregated Signal). Filters +
// paginates in memory — fine at ~14k rows for a hackathon demo; the first
// thing to change if this ever needs to scale past that is an index, not a
// different endpoint shape.
export async function GET(req: NextRequest) {
  if (!hasRealData()) {
    return NextResponse.json({ total: 0, page: 1, pageSize: 50, rows: [], noData: true });
  }
  const sp = req.nextUrl.searchParams;
  const vehicleCode = sp.get("vehicleCode");
  const component = sp.get("component");
  const feedbackType = sp.get("feedbackType");
  const country = sp.get("country");
  const market = sp.get("market") as MarketCode | null;
  const q = sp.get("q")?.toLowerCase();
  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? "50")));

  let rows = loadFeedback();
  if (vehicleCode) rows = rows.filter((r) => r.vehicleCode === vehicleCode);
  if (component) rows = rows.filter((r) => r.component === component);
  if (feedbackType) rows = rows.filter((r) => r.feedbackType === feedbackType);
  if (country) rows = rows.filter((r) => r.country === country);
  if (market) rows = rows.filter((r) => countryToMarket(r.country) === market);
  if (q) rows = rows.filter((r) => r.text.toLowerCase().includes(q) || (r.vfcLevel2 ?? "").toLowerCase().includes(q));

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return NextResponse.json({ total, page, pageSize, rows: pageRows });
}
