"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api-client";
import type { Vehicle } from "@/lib/types";
import type { SpecDocument } from "@/lib/spec/types";
import { SiteHeader } from "@/components/SiteHeader";
import { SpecExportModal } from "@/components/spec/SpecExportModal";
import { humanize } from "@/components/spec/SpecDocumentView";

// The PM's last step: the requirements specification for the successor
// vehicle, built from every component workflow, exportable as PDF or Word.
const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-neutral-100 text-neutral-700",
  challenged: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  postponed: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-700",
};

const STATUS_MEANING: { status: string; meaning: string }[] = [
  { status: "proposed", meaning: "Derived from the data, waiting for a decision" },
  { status: "challenged", meaning: "The PM pushed back; the AI is re-assessing" },
  { status: "approved", meaning: "Accepted by the PM" },
  { status: "postponed", meaning: "Parked for a later cycle" },
  { status: "rejected", meaning: "Declined by the PM" },
];

const ROW = "grid grid-cols-[6.5rem_1fr_6.5rem_3rem] items-baseline gap-4";

export default function SpecPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [spec, setSpec] = useState<SpecDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api
      .listVehicles()
      .then((vs) => {
        setVehicles(vs);
        const g60 = vs.find((v) => v.id === "veh_g60") ?? vs[0];
        if (g60) setVehicleId(g60.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!vehicleId) return;
    setSpec(null);
    setError(null);
    api.getSpec(vehicleId).then(setSpec).catch((e) => setError(e.message));
  }, [vehicleId]);

  const byComponent = useMemo(() => {
    const map = new Map<string, SpecDocument["requirements"]>();
    spec?.requirements.forEach((r) => map.set(r.component, [...(map.get(r.component) ?? []), r]));
    return [...map.entries()];
  }, [spec]);

  const high = spec?.requirements.filter((r) => r.priority === "high").length ?? 0;
  const avg = spec && spec.requirements.length ? spec.requirements.reduce((a, r) => a + r.score, 0) / spec.requirements.length : 0;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader active="spec" />
      <main className="mx-auto max-w-[1100px] px-4 py-12 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-bmw-blue">Specification</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-light tracking-tight sm:text-5xl">Requirements specification</h1>
            <p className="mt-3 max-w-xl text-base text-neutral-600">
              Every requirement across the component workflows, assembled into the document you send on. Export it as PDF or Word.
            </p>
          </div>
          <button
            onClick={() => setExporting(true)}
            disabled={!spec}
            className="bg-bmw-blue px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0653b6] disabled:opacity-40"
          >
            Export spec
          </button>
        </div>

        <div role="tablist" aria-label="Vehicle" className="mt-8 flex flex-wrap gap-2">
          {vehicles.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={vehicleId === v.id}
              onClick={() => setVehicleId(v.id)}
              className={clsx(
                "border px-4 py-2 text-sm font-medium transition-colors",
                vehicleId === v.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700 hover:border-neutral-900",
              )}
            >
              {v.name}
            </button>
          ))}
        </div>

        {error && <p className="mt-8 text-sm text-red-600">{error}</p>}
        {!spec && !error && <p className="mt-8 text-sm text-neutral-500">Building specification…</p>}

        {spec && (
          <>
            <dl className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
              <Kpi label="Requirements" value={String(spec.requirements.length)} />
              <Kpi label="High priority" value={String(high)} />
              <Kpi label="Areas covered" value={String(byComponent.length)} />
              <Kpi label="Average score" value={avg.toFixed(1)} />
            </dl>

            <section aria-label="How to read the list" className="mt-10 grid gap-6 border border-neutral-200 bg-neutral-50 p-5 text-[13px] leading-snug text-neutral-700 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">Status</p>
                <p className="mt-1">Where the requirement stands in review.</p>
                <ul className="mt-2 space-y-1.5">
                  {STATUS_MEANING.map((m) => (
                    <li key={m.status} className="flex items-baseline gap-2">
                      <span className={clsx("w-[5.5rem] shrink-0 px-2 py-0.5 text-center text-[11px] font-medium", STATUS_STYLE[m.status])}>{humanize(m.status)}</span>
                      <span>{m.meaning}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">Score</p>
                <p className="mt-1">
                  Priority score from 0 to 100, the weighted average of customer impact, signal frequency, sales relevance, competitive gap, strategic fit,
                  feasibility and evidence strength. Higher means more important.
                </p>
                <p className="mt-2">
                  <span className="font-mono tabular-nums text-neutral-900">65+</span> high · <span className="font-mono tabular-nums text-neutral-900">55–64</span> medium ·{" "}
                  <span className="font-mono tabular-nums text-neutral-900">below 55</span> low
                </p>
              </div>
            </section>

            {spec.requirements.length === 0 ? (
              <p className="mt-10 border border-neutral-200 p-6 text-sm text-neutral-600">
                No requirements yet for this vehicle. Open a component workflow first so requirements can be derived.
              </p>
            ) : (
              <div className="mt-10 space-y-8">
                {byComponent.map(([component, reqs]) => (
                  <section key={component}>
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em]">{component}</h2>
                    <div className={clsx(ROW, "mt-2 border-b border-neutral-900 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500")}>
                      <span>ID</span>
                      <span>Requirement</span>
                      <span>Status</span>
                      <span className="text-right">Score</span>
                    </div>
                    <ul>
                      {reqs.map((r) => (
                        <li key={r.id} className={clsx(ROW, "border-b border-neutral-200 py-2.5 text-sm")}>
                          <span className="font-mono text-[11px] text-neutral-500">{r.id}</span>
                          <span>{r.title}</span>
                          <span className={clsx("px-2 py-0.5 text-center text-[11px] font-medium", STATUS_STYLE[r.status])}>{humanize(r.status)}</span>
                          <span className="text-right font-mono tabular-nums text-neutral-900">{r.score.toFixed(1)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      {exporting && spec && <SpecExportModal spec={spec} onClose={() => setExporting(false)} />}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">{label}</dt>
      <dd className="mt-1 text-3xl font-light tabular-nums">{value}</dd>
    </div>
  );
}
