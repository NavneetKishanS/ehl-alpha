"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Vehicle, VehicleComponent } from "@/lib/types";
import { CarHotspotViewer } from "@/components/CarHotspotViewer";

export default function LandingPage() {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [components, setComponents] = useState<VehicleComponent[]>([]);
  const [creating, setCreating] = useState<VehicleComponent | null>(null);
  const [market, setMarket] = useState("Europe");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listVehicles().then(async (vehicles) => {
      const v = vehicles[0];
      setVehicle(v);
      setComponents(await api.listComponents(v.id));
    });
  }, []);

  async function handleSelect(component: VehicleComponent) {
    if (component.workflowId) {
      router.push(`/workflow/${component.id}`);
    } else {
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
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center px-6 py-12">
      <header className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bmw-blue">BMW Group · AI for Product Decision Making</p>
        <h1 className="mt-2 text-3xl font-bold text-neutral-50">{vehicle?.name ?? "Loading…"}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {vehicle ? `${vehicle.generation} · ${vehicle.markets.join(", ")}` : ""}
        </p>
        <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-500">
          Click a component to open its requirements workflow, or start a new one. Blue dots have an
          active workflow; gray dots are untouched.
        </p>
      </header>

      {components.length > 0 && <CarHotspotViewer components={components} onSelect={handleSelect} />}

      <div className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
        {components.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelect(c)}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm hover:border-bmw-blue/50 hover:bg-white/[0.06]"
          >
            <div className="font-medium text-neutral-200">{c.label}</div>
            <div className="mt-0.5 text-xs text-neutral-500">
              {c.workflowId ? "Workflow in progress →" : "No workflow yet — create one"}
            </div>
          </button>
        ))}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-900 p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-neutral-100">New workflow: {creating.label}</h2>
            <p className="mt-1 text-xs text-neutral-500">Choose the market scope for this requirements run.</p>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="mt-3 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-200"
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
                className="rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmCreate}
                disabled={busy}
                className="rounded-md bg-bmw-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
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
