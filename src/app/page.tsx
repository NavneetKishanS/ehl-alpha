"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { api } from "@/lib/api-client";
import type { Vehicle, VehicleComponent } from "@/lib/types";
import { BmwLogo } from "@/components/BmwLogo";
import { PAINTS, type ViewMode } from "@/lib/carViewer";

// WebGL only runs client-side. Falls back to the local three.js viewer if Sketchfab can't load.
const CarViewer = dynamic(() => import("@/components/SketchfabCarViewer"), { ssr: false });

export default function LandingPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [components, setComponents] = useState<VehicleComponent[]>([]);
  const [creating, setCreating] = useState<VehicleComponent | null>(null);
  const [market, setMarket] = useState("Europe");
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<ViewMode>("exterior");
  const [paintId, setPaintId] = useState(PAINTS[0].id);
  const [resetKey, setResetKey] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
  const paint = PAINTS.find((p) => p.id === paintId) ?? PAINTS[0];

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
    <div className="min-h-screen bg-white text-neutral-900">
      {/* ---------- Top navigation ---------- */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BmwLogo size={36} />
            <span className="hidden h-6 w-px bg-neutral-300 sm:block" />
            <span className="hidden text-[15px] font-semibold tracking-tight sm:block">Requirements Copilot</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <span className="hidden border-b-2 border-neutral-900 px-3 py-5 font-medium md:block">Vehicles</span>
            <Link href="/evidence" className="hidden px-3 py-5 text-neutral-600 hover:text-neutral-900 md:block">
              Evidence Explorer
            </Link>
            <Link
              href="/evidence"
              className="ml-2 bg-bmw-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0653b6] md:hidden"
            >
              Evidence
            </Link>
          </nav>
        </div>
      </header>

      {/* ---------- Hero: 3D studio ---------- */}
      <section className="relative h-[calc(100svh-4rem)] min-h-[560px] overflow-hidden bg-[radial-gradient(120%_90%_at_50%_35%,#ffffff_0%,#eceeef_45%,#d6d9dc_100%)]">
        {components.length > 0 && (
          <CarViewer
            components={components}
            mode={mode}
            paint={paint.color}
            resetKey={resetKey}
            highlightedId={hoveredId}
            onHover={setHoveredId}
            onSelect={handleSelect}
          />
        )}

        {/* Headline */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-start justify-between gap-6 px-4 pt-8 sm:px-8 sm:pt-12">
            <div className={clsx("pointer-events-auto max-w-xl transition-opacity duration-500", mode === "interior" && "pointer-events-none opacity-0")}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-bmw-blue">
                BMW Group · AI for Product Decision Making
              </p>
              <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-6xl">
                {vehicle ? (
                  <>
                    {vehicle.name.replace(/^BMW\s*/i, "")}
                    <span className="block text-base font-normal tracking-normal text-neutral-500 sm:mt-2 sm:text-lg">
                      {vehicle.generation}
                    </span>
                  </>
                ) : (
                  <span className="text-neutral-400">Loading…</span>
                )}
              </h1>
            </div>

            {vehicles.length > 1 && (
              <div className="pointer-events-auto flex flex-wrap gap-2">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVehicleId(v.id)}
                    className={clsx(
                      "border px-4 py-2 text-sm transition-colors",
                      v.id === vehicleId
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white/70 text-neutral-700 hover:border-neutral-900",
                    )}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-14 sm:flex-row sm:items-end sm:justify-between sm:px-8">
            <div className="flex flex-col gap-3">
              {mode === "exterior" && (
                <div className="pointer-events-auto flex w-fit items-center gap-3 bg-white/80 px-3 py-2 backdrop-blur">
                  <div className="flex gap-2">
                    {PAINTS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPaintId(p.id)}
                        title={p.name}
                        aria-label={p.name}
                        className={clsx(
                          "h-7 w-7 rounded-full border-2 shadow-sm transition-transform hover:scale-110",
                          p.id === paintId ? "border-bmw-blue ring-2 ring-white" : "border-white",
                        )}
                        style={{ background: `radial-gradient(circle at 35% 30%, #ffffff55, ${p.color} 55%)` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-neutral-700">{paint.name}</span>
                </div>
              )}
              <div className="pointer-events-auto flex w-fit border border-neutral-300 bg-white/90 p-1 shadow-sm backdrop-blur">
                {(["exterior", "interior"] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={clsx(
                      "px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition-colors",
                      mode === m ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-4 text-xs text-neutral-600">
              <span className="hidden bg-white/80 px-2 py-1 backdrop-blur lg:block">{mode === "exterior" ? "Drag to rotate · Scroll to zoom" : "Drag to look around"}</span>
              <button
                onClick={() => setResetKey((k) => k + 1)}
                className="border border-neutral-300 bg-white/90 px-3 py-2 font-medium text-neutral-800 transition-colors hover:border-neutral-900"
              >
                Reset view
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Key facts ---------- */}
      {vehicle && (
        <section className="border-b border-neutral-200">
          <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-px bg-neutral-200 sm:grid-cols-4">
            <Fact label="Model" value={vehicle.name} />
            <Fact label="Markets" value={vehicle.markets.join(" · ")} />
            <Fact label="Active workflows" value={`${activeCount} / ${components.length}`} />
            <Fact label="Components" value={String(components.length)} />
          </div>
        </section>
      )}

      {/* ---------- Components ---------- */}
      <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-8 sm:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-light tracking-tight sm:text-4xl">Vehicle components</h2>
            <p className="mt-2 max-w-xl text-[15px] text-neutral-600">
              Pick a component on the car or below to open its requirements workflow, or start a new one.
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs text-neutral-600">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-bmw-blue" /> Active workflow
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-neutral-400 bg-white" /> Not started
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {components.map((c, i) => {
            const active = Boolean(c.workflowId);
            return (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={clsx(
                  "group flex min-h-[148px] flex-col justify-between border bg-white p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]",
                  hoveredId === c.id ? "border-neutral-900" : "border-neutral-200 hover:border-neutral-900",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-xs text-neutral-400">{String(i + 1).padStart(2, "0")}</span>
                  <span
                    className={clsx(
                      "px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                      active ? "bg-bmw-blue/10 text-bmw-blue" : "bg-neutral-100 text-neutral-500",
                    )}
                  >
                    {active ? "In progress" : "Not started"}
                  </span>
                </div>
                <div>
                  <div className="text-xl font-normal tracking-tight">{c.label}</div>
                  <div
                    className={clsx(
                      "mt-2 flex items-center gap-2 text-sm font-medium",
                      active ? "text-bmw-blue" : "text-neutral-700",
                    )}
                  >
                    {active ? "Open workflow" : "Create workflow"}
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------- Evidence teaser ---------- */}
      <section className="bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-300">Evidence Explorer</p>
            <h3 className="mt-2 text-2xl font-light tracking-tight sm:text-3xl">Every requirement, traced back to its source.</h3>
          </div>
          <Link href="/evidence" className="bg-bmw-blue px-6 py-3 text-sm font-medium transition-colors hover:bg-[#0653b6]">
            Explore evidence →
          </Link>
        </div>
      </section>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-neutral-500 sm:px-8">
          <span>BMW Group · Requirements Copilot · TUM Hackathon prototype</span>
          <span>
            3D model:{" "}
            <a href="https://sketchfab.com/3d-models/2025-bmw-330i-xdrive-a587961a125340738ca1c6ba53c57cd8" className="underline hover:text-neutral-800" target="_blank" rel="noreferrer">
              “2025 BMW 330i xDrive”
            </a>{" "}
            by{" "}
            <a href="https://sketchfab.com/ddiaz-design" className="underline hover:text-neutral-800" target="_blank" rel="noreferrer">
              Ddiaz Design
            </a>{" "}
            on Sketchfab,{" "}
            <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" className="underline hover:text-neutral-800" target="_blank" rel="noreferrer">
              CC BY-NC-SA 4.0
            </a>
          </span>
        </div>
      </footer>

      {/* ---------- Create workflow dialog ---------- */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={() => setCreating(null)}>
          <div className="w-full max-w-md bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bmw-blue">New workflow</p>
            <h2 className="mt-2 text-2xl font-light tracking-tight">{creating.label}</h2>
            <p className="mt-2 text-sm text-neutral-600">Choose the market scope for this requirements run.</p>
            <label className="mt-6 block text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">Market</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="mt-2 w-full border border-neutral-300 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900"
            >
              {(vehicle?.markets ?? ["Europe"]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setCreating(null)}
                className="border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-800 hover:border-neutral-900"
              >
                Cancel
              </button>
              <button
                onClick={confirmCreate}
                disabled={busy}
                className="bg-bmw-blue px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0653b6] disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create workflow"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-6 sm:px-8">
      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">{label}</div>
      <div className="mt-2 text-lg font-normal tracking-tight sm:text-xl">{value}</div>
    </div>
  );
}
