"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { api } from "@/lib/api-client";
import type { Workflow, Requirement, StakeholderReview, Stakeholder, AISummary, VehicleComponent, Vehicle, CustomerStudyScore } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { StakeholderAvatar } from "@/components/StakeholderAvatar";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { Chip, EvidenceMeter, ScoreRing, SectionTitle, STATUS_CHIP, humanize } from "@/components/workflow/primitives";
import { StudyComparison } from "@/components/workflow/StudyComparison";
import { expertiseLabel } from "@/lib/stakeholderName";
import { isCategoryRelevant, isRelevantToStakeholder } from "@/lib/expertiseRelevance";

const DECISION_STYLE: Record<StakeholderReview["decision"], { chip: string; label: string }> = {
  approve: { chip: "bg-emerald-50 text-emerald-700", label: "Approved" },
  reject: { chip: "bg-red-50 text-red-700", label: "Not approved" },
  pending: { chip: "bg-amber-50 text-amber-800", label: "Awaiting your review" },
};

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
  const [notFound, setNotFound] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [wf, shs] = await Promise.all([api.getWorkflow(params.workflowId), api.listStakeholders()]);
      setWorkflow(wf);
      const me = shs.find((s) => s.id === params.stakeholderId) ?? null;
      setStakeholder(me);
      setAllStakeholders(shs);
      if (!me) setNotFound(true);
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
    } catch {
      setNotFound(true);
    }
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

  if (notFound) {
    return (
      <div className="min-h-screen bg-white text-neutral-900">
        <SiteHeader active="workflow" />
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Stakeholder review</p>
          <h1 className="mt-3 text-3xl font-light tracking-tight">This review link isn’t valid</h1>
          <p className="mt-3 text-[15px] text-neutral-600">The workflow or stakeholder couldn’t be found.</p>
          <Link href="/" className="mt-8 inline-block bg-bmw-blue px-6 py-3 text-sm font-medium text-white hover:bg-[#0653b6]">
            Back to vehicle overview
          </Link>
        </div>
      </div>
    );
  }

  if (!workflow || !stakeholder) return <LoadingState />;

  const decisionTrail = aiSummaries.find((s) => s.type === "decision_trail");
  const studyByCategory = groupBy(study, (r) => r.category);
  const ranked = [...requirements].sort((a, b) => b.score - a.score);
  const reviewFor = (reqId: string) => reviews.find((r) => r.requirementId === reqId);
  // Only show requirements in this stakeholder's domain, plus anything explicitly assigned to them (see lib/expertiseRelevance).
  const assignedIds = new Set(reviews.map((r) => r.requirementId));
  const relevant = ranked.filter((r) => isRelevantToStakeholder(r.category, stakeholder.expertise, assignedIds.has(r.id)));
  const visible = showAll ? ranked : relevant;
  const hiddenCount = ranked.length - relevant.length;
  const generalReviews = reviews.filter((r) => !r.requirementId || !requirements.some((q) => q.id === r.requirementId));
  const submitted = reviews.filter((r) => r.decision !== "pending").length;
  const pending = reviews.length - submitted;
  const [firstName, role] = stakeholder.name.split(" — ");
  const expertiseWord = expertiseLabel(stakeholder.expertise);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader active="workflow" workflowHref={component ? `/workflow/${component.id}` : undefined} />

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_70%_0%,#ffffff_0%,#eef0f2_50%,#dde1e5_100%)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-6 right-0 select-none whitespace-nowrap text-[18vw] font-semibold uppercase leading-none tracking-tighter text-transparent opacity-[0.07] [-webkit-text-stroke:2px_#0a0a0a] lg:text-[13vw]"
        >
          {expertiseWord}
        </span>
        <div className="relative mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav className="flex flex-wrap items-center gap-2 text-[13px] text-neutral-500">
              <Link href="/" className="hover:text-neutral-900">Vehicles</Link>
              <span>/</span>
              <Link href="/" className="hover:text-neutral-900">{vehicle?.name ?? "…"}</Link>
              <span>/</span>
              {component ? (
                <Link href={`/workflow/${component.id}`} className="hover:text-neutral-900">{component.label}</Link>
              ) : (
                <span>…</span>
              )}
              <span>/</span>
              <span className="text-neutral-900">Stakeholder review</span>
            </nav>
            {component && (
              <RoleSwitcher
                componentId={component.id}
                workflowId={workflow.id}
                stakeholders={allStakeholders}
                current={{ type: "stakeholder", stakeholderId: stakeholder.id }}
              />
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-bmw-blue">Stakeholder review</p>
              <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-6xl">{component?.label ?? "…"}</h1>
              <p className="mt-3 text-base text-neutral-600 sm:text-lg">
                {vehicle?.name ?? "…"} <span className="text-neutral-400">·</span> {vehicle?.generation ?? ""}{" "}
                <span className="text-neutral-400">·</span> Market: <span className="text-neutral-900">{workflow.market}</span>
              </p>
            </div>

            {/* Reviewer identity */}
            <div className="flex items-center gap-4 border border-neutral-200 bg-white/80 px-5 py-4 backdrop-blur">
              <StakeholderAvatar stakeholder={stakeholder} size={56} />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Reviewing as</p>
                <p className="text-[15px] font-medium text-neutral-900">{firstName}</p>
                <p className="text-[13px] capitalize text-neutral-500">{role ?? expertiseLabel(stakeholder.expertise)}</p>
              </div>
            </div>
          </div>

          <dl className="mt-10 grid max-w-4xl grid-cols-2 gap-y-6 sm:grid-cols-4">
            <Kpi label="Assigned to you" value={String(reviews.length)} />
            <Kpi label="Awaiting review" value={String(pending)} />
            <Kpi label="Submitted" value={String(submitted)} />
            <Kpi label="Requirements" value={String(requirements.length)} />
          </dl>
        </div>
      </section>

      {/* ---------- Review progress ---------- */}
      <div className="relative mx-auto -mt-14 max-w-[1440px] px-4 sm:px-8">
        <section className="border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Your reviews</p>
              <p className="mt-1 text-lg font-light tracking-tight text-neutral-900">
                {reviews.length === 0
                  ? "Nothing is assigned to you on this workflow."
                  : pending === 0
                    ? "All done. Thank you, your reviews are with the PM."
                    : `${submitted} of ${reviews.length} submitted · ${pending} waiting for your expert opinion`}
              </p>
            </div>
            {reviews.length > 0 && <span className="text-3xl font-light tabular-nums">{Math.round((submitted / reviews.length) * 100)}%</span>}
          </div>
          {reviews.length > 0 && (
            <>
              <div className="mt-4 h-1.5 bg-neutral-100">
                <div className="h-full bg-bmw-blue transition-[width] duration-700" style={{ width: `${(submitted / reviews.length) * 100}%` }} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {reviews.map((rv) => {
                  const req = requirements.find((q) => q.id === rv.requirementId);
                  const d = DECISION_STYLE[rv.decision];
                  return (
                    <a
                      key={rv.id}
                      href={`#${req ? `req-${req.id}` : `rev-${rv.id}`}`}
                      className="group flex items-center gap-2 border border-neutral-200 px-3 py-2 text-[13px] text-neutral-700 transition-colors hover:border-neutral-900"
                    >
                      <span className={clsx("h-2 w-2 rounded-full", rv.decision === "pending" ? "bg-amber-500" : rv.decision === "approve" ? "bg-emerald-600" : "bg-red-500")} />
                      <span className="max-w-[280px] truncate">{req?.title ?? "General workflow review"}</span>
                      <span className="sr-only">{d.label}</span>
                    </a>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {/* ---------- Body ---------- */}
      <div className="mx-auto max-w-[1440px] space-y-14 px-4 py-12 sm:px-8">
        {decisionTrail && (
          <section className="relative overflow-hidden bg-neutral-950 p-7 text-white sm:p-8">
            <span className="absolute inset-y-0 left-0 w-[3px] bg-bmw-blue" />
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bmw-blue text-[12px] font-semibold">AI</span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">Kompass summary · what happened so far</p>
            </div>
            <p className="mt-4 max-w-4xl text-[15px] leading-relaxed text-neutral-200">{decisionTrail.content}</p>
          </section>
        )}

        <section>
          <SectionTitle
            eyebrow={`Relevant to ${expertiseLabel(stakeholder.expertise)}`}
            title={`Draft requirements (${visible.length}${hiddenCount > 0 && !showAll ? ` of ${ranked.length}` : ""})`}
            aside={
              hiddenCount > 0 ? (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="border border-neutral-300 bg-white px-4 py-2 text-[13px] font-medium text-neutral-800 transition-colors hover:border-neutral-900"
                >
                  {showAll ? `Hide ${hiddenCount} outside your domain` : `Show all ${ranked.length} (${hiddenCount} hidden as not relevant)`}
                </button>
              ) : (
                <p className="text-[13px] text-neutral-500">Requirements assigned to you have a review form underneath.</p>
              )
            }
          />
          <div className="space-y-5">
            {visible.map((req) => (
              <RequirementReviewCard
                key={req.id}
                rank={ranked.indexOf(req) + 1}
                inDomain={isCategoryRelevant(req.category, stakeholder.expertise)}
                requirement={req}
                review={reviewFor(req.id)}
                draft={drafts[reviewFor(req.id)?.id ?? ""]}
                onDraft={(id, v) => setDrafts((d) => ({ ...d, [id]: v }))}
                busy={busyId === reviewFor(req.id)?.id}
                onSubmit={submit}
              />
            ))}
            {generalReviews.map((rv) => (
              <div key={rv.id} id={`rev-${rv.id}`} className="scroll-mt-24 border border-neutral-200 bg-white">
                <div className="p-5 sm:p-6">
                  <Chip className="bg-neutral-100 text-neutral-700">Whole workflow</Chip>
                  <h3 className="mt-3 text-xl font-normal tracking-tight">General workflow review</h3>
                </div>
                <ReviewForm review={rv} draft={drafts[rv.id]} onDraft={(id, v) => setDrafts((d) => ({ ...d, [id]: v }))} busy={busyId === rv.id} onSubmit={submit} />
              </div>
            ))}
            {requirements.length > 0 && visible.length === 0 && (
              <div className="border border-dashed border-neutral-300 bg-white p-10 text-center text-[14px] text-neutral-500">
                None of these requirements fall in your domain.{" "}
                <button onClick={() => setShowAll(true)} className="font-medium text-bmw-blue hover:underline">
                  Show all {ranked.length}
                </button>
              </div>
            )}
            {requirements.length === 0 && (
              <div className="border border-dashed border-neutral-300 bg-white p-10 text-center text-[14px] text-neutral-500">No requirements derived yet.</div>
            )}
          </div>
        </section>

        {Object.keys(studyByCategory).length > 0 && (
          <section>
            <SectionTitle
              eyebrow="Customer study"
              title="How we compare"
              aside={
                <p className="flex items-center gap-4 text-[13px] text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 bg-bmw-blue" /> {vehicle?.name ?? "This model"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 bg-neutral-400" /> Other models
                  </span>
                </p>
              }
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(studyByCategory).map(([category, rows]) => (
                <StudyComparison key={category} category={category} rows={rows} ourModel={vehicle?.name} />
              ))}
            </div>
            <p className="mt-4 text-[12px] text-neutral-500">
              “est.” = reconstructed from a satisfaction-bucket distribution (US methodology), lower precision than the direct CN/EU mean.
            </p>
          </section>
        )}
      </div>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-neutral-500 sm:px-8">
          <span>BMW Group · PM Kompass · TUM Hackathon prototype</span>
          {component && (
            <Link href={`/workflow/${component.id}`} className="hover:text-neutral-900">
              ← Back to PM workflow view
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}

// ---------- Pieces ----------

function RequirementReviewCard({
  rank,
  inDomain,
  requirement,
  review,
  draft,
  onDraft,
  busy,
  onSubmit,
}: {
  rank: number;
  inDomain: boolean;
  requirement: Requirement;
  review?: StakeholderReview;
  draft?: string;
  onDraft: (reviewId: string, value: string) => void;
  busy: boolean;
  onSubmit: (review: StakeholderReview, decision: "approve" | "reject") => void;
}) {
  const [showFactors, setShowFactors] = useState(Boolean(review));
  const assigned = Boolean(review);
  return (
    <article
      id={`req-${requirement.id}`}
      className={clsx(
        "relative scroll-mt-24 border bg-white transition-shadow",
        assigned ? "border-neutral-900 shadow-[0_16px_40px_rgba(0,0,0,0.06)]" : "border-neutral-200",
      )}
    >
      {assigned && <span className="absolute inset-y-0 left-0 w-[3px] bg-bmw-blue" />}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2 pt-1">
            <span className="mr-1 font-mono text-sm text-neutral-300">{String(rank).padStart(2, "0")}</span>
            <Chip className={STATUS_CHIP[requirement.status]}>{requirement.status}</Chip>
            <Chip className="bg-white text-neutral-500 ring-1 ring-inset ring-neutral-200">{humanize(requirement.category)}</Chip>
            <Chip className="bg-white text-neutral-500 ring-1 ring-inset ring-neutral-200">{requirement.effort} effort</Chip>
            <span className="ml-1">
              <EvidenceMeter level={requirement.evidenceLevel} />
            </span>
            {review && <Chip className={DECISION_STYLE[review.decision].chip}>{DECISION_STYLE[review.decision].label}</Chip>}
            {review && !inDomain && (
              <Chip className="bg-neutral-900 text-white">Assigned to you · outside your domain</Chip>
            )}
          </div>
          <ScoreRing score={requirement.score} />
        </div>
        <h3 className="mt-1 text-xl font-normal leading-snug tracking-tight text-neutral-900 sm:pr-24">{requirement.title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-neutral-600 sm:pr-24">{requirement.description}</p>
      </div>

      {(requirement.assumptions.length > 0 || requirement.uncertainties.length > 0) && (
        <div className="grid gap-2 px-5 pb-5 sm:px-6">
          {requirement.assumptions.map((a, i) => (
            <p key={`a${i}`} className="bg-[#eef4fc] px-4 py-3 text-[13px] leading-relaxed text-[#1d3d6b]">
              <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">Assumption</span>
              {a}
            </p>
          ))}
          {requirement.uncertainties.map((u, i) => (
            <p key={`u${i}`} className="bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
              <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">Uncertainty</span>
              {u}
            </p>
          ))}
        </div>
      )}

      <div className="border-t border-neutral-100">
        <button
          onClick={() => setShowFactors((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 sm:px-6"
        >
          <span>
            Why this score <span className="font-normal text-neutral-400">· {requirement.scoreFactors.length} factors</span>
          </span>
          <span className={clsx("text-neutral-400 transition-transform", showFactors && "rotate-180")}>⌄</span>
        </button>
        {showFactors && (
          <div className="grid gap-x-10 gap-y-4 bg-neutral-50 px-5 py-5 sm:grid-cols-2 sm:px-6">
            {requirement.scoreFactors.map((f) => (
              <div key={f.key}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-neutral-800">{f.label}</span>
                  <span className="shrink-0 tabular-nums text-neutral-900">{f.rawValue}</span>
                </div>
                <div className="mt-1.5 h-1.5 bg-neutral-200">
                  <div className="h-full bg-neutral-900" style={{ width: `${Math.max(0, Math.min(100, f.rawValue))}%` }} />
                </div>
                <p className="mt-1 text-[12px] text-neutral-500">{f.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {review ? (
        <ReviewForm review={review} draft={draft} onDraft={onDraft} busy={busy} onSubmit={onSubmit} />
      ) : (
        <p className="border-t border-neutral-100 px-5 py-4 text-[13px] text-neutral-400 sm:px-6">
          {inDomain ? "Not assigned to you · shown for context." : "Outside your domain · shown because “Show all” is on."}
        </p>
      )}
    </article>
  );
}

function ReviewForm({
  review,
  draft,
  onDraft,
  busy,
  onSubmit,
}: {
  review: StakeholderReview;
  draft?: string;
  onDraft: (reviewId: string, value: string) => void;
  busy: boolean;
  onSubmit: (review: StakeholderReview, decision: "approve" | "reject") => void;
}) {
  const isSubmitted = review.decision !== "pending";
  if (isSubmitted) {
    const d = DECISION_STYLE[review.decision];
    return (
      <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-white", review.decision === "approve" ? "bg-emerald-600" : "bg-red-500")}>
            {review.decision === "approve" ? "✓" : "✕"}
          </span>
          <span className="text-[14px] font-medium text-neutral-900">Your review: {d.label.toLowerCase()}</span>
          {review.submittedAt && <span className="ml-auto text-[12px] text-neutral-400">Submitted {new Date(review.submittedAt).toLocaleString()}</span>}
        </div>
        {review.expertOpinion && <p className="mt-3 border-l-2 border-neutral-300 pl-3 text-[14px] leading-relaxed text-neutral-700">{review.expertOpinion}</p>}
      </div>
    );
  }
  return (
    <div className="border-t border-neutral-100 px-5 py-5 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Your expert opinion</p>
      <textarea
        defaultValue={review.expertOpinion}
        onChange={(e) => onDraft(review.id, e.target.value)}
        placeholder="What should the PM know from your perspective? Risks, feasibility, cost or supplier context…"
        rows={3}
        className="mt-3 w-full border border-neutral-300 bg-white px-3 py-2.5 text-[14px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSubmit(review, "approve")}
          disabled={busy}
          className="bg-bmw-blue px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0653b6] disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Approve"}
        </button>
        <button
          onClick={() => onSubmit(review, "reject")}
          disabled={busy}
          className="border border-neutral-300 bg-white px-5 py-2.5 text-[13px] font-medium text-red-600 transition-colors hover:border-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Not approve
        </button>
        <span className="ml-auto text-[12px] text-neutral-400">{(draft ?? review.expertOpinion).trim() ? "" : "Tip: add a sentence of reasoning for the PM."}</span>
      </div>
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

function groupBy<T, K extends string>(arr: T[], fn: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of arr) {
    const key = fn(item);
    (out[key] ??= []).push(item);
  }
  return out;
}
