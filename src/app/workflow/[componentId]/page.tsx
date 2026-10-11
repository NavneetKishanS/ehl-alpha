"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
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
import { SiteHeader } from "@/components/SiteHeader";
import { StakeholderAvatar } from "@/components/StakeholderAvatar";
import { PipelineStrip } from "@/components/PipelineStrip";
import { RequirementCard } from "@/components/RequirementCard";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { ReviewerRow } from "@/components/ReviewerRow";
import { SignalBreakdown } from "@/components/workflow/SignalBreakdown";
import { EvidenceMeter, SectionTitle, humanize } from "@/components/workflow/primitives";
import { SensitivityView } from "@/components/SensitivityView";
import { StakeholderMatrix } from "@/components/StakeholderMatrix";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { AssignReviewers } from "@/components/AssignReviewers";

const WORKFLOW_STATUS: Record<Workflow["status"], string> = {
  draft: "bg-neutral-100 text-neutral-700",
  analyzing: "bg-[#eef4fc] text-bmw-blue",
  stakeholder_review: "bg-amber-50 text-amber-800",
  pm_review: "bg-[#eef4fc] text-bmw-blue",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  archived: "bg-neutral-100 text-neutral-500",
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
      <div className="min-h-screen bg-white text-neutral-900">
        <SiteHeader active="workflow" />
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">{component?.label ?? "Component"}</p>
          <h1 className="mt-3 text-3xl font-light tracking-tight">No workflow exists yet</h1>
          <p className="mt-3 text-[15px] text-neutral-600">Start one from the vehicle overview to derive requirements for this component.</p>
          <Link href="/" className="mt-8 inline-block bg-bmw-blue px-6 py-3 text-sm font-medium text-white hover:bg-[#0653b6]">
            Back to vehicle overview
          </Link>
        </div>
      </div>
    );
  }

  if (!workflow) return <LoadingState />;

  const decisionTrail = aiSummaries.find((s) => s.type === "decision_trail");
  const stakeholderOverview = aiSummaries.find((s) => s.type === "stakeholder_overview");
  const limitations = aiSummaries.find((s) => s.type === "limitations");

  const ranked = [...requirements].sort((a, b) => b.score - a.score);
  const selectedReq =
    requirements.find((r) => r.id === selectedReqId) ??
    ranked.find((r) => reviews.some((rv) => rv.requirementId === r.id)) ??
    ranked[0] ??
    null;
  const selectedReviews = selectedReq ? reviews.filter((r) => r.requirementId === selectedReq.id) : [];
  const totalMentions = signals.reduce((a, s) => a + s.frequency, 0);
  const decided = requirements.filter((r) => r.status !== "proposed").length;
  const vehicleCode = vehicle?.id?.replace("veh_", "").toUpperCase();
  const evidenceHref = `/evidence?vehicleCode=${vehicleCode ?? ""}&component=${component?.key ?? ""}`;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader active="workflow" workflowHref={`/workflow/${params.componentId}`} />

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_70%_0%,#ffffff_0%,#eef0f2_50%,#dde1e5_100%)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-6 right-0 select-none whitespace-nowrap text-[18vw] font-semibold uppercase leading-none tracking-tighter text-transparent opacity-[0.07] [-webkit-text-stroke:2px_#0a0a0a] lg:text-[13vw]"
        >
          {component?.key ?? ""}
        </span>
        <div className="relative mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex flex-wrap items-center gap-2 text-[13px] text-neutral-500">
              <Link href="/" className="hover:text-neutral-900">Vehicles</Link>
              <span>/</span>
              <Link href="/" className="hover:text-neutral-900">{vehicle?.name ?? "…"}</Link>
              <span>/</span>
              <span className="text-neutral-900">{component?.label ?? "…"}</span>
            </nav>
            <RoleSwitcher
              componentId={component?.id ?? ""}
              workflowId={workflow.id}
              stakeholders={stakeholders}
              current={{ type: "pm" }}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-bmw-blue">Requirements workflow</p>
                <span className={clsx("px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", WORKFLOW_STATUS[workflow.status])}>
                  {humanize(workflow.status)}
                </span>
              </div>
              <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-6xl">{component?.label ?? "…"}</h1>
              <p className="mt-3 text-base text-neutral-600 sm:text-lg">
                {vehicle?.name ?? "…"} <span className="text-neutral-400">·</span> {vehicle?.generation ?? ""}{" "}
                <span className="text-neutral-400">·</span> Market: <span className="text-neutral-900">{workflow.market}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="border border-neutral-300 bg-white/80 px-5 py-3 text-sm font-medium text-neutral-800 backdrop-blur transition-colors hover:border-neutral-900">
                All components
              </Link>
              <Link href="/spec" className="border border-neutral-300 bg-white/80 px-5 py-3 text-sm font-medium text-neutral-800 backdrop-blur transition-colors hover:border-neutral-900">
                Export spec
              </Link>
              <Link href={evidenceHref} className="bg-bmw-blue px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0653b6]">
                Open Evidence Explorer →
              </Link>
            </div>
          </div>

          <dl className="mt-10 grid max-w-4xl grid-cols-2 gap-y-6 sm:grid-cols-4">
            <Kpi label="Customer verbatims" value={totalMentions.toLocaleString()} />
            <Kpi label="Feedback themes" value={String(signals.length)} />
            <Kpi label="Draft requirements" value={String(requirements.length)} />
            <Kpi label="Decided" value={`${decided} / ${requirements.length}`} />
          </dl>
        </div>
      </section>

      {/* ---------- Pipeline ---------- */}
      <div className="relative mx-auto -mt-14 max-w-[1440px] px-4 sm:px-8">
        <section className="border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-8">
          <PipelineStrip stages={workflow.stages} />
        </section>
      </div>

      {/* ---------- Body ---------- */}
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-8 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 space-y-14">
          {decisionTrail && (
            <section className="relative overflow-hidden bg-neutral-950 p-7 text-white sm:p-8">
              <span className="absolute inset-y-0 left-0 w-[3px] bg-bmw-blue" />
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bmw-blue text-[12px] font-semibold">AI</span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">Kompass summary · decision trail</p>
              </div>
              <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-neutral-200">{decisionTrail.content}</p>
              <p className="mt-4 text-[11px] text-neutral-500">
                Generated from {decisionTrail.basedOnLogIds.length} audit entries · {new Date(decisionTrail.generatedAt).toLocaleString()}
              </p>
            </section>
          )}

          <section>
            <SectionTitle
              eyebrow="Ranked by weighted score"
              title={`Draft requirements (${requirements.length})`}
              aside={<p className="text-[13px] text-neutral-500">Select a requirement to see its stakeholder reviews.</p>}
            />
            <div className="space-y-5">
              {ranked.map((req, i) => (
                <div key={req.id}>
                  <RequirementCard
                    rank={i + 1}
                    requirement={req}
                    selected={selectedReq?.id === req.id}
                    onSelect={() => setSelectedReqId(req.id)}
                    onChanged={onRequirementChanged}
                  />
                  <AssignReviewers
                    requirementId={req.id}
                    allStakeholders={stakeholders}
                    existingReviews={reviews}
                    onAssigned={refresh}
                  />
                </div>
              ))}
              {requirements.length === 0 && (
                <div className="border border-dashed border-neutral-300 bg-white p-10 text-center text-[14px] text-neutral-500">No requirements derived yet.</div>
              )}
            </div>
          </section>

          <SensitivityView requirements={requirements} />

          <StakeholderMatrix
            requirements={requirements}
            reviews={reviews}
            stakeholders={stakeholders}
            selectedReqId={selectedReq?.id ?? null}
            onSelectRequirement={setSelectedReqId}
          />

          <section>
            <SectionTitle
              eyebrow="Evidence & sources"
              title="What customers are saying"
              aside={
                <p className="text-[13px] text-neutral-500">
                  {totalMentions.toLocaleString()} verbatims · {signals.length} themes · click a theme for quotes
                </p>
              }
            />
            <div className="border border-neutral-200 bg-white p-5 sm:p-8">
              <SignalBreakdown signals={signals} sources={sources} evidenceHref={(theme) => `${evidenceHref}&q=${encodeURIComponent(theme)}`} />
            </div>
          </section>

          {limitations && (
            <section className="flex gap-4 border-l-[3px] border-amber-500 bg-amber-50 p-6">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[12px] font-bold text-white">!</span>
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-800">Limitations</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-amber-950">{limitations.content}</p>
              </div>
            </section>
          )}
        </main>

        {/* ---------- Sidebar ---------- */}
        {/* Pinned to the viewport on desktop: both cards scroll internally instead of being clipped. */}
        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start">
          {selectedReq && (
            <section className="flex shrink-0 flex-col border border-neutral-200 bg-white lg:max-h-[45vh]">
              <div className="shrink-0 border-b border-neutral-100 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Stakeholder review</p>
                <h2 className="mt-2 text-[15px] font-medium leading-snug text-neutral-900">{selectedReq.title}</h2>
                <div className="mt-2">
                  <EvidenceMeter level={selectedReq.evidenceLevel} />
                </div>
              </div>
              <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
                {stakeholderOverview && (
                  <p className="mb-4 bg-[#eef4fc] p-3 text-[13px] leading-relaxed text-[#1d3d6b]">
                    <span className="font-semibold">Kompass overview: </span>
                    {stakeholderOverview.content}
                  </p>
                )}
                {selectedReviews.map((rev) => (
                  <ReviewerRow key={rev.id} review={rev} stakeholder={stakeholders.find((s) => s.id === rev.stakeholderId)} />
                ))}
                {selectedReviews.length === 0 && (
                  <div className="flex items-center gap-3 text-[13px] text-neutral-500">
                    <span className="flex -space-x-2">
                      {stakeholders.slice(0, 4).map((s) => (
                        <span key={s.id} className="rounded-full opacity-50 ring-2 ring-white">
                          <StakeholderAvatar stakeholder={s} size={28} />
                        </span>
                      ))}
                    </span>
                    No reviews requested for this requirement yet.
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="flex max-h-[600px] min-h-[220px] flex-col border border-neutral-200 bg-white p-5 lg:max-h-none lg:min-h-0 lg:flex-1">
            <div className="mb-4 flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Audit trail</p>
              <span className="text-[12px] text-neutral-400">{auditLog.length} entries</span>
            </div>
            <AuditLogPanel entries={auditLog} />
          </section>
        </aside>
      </div>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-neutral-500 sm:px-8">
          <span>BMW Group · PM Kompass · TUM Hackathon prototype</span>
          <Link href="/" className="hover:text-neutral-900">← Back to vehicle overview</Link>
        </div>
      </footer>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-neutral-300 pl-4">
      <dt className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">{label}</dt>
      <dd className="mt-1 text-3xl font-light tabular-nums tracking-tight text-neutral-900">{value}</dd>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <SiteHeader active="workflow" />
      <div className="bg-[radial-gradient(120%_120%_at_70%_0%,#ffffff_0%,#eef0f2_50%,#dde1e5_100%)]">
        <div className="mx-auto max-w-[1440px] animate-pulse px-4 pb-24 pt-10 sm:px-8">
          <div className="h-3 w-48 bg-neutral-300/60" />
          <div className="mt-10 h-12 w-96 max-w-full bg-neutral-300/60" />
          <div className="mt-4 h-4 w-72 bg-neutral-300/50" />
        </div>
      </div>
      <div className="mx-auto -mt-14 max-w-[1440px] px-4 sm:px-8">
        <div className="h-40 animate-pulse border border-neutral-200 bg-white" />
      </div>
    </div>
  );
}
