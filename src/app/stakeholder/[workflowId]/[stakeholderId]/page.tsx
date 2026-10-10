"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Workflow, Requirement, StakeholderReview, Stakeholder, AISummary, VehicleComponent, Vehicle, CustomerStudyScore } from "@/lib/types";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { MetricBar } from "@/components/charts/MetricBar";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { RoleSwitcher } from "@/components/RoleSwitcher";

export default function StakeholderPage() {
  const params = useParams<{ workflowId: string; stakeholderId: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [component, setComponent] = useState<VehicleComponent | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [reviews, setReviews] = useState<StakeholderReview[]>([]);
  const [stakeholder, setStakeholder] = useState<Stakeholder | null>(null);
  const [allStakeholders, setAllStakeholders] = useState<Stakeholder[]>([]);
  const [aiSummaries, setAISummaries] = useState<AISummary[]>([]);
  const [study, setStudy] = useState<CustomerStudyScore[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [wf, shs] = await Promise.all([api.getWorkflow(params.workflowId), api.listStakeholders()]);
    setWorkflow(wf);
    setStakeholder(shs.find((s) => s.id === params.stakeholderId) ?? null);
    setAllStakeholders(shs);
    const [reqs, revs, summaries, comp, veh, cs] = await Promise.all([
      api.listRequirements(wf.id),
      api.listReviews(wf.id),
      api.getAISummaries(wf.id),
      api.getComponent(wf.componentId),
      api.getVehicle(wf.vehicleId),
      api.getCustomerStudy(wf.id),
    ]);
    setRequirements(reqs);
    setReviews(revs.filter((r) => r.stakeholderId === params.stakeholderId));
    setAISummaries(summaries);
    setComponent(comp);
    setVehicle(veh);
    setStudy(cs);
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
  const studyByCategory = groupBy(study, (r) => r.category);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <header className="mb-6 border-b border-neutral-800 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bmw-blue">Stakeholder review</p>
            <h1 className="mt-1 text-xl font-bold text-neutral-50">
              {vehicle?.name ?? "…"} · {component?.label ?? "…"} · {workflow.market}
            </h1>
            <p className="mt-1 text-xs text-neutral-500">
              Signed in as <span className="font-medium text-neutral-300">{stakeholder.name}</span> ({stakeholder.expertise.replace(/_/g, " ")})
            </p>
          </div>
          {component && (
            <RoleSwitcher
              componentId={component.id}
              workflowId={workflow.id}
              stakeholders={allStakeholders}
              current={{ type: "stakeholder", stakeholderId: stakeholder.id }}
              variant="dark"
            />
          )}
        </div>
      </header>

      {decisionTrail && (
        <section className="mb-5 border-l-2 border-sky-600 bg-sky-950/20 p-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-wide text-sky-400">Summary so far</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{decisionTrail.content}</p>
        </section>
      )}

      {Object.keys(studyByCategory).length > 0 && (
        <section className="mb-5 border border-neutral-800 bg-neutral-900/40 p-3">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Customer study — how we compare (0-10 mean, by model/region)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(studyByCategory).map(([category, rows]) => (
              <div key={category}>
                <p className="mb-1 text-[11px] text-neutral-400">{category}</p>
                <GroupedBarChart
                  data={rows.map((r) => ({ label: `${r.model} ${r.region}`, value: r.mean, sub: r.methodology === "distribution_derived" ? "est." : undefined }))}
                  highlightLabel={vehicle?.name?.match(/\d/)?.[0]}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-neutral-600">
            &quot;est.&quot; = reconstructed from a satisfaction-bucket distribution (US methodology), lower precision than the direct CN/EU mean.
          </p>
        </section>
      )}

      <section className="mb-5 border border-neutral-800 bg-neutral-900/40 p-3">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Requirements, PM requirements &amp; evidence
        </h2>
        <div className="space-y-2">
          {requirements.map((req) => (
            <div key={req.id} className="border border-neutral-800 bg-black/20 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium text-neutral-200">{req.title}</h3>
                <EvidenceBadge level={req.evidenceLevel} />
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">{req.description}</p>
              <div className="mt-1.5 flex gap-3 font-mono text-[10px] text-neutral-600">
                <span>score={req.score.toFixed(1)}</span>
                <span>category={req.category}</span>
                <span>effort={req.effort}</span>
              </div>
              <div className="mt-2">
                {req.scoreFactors.map((f) => (
                  <MetricBar key={f.key} label={f.label} value={f.rawValue} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Your review</h2>
        <div className="space-y-3">
          {reviews.map((review) => {
            const req = requirements.find((r) => r.id === review.requirementId);
            const isSubmitted = review.decision !== "pending";
            return (
              <div key={review.id} className="border border-neutral-800 bg-neutral-900/40 p-3">
                <h3 className="text-xs font-medium text-neutral-200">{req?.title ?? "General workflow review"}</h3>
                <textarea
                  defaultValue={review.expertOpinion}
                  onChange={(e) => setDrafts((d) => ({ ...d, [review.id]: e.target.value }))}
                  disabled={isSubmitted}
                  placeholder="Your expert opinion…"
                  rows={3}
                  className="mt-2 w-full border border-neutral-700 bg-black/30 px-2.5 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 disabled:opacity-60"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => submit(review, "approve")}
                    disabled={isSubmitted || busyId === review.id}
                    className="bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => submit(review, "reject")}
                    disabled={isSubmitted || busyId === review.id}
                    className="bg-red-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                  >
                    Not approve
                  </button>
                  {isSubmitted && (
                    <span className="ml-auto font-mono text-[10px] text-neutral-600">
                      submitted {review.submittedAt ? new Date(review.submittedAt).toLocaleString() : ""}
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

function groupBy<T, K extends string>(arr: T[], fn: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of arr) {
    const key = fn(item);
    (out[key] ??= []).push(item);
  }
  return out;
}
