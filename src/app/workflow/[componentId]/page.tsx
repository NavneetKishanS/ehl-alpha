"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";
import type {
  Workflow,
  Requirement,
  AuditLogEntry,
  AISummary,
  StakeholderReview,
  Stakeholder,
  Signal,
  SourceRecord,
} from "@/lib/types";
import { PipelineStrip } from "@/components/PipelineStrip";
import { RequirementCard } from "@/components/RequirementCard";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { ReviewerRow } from "@/components/ReviewerRow";
import { EvidenceBadge } from "@/components/EvidenceBadge";

export default function WorkflowPage() {
  const params = useParams<{ componentId: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [aiSummaries, setAISummaries] = useState<AISummary[]>([]);
  const [reviews, setReviews] = useState<StakeholderReview[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    const wf = await api.getWorkflowByComponent(params.componentId);
    if (!wf) {
      setNotFound(true);
      return;
    }
    setWorkflow(wf);
    const [reqs, log, summaries, revs, shs, sig] = await Promise.all([
      api.listRequirements(wf.id),
      api.getAuditLog(wf.id),
      api.getAISummaries(wf.id),
      api.listReviews(wf.id),
      api.listStakeholders(),
      api.getSignals(wf.id),
    ]);
    setRequirements(reqs);
    setAuditLog(log);
    setAISummaries(summaries);
    setReviews(revs);
    setStakeholders(shs);
    setSignals(sig.signals);
    setSources(sig.sources);
  }, [params.componentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function onRequirementChanged(updated: Requirement) {
    setRequirements((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    refresh(); // pick up new audit log / summary entries
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-neutral-400">No workflow exists for this component yet.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-sky-400 hover:text-sky-300">
          ← Back to landing page
        </Link>
      </main>
    );
  }

  if (!workflow) {
    return <main className="px-6 py-16 text-center text-neutral-500">Loading…</main>;
  }

  const decisionTrail = aiSummaries.find((s) => s.type === "decision_trail");
  const stakeholderOverview = aiSummaries.find((s) => s.type === "stakeholder_overview");
  const limitations = aiSummaries.find((s) => s.type === "limitations");

  const selectedReq = requirements.find((r) => r.id === selectedReqId) ?? requirements[0] ?? null;
  const selectedReviews = selectedReq ? reviews.filter((r) => r.requirementId === selectedReq.id) : [];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">← All components</Link>
          <h1 className="mt-1 text-2xl font-bold text-neutral-50 capitalize">
            {workflow.componentId.replace("comp_", "").replace(/_/g, " ")} workflow
          </h1>
          <p className="text-sm text-neutral-500">Market: {workflow.market} · Status: {workflow.status.replace(/_/g, " ")}</p>
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <PipelineStrip stages={workflow.stages} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {decisionTrail && (
            <section className="rounded-xl border border-sky-400/20 bg-sky-500/5 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-sky-300">AI summary · decision trail</h2>
              <p className="mt-2 text-sm text-neutral-200">{decisionTrail.content}</p>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Requirements ({requirements.length})
            </h2>
            <div className="space-y-4">
              {requirements.map((req) => (
                <div key={req.id} onClick={() => setSelectedReqId(req.id)}>
                  <RequirementCard requirement={req} onChanged={onRequirementChanged} />
                </div>
              ))}
              {requirements.length === 0 && (
                <p className="text-sm text-neutral-500">No requirements derived yet.</p>
              )}
            </div>
          </section>

          {selectedReq && (
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                  Stakeholder reviews — {selectedReq.title}
                </h2>
                {stakeholderOverview && <EvidenceBadge level={selectedReq.evidenceLevel} />}
              </div>
              {stakeholderOverview && (
                <p className="mb-3 rounded-lg border border-violet-400/20 bg-violet-500/5 p-3 text-xs text-violet-200">
                  <span className="font-semibold">AI overview: </span>
                  {stakeholderOverview.content}
                </p>
              )}
              <div className="space-y-2">
                {selectedReviews.map((rev) => (
                  <ReviewerRow key={rev.id} review={rev} stakeholder={stakeholders.find((s) => s.id === rev.stakeholderId)} />
                ))}
                {selectedReviews.length === 0 && (
                  <p className="text-xs text-neutral-500">No reviews requested for this requirement yet.</p>
                )}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Evidence &amp; sources ({sources.length})
            </h2>
            <div className="space-y-2">
              {signals.map((sig) => (
                <details key={sig.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-neutral-200">
                    {sig.theme} <span className="text-xs text-neutral-500">({sig.frequency} mentions, {sig.sentiment})</span>
                  </summary>
                  <ul className="mt-2 space-y-1 pl-4 text-xs text-neutral-400">
                    {sig.sourceIds
                      .map((id) => sources.find((s) => s.id === id))
                      .filter(Boolean)
                      .map((s) => (
                        <li key={s!.id}>
                          <span className="text-neutral-500">[{s!.datasetType}/{s!.reliability}]</span> {s!.title}: {s!.excerpt}
                        </li>
                      ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          {limitations && (
            <section className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-300">Limitations panel</h2>
              <p className="mt-2 text-sm text-neutral-200">{limitations.content}</p>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Audit trail ({auditLog.length})
          </h2>
          <AuditLogPanel entries={auditLog} />
        </aside>
      </div>
    </main>
  );
}
