"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Requirement } from "@/lib/types";
import { EvidenceBadge } from "./EvidenceBadge";
import { api } from "@/lib/api-client";

const STATUS_STYLE: Record<Requirement["status"], string> = {
  proposed: "bg-neutral-700 text-neutral-200",
  approved: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30",
  rejected: "bg-red-500/20 text-red-300 border border-red-400/30",
  postponed: "bg-amber-500/20 text-amber-300 border border-amber-400/30",
  challenged: "bg-violet-500/20 text-violet-300 border border-violet-400/30",
};

export function RequirementCard({
  requirement,
  onChanged,
}: {
  requirement: Requirement;
  onChanged: (updated: Requirement) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [weights, setWeights] = useState(
    Object.fromEntries(requirement.scoreFactors.map((f) => [f.key, f.weight])),
  );
  const [rationaleDraft, setRationaleDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [challengeArg, setChallengeArg] = useState("");
  const [challengeResult, setChallengeResult] = useState<{ changed: boolean; explanation: string } | null>(null);

  const liveScore = computeLiveScore(requirement, weights);

  async function act(status: Requirement["status"]) {
    const needsRationale = status === "rejected" || status === "postponed";
    if (needsRationale && !rationaleDraft.trim()) {
      alert("A rationale is required for this decision.");
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-neutral-100">{requirement.title}</h3>
            <span className={clsx("rounded px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLE[requirement.status])}>
              {requirement.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">{requirement.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <EvidenceBadge level={requirement.evidenceLevel} />
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300">
              {requirement.category.replace(/_/g, " ")}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300">
              effort: {requirement.effort}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-2xl font-bold tabular-nums text-neutral-100">{liveScore.toFixed(1)}</div>
          <div className="text-[11px] text-neutral-500">score / 100</div>
        </div>
      </div>

      {requirement.assumptions.length > 0 && (
        <div className="mt-3 rounded-lg border border-sky-400/20 bg-sky-500/5 p-2 text-xs text-sky-200">
          <span className="font-semibold">Assumption: </span>
          {requirement.assumptions.join(" ")}
        </div>
      )}
      {requirement.uncertainties.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/5 p-2 text-xs text-amber-200">
          <span className="font-semibold">Uncertainty: </span>
          {requirement.uncertainties.join(" ")}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 text-xs font-medium text-sky-400 hover:text-sky-300"
      >
        {expanded ? "Hide" : "Show"} score breakdown & factor weights
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
          {requirement.scoreFactors.map((f) => (
            <div key={f.key}>
              <div className="flex items-center justify-between text-xs text-neutral-300">
                <span>
                  {f.label} <span className="text-neutral-500">(raw {f.rawValue})</span>
                </span>
                <span className="tabular-nums text-neutral-400">weight {Math.round(weights[f.key] * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights[f.key]}
                onChange={(e) => setWeights((w) => ({ ...w, [f.key]: Number(e.target.value) }))}
                className="w-full accent-bmw-blue"
              />
              <p className="text-[11px] text-neutral-500">{f.rationale}</p>
            </div>
          ))}
          <button
            onClick={saveWeights}
            disabled={pending === "weights"}
            className="rounded-md bg-bmw-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {pending === "weights" ? "Saving…" : "Save weights & recompute"}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => act("approved")}
          disabled={!!pending}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => act("rejected")}
          disabled={!!pending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          onClick={() => act("postponed")}
          disabled={!!pending}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
        >
          Postpone
        </button>
        <input
          value={rationaleDraft}
          onChange={(e) => setRationaleDraft(e.target.value)}
          placeholder="Rationale (required for reject/postpone)"
          className="min-w-[220px] flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600"
        />
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="flex items-center gap-2">
          <input
            value={challengeArg}
            onChange={(e) => setChallengeArg(e.target.value)}
            placeholder="Challenge this score/rationale with your own argument…"
            className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600"
          />
          <button
            onClick={sendChallenge}
            disabled={pending === "challenge"}
            className="rounded-md border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
          >
            {pending === "challenge" ? "Re-assessing…" : "Challenge"}
          </button>
        </div>
        {challengeResult && (
          <p className={clsx("mt-2 text-xs", challengeResult.changed ? "text-emerald-300" : "text-neutral-400")}>
            {challengeResult.changed ? "Result changed: " : "Result unchanged: "}
            {challengeResult.explanation}
          </p>
        )}
      </div>
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
