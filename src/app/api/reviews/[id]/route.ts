import { NextRequest, NextResponse } from "next/server";
import { submitReview } from "@/lib/db";
import type { ReviewDecision } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { decision, expertOpinion } = body as { decision: ReviewDecision; expertOpinion: string };
  if (!decision || decision === "pending") {
    return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
  }
  try {
    const review = submitReview(params.id, decision, expertOpinion ?? "");
    return NextResponse.json(review);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
