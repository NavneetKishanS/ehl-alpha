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
  VehicleComponent,
  Vehicle,
} from "@/lib/types";
import { PipelineStrip } from "@/components/PipelineStrip";
import { RequirementCard } from "@/components/RequirementCard";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { ReviewerRow } from "@/components/ReviewerRow";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { SensitivityView } from "@/components/SensitivityView";

const SENTIMENT_DOT: Record<Signal["sentiment"], string> = {
  positive: "bg-emerald-500",
  negative: "bg-red-500",
  mixed: "bg-sky-500",
  neutral: "bg-neutral-600",
};

export default function WorkflowPage() {
  const params = useParams<{ componentId: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [component, setComponent] = useState<VehicleComponent | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
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
    const [comp, wf] = await Promise.all([api.getComponent(params.componentId), api.getWorkflowByComponent(params.componentId)]);
    setComponent(comp);
    if (!wf) {
      setNotFound(true);
      return;
    }
    setWorkflow(wf);
    const [reqs, log, summaries, revs, shs, sig, veh] = await Promise.all([
      api.listRequirements(wf.id),
      api.getAuditLog(wf.id),
      api.getAISummaries(wf.id),
      api.listReviews(wf.id),
      api.listStakeholders(),
      api.getSignals(wf.id),
      api.getVehicle(wf.vehicleId),
    ]);
    setRequirements(reqs);
    setAuditLog(log);
    setAISummaries(summaries);
    setReviews(revs);
    setStakeholders(shs);
    setSignals([...sig.signals].sort((a, b) => b.frequency - a.frequency));
    setSources(sig.sources);
    setVehicle(veh);
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

  const selectedReq =
    requirements.find((r) => r.id === selectedReqId) ??
    requirements.find((r) => reviews.some((rv) => rv.requirementId === r.id)) ??
    requirements[0] ??
    null;
  const selectedReviews = selectedReq ? reviews.filter((r) => r.requirementId === selectedReq.id) : [];
  const totalMentions = signals.reduce((a, s) => a + s.frequency, 0);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">← All components</Link>
          <h1 className="mt-1 text-xl font-bold text-neutral-50">
            {vehicle?.name ?? "…"} · {component?.label ?? "…"}
          </h1>
          <p className="font-mono text-xs text-neutral-500">
            market={workflow.market} · status={workflow.status} · {totalMentions.toLocaleString()} verbatims across {signals.length} themes
          </p>
        </div>
        <Link
          href={`/evidence?vehicleCode=${vehicle?.id?.replace("veh_", "").toUpperCase()}&component=${component?.key}`}
          className="shrink-0 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
        >
          Open Evidence Explorer →
        </Link>
      </div>

      <section className="mb-6 border border-neutral-800 bg-neutral-900/40 p-4">
        <PipelineStrip stages={workflow.stages} />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          {decisionTrail && (
            <section className="border-l-2 border-sky-600 bg-sky-950/20 p-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-wide text-sky-400">AI summary · decision trail</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{decisionTrail.content}</p>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Requirements ({requirements.length})
            </h2>
            <div className="space-y-3">
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

          <SensitivityView requirements={requirements} />

          {selectedReq && (
            <section className="border border-neutral-800 bg-neutral-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Stakeholder reviews — {selectedReq.title}
                </h2>
                <EvidenceBadge level={selectedReq.evidenceLevel} />
              </div>
              {stakeholderOverview && (
                <p className="mb-2 border-l-2 border-violet-600 bg-violet-950/20 p-2 text-[11px] text-violet-200">
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

          <section className="border border-neutral-800 bg-neutral-900/40 p-3">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Evidence &amp; sources — {signals.length} real feedback themes
            </h2>
            <div className="divide-y divide-neutral-800">
              {signals.map((sig) => (
                <details key={sig.id} className="group py-1.5">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs text-neutral-300 hover:text-neutral-100">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT_DOT[sig.sentiment]}`} />
                    <span className="flex-1">{sig.theme}</span>
                    <span className="font-mono text-[10px] text-neutral-600">{sig.frequency}× · {sig.sentiment}</span>
                  </summary>
                  <ul className="mt-1.5 space-y-1 pl-5 text-[11px] text-neutral-500">
                    {sig.sourceIds
                      .map((id) => sources.find((s) => s.id === id))
                      .filter(Boolean)
                      .slice(0, 8)
                      .map((s) => (
                        <li key={s!.id}>
                          <span className="font-mono text-neutral-600">[{s!.datasetType}/{s!.reliability}{s!.country ? `/${s!.country}` : ""}]</span> {s!.excerpt}
                        </li>
                      ))}
                  </ul>
                </details>
              ))}
              {signals.length === 0 && <p className="text-xs text-neutral-600">No signals extracted yet.</p>}
            </div>
          </section>

          {limitations && (
            <section className="border-l-2 border-amber-600 bg-amber-950/20 p-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Limitations</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{limitations.content}</p>
            </section>
          )}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Audit trail ({auditLog.length})
          </h2>
          <AuditLogPanel entries={auditLog} />
        </aside>
      </div>
    </main>
  );
}
