"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Requirement } from "@/lib/types";
import { EvidenceBadge } from "./EvidenceBadge";
import { api } from "@/lib/api-client";

const STATUS_STYLE: Record<Requirement["status"], string> = {
  proposed: "bg-neutral-800 text-neutral-300 border-neutral-700",
  approved: "bg-emerald-950 text-emerald-300 border-emerald-800",
  rejected: "bg-red-950 text-red-300 border-red-800",
  postponed: "bg-amber-950 text-amber-300 border-amber-800",
  challenged: "bg-violet-950 text-violet-300 border-violet-800",
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
  const weightsDirty = requirement.scoreFactors.some((f) => Math.abs(weights[f.key] - f.weight) > 0.001);

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
    <div className="border border-neutral-800 bg-neutral-900/60">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-800 p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx("border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_STYLE[requirement.status])}>
              {requirement.status}
            </span>
            <EvidenceBadge level={requirement.evidenceLevel} />
            <span className="text-[11px] text-neutral-500">{requirement.category.replace(/_/g, " ")}</span>
          </div>
          <h3 className="mt-1.5 text-sm font-semibold text-neutral-100">{requirement.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">{requirement.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <div className="font-mono text-xl font-bold tabular-nums text-neutral-100">{liveScore.toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-600">score{weightsDirty ? " · unsaved" : ""}</div>
        </div>
      </div>

      {(requirement.assumptions.length > 0 || requirement.uncertainties.length > 0) && (
        <div className="divide-y divide-neutral-800 border-b border-neutral-800">
          {requirement.assumptions.map((a, i) => (
            <div key={i} className="flex gap-2 border-l-2 border-sky-600 bg-sky-950/30 px-3 py-1.5 text-[11px] text-sky-200">
              <span className="shrink-0 font-semibold text-sky-400">ASSUMPTION</span>
              <span>{a}</span>
            </div>
          ))}
          {requirement.uncertainties.map((u, i) => (
            <div key={i} className="flex gap-2 border-l-2 border-amber-600 bg-amber-950/20 px-3 py-1.5 text-[11px] text-amber-200">
              <span className="shrink-0 font-semibold text-amber-400">UNCERTAINTY</span>
              <span>{u}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full border-b border-neutral-800 px-3 py-1.5 text-left text-[11px] font-medium text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300"
      >
        {expanded ? "▾" : "▸"} Score breakdown ({requirement.scoreFactors.length} factors, adjustable weights)
      </button>

      {expanded && (
        <div className="space-y-2.5 border-b border-neutral-800 bg-black/20 p-3">
          {requirement.scoreFactors.map((f) => (
            <div key={f.key}>
              <div className="flex items-center justify-between text-[11px] text-neutral-300">
                <span>
                  {f.label} <span className="font-mono text-neutral-500">raw={f.rawValue}</span>
                </span>
                <span className="font-mono tabular-nums text-neutral-400">w={Math.round(weights[f.key] * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights[f.key]}
                onChange={(e) => setWeights((w) => ({ ...w, [f.key]: Number(e.target.value) }))}
                className="h-1 w-full accent-bmw-blue"
              />
              <p className="text-[10px] text-neutral-600">{f.rationale}</p>
            </div>
          ))}
          <button
            onClick={saveWeights}
            disabled={pending === "weights"}
            className="bg-bmw-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {pending === "weights" ? "Saving…" : "Save weights & recompute"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 p-3">
        <button
          onClick={() => act("approved")}
          disabled={!!pending}
          className="bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => act("rejected")}
          disabled={!!pending}
          className="bg-red-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          onClick={() => act("postponed")}
          disabled={!!pending}
          className="bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Postpone
        </button>
        <input
          value={rationaleDraft}
          onChange={(e) => setRationaleDraft(e.target.value)}
          placeholder="Rationale (required for reject/postpone)"
          className="min-w-[220px] flex-1 border border-neutral-700 bg-black/30 px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600"
        />
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2">
          <input
            value={challengeArg}
            onChange={(e) => setChallengeArg(e.target.value)}
            placeholder="Challenge this score/rationale with your own argument…"
            className="flex-1 border border-neutral-700 bg-black/30 px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600"
          />
          <button
            onClick={sendChallenge}
            disabled={pending === "challenge"}
            className="border border-violet-700 bg-violet-950 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-900 disabled:opacity-50"
          >
            {pending === "challenge" ? "Re-assessing…" : "Challenge"}
          </button>
        </div>
        {challengeResult && (
          <p className={clsx("mt-2 border-l-2 pl-2 text-xs", challengeResult.changed ? "border-emerald-600 text-emerald-300" : "border-neutral-600 text-neutral-400")}>
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
