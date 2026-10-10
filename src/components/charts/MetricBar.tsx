// A single labeled metric bar with gridlines and a numeric readout —
// deliberately plain (no gradients, no animation) so a page of 7 of these
// reads as a data table, not a chat-app decoration.
export function MetricBar({
  label,
  value,
  max = 100,
  sublabel,
  accent = "default",
}: {
  label: string;
  value: number;
  max?: number;
  sublabel?: string;
  accent?: "default" | "warn" | "good";
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const barColor = accent === "warn" ? "bg-amber-500" : accent === "good" ? "bg-emerald-500" : "bg-neutral-300";
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-2 py-0.5 text-[11px]">
      <span className="truncate text-neutral-400" title={label}>
        {label}
      </span>
      <div className="relative h-3 bg-neutral-800">
        <div className="absolute inset-y-0 left-1/4 w-px bg-neutral-700" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-700" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-neutral-700" />
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-right font-mono tabular-nums text-neutral-300">{value}</span>
      {sublabel && <span className="col-span-3 -mt-0.5 truncate text-[10px] text-neutral-600">{sublabel}</span>}
    </div>
  );
}
