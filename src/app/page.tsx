"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Vehicle, VehicleComponent } from "@/lib/types";
import { CarHotspotViewer } from "@/components/CarHotspotViewer";

export default function LandingPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [components, setComponents] = useState<VehicleComponent[]>([]);
  const [creating, setCreating] = useState<VehicleComponent | null>(null);
  const [market, setMarket] = useState("Europe");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listVehicles().then((vs) => {
      setVehicles(vs);
      if (vs[0]) setVehicleId(vs[0].id);
    });
  }, []);

  useEffect(() => {
    if (!vehicleId) return;
    api.listComponents(vehicleId).then(setComponents);
  }, [vehicleId]);

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const activeCount = components.filter((c) => c.workflowId).length;

  async function handleSelect(component: VehicleComponent) {
    if (component.workflowId) {
      router.push(`/workflow/${component.id}`);
    } else {
      setMarket(vehicle?.markets[0] ?? "Europe");
      setCreating(component);
    }
  }

  async function confirmCreate() {
    if (!creating) return;
    setBusy(true);
    try {
      await api.createWorkflow(creating.id, market);
      router.push(`/workflow/${creating.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bmw-blue">BMW Group · AI for Product Decision Making</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-50">Requirements Copilot</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Click a component to open its requirements workflow, or start a new one. Blue dots have an active
            workflow; gray dots are untouched.
          </p>
        </div>
        <Link href="/evidence" className="shrink-0 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
          Evidence Explorer →
        </Link>
      </header>

      {vehicles.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => setVehicleId(v.id)}
              className={`border px-3 py-1.5 text-xs font-medium ${
                v.id === vehicleId
                  ? "border-bmw-blue bg-bmw-blue/10 text-sky-300"
                  : "border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {vehicle && (
        <p className="mb-4 font-mono text-xs text-neutral-500">
          {vehicle.generation} · markets: {vehicle.markets.join(", ")} · {activeCount}/{components.length} components have an active workflow
        </p>
      )}

      {components.length > 0 && <CarHotspotViewer components={components} onSelect={handleSelect} />}

      <div className="mt-8 grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
        {components.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelect(c)}
            className="border border-neutral-800 bg-neutral-900/40 px-3 py-2.5 text-left text-sm hover:border-neutral-600 hover:bg-neutral-900"
          >
            <div className="font-medium text-neutral-200">{c.label}</div>
            <div className="mt-0.5 text-[11px] text-neutral-500">
              {c.workflowId ? "Workflow in progress →" : "No workflow yet — create one"}
            </div>
          </button>
        ))}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-neutral-100">New workflow: {creating.label}</h2>
            <p className="mt-1 text-xs text-neutral-500">Choose the market scope for this requirements run.</p>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="mt-3 w-full border border-neutral-700 bg-black/30 px-3 py-2 text-sm text-neutral-200"
            >
              {(vehicle?.markets ?? ["Europe"]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCreating(null)}
                className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmCreate}
                disabled={busy}
                className="bg-bmw-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create workflow"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
