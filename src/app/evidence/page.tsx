"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, type Facets, type FeedbackPage } from "@/lib/api-client";

const FEEDBACK_TYPE_STYLE: Record<string, string> = {
  Likes: "text-emerald-300 border-emerald-800",
  Wants: "text-sky-300 border-sky-800",
  "Difficult to Use": "text-amber-300 border-amber-800",
  Defect: "text-red-300 border-red-800",
};

export default function EvidenceExplorerPage() {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [data, setData] = useState<FeedbackPage | null>(null);
  const [vehicleCode, setVehicleCode] = useState("");
  const [component, setComponent] = useState("");
  const [feedbackType, setFeedbackType] = useState("");
  const [country, setCountry] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    api.getFeedbackFacets().then(setFacets);
  }, []);

  const load = useCallback(() => {
    api.getFeedback({ vehicleCode, component, feedbackType, country, q, page, pageSize }).then(setData);
  }, [vehicleCode, component, feedbackType, country, q, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [vehicleCode, component, feedbackType, country, q]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <div className="mb-6">
        <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">← Landing page</Link>
        <h1 className="mt-1 text-xl font-bold text-neutral-50">Evidence Explorer</h1>
        <p className="text-sm text-neutral-500">
          Raw customer feedback behind every signal and requirement — filter, search, and drill down to the source record (US-1.3, US-8.1).
        </p>
      </div>

      {data?.noData && (
        <div className="border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
          No real data ingested yet. Copy the datasets into <code className="font-mono">data-raw/</code> and run{" "}
          <code className="font-mono">npm run ingest</code> (see docs/DATA_SETUP.md).
        </div>
      )}

      {!data?.noData && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 border border-neutral-800 bg-neutral-900/60 p-3 sm:grid-cols-5">
            <Select label="Vehicle" value={vehicleCode} onChange={setVehicleCode} options={facets?.vehicleCodes} />
            <Select label="Component" value={component} onChange={setComponent} options={facets?.components} />
            <Select label="Feedback type" value={feedbackType} onChange={setFeedbackType} options={facets?.feedbackTypes} />
            <Select label="Country" value={country} onChange={setCountry} options={facets?.countries} />
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="text or VFC category…"
                className="w-full border border-neutral-700 bg-black/30 px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600"
              />
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
            <span>
              {data?.total.toLocaleString() ?? "…"} rows matched
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="border border-neutral-700 px-2 py-1 disabled:opacity-30"
              >
                ←
              </button>
              <span className="font-mono">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="border border-neutral-700 px-2 py-1 disabled:opacity-30"
              >
                →
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-neutral-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900 text-[10px] uppercase tracking-wide text-neutral-500">
                  <th className="px-2 py-2 font-medium">ID</th>
                  <th className="px-2 py-2 font-medium">Vehicle</th>
                  <th className="px-2 py-2 font-medium">Country</th>
                  <th className="px-2 py-2 font-medium">Engine</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Category (VFC)</th>
                  <th className="px-2 py-2 font-medium">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-900 hover:bg-neutral-900/50">
                    <td className="px-2 py-2 font-mono text-neutral-600">{r.id}</td>
                    <td className="px-2 py-2 text-neutral-400">{r.vehicleCode}</td>
                    <td className="px-2 py-2 text-neutral-400">{r.country}</td>
                    <td className="px-2 py-2 text-neutral-500">{r.engineType}</td>
                    <td className="px-2 py-2">
                      {r.feedbackType ? (
                        <span className={`border px-1 py-0.5 text-[10px] ${FEEDBACK_TYPE_STYLE[r.feedbackType] ?? "border-neutral-700 text-neutral-400"}`}>
                          {r.feedbackType}
                        </span>
                      ) : (
                        <span className="text-neutral-700">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-neutral-500">{r.vfcLevel2 ?? "unclassified"}</td>
                    <td className="max-w-xl px-2 py-2 text-neutral-300">{r.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; count: number }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-neutral-700 bg-black/30 px-2 py-1.5 text-xs text-neutral-200"
      >
        <option value="">All</option>
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value} ({o.count.toLocaleString()})
          </option>
        ))}
      </select>
    </div>
  );
}
