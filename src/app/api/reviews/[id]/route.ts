import { NextRequest, NextResponse } from "next/server";
import { submitReview } from "@/lib/db";
import { regenerateDecisionTrail, regenerateStakeholderOverview } from "@/lib/aiSummaries";
import type { ReviewDecision, StakeholderReview } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { decision, expertOpinion } = body as { decision: ReviewDecision; expertOpinion: string };
  if (!decision || decision === "pending") {
    return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
  }
  let review: StakeholderReview;
  try {
    review = submitReview(params.id, decision, expertOpinion ?? "");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
  // A new review changes both who-says-what and the overall decision trail.
  await Promise.all([
    regenerateStakeholderOverview(review.workflowId, review.requirementId),
    regenerateDecisionTrail(review.workflowId, review.requirementId),
  ]);
  return NextResponse.json(review);
}
