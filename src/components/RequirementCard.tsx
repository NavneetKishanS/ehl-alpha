"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { Requirement } from "@/lib/types";
import { api } from "@/lib/api-client";
import { Chip, EvidenceMeter, ScoreRing, STATUS_CHIP, humanize } from "@/components/workflow/primitives";
import { PdfPreviewModal } from "@/components/workflow/PdfPreviewModal";
import { buildRecord, loadDecision, saveDecision, type DecisionRecord } from "@/lib/decisionRecord";
import { DecisionModal, PRIORITY, formatDue, type DecisionAction, type DecisionDraft, type Priority } from "@/components/workflow/DecisionModal";

export function RequirementCard({
  requirement,
  rank,
  selected,
  onSelect,
  onChanged,
}: {
  requirement: Requirement;
  rank: number;
  selected?: boolean;
  onSelect?: () => void;
  onChanged: (updated: Requirement) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [weights, setWeights] = useState(
    Object.fromEntries(requirement.scoreFactors.map((f) => [f.key, f.weight])),
  );
  const [rationaleDraft, setRationaleDraft] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [preview, setPreview] = useState<DecisionDraft | null>(null);
  const [record, setRecord] = useState<DecisionRecord | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // Signed decisions are kept in this browser; drop one that no longer matches the status.
  useEffect(() => {
    const r = loadDecision(requirement.id);
    setRecord(r && r.action === requirement.status ? r : null);
  }, [requirement.id, requirement.status]);
  const [pending, setPending] = useState<string | null>(null);
  const [challengeArg, setChallengeArg] = useState("");
  const [challengeResult, setChallengeResult] = useState<{ changed: boolean; explanation: string } | null>(null);

  const liveScore = computeLiveScore(requirement, weights);
  const weightsDirty = requirement.scoreFactors.some((f) => Math.abs(weights[f.key] - f.weight) > 0.001);

  const decided = requirement.status === "approved" || requirement.status === "rejected" || requirement.status === "postponed";
  // Once decided, the panel turns into a read-only summary until the PM chooses to edit.
  const showForm = !decided || editing;

  function startEdit() {
    setRationaleDraft(record?.reason ?? "");
    setDueDate(record?.dueDate ?? "");
    setPriority(record?.priority ?? null);
    setShowErrors(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setShowErrors(false);
  }

  const today = new Date().toISOString().slice(0, 10);
  const missing = { dueDate: !dueDate, priority: !priority, reason: !rationaleDraft.trim() };
  const formComplete = !missing.dueDate && !missing.priority && !missing.reason;

  // Every decision needs a due date, priority and reason, then a signed preview.
  function act(action: DecisionAction) {
    if (!formComplete || !priority) {
      setShowErrors(true);
      return;
    }
    setPreview({ action, dueDate, priority, reason: rationaleDraft.trim() });
  }

  async function confirmDecision(signedBy: string, signedAt: Date, signature: string) {
    if (!preview) return;
    setPending(preview.action);
    const stamp = signedAt.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const rationale = `${preview.reason} · Priority: ${PRIORITY[preview.priority].label} · Review due: ${formatDue(preview.dueDate)} · Signed by ${signedBy}, ${stamp}`;
    try {
      const updated = await api.updateRequirementStatus(requirement.id, preview.action, rationale);
      const rec = buildRecord(requirement, liveScore, {
        action: preview.action,
        priority: preview.priority,
        dueDate: preview.dueDate,
        reason: preview.reason,
        signedBy,
        signedAt: signedAt.toISOString(),
        signature,
      });
      saveDecision(rec);
      setRecord(rec);
      onChanged(updated);
      setRationaleDraft("");
      setDueDate("");
      setPriority(null);
      setShowErrors(false);
      setPreview(null);
      setEditing(false);
    } finally {
      setPending(null);
    }
  }

  async function saveWeights() {
    setPending("weights");
    try {
      const updated = await api.updateWeights(requirement.id, weights);
      onChanged(updated);
    } finally {
      setPending(null);
    }
  }

  async function sendChallenge() {
    if (!challengeArg.trim()) return;
    setPending("challenge");
    try {
      const result = await api.challengeRequirement(requirement.id, challengeArg);
      setChallengeResult(result);
      const updated = await api.getRequirement(requirement.id);
      onChanged(updated);
    } finally {
      setPending(null);
    }
  }

  return (
    <article
      onClick={onSelect}
      className={clsx(
        "group relative border bg-white transition-all duration-200",
        selected
          ? "border-neutral-900 shadow-[0_16px_40px_rgba(0,0,0,0.08)]"
          : "border-neutral-200 hover:border-neutral-400 hover:shadow-[0_10px_28px_rgba(0,0,0,0.05)]",
      )}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-bmw-blue" />}

      {/* Header */}
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
            {record && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPdfOpen(true);
                }}
                className="ml-1 inline-flex items-center gap-1.5 border border-bmw-blue px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-bmw-blue transition-colors hover:bg-bmw-blue hover:text-white"
                title="Open the signed decision record (PDF)"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 1.5h5.5L13 5v9.5H4z" />
                  <path d="M9.5 1.5V5H13" />
                </svg>
                Preview
              </button>
            )}
          </div>
          <ScoreRing score={liveScore} dirty={weightsDirty} />
        </div>
        <h3 className="mt-1 text-xl font-normal leading-snug tracking-tight text-neutral-900 sm:pr-24">{requirement.title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-neutral-600 sm:pr-24">{requirement.description}</p>
      </div>

      {/* Assumptions & uncertainties */}
      {(requirement.assumptions.length > 0 || requirement.uncertainties.length > 0) && (
        <div className="grid gap-2 px-5 pb-5 sm:px-6">
          {requirement.assumptions.map((a, i) => (
            <Callout key={`a${i}`} tone="assumption" text={a} />
          ))}
          {requirement.uncertainties.map((u, i) => (
            <Callout key={`u${i}`} tone="uncertainty" text={u} />
          ))}
        </div>
      )}

      {/* Score breakdown */}
      <div className="border-t border-neutral-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="flex w-full items-center justify-between px-6 py-3 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <span>
            Score breakdown <span className="font-normal text-neutral-400">· {requirement.scoreFactors.length} factors, adjustable weights</span>
          </span>
          <span className={clsx("text-neutral-400 transition-transform", expanded && "rotate-180")}>⌄</span>
        </button>

        {expanded && (
          <div className="space-y-4 bg-neutral-50 px-6 py-5" onClick={(e) => e.stopPropagation()}>
            {requirement.scoreFactors.map((f) => (
              <div key={f.key}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-medium text-neutral-800">{f.label}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-500">
                    value {f.rawValue} · weight <span className="text-neutral-900">{Math.round(weights[f.key] * 100)}%</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-neutral-200">
                  <div className="h-full bg-neutral-900" style={{ width: `${Math.max(0, Math.min(100, f.rawValue))}%` }} />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weights[f.key]}
                  onChange={(e) => setWeights((w) => ({ ...w, [f.key]: Number(e.target.value) }))}
                  className="mt-2 h-1 w-full cursor-pointer accent-bmw-blue"
                  aria-label={`${f.label} weight`}
                />
                <p className="mt-1 text-[12px] text-neutral-500">{f.rationale}</p>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={saveWeights}
                disabled={pending === "weights" || !weightsDirty}
                className="bg-bmw-blue px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0653b6] disabled:opacity-40"
              >
                {pending === "weights" ? "Saving…" : "Save weights & recompute"}
              </button>
              {weightsDirty && (
                <button
                  onClick={() => setWeights(Object.fromEntries(requirement.scoreFactors.map((f) => [f.key, f.weight])))}
                  className="text-[13px] text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Decision */}
      <div className="border-t border-neutral-100 px-6 py-5" onClick={(e) => e.stopPropagation()}>
        {showForm ? (
        <div className="border border-neutral-200 bg-neutral-50/70 p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">{editing ? "Edit decision" : "PM decision"}</p>
            {editing ? (
              <button onClick={cancelEdit} className="text-[12px] font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline">
                Cancel edit
              </button>
            ) : (
              <p className="text-[12px] text-neutral-500">All fields required</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <FieldLabel label="Review due date" error={showErrors && missing.dueDate ? "Pick a date" : undefined}>
              <input
                type="date"
                min={today}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={clsx(
                  "h-11 w-full border bg-white px-3 text-[14px] text-neutral-900 outline-none transition-colors focus:border-neutral-900",
                  showErrors && missing.dueDate ? "border-red-500" : "border-neutral-300",
                )}
              />
            </FieldLabel>

            <FieldLabel as="div" label="Priority level" error={showErrors && missing.priority ? "Select one" : undefined}>
              <div
                role="radiogroup"
                aria-label="Priority level"
                className={clsx("grid h-11 grid-cols-3 border bg-white", showErrors && missing.priority ? "border-red-500" : "border-neutral-300")}
              >
                {(Object.keys(PRIORITY) as Priority[]).map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={priority === p}
                    onClick={() => setPriority(p)}
                    className={clsx(
                      "flex items-center justify-center gap-2 text-[13px] font-medium transition-colors",
                      i > 0 && "border-l border-neutral-300",
                      priority === p ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100",
                    )}
                  >
                    <span className={clsx("h-2 w-2 rounded-full", PRIORITY[p].dot)} />
                    {PRIORITY[p].label}
                  </button>
                ))}
              </div>
            </FieldLabel>
          </div>

          <div className="mt-4">
            <FieldLabel label="Reason for action" error={showErrors && missing.reason ? "Explain the decision" : undefined}>
              <textarea
                value={rationaleDraft}
                onChange={(e) => setRationaleDraft(e.target.value)}
                rows={2}
                placeholder="Why approve, postpone or reject? This is recorded in the audit trail."
                className={clsx(
                  "w-full resize-y border bg-white px-3 py-2.5 text-[14px] leading-relaxed text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900",
                  showErrors && missing.reason ? "border-red-500" : "border-neutral-300",
                )}
              />
            </FieldLabel>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-neutral-500">You’ll preview and sign before anything is saved.</p>
            <div className="flex gap-2">
              <button
                onClick={() => act("approved")}
                disabled={!!pending}
                className="bg-bmw-blue px-6 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0653b6] disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => act("postponed")}
                disabled={!!pending}
                className="border border-neutral-300 bg-white px-5 py-2.5 text-[13px] font-medium text-neutral-800 transition-colors hover:border-neutral-900 disabled:opacity-50"
              >
                Postpone
              </button>
              <button
                onClick={() => act("rejected")}
                disabled={!!pending}
                className="border border-neutral-300 bg-white px-5 py-2.5 text-[13px] font-medium text-red-600 transition-colors hover:border-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
        ) : (
          <DecisionSummary
            status={requirement.status as DecisionAction}
            record={record}
            onEdit={startEdit}
            onPreview={() => setPdfOpen(true)}
          />
        )}

        {pdfOpen && record && <PdfPreviewModal record={record} onClose={() => setPdfOpen(false)} />}

        {preview && (
          <DecisionModal
            requirement={requirement}
            score={liveScore}
            draft={preview}
            busy={pending === preview.action}
            onCancel={() => setPreview(null)}
            onConfirm={confirmDecision}
          />
        )}

        {/* Challenge */}
        <div className="mt-4">
          {!challengeOpen ? (
            <button
              onClick={() => setChallengeOpen(true)}
              className="text-[13px] font-medium text-bmw-blue underline-offset-2 hover:underline"
            >
              Disagree with the score? Challenge PM Kompass →
            </button>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                autoFocus
                value={challengeArg}
                onChange={(e) => setChallengeArg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChallenge()}
                placeholder="Your counter-argument, e.g. “Digital Key is a top-3 purchase driver in China”"
                className="min-w-0 flex-1 border border-neutral-300 bg-white px-3 py-2.5 text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900"
              />
              <button
                onClick={sendChallenge}
                disabled={pending === "challenge" || !challengeArg.trim()}
                className="shrink-0 bg-neutral-900 px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-black disabled:opacity-40"
              >
                {pending === "challenge" ? "Re-assessing…" : "Challenge"}
              </button>
            </div>
          )}
          {challengeResult && (
            <div
              className={clsx(
                "mt-3 border-l-[3px] px-4 py-3 text-[13px]",
                challengeResult.changed ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-neutral-400 bg-neutral-50 text-neutral-700",
              )}
            >
              <span className="font-semibold">{challengeResult.changed ? "Result changed. " : "Result unchanged. "}</span>
              {challengeResult.explanation}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Callout({ tone, text }: { tone: "assumption" | "uncertainty"; text: string }) {
  const isAssumption = tone === "assumption";
  return (
    <div
      className={clsx(
        "flex gap-3 px-4 py-3 text-[13px] leading-relaxed",
        isAssumption ? "bg-[#eef4fc] text-[#1d3d6b]" : "bg-amber-50 text-amber-900",
      )}
    >
      <span
        className={clsx(
          "mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
          isAssumption ? "bg-bmw-blue" : "bg-amber-500",
        )}
      >
        {isAssumption ? "i" : "!"}
      </span>
      <span>
        <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">{isAssumption ? "Assumption" : "Uncertainty"}</span>
        {text}
      </span>
    </div>
  );
}

function computeLiveScore(requirement: Requirement, weights: Record<string, number>) {
  const totalWeight = requirement.scoreFactors.reduce((s, f) => s + (weights[f.key] ?? f.weight), 0) || 1;
  const weighted = requirement.scoreFactors.reduce(
    (s, f) => s + f.rawValue * (weights[f.key] ?? f.weight),
    0,
  );
  return weighted / totalWeight;
}

function FieldLabel({ label, error, as = "label", children }: { label: string; error?: string; as?: "label" | "div"; children: React.ReactNode }) {
  // Use "div" when the field holds several buttons, so clicking the label text doesn't press the first one.
  const Tag = as;
  return (
    <Tag className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-neutral-700">
          {label} <span className="text-red-500">*</span>
        </span>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </span>
      {children}
    </Tag>
  );
}

const DECIDED_STYLE: Record<DecisionAction, { chip: string; label: string; bar: string }> = {
  approved: { chip: "bg-emerald-50 text-emerald-700", label: "Approved", bar: "bg-emerald-600" },
  postponed: { chip: "bg-amber-50 text-amber-800", label: "Postponed", bar: "bg-amber-500" },
  rejected: { chip: "bg-red-50 text-red-700", label: "Rejected", bar: "bg-red-600" },
};

// Read-only view of the signed decision, shown instead of the form once decided.
function DecisionSummary({
  status,
  record,
  onEdit,
  onPreview,
}: {
  status: DecisionAction;
  record: DecisionRecord | null;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const st = DECIDED_STYLE[status];
  const signedAt = record
    ? new Date(record.signedAt).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div className="relative border border-neutral-200 bg-white p-5">
      <span className={clsx("absolute inset-y-0 left-0 w-[3px]", st.bar)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">PM decision</p>
          <span className={clsx("px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", st.chip)}>{st.label}</span>
        </div>
        <div className="flex gap-2">
          {record && (
            <button onClick={onPreview} className="border border-neutral-300 bg-white px-4 py-2 text-[13px] font-medium text-neutral-800 transition-colors hover:border-neutral-900">
              View PDF
            </button>
          )}
          <button onClick={onEdit} className="flex items-center gap-2 bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M11 2.5l2.5 2.5L6 12.5H3.5V10z" />
            </svg>
            Edit decision
          </button>
        </div>
      </div>

      {record ? (
        <>
          <dl className="mt-4 grid grid-cols-1 gap-px bg-neutral-200 sm:grid-cols-3">
            <div className="bg-white py-3 pr-4 sm:pl-0">
              <dt className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Priority</dt>
              <dd className="mt-1 flex items-center gap-2 text-[14px] text-neutral-900">
                <span className={clsx("h-2.5 w-2.5 rounded-full", PRIORITY[record.priority].dot)} />
                {PRIORITY[record.priority].label}
              </dd>
            </div>
            <div className="bg-white px-0 py-3 sm:px-4">
              <dt className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Review due</dt>
              <dd className="mt-1 text-[14px] text-neutral-900">{formatDue(record.dueDate)}</dd>
            </div>
            <div className="bg-white px-0 py-3 sm:px-4">
              <dt className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Signed by</dt>
              <dd className="mt-1 text-[14px] text-neutral-900">
                {record.signedBy}
                <span className="block text-[12px] text-neutral-500">{signedAt}</span>
              </dd>
            </div>
          </dl>
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Reason for action</p>
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-neutral-800">{record.reason}</p>
          </div>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-neutral-500">This decision is recorded in the audit trail. Edit it to add a due date, priority and signature.</p>
      )}
    </div>
  );
}
