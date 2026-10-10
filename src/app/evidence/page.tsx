"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { api, type Facets, type FeedbackPage } from "@/lib/api-client";
import type { FeedbackRecord, Vehicle } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { countryToMarket } from "@/lib/market";

const PAGE_SIZE = 50;

const TYPE_STYLE: Record<string, { chip: string; bar: string; accent: string }> = {
  Likes: { chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-600", accent: "bg-emerald-600" },
  Wants: { chip: "bg-[#eef4fc] text-bmw-blue", bar: "bg-bmw-blue", accent: "bg-bmw-blue" },
  "Difficult to Use": { chip: "bg-amber-50 text-amber-800", bar: "bg-amber-500", accent: "bg-amber-500" },
  Defect: { chip: "bg-red-50 text-red-700", bar: "bg-red-500", accent: "bg-red-500" },
};
const UNCLASSIFIED = { chip: "bg-neutral-100 text-neutral-500", bar: "bg-neutral-300", accent: "bg-neutral-300" };

const COMPONENT_LABEL: Record<string, string> = {
  general: "General",
  steering: "Steering & Cockpit",
  interior: "Interior & Cabin",
  engine: "Powertrain",
  exterior: "Exterior & Design",
  battery: "Battery & Charging",
  windows: "Windows & Glass",
};

const ENGINE_LABEL: Record<string, string> = { ICE: "ICE", BEVE: "BEV", BEV: "BEV", PHEV: "PHEV" };

function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...code.split("").map((c) => 127397 + c.charCodeAt(0)));
}

export default function EvidenceExplorerPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
      <EvidenceExplorer />
    </Suspense>
  );
}

function EvidenceExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [facets, setFacets] = useState<Facets | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [data, setData] = useState<FeedbackPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mix, setMix] = useState<{ total: number; byType: Record<string, number> } | null>(null);

  // Filters start from the URL so links like the workflow page's "Open Evidence Explorer" arrive pre-filtered.
  const [vehicleCode, setVehicleCode] = useState(params.get("vehicleCode") ?? "");
  const [component, setComponent] = useState(params.get("component") ?? "");
  const [feedbackType, setFeedbackType] = useState(params.get("feedbackType") ?? "");
  const [market, setMarket] = useState(params.get("market") ?? "");
  const [country, setCountry] = useState(params.get("country") ?? "");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.getFeedbackFacets().then(setFacets).catch(() => setFacets(null));
    api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 1 and mirror filters into the URL whenever they change.
  useEffect(() => {
    setPage(1);
    const sp = new URLSearchParams();
    if (vehicleCode) sp.set("vehicleCode", vehicleCode);
    if (component) sp.set("component", component);
    if (feedbackType) sp.set("feedbackType", feedbackType);
    if (market) sp.set("market", market);
    if (country) sp.set("country", country);
    if (debouncedQ) sp.set("q", debouncedQ);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [vehicleCode, component, feedbackType, market, country, debouncedQ, pathname, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getFeedback({ vehicleCode, component, feedbackType, market, country, q: debouncedQ, page, pageSize: PAGE_SIZE })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [vehicleCode, component, feedbackType, market, country, debouncedQ, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Feedback-type mix for the current filters (ignoring the type filter itself).
  useEffect(() => {
    if (!facets) return;
    let cancelled = false;
    const base = { vehicleCode, component, market, country, q: debouncedQ, page: 1, pageSize: 1 };
    const types = facets.feedbackTypes.map((t) => t.value);
    Promise.all([api.getFeedback(base), ...types.map((t) => api.getFeedback({ ...base, feedbackType: t }))])
      .then(([all, ...perType]) => {
        if (cancelled) return;
        setMix({ total: all.total, byType: Object.fromEntries(types.map((t, i) => [t, perType[i].total])) });
      })
      .catch(() => !cancelled && setMix(null));
    return () => {
      cancelled = true;
    };
  }, [facets, vehicleCode, component, market, country, debouncedQ]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const grouped = useMemo(() => groupById(data?.rows ?? []), [data]);
  const vehicleName = (code: string) => vehicles.find((v) => v.id === `veh_${code.toLowerCase()}`)?.name ?? code;
  const totalVerbatims = facets?.vehicleCodes.reduce((a, v) => a + v.count, 0) ?? 0;
  const classified = facets?.feedbackTypes.reduce((a, v) => a + v.count, 0) ?? 0;

  const activeFilters = [
    vehicleCode && { label: `${vehicleCode} · ${vehicleName(vehicleCode)}`, clear: () => setVehicleCode("") },
    component && { label: COMPONENT_LABEL[component] ?? component, clear: () => setComponent("") },
    feedbackType && { label: feedbackType, clear: () => setFeedbackType("") },
    market && { label: facets?.markets.find((m) => m.value === market)?.label ?? market, clear: () => setMarket("") },
    country && { label: `${flag(country)} ${country}`, clear: () => setCountry("") },
    debouncedQ && { label: `“${debouncedQ}”`, clear: () => setQ("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  function clearAll() {
    setVehicleCode("");
    setComponent("");
    setFeedbackType("");
    setMarket("");
    setCountry("");
    setQ("");
  }

  function goTo(p: number) {
    setPage(p);
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader active="evidence" />

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_70%_0%,#ffffff_0%,#eef0f2_50%,#dde1e5_100%)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-6 right-0 select-none whitespace-nowrap text-[18vw] font-semibold uppercase leading-none tracking-tighter text-transparent opacity-[0.07] [-webkit-text-stroke:2px_#0a0a0a] lg:text-[13vw]"
        >
          Evidence
        </span>
        <div className="relative mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
          <nav className="flex items-center gap-2 text-[13px] text-neutral-500">
            <Link href="/" className="hover:text-neutral-900">Vehicles</Link>
            <span>/</span>
            <span className="text-neutral-900">Evidence Explorer</span>
          </nav>
          <div className="mt-8 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-bmw-blue">Evidence Explorer</p>
            <h1 className="mt-3 text-4xl font-light tracking-tight sm:text-6xl">Every requirement, traced back to its source.</h1>
            <p className="mt-4 max-w-2xl text-base text-neutral-600 sm:text-lg">
              The raw customer feedback behind every signal and requirement. Filter, search and drill down to the original verbatim.
            </p>
          </div>
          <dl className="mt-10 grid max-w-4xl grid-cols-2 gap-y-6 sm:grid-cols-4">
            <Kpi label="Customer verbatims" value={facets ? totalVerbatims.toLocaleString() : "…"} />
            <Kpi label="Models" value={facets ? String(facets.vehicleCodes.length) : "…"} />
            <Kpi label="Markets" value={facets ? String(facets.markets.length) : "…"} />
            <Kpi label="Classified" value={facets && totalVerbatims ? `${Math.round((classified / totalVerbatims) * 100)}%` : "…"} />
          </dl>
        </div>
      </section>

      {/* ---------- Filters ---------- */}
      <div className="relative mx-auto -mt-14 max-w-[1440px] px-4 sm:px-8">
        <section className="border border-neutral-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
          {/* Model selector */}
          <div className="flex overflow-x-auto border-b border-neutral-200">
            <ModelTab active={!vehicleCode} onClick={() => setVehicleCode("")} code="All" name="All models" count={totalVerbatims} />
            {facets?.vehicleCodes
              .slice()
              .sort((a, b) => a.value.localeCompare(b.value))
              .map((v) => (
                <ModelTab
                  key={v.value}
                  active={vehicleCode === v.value}
                  onClick={() => setVehicleCode(v.value)}
                  code={v.value}
                  name={vehicleName(v.value)}
                  count={v.count}
                />
              ))}
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {/* Components */}
            <div>
              <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">Component</p>
              <div className="flex flex-wrap gap-2">
                <Pill active={!component} onClick={() => setComponent("")}>All</Pill>
                {facets?.components.map((c) => (
                  <Pill key={c.value} active={component === c.value} onClick={() => setComponent(component === c.value ? "" : c.value)}>
                    {COMPONENT_LABEL[c.value] ?? c.value}
                    <span className={clsx("ml-1.5 tabular-nums", component === c.value ? "text-white/60" : "text-neutral-400")}>
                      {c.count.toLocaleString()}
                    </span>
                  </Pill>
                ))}
              </div>
            </div>

            {/* Search + market + country */}
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
              <label className="relative block">
                <span className="sr-only">Search feedback</span>
                <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="9" cy="9" r="6" />
                  <path d="M13.5 13.5L17 17" />
                </svg>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search verbatims or VFC categories, e.g. “digital key”"
                  className="w-full border border-neutral-300 bg-white py-3 pl-10 pr-3 text-[14px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900"
                />
              </label>
              <select
                value={market}
                onChange={(e) => {
                  setMarket(e.target.value);
                  setCountry(""); // avoid confusing zero-result combos like market=US + country=GB
                }}
                className="w-full border border-neutral-300 bg-white px-3 py-3 text-[14px] text-neutral-900 outline-none focus:border-neutral-900"
                aria-label="Market"
              >
                <option value="">All markets</option>
                {facets?.markets.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} ({m.count.toLocaleString()})
                  </option>
                ))}
              </select>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full border border-neutral-300 bg-white px-3 py-3 text-[14px] text-neutral-900 outline-none focus:border-neutral-900"
                aria-label="Country"
              >
                <option value="">All countries</option>
                {facets?.countries
                  .filter((c) => !market || countryToMarket(c.value) === market)
                  .map((c) => (
                    <option key={c.value} value={c.value}>
                      {flag(c.value)} {c.value} ({c.count.toLocaleString()})
                    </option>
                  ))}
              </select>
              <button
                onClick={clearAll}
                disabled={activeFilters.length === 0}
                className="border border-neutral-300 px-5 py-3 text-[14px] font-medium text-neutral-800 transition-colors hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear all
              </button>
            </div>
          </div>
        </section>
      </div>

      {data?.noData ? (
        <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8">
          <div className="flex gap-4 border-l-[3px] border-amber-500 bg-amber-50 p-6 text-[14px] text-amber-950">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[12px] font-bold text-white">!</span>
            <p>
              No real data ingested yet. Copy the datasets into <code className="font-mono">data-raw/</code> and run{" "}
              <code className="font-mono">npm run ingest</code> (see docs/DATA_SETUP.md).
            </p>
          </div>
        </div>
      ) : (
        <div id="results" className="mx-auto grid max-w-[1440px] scroll-mt-20 grid-cols-1 gap-8 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="min-w-0">
            {/* Results header */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Results</p>
                <h2 className="mt-1 text-2xl font-light tracking-tight sm:text-[28px]">
                  {data ? `${data.total.toLocaleString()} matching rows` : "Loading…"}
                </h2>
              </div>
              <Pager page={page} totalPages={totalPages} onPage={goTo} total={data?.total ?? 0} />
            </div>

            {activeFilters.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {activeFilters.map((f) => (
                  <button
                    key={f.label}
                    onClick={f.clear}
                    className="group flex items-center gap-2 bg-neutral-900 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-black"
                  >
                    {f.label}
                    <span className="text-white/50 group-hover:text-white">✕</span>
                  </button>
                ))}
              </div>
            )}

            {error && <div className="mb-5 border-l-[3px] border-red-500 bg-red-50 p-4 text-[14px] text-red-800">Couldn’t load feedback: {error}</div>}

            <div className={clsx("space-y-3 transition-opacity", loading && data && "opacity-50")}>
              {!data && loading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-32 animate-pulse border border-neutral-200 bg-white" />)}

              {grouped.map((g) => (
                <VerbatimCard key={g.id} group={g} vehicleName={vehicleName(g.vehicleCode)} query={debouncedQ} onType={setFeedbackType} />
              ))}

              {data && data.rows.length === 0 && (
                <div className="border border-dashed border-neutral-300 bg-white p-12 text-center">
                  <p className="text-lg font-light">No feedback matches these filters.</p>
                  <button onClick={clearAll} className="mt-4 text-[14px] font-medium text-bmw-blue hover:underline">
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            {data && data.total > PAGE_SIZE && (
              <div className="mt-8 flex justify-center">
                <Pager page={page} totalPages={totalPages} onPage={goTo} total={data.total} />
              </div>
            )}
          </main>

          {/* ---------- Sidebar ---------- */}
          <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
            <section className="border border-neutral-200 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">Feedback mix</p>
              <p className="mt-1 text-[13px] text-neutral-500">For the current filters. Click a type to filter by it.</p>
              {mix && mix.total > 0 ? (
                <>
                  <div className="mt-4 flex h-3 overflow-hidden bg-neutral-100">
                    {Object.entries(mix.byType).map(([t, n]) => (
                      <div key={t} className={(TYPE_STYLE[t] ?? UNCLASSIFIED).bar} style={{ width: `${(n / mix.total) * 100}%` }} title={`${t}: ${n}`} />
                    ))}
                  </div>
                  <ul className="mt-4 space-y-1">
                    {Object.entries(mix.byType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([t, n]) => (
                        <MixRow
                          key={t}
                          label={t}
                          count={n}
                          pct={(n / mix.total) * 100}
                          dot={(TYPE_STYLE[t] ?? UNCLASSIFIED).bar}
                          active={feedbackType === t}
                          onClick={() => setFeedbackType(feedbackType === t ? "" : t)}
                        />
                      ))}
                    <MixRow
                      label="Unclassified"
                      count={Math.max(0, mix.total - Object.values(mix.byType).reduce((a, b) => a + b, 0))}
                      pct={(Math.max(0, mix.total - Object.values(mix.byType).reduce((a, b) => a + b, 0)) / mix.total) * 100}
                      dot={UNCLASSIFIED.bar}
                    />
                  </ul>
                </>
              ) : (
                <div className="mt-4 h-24 animate-pulse bg-neutral-100" />
              )}
            </section>

            <section className="bg-neutral-950 p-5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">About this data</p>
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-300">
                First-party customer verbatims from BMW’s Feedback Explorer datasets, classified with the Vehicle Feature Catalogue (VFC). A
                verbatim can carry several classifications, so it may count once per category.
              </p>
              <Link href="/" className="mt-4 inline-block text-[13px] font-medium text-white underline-offset-2 hover:underline">
                See the requirements built on it →
              </Link>
            </section>
          </aside>
        </div>
      )}

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-neutral-500 sm:px-8">
          <span>BMW Group · Requirements Copilot · TUM Hackathon prototype</span>
          <Link href="/" className="hover:text-neutral-900">← Back to vehicle overview</Link>
        </div>
      </footer>
    </div>
  );
}

// ---------- Pieces ----------

interface VerbatimGroup {
  id: string;
  vehicleCode: string;
  country: string;
  engineType: string;
  text: string;
  tags: { type: string | null; l2: string | null; l3: string | null; component: string }[];
}

// The API returns one row per (verbatim, classification); show each verbatim once.
function groupById(rows: FeedbackRecord[]): VerbatimGroup[] {
  const map = new Map<string, VerbatimGroup>();
  for (const r of rows) {
    const g = map.get(r.id) ?? { id: r.id, vehicleCode: r.vehicleCode, country: r.country, engineType: r.engineType, text: r.text, tags: [] };
    g.tags.push({ type: r.feedbackType || null, l2: r.vfcLevel2, l3: r.vfcLevel3 || null, component: r.component });
    map.set(r.id, g);
  }
  return [...map.values()];
}

function VerbatimCard({
  group,
  vehicleName,
  query,
  onType,
}: {
  group: VerbatimGroup;
  vehicleName: string;
  query: string;
  onType: (t: string) => void;
}) {
  const primary = group.tags.find((t) => t.type)?.type ?? null;
  const accent = primary ? (TYPE_STYLE[primary] ?? UNCLASSIFIED).accent : UNCLASSIFIED.accent;
  return (
    <article className="relative border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-[0_10px_28px_rgba(0,0,0,0.05)] sm:p-6">
      <span className={clsx("absolute inset-y-0 left-0 w-[3px]", accent)} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-neutral-500">
        <span className="font-medium text-neutral-900">
          {group.vehicleCode} <span className="font-normal text-neutral-500">· {vehicleName}</span>
        </span>
        <span className="h-3 w-px bg-neutral-200" />
        <span>
          {flag(group.country)} {group.country}
        </span>
        <span className="h-3 w-px bg-neutral-200" />
        <span className="bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
          {ENGINE_LABEL[group.engineType] ?? group.engineType}
        </span>
        <span className="ml-auto font-mono text-[11px] text-neutral-400">{group.id}</span>
      </div>

      <blockquote className="mt-3 text-[15px] leading-relaxed text-neutral-800">
        <span className="mr-0.5 text-neutral-300">“</span>
        <Highlight text={group.text} query={query} />
        <span className="ml-0.5 text-neutral-300">”</span>
      </blockquote>

      <div className="mt-4 flex flex-wrap gap-2">
        {group.tags.map((t, i) => {
          const style = t.type ? (TYPE_STYLE[t.type] ?? UNCLASSIFIED) : UNCLASSIFIED;
          return (
            <span key={i} className="inline-flex items-center gap-2 border border-neutral-200 py-1 pl-1 pr-2.5 text-[12px] text-neutral-600">
              {t.type ? (
                <button
                  onClick={() => onType(t.type!)}
                  className={clsx("shrink-0 whitespace-nowrap px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]", style.chip)}
                  title={`Show only “${t.type}”`}
                >
                  {t.type}
                </button>
              ) : (
                <span className={clsx("shrink-0 whitespace-nowrap px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]", style.chip)}>Unclassified</span>
              )}
              <span>
                {t.l2 ?? COMPONENT_LABEL[t.component] ?? "General"}
                {t.l3 && <span className="text-neutral-400"> › {t.l3}</span>}
              </span>
            </span>
          );
        })}
      </div>
    </article>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-[#dbe8fb] px-0.5 text-neutral-950">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function ModelTab({ active, onClick, code, name, count }: { active: boolean; onClick: () => void; code: string; name: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "relative min-w-[170px] flex-1 px-5 py-4 text-left transition-colors",
        active ? "bg-white" : "bg-neutral-50 hover:bg-white",
      )}
    >
      <span className={clsx("absolute inset-x-0 bottom-0 h-[3px]", active ? "bg-bmw-blue" : "bg-transparent")} />
      <span className={clsx("block text-[11px] font-semibold uppercase tracking-[0.15em]", active ? "text-bmw-blue" : "text-neutral-400")}>{code}</span>
      <span className={clsx("mt-1 block text-[15px]", active ? "font-medium text-neutral-900" : "text-neutral-700")}>{name}</span>
      <span className="mt-0.5 block text-[12px] tabular-nums text-neutral-400">{count ? `${count.toLocaleString()} verbatims` : ""}</span>
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "border px-3.5 py-2 text-[13px] transition-colors",
        active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900",
      )}
    >
      {children}
    </button>
  );
}

function MixRow({
  label,
  count,
  pct,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  pct: number;
  dot: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
      <span className="flex-1 text-left">{label}</span>
      <span className="tabular-nums text-neutral-500">{count.toLocaleString()}</span>
      <span className="w-10 text-right tabular-nums text-neutral-900">{Math.round(pct)}%</span>
    </>
  );
  const cls = "flex w-full items-center gap-3 px-2 py-2 text-[13px] transition-colors";
  return (
    <li>
      {onClick ? (
        <button onClick={onClick} className={clsx(cls, active ? "bg-neutral-900 text-white [&_span]:text-white" : "text-neutral-800 hover:bg-neutral-50")}>
          {content}
        </button>
      ) : (
        <div className={clsx(cls, "text-neutral-500")}>{content}</div>
      )}
    </li>
  );
}

function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <div className="flex items-center gap-3 text-[13px] text-neutral-600">
      <span className="tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="border border-neutral-300 bg-white px-3 py-2 transition-colors hover:border-neutral-900 disabled:opacity-30 disabled:hover:border-neutral-300"
          aria-label="Previous page"
        >
          ←
        </button>
        <span className="border-y border-neutral-300 bg-white px-3 py-2 tabular-nums text-neutral-900">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="border border-neutral-300 bg-white px-3 py-2 transition-colors hover:border-neutral-900 disabled:opacity-30 disabled:hover:border-neutral-300"
          aria-label="Next page"
        >
          →
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-neutral-300 pl-4">
      <dt className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-500">{label}</dt>
      <dd className="mt-1 text-3xl font-light tabular-nums tracking-tight text-neutral-900">{value}</dd>
    </div>
  );
}
