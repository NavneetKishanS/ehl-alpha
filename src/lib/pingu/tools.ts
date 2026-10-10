// Tools Pingu can call. query_feedback / search_verbatims give exact answers
// over the row-level feedback (the prompt context only has aggregates), and
// show_chart lets the model hand a chart to the UI instead of describing it.

import { loadFeedback } from "@/lib/realData";
import type { ChartSpec } from "./types";

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "query_feedback",
      description:
        "Count customer feedback rows, optionally filtered and grouped. Use for exact counts and rankings (e.g. top dislikes for BEV owners in the US). Returns the top groups by row count.",
      parameters: {
        type: "object",
        properties: {
          vehicle: { type: "string", enum: ["F70", "G60", "G70"] },
          country: { type: "string", description: "Two-letter country code, e.g. US, KR, GB" },
          engine_type: { type: "string", enum: ["ICE", "PHEV", "BEVE"] },
          feedback_type: { type: "string", enum: ["Likes", "Wants", "Difficult to Use", "Defect"] },
          component: { type: "string", enum: ["exterior", "interior", "windows", "steering", "engine", "battery", "general"] },
          theme_contains: { type: "string", description: "Case-insensitive substring of the VFC theme name, e.g. 'charging'" },
          group_by: { type: "string", enum: ["theme", "component", "country", "engine_type", "feedback_type", "vehicle"] },
          limit: { type: "integer", description: "Max groups to return (default 10, max 25)" },
        },
        required: ["group_by"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_verbatims",
      description: "Find real customer comments containing a keyword. Returns up to 5 short excerpts. Use to quote what customers actually say.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          vehicle: { type: "string", enum: ["F70", "G60", "G70"] },
          feedback_type: { type: "string", enum: ["Likes", "Wants", "Difficult to Use", "Defect"] },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_chart",
      description:
        "Display a chart to the user. Call it whenever they ask for a graph/chart/plot, or when a comparison is clearer visually. Only use numbers taken from the data. 'bar' = vertical grouped bars (several series, or few categories); 'hbar' = horizontal ranked bars (single series, long labels).",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["bar", "hbar"] },
          title: { type: "string" },
          unit: { type: "string", description: "Optional unit suffix, e.g. '%' or ' units'" },
          categories: { type: "array", items: { type: "string" }, description: "At most 12 category labels" },
          series: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, values: { type: "array", items: { type: "number" } } },
              required: ["name", "values"],
            },
            description: "One entry per series; values align with categories",
          },
          note: { type: "string", description: "Optional one-line caveat or data source" },
        },
        required: ["type", "title", "categories", "series"],
      },
    },
  },
] as const;

type Args = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export function queryFeedback(args: Args): string {
  const vehicle = str(args.vehicle);
  const country = str(args.country)?.toUpperCase();
  const engine = str(args.engine_type);
  const type = str(args.feedback_type);
  const component = str(args.component);
  const theme = str(args.theme_contains)?.toLowerCase();
  const groupBy = str(args.group_by) ?? "theme";
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 25);

  const rows = loadFeedback().filter(
    (r) =>
      (!vehicle || r.vehicleCode === vehicle) &&
      (!country || r.country === country) &&
      (!engine || r.engineType === engine) &&
      (!type || r.feedbackType === type) &&
      (!component || r.component === component) &&
      (!theme || (r.vfcLevel2 ?? "").toLowerCase().includes(theme)),
  );

  const keyOf: Record<string, (r: (typeof rows)[number]) => string | null> = {
    theme: (r) => r.vfcLevel2,
    component: (r) => r.component,
    country: (r) => r.country,
    engine_type: (r) => r.engineType,
    feedback_type: (r) => r.feedbackType || "untyped",
    vehicle: (r) => r.vehicleCode,
  };
  const key = keyOf[groupBy] ?? keyOf.theme;

  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k || k === "no_class_found") continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k, count]) => ({ key: k, count }));
  return JSON.stringify({ matchingRows: rows.length, groupBy, groups });
}

export function searchVerbatims(args: Args): string {
  const query = str(args.query)?.toLowerCase();
  if (!query) return JSON.stringify({ error: "query is required" });
  const vehicle = str(args.vehicle);
  const type = str(args.feedback_type);
  const hits: { id: string; vehicle: string; type: string | null; text: string }[] = [];
  let total = 0;
  for (const r of loadFeedback()) {
    if (vehicle && r.vehicleCode !== vehicle) continue;
    if (type && r.feedbackType !== type) continue;
    if (!r.text.toLowerCase().includes(query)) continue;
    total++;
    if (hits.length < 5) hits.push({ id: r.id, vehicle: r.vehicleCode, type: r.feedbackType, text: r.text.slice(0, 240) });
  }
  return JSON.stringify({ totalMatches: total, examples: hits });
}

export function validateChart(args: Args): ChartSpec | string {
  const categories = Array.isArray(args.categories) ? args.categories.map(String).slice(0, 12) : [];
  const series = (Array.isArray(args.series) ? args.series : [])
    .map((s: unknown) => {
      const o = s as { name?: unknown; values?: unknown };
      const values = Array.isArray(o.values) ? o.values.map(Number).slice(0, categories.length) : [];
      return { name: String(o.name ?? ""), values };
    })
    .filter((s) => s.values.length === categories.length && s.values.every((v) => Number.isFinite(v)))
    .slice(0, 4);
  if (!categories.length || !series.length) return "Chart rejected: categories and series must be non-empty and the same length.";
  return {
    type: args.type === "hbar" ? "hbar" : "bar",
    title: String(args.title ?? "Chart"),
    unit: str(args.unit),
    categories,
    series,
    note: str(args.note),
  };
}
