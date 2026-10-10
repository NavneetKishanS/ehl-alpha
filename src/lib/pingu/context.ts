// Builds the data context Pingu answers from. Everything comes from the
// ingested fixtures in src/data/ (signals, customer study, sales, feedback)
// via realData.ts — the same data the rest of the app uses — condensed to a
// compact text block so it fits in a prompt. Row-level questions that need
// exact counts are answered with the query tools in tools.ts instead.

import { loadCustomerStudy, loadFeedback, loadSales, loadSignals } from "@/lib/realData";

const VEHICLES: Record<string, string> = { F70: "BMW 1 Series", G60: "BMW 5 Series (G68 = China long-wheelbase variant)", G70: "BMW 7 Series" };

let cached: string | null = null;

export function hasPinguData(): boolean {
  return loadSignals().length > 0;
}

export function buildContext(): string {
  if (cached) return cached;

  const sections: string[] = [];

  sections.push(
    "VEHICLES\n" +
      Object.entries(VEHICLES)
        .map(([code, name]) => `${code} = ${name}`)
        .join("\n") +
      "\nFeedback types: Likes, Wants (requests for something missing), Difficult to Use, Defect. Engine types: ICE, PHEV, BEVE (battery-electric).",
  );

  const sales = loadSales();
  if (sales.length) {
    sections.push(
      "SALES VOLUMES (units; 2030 is an estimate)\nvehicle | market | 2024 | 2025 | 2030\n" +
        sales.map((s) => `${s.vehicleCode} | ${s.market} | ${s.volume2024} | ${s.volume2025} | ${s.volume2030}`).join("\n"),
    );
  }

  const study = loadCustomerStudy();
  if (study.length) {
    sections.push(
      "CUSTOMER STUDY 2025 (satisfaction means, 0-10; CN/EU are direct means, US is derived from bucket distributions so less precise)\ncategory | model | region | mean\n" +
        study.map((s) => `${s.category} | ${s.model} | ${s.region} | ${s.mean.toFixed(2)}`).join("\n"),
    );
  }

  const feedback = loadFeedback();
  if (feedback.length) {
    sections.push("FEEDBACK OVERVIEW (row counts; one verbatim can carry several tags)\n" + overview(feedback));
  }

  const signals = loadSignals()
    .filter((s) => s.theme && s.theme !== "no_class_found")
    .sort((a, b) => b.frequency - a.frequency);
  if (signals.length) {
    sections.push(
      "FEEDBACK THEMES (BMW's own VFC categories, grouped by vehicle and app component)\nvehicle | component | theme | total | likes | wants | difficult-to-use | defects\n" +
        signals
          .map((s) => `${s.vehicleCode} | ${s.component} | ${s.theme} | ${s.frequency} | ${s.likes} | ${s.wants} | ${s.difficultToUse} | ${s.defect}`)
          .join("\n"),
    );
  }

  cached = sections.join("\n\n");
  return cached;
}

function overview(rows: ReturnType<typeof loadFeedback>): string {
  const lines: string[] = [];
  for (const code of Object.keys(VEHICLES)) {
    const own = rows.filter((r) => r.vehicleCode === code);
    if (!own.length) continue;
    lines.push(
      `${code}: ${own.length} rows`,
      `  by feedback type: ${tally(own, (r) => r.feedbackType || "untyped")}`,
      `  by engine type: ${tally(own, (r) => r.engineType)}`,
      `  by country (top 8): ${tally(own, (r) => r.country, 8)}`,
      `  by component: ${tally(own, (r) => r.component)}`,
    );
  }
  return lines.join("\n");
}

function tally<T>(rows: T[], key: (r: T) => string, limit = 20): string {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, n]) => `${k} ${n}`)
    .join(", ");
}
