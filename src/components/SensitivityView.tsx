"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Requirement } from "@/lib/types";

// US-4.4: "so I see how fragile the ranking is." Re-scores every
// requirement under a handful of alternate weight profiles (same factors,
// different emphasis) and shows how much each requirement's rank moves —
// a requirement that stays top-3 under every profile is a safe bet; one
// that swings from #1 to #5 depending on what you weight is worth a
// second look before anyone treats its rank as settled.

interface Preset {
  key: string;
  label: string;
  weights: Record<string, number>;
}

const PRESETS: Preset[] = [
  {
    key: "impact",
    label: "Customer-impact-heavy",
    weights: { customer_impact: 0.4, frequency: 0.15, sales_relevance: 0.1, competitive_gap: 0.1, strategic_fit: 0.1, effort_inverse: 0.05, evidence_strength: 0.1 },
  },
  {
    key: "evidence",
    label: "Evidence-heavy",
    weights: { customer_impact: 0.15, frequency: 0.1, sales_relevance: 0.1, competitive_gap: 0.1, strategic_fit: 0.05, effort_inverse: 0.1, evidence_strength: 0.4 },
  },
  {
    key: "commercial",
    label: "Sales & competitive-heavy",
    weights: { customer_impact: 0.15, frequency: 0.1, sales_relevance: 0.3, competitive_gap: 0.25, strategic_fit: 0.05, effort_inverse: 0.05, evidence_strength: 0.1 },
  },
  {
    key: "feasibility",
    label: "Feasibility-heavy (quick wins)",
    weights: { customer_impact: 0.15, frequency: 0.1, sales_relevance: 0.1, competitive_gap: 0.1, strategic_fit: 0.05, effort_inverse: 0.4, evidence_strength: 0.1 },
  },
];

function scoreUnder(req: Requirement, weights: Record<string, number>): number {
  const totalWeight = req.scoreFactors.reduce((s, f) => s + (weights[f.key] ?? f.weight), 0) || 1;
  const weighted = req.scoreFactors.reduce((s, f) => s + f.rawValue * (weights[f.key] ?? f.weight), 0);
  return weighted / totalWeight;
}

function ranksFor(requirements: Requirement[], scoreFn: (r: Requirement) => number): Map<string, number> {
  const sorted = [...requirements].sort((a, b) => scoreFn(b) - scoreFn(a));
  return new Map(sorted.map((r, i) => [r.id, i + 1]));
}

export function SensitivityView({ requirements }: { requirements: Requirement[] }) {
  const [open, setOpen] = useState(false);
  if (requirements.length < 2) return null;

  const baselineRanks = ranksFor(requirements, (r) => r.score);
  const presetRanks = PRESETS.map((preset) => ({
    preset,
    ranks: ranksFor(requirements, (r) => scoreUnder(r, preset.weights)),
  }));

  const rows = requirements
    .map((req) => {
      const baseline = baselineRanks.get(req.id)!;
      const underPreset = presetRanks.map(({ preset, ranks }) => ({ preset, rank: ranks.get(req.id)! }));
      const maxSwing = Math.max(0, ...underPreset.map((p) => Math.abs(p.rank - baseline)));
      return { req, baseline, underPreset, maxSwing };
    })
    .sort((a, b) => a.baseline - b.baseline);

  return (
    <section className="border border-neutral-800 bg-neutral-900/40 p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-300"
      >
        <span>
          {open ? "▾" : "▸"} Sensitivity: how fragile is this ranking?
        </span>
        <span className="font-mono text-[10px] normal-case text-neutral-600">
          {rows.filter((r) => r.maxSwing >= 2).length} requirement(s) swing ≥ 2 ranks under different priorities
        </span>
      </button>

      {open && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wide text-neutral-500">
                <th className="py-1.5 pr-3 font-medium">Requirement</th>
                <th className="px-2 py-1.5 text-center font-medium">Current</th>
                {PRESETS.map((p) => (
                  <th key={p.key} className="px-2 py-1.5 text-center font-medium" title={p.label}>
                    {p.label.split(" ")[0]}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-center font-medium">Max swing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ req, baseline, underPreset, maxSwing }) => (
                <tr key={req.id} className="border-b border-neutral-900">
                  <td className="max-w-xs truncate py-1.5 pr-3 text-neutral-300" title={req.title}>
                    {req.title}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono text-neutral-200">#{baseline}</td>
                  {underPreset.map(({ preset, rank }) => (
                    <td
                      key={preset.key}
                      className={clsx(
                        "px-2 py-1.5 text-center font-mono",
                        rank === baseline ? "text-neutral-500" : rank < baseline ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      #{rank}
                    </td>
                  ))}
                  <td
                    className={clsx(
                      "px-2 py-1.5 text-center font-mono font-semibold",
                      maxSwing >= 3 ? "text-red-400" : maxSwing >= 2 ? "text-amber-400" : "text-neutral-600",
                    )}
                  >
                    {maxSwing === 0 ? "—" : `±${maxSwing}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-neutral-600">
            Each column re-scores every requirement with a different weight profile applied uniformly (not the
            per-requirement weights set via each card&apos;s sliders). Green = ranks higher under that profile, amber =
            ranks lower. A requirement that stays near its current rank across every profile is a safer bet than
            one that swings widely.
          </p>
        </div>
      )}
    </section>
  );
}
