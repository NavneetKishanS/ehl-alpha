"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartSpec } from "@/lib/pingu/types";

// Light-theme SVG charts for Pingu's answers. Same hand-rolled approach as
// components/charts (no charting library). The whole chart — title, legend,
// plot, note — is one SVG so it can be expanded full screen and exported to
// PNG exactly as drawn.
const COLORS = ["#1c69d4", "#4a5568", "#16a34a", "#d97706"];
const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
const MONO = "ui-monospace, Menlo, Consolas, monospace";

export function PinguChart({ chart }: { chart: ChartSpec }) {
  const [expanded, setExpanded] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <figure className="border border-neutral-200 bg-white">
      <div className="flex justify-end gap-1 border-b border-neutral-100 px-2 py-1">
        <ToolButton label="Download PNG" onClick={() => downloadPng(svgRef.current, chart.title)}>
          ↓ PNG
        </ToolButton>
        <ToolButton label="View full screen" onClick={() => setExpanded(true)}>
          ⤢ Expand
        </ToolButton>
      </div>
      <div className="p-2">
        <ChartSvg chart={chart} svgRef={svgRef} />
      </div>
      {expanded && <ExpandedChart chart={chart} onClose={() => setExpanded(false)} />}
    </figure>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="px-2 py-0.5 text-[11px] font-medium text-neutral-600 transition-colors hover:text-bmw-blue"
    >
      {children}
    </button>
  );
}

function ExpandedChart({ chart, onClose }: { chart: ChartSpec; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/70 p-4 sm:p-10" onClick={onClose}>
      <div role="dialog" aria-label={chart.title} className="flex max-h-full w-full max-w-5xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">Pingu chart</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadPng(svgRef.current, chart.title)}
              className="border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-800 transition-colors hover:border-bmw-blue hover:text-bmw-blue"
            >
              ↓ Download PNG
            </button>
            <button type="button" onClick={onClose} aria-label="Close full screen" className="px-2 text-xl leading-none text-neutral-500 hover:text-neutral-900">
              ×
            </button>
          </div>
        </div>
        <div className="overflow-auto p-4 sm:p-6">
          <ChartSvg chart={chart} svgRef={svgRef} />
        </div>
      </div>
    </div>
  );
}

function fmt(v: number) {
  return Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-US") : String(Math.round(v * 100) / 100);
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function ChartSvg({ chart, svgRef }: { chart: ChartSpec; svgRef: React.RefObject<SVGSVGElement> }) {
  const unit = chart.unit ?? "";
  const max = Math.max(1, ...chart.series.flatMap((s) => s.values));
  const multi = chart.series.length > 1;
  const headerH = multi ? 62 : 40;
  const noteH = chart.note ? 24 : 8;

  const body =
    chart.type === "hbar" ? layoutHBars(chart, max, unit, headerH) : layoutVBars(chart, max, unit, headerH);
  const width = body.width;
  const height = headerH + body.height + noteH;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ display: "block", maxHeight: "80vh" }}
      fontFamily={FONT}
      role="img"
      aria-label={chart.title}
    >
      <rect width={width} height={height} fill="#ffffff" />
      <text x={12} y={24} fontSize={15} fontWeight={600} fill="#111827">
        {trunc(chart.title, Math.floor(width / 8.5))}
      </text>
      {multi &&
        chart.series.map((s, i) => {
          const x = 12 + chart.series.slice(0, i).reduce((acc, p) => acc + p.name.length * 6.2 + 28, 0);
          return (
            <g key={s.name}>
              <rect x={x} y={39} width={10} height={10} fill={COLORS[i % COLORS.length]} />
              <text x={x + 15} y={48} fontSize={11} fill="#4b5563">
                {s.name}
              </text>
            </g>
          );
        })}
      <g transform={`translate(0 ${headerH})`}>{body.node}</g>
      {chart.note && (
        <text x={12} y={height - 8} fontSize={10} fill="#6b7280">
          {trunc(chart.note, Math.floor(width / 5.5))}
        </text>
      )}
    </svg>
  );
}

interface Layout {
  width: number;
  height: number;
  node: React.ReactNode;
}

function layoutVBars(chart: ChartSpec, max: number, unit: string, _headerH: number): Layout {
  const n = chart.series.length;
  const barW = 22;
  const groupW = n * barW + 26;
  const padLeft = 62;
  const width = Math.max(480, padLeft + chart.categories.length * groupW + 16);
  const plotTop = 16;
  const plotH = 220;
  const labelH = 40;
  const height = plotTop + plotH + labelH;
  const slot = (width - padLeft - 8) / chart.categories.length;

  const node = (
    <>
      {[0, 0.25, 0.5, 0.75, 1].map((g) => {
        const y = plotTop + plotH - g * plotH;
        return (
          <g key={g}>
            <line x1={padLeft} x2={width - 8} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={padLeft - 6} y={y + 3} fontSize={10} fill="#6b7280" textAnchor="end" fontFamily={MONO}>
              {fmt(g * max)}
            </text>
          </g>
        );
      })}
      {chart.categories.map((cat, ci) => {
        const groupStart = padLeft + ci * slot + (slot - n * barW) / 2;
        return (
          <g key={cat}>
            {chart.series.map((s, si) => {
              const h = Math.max(1, (s.values[ci] / max) * plotH);
              const x = groupStart + si * barW;
              const y = plotTop + plotH - h;
              return (
                <g key={s.name}>
                  <rect x={x} y={y} width={barW - 2} height={h} fill={COLORS[si % COLORS.length]} />
                  {n <= 2 && (
                    <text x={x + (barW - 2) / 2} y={y - 4} fontSize={10} fill="#374151" textAnchor="middle" fontFamily={MONO}>
                      {fmt(s.values[ci])}
                      {unit}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={padLeft + ci * slot + slot / 2} y={plotTop + plotH + 18} fontSize={11} fill="#374151" textAnchor="middle">
              {trunc(cat, Math.max(8, Math.floor(slot / 6.5)))}
            </text>
          </g>
        );
      })}
    </>
  );
  return { width, height, node };
}

function layoutHBars(chart: ChartSpec, max: number, unit: string, _headerH: number): Layout {
  const n = chart.series.length;
  const width = 560;
  const labelW = 170;
  const valueW = 78;
  const barH = 14;
  const rowH = n * (barH + 2) + 12;
  const plotW = width - labelW - valueW - 12;
  const height = chart.categories.length * rowH + 8;

  const node = (
    <>
      {chart.categories.map((cat, ci) => {
        const y = ci * rowH + 4;
        return (
          <g key={cat}>
            <text x={labelW - 8} y={y + (n * (barH + 2)) / 2 + 3} fontSize={11} fill="#374151" textAnchor="end">
              {trunc(cat, 28)}
            </text>
            {chart.series.map((s, si) => {
              const w = Math.max(1, (s.values[ci] / max) * plotW);
              const by = y + si * (barH + 2);
              return (
                <g key={s.name}>
                  <rect x={labelW} y={by} width={plotW} height={barH} fill="#f3f4f6" />
                  <rect x={labelW} y={by} width={w} height={barH} fill={COLORS[si % COLORS.length]} />
                  <text x={labelW + plotW + 8} y={by + 11} fontSize={10} fill="#111827" fontFamily={MONO}>
                    {fmt(s.values[ci])}
                    {unit}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
  return { width, height, node };
}

// Serialize the on-screen SVG, rasterize at 2x onto a white canvas, download.
function downloadPng(svg: SVGSVGElement | null, title: string) {
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  const scale = 2;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(vb.width));
  clone.setAttribute("height", String(vb.height));
  clone.style.maxHeight = "";
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = vb.width * scale;
    canvas.height = vb.height * scale;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pingu-chart"}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, "image/png");
    }
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}
