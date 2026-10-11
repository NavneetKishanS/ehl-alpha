import { NextRequest, NextResponse } from "next/server";
import { cacheSignalOverview, getSignal, getSourcesByIds } from "@/lib/db";
import { summarizeSignalOverview } from "@/lib/ai";

// Generated on demand (first expand of a theme on the workflow page), not
// precomputed for all ~550 real signals. Cached on the Signal after the
// first call, so a second click (or a page reload) is free.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const signal = getSignal(params.id);
  if (!signal) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (signal.aiOverview) return NextResponse.json(signal.aiOverview);

  const sources = getSourcesByIds(signal.sourceIds);
  const quotes = Array.from(new Set([...sources.map((s) => s.excerpt), ...signal.sampleVerbatims].filter(Boolean))).slice(0, 8);

  const result = await summarizeSignalOverview({
    theme: signal.theme,
    frequency: signal.frequency,
    sentiment: signal.sentiment,
    quotes,
  });

  const updated = cacheSignalOverview(
    signal.id,
    { content: result.text, model: result.model, live: result.live },
    { type: "ai", id: "ai_engine", name: "PM Kompass", model: result.model },
  );

  return NextResponse.json(updated.aiOverview);
}
