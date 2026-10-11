"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Requirement } from "@/lib/types";
import { api } from "@/lib/api-client";
import { Chip, EvidenceMeter, ScoreRing, STATUS_CHIP, humanize } from "@/components/workflow/primitives";

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
  const [rationaleError, setRationaleError] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [challengeArg, setChallengeArg] = useState("");
  const [challengeResult, setChallengeResult] = useState<{ changed: boolean; explanation: string } | null>(null);

  const liveScore = computeLiveScore(requirement, weights);
  const weightsDirty = requirement.scoreFactors.some((f) => Math.abs(weights[f.key] - f.weight) > 0.001);

  async function act(status: Requirement["status"]) {
    const needsRationale = status === "rejected" || status === "postponed";
    if (needsRationale && !rationaleDraft.trim()) {
      setRationaleError(true);
      return;
    }
    setPending(status);
    try {
      const updated = await api.updateRequirementStatus(requirement.id, status, rationaleDraft || undefined);
      onChanged(updated);
      setRationaleDraft("");
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            value={rationaleDraft}
            onChange={(e) => {
              setRationaleDraft(e.target.value);
              setRationaleError(false);
            }}
            placeholder="Decision rationale (required to reject or postpone)"
            className={clsx(
              "min-w-0 flex-1 border bg-white px-3 py-2.5 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900",
              rationaleError ? "border-red-500" : "border-neutral-300",
            )}
          />
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => act("approved")}
              disabled={!!pending}
              className="bg-bmw-blue px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0653b6] disabled:opacity-50"
            >
              {pending === "approved" ? "Approving…" : "Approve"}
            </button>
            <button
              onClick={() => act("postponed")}
              disabled={!!pending}
              className="border border-neutral-300 bg-white px-4 py-2.5 text-[13px] font-medium text-neutral-800 transition-colors hover:border-neutral-900 disabled:opacity-50"
            >
              Postpone
            </button>
            <button
              onClick={() => act("rejected")}
              disabled={!!pending}
              className="border border-neutral-300 bg-white px-4 py-2.5 text-[13px] font-medium text-red-600 transition-colors hover:border-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
        {rationaleError && <p className="mt-2 text-[12px] text-red-600">Add a short rationale before rejecting or postponing.</p>}

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
