import { NextRequest, NextResponse } from "next/server";
import { PinguConfigError, runPingu } from "@/lib/pingu/chat";
import { hasPinguData } from "@/lib/pingu/context";
import type { ChatTurn } from "@/lib/pingu/types";

export const dynamic = "force-dynamic";

// Pingu: the chat assistant that answers from the ingested src/data/*.json.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { messages?: ChatTurn[] } | null;
  const messages = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "messages must end with a user message" }, { status: 400 });
  }
  if (!hasPinguData()) {
    return NextResponse.json(
      { error: "No ingested data found in src/data/. Run `npm run ingest` first (see docs/DATA_SETUP.md)." },
      { status: 503 },
    );
  }
  try {
    return NextResponse.json(await runPingu(messages));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: err instanceof PinguConfigError ? 503 : 502 });
  }
}
