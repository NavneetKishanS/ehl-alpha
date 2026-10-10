"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Workflow, Requirement, StakeholderReview, Stakeholder, AISummary } from "@/lib/types";
import { EvidenceBadge } from "@/components/EvidenceBadge";

export default function StakeholderPage() {
  const params = useParams<{ workflowId: string; stakeholderId: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [reviews, setReviews] = useState<StakeholderReview[]>([]);
  const [stakeholder, setStakeholder] = useState<Stakeholder | null>(null);
  const [aiSummaries, setAISummaries] = useState<AISummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [wf, shs] = await Promise.all([api.getWorkflow(params.workflowId), api.listStakeholders()]);
    setWorkflow(wf);
    setStakeholder(shs.find((s) => s.id === params.stakeholderId) ?? null);
    const [reqs, revs, summaries] = await Promise.all([
      api.listRequirements(wf.id),
      api.listReviews(wf.id),
      api.getAISummaries(wf.id),
    ]);
    setRequirements(reqs);
    setReviews(revs.filter((r) => r.stakeholderId === params.stakeholderId));
    setAISummaries(summaries);
  }, [params.workflowId, params.stakeholderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submit(review: StakeholderReview, decision: "approve" | "reject") {
    setBusyId(review.id);
    try {
      await api.submitReview(review.id, decision, drafts[review.id] ?? review.expertOpinion);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (!workflow || !stakeholder) {
    return <main className="px-6 py-16 text-center text-neutral-500">Loading…</main>;
  }

  const decisionTrail = aiSummaries.find((s) => s.type === "decision_trail");

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bmw-blue">Stakeholder review</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-50">
          {workflow.componentId.replace("comp_", "").replace(/_/g, " ")} · {workflow.market}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Signed in as <span className="font-medium text-neutral-300">{stakeholder.name}</span> ({stakeholder.expertise.replace(/_/g, " ")})
        </p>
      </header>

      {decisionTrail && (
        <section className="mb-6 rounded-xl border border-sky-400/20 bg-sky-500/5 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-300">Summary so far</h2>
          <p className="mt-2 text-sm text-neutral-200">{decisionTrail.content}</p>
        </section>
      )}

      <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Requirements, PM requirements &amp; evidence
        </h2>
        <div className="space-y-3">
          {requirements.map((req) => (
            <div key={req.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-neutral-200">{req.title}</h3>
                <EvidenceBadge level={req.evidenceLevel} />
              </div>
              <p className="mt-1 text-xs text-neutral-400">{req.description}</p>
              <div className="mt-2 flex gap-4 text-xs text-neutral-500">
                <span>Score: <span className="text-neutral-300">{req.score.toFixed(1)}</span></span>
                <span>Category: {req.category.replace(/_/g, " ")}</span>
                <span>Effort: {req.effort}</span>
              </div>
              {/* simple bar "chart" from real score factors, per the brief's "any other metrics in charts" */}
              <div className="mt-3 space-y-1">
                {req.scoreFactors.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 text-[11px]">
                    <span className="w-32 shrink-0 text-neutral-500">{f.label}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-bmw-blue"
                        style={{ width: `${f.rawValue}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-neutral-400">{f.rawValue}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Your review</h2>
        <div className="space-y-4">
          {reviews.map((review) => {
            const req = requirements.find((r) => r.id === review.requirementId);
            const isSubmitted = review.decision !== "pending";
            return (
              <div key={review.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-sm font-medium text-neutral-200">{req?.title ?? "General workflow review"}</h3>
                <textarea
                  defaultValue={review.expertOpinion}
                  onChange={(e) => setDrafts((d) => ({ ...d, [review.id]: e.target.value }))}
                  disabled={isSubmitted}
                  placeholder="Your expert opinion…"
                  rows={3}
                  className="mt-3 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 disabled:opacity-60"
                />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => submit(review, "approve")}
                    disabled={isSubmitted || busyId === review.id}
                    className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => submit(review, "reject")}
                    disabled={isSubmitted || busyId === review.id}
                    className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
                  >
                    Not approve
                  </button>
                  {isSubmitted && (
                    <span className="ml-auto text-xs text-neutral-500">
                      Submitted {review.submittedAt ? new Date(review.submittedAt).toLocaleString() : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {reviews.length === 0 && (
            <p className="text-sm text-neutral-500">No reviews are currently assigned to you for this workflow.</p>
          )}
        </div>
      </section>
    </main>
  );
}
