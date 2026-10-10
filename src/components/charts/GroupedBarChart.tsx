// Real SVG bar chart with axis gridlines and value labels — for comparing
// a metric (e.g. customer-study mean) across a handful of named series. No
// charting library: this is small enough to hand-roll and keeps the bundle
// lean, see docs/ROLE_C_PM_FRONTEND.md.
export function GroupedBarChart({
  data,
  max = 10,
  height = 160,
  unit = "",
  highlightLabel,
}: {
  data: { label: string; value: number; sub?: string }[];
  max?: number;
  height?: number;
  unit?: string;
  highlightLabel?: string;
}) {
  if (data.length === 0) return <p className="text-xs text-neutral-600">No comparable data.</p>;
  const width = Math.max(320, data.length * 72);
  const padLeft = 28;
  const padBottom = 34;
  const plotH = height - padBottom;
  const barW = (width - padLeft) / data.length - 12;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="overflow-visible">
      {gridLines.map((g) => {
        const y = plotH - g * plotH;
        return (
          <g key={g}>
            <line x1={padLeft} x2={width} y1={y} y2={y} stroke="#2a3242" strokeWidth={1} />
            <text x={0} y={y + 3} fontSize={9} fill="#6b7280" fontFamily="monospace">
              {(g * max).toFixed(0)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = padLeft + i * (barW + 12) + 6;
        const h = Math.max(1, (Math.min(d.value, max) / max) * plotH);
        const y = plotH - h;
        const isHighlighted = highlightLabel && d.label.includes(highlightLabel);
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={h} fill={isHighlighted ? "#1c69d4" : "#4a5568"} />
            <text x={x + barW / 2} y={y - 6} fontSize={10} fill="#e5e9f0" textAnchor="middle" fontFamily="monospace">
              {d.value.toFixed(1)}
              {unit}
            </text>
            <text x={x + barW / 2} y={plotH + 14} fontSize={9} fill="#9ca3af" textAnchor="middle">
              {truncate(d.label, 12)}
            </text>
            {d.sub && (
              <text x={x + barW / 2} y={plotH + 26} fontSize={8} fill="#6b7280" textAnchor="middle">
                {d.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
