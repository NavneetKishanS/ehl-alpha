// Converts the real BMW hackathon datasets (data-raw/, gitignored —
// confidential, each teammate needs their own copy) into the JSON fixtures
// the app reads from src/data/ (also gitignored). Re-run this any time the
// source files change:
//
//   npm run ingest
//
// This is an offline/dev-time pipeline, not a runtime upload feature — see
// docs/ROLE_A_BACKEND.md task 1 for turning this into a real
// POST /api/workflows/:id/ingest endpoint later. For now it's the fastest
// way to get the whole team working against real numbers instead of
// hand-written fixtures.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import * as XLSX from "xlsx";
import { mapCategoryToComponent } from "./lib/componentMap";
import type {
  FeedbackRecord,
  SalesVolume,
  CustomerStudyScore,
  ComponentKey,
} from "../src/lib/types";

const RAW = join(__dirname, "..", "data-raw");
const OUT = join(__dirname, "..", "src", "data");

if (!existsSync(RAW)) {
  console.error(
    `\nNo data-raw/ directory found. Copy the real BMW xlsx/PDF files there first (see docs/DATA_SETUP.md).\n`,
  );
  process.exit(1);
}
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const VEHICLES = ["F70", "G60", "G70"] as const;
type VehicleCode = (typeof VEHICLES)[number];

// ---------------------------------------------------------------------------
// 1. Feedback_Explorer sheets -> FeedbackRecord[]
// ---------------------------------------------------------------------------

const allFeedback: FeedbackRecord[] = [];

for (const code of VEHICLES) {
  const path = join(RAW, `${code}_feedback_hackathon.xlsx`);
  if (!existsSync(path)) {
    console.warn(`Skipping ${code}: ${path} not found`);
    continue;
  }
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets["Feedback_Explorer"];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(ws, { defval: null });

  for (const row of rows) {
    const vfc2 = (row["Vfc level2 Name"] as string) ?? null;
    const vfc3 = (row["Vfc level3 Name"] as string) ?? null;
    const component = mapCategoryToComponent(vfc2);
    allFeedback.push({
      id: String(row["ID"]),
      vehicleCode: code,
      country: (row["Country"] as string) ?? "Unknown",
      engineType: (row["Engine Type"] as string) ?? "Unknown",
      feedbackType: (row["Feedback Type"] as string) ?? null,
      text: String(row["Customer Feedback"] ?? "").slice(0, 600),
      vfcLevel2: vfc2 === "no_class_found" ? null : vfc2,
      vfcLevel3: vfc3,
      component,
    });
  }
  console.log(`${code}: ingested ${rows.length} feedback rows`);
}

writeFileSync(join(OUT, "feedback.json"), JSON.stringify(allFeedback));
console.log(`Wrote feedback.json (${allFeedback.length} rows)`);

// ---------------------------------------------------------------------------
// 2. Signals: group feedback by (vehicleCode, component, theme)
// ---------------------------------------------------------------------------

interface RawSignal {
  vehicleCode: VehicleCode;
  component: ComponentKey | "general";
  theme: string;
  frequency: number;
  likes: number;
  wants: number;
  difficultToUse: number;
  defect: number;
  none: number;
  sampleVerbatims: string[];
  feedbackIds: string[];
  countries: Record<string, number>;
}

const signalMap = new Map<string, RawSignal>();

for (const fb of allFeedback) {
  const theme = fb.vfcLevel2 ?? fb.vfcLevel3 ?? "Unclassified feedback";
  const key = `${fb.vehicleCode}__${fb.component}__${theme}`;
  let sig = signalMap.get(key);
  if (!sig) {
    sig = {
      vehicleCode: fb.vehicleCode as VehicleCode,
      component: fb.component,
      theme,
      frequency: 0,
      likes: 0,
      wants: 0,
      difficultToUse: 0,
      defect: 0,
      none: 0,
      sampleVerbatims: [],
      feedbackIds: [],
      countries: {},
    };
    signalMap.set(key, sig);
  }
  sig.frequency++;
  sig.countries[fb.country] = (sig.countries[fb.country] ?? 0) + 1;
  if (fb.feedbackType === "Likes") sig.likes++;
  else if (fb.feedbackType === "Wants") sig.wants++;
  else if (fb.feedbackType === "Difficult to Use") sig.difficultToUse++;
  else if (fb.feedbackType === "Defect") sig.defect++;
  else sig.none++;
  if (sig.sampleVerbatims.length < 6 && fb.text.length > 40) {
    sig.sampleVerbatims.push(fb.text);
  }
  if (sig.feedbackIds.length < 30) sig.feedbackIds.push(fb.id);
}

const signals = Array.from(signalMap.values());
writeFileSync(join(OUT, "signals.json"), JSON.stringify(signals));
console.log(`Wrote signals.json (${signals.length} grouped themes)`);

// ---------------------------------------------------------------------------
// 3. Sales volumes
// ---------------------------------------------------------------------------

const salesSheetByVehicle: Record<VehicleCode, string> = {
  F70: "F70",
  G60: "G60_G68",
  G70: "G70",
};

const sales: SalesVolume[] = [];
const salesPath = join(RAW, "sales_volumes.xlsx");
if (existsSync(salesPath)) {
  const wb = XLSX.readFile(salesPath);
  for (const code of VEHICLES) {
    const ws = wb.Sheets[salesSheetByVehicle[code]];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws);
    for (const row of rows) {
      sales.push({
        vehicleCode: code,
        market: String(row["market"]),
        marketCode: String(row["market_code"]),
        volume2024: Number(row["volume_2024"]) || 0,
        volume2025: Number(row["volume_2025"]) || 0,
        volume2030: Number(row["volume_2030"]) || 0,
      });
    }
  }
}
writeFileSync(join(OUT, "sales.json"), JSON.stringify(sales));
console.log(`Wrote sales.json (${sales.length} rows)`);

// ---------------------------------------------------------------------------
// 4. Customer study: CN_EU_2025 (direct means) + US_2025 (bucket distributions)
// ---------------------------------------------------------------------------

// Column -> {region, vehicleCode, displayModel} for the CN_EU sheet, fixed
// by inspection of the real file's header rows (see docs/DATA_SETUP.md).
const CN_EU_COLUMNS: { col: number; region: "CN" | "EU"; vehicleCode: VehicleCode; model: string }[] = [
  { col: 1, region: "CN", vehicleCode: "G60", model: "BMW 5 Series G68" },
  { col: 2, region: "CN", vehicleCode: "G70", model: "BMW 7 Series G70" },
  { col: 3, region: "EU", vehicleCode: "F70", model: "BMW 1 Series F70" },
  { col: 4, region: "EU", vehicleCode: "G60", model: "BMW 5 Series G60" },
  { col: 5, region: "EU", vehicleCode: "G70", model: "BMW 7 Series G70" },
];

const customerStudy: CustomerStudyScore[] = [];
const studyPath = join(RAW, "F70_G60_G68_G70_customer_studies.xlsx");

if (existsSync(studyPath)) {
  const wb = XLSX.readFile(studyPath);

  const wsCnEu = wb.Sheets["CN_EU_2025"];
  const cnEuRows: unknown[][] = XLSX.utils.sheet_to_json(wsCnEu, { header: 1, defval: null });
  for (let i = 2; i < cnEuRows.length - 1; i += 2) {
    const categoryRow = cnEuRows[i];
    const meanRow = cnEuRows[i + 1];
    const category = categoryRow?.[0] as string | null;
    if (!category || meanRow?.[0] !== "Mean") continue;
    for (const c of CN_EU_COLUMNS) {
      const v = meanRow[c.col];
      if (typeof v === "number") {
        customerStudy.push({
          category,
          model: c.model,
          region: c.region,
          mean: Math.round(v * 100) / 100,
          methodology: "direct_mean",
        });
      }
    }
  }

  // US sheet: variable-height category blocks (header row, "Sample total"
  // row, then up to 7 ordered satisfaction buckets). Reconstruct a 0-10
  // mean from the bucket distribution — flagged as lower-precision
  // (methodology: "distribution_derived") rather than treated as
  // equivalent to the CN/EU direct means.
  const BUCKET_SCORE: Record<string, number> = {
    "I Hate It": 0,
    "A Failure": 1.67,
    Unsatisfactory: 3.33,
    Satisfactory: 5,
    Excellent: 6.67,
    Delightful: 8.33,
    "I Love It": 10,
  };
  const wsUs = wb.Sheets["US_2025"];
  const usRows: unknown[][] = XLSX.utils.sheet_to_json(wsUs, { header: 1, defval: null });
  let i = 0;
  while (i < usRows.length) {
    const row = usRows[i];
    const isHeader = row?.[0] && row[1] === null;
    if (isHeader) {
      const category = String(row[0]).trim();
      const models = [row[2], row[3]]
        .map((m) => (typeof m === "string" ? m.trim() : null))
        .filter((m): m is string => !!m);
      const weighted: number[] = [0, 0];
      const totalPct: number[] = [0, 0];
      let j = i + 2; // skip header + "Sample total"
      while (j < usRows.length && usRows[j]?.[1] === "% of column, sample base" && usRows[j]?.[0] !== "Sample total") {
        const bucket = String(usRows[j][0]);
        const score = BUCKET_SCORE[bucket];
        if (score !== undefined) {
          for (let m = 0; m < models.length; m++) {
            const pct = usRows[j][2 + m];
            if (typeof pct === "number") {
              weighted[m] += score * pct;
              totalPct[m] += pct;
            }
          }
        }
        j++;
      }
      models.forEach((model, m) => {
        if (totalPct[m] > 0) {
          const vehicleCode = model.includes("G60") ? "G60" : model.includes("G70") ? "G70" : null;
          if (vehicleCode) {
            customerStudy.push({
              category,
              model,
              region: "US",
              mean: Math.round((weighted[m] / totalPct[m]) * 100) / 100,
              methodology: "distribution_derived",
            });
          }
        }
      });
      i = j;
    } else {
      i++;
    }
  }
}

writeFileSync(join(OUT, "customer-study.json"), JSON.stringify(customerStudy));
console.log(`Wrote customer-study.json (${customerStudy.length} rows)`);

// ---------------------------------------------------------------------------
// 5. Equipment PDFs: chunk the extracted text by section, keep as raw
//    excerpts for citation. Full standard/optional-equipment matrix parsing
//    is a known gap — see docs/DATA_SETUP.md for why and how to extend this.
// ---------------------------------------------------------------------------

interface EquipmentChunk {
  vehicleCode: VehicleCode;
  section: string;
  text: string;
}

const equipmentChunks: EquipmentChunk[] = [];
const SECTION_HEADERS = [
  "AUSGEWÄHLTE SERIENAUSSTATTUNGEN",
  "SONDERAUSSTATTUNGEN",
  "FAHRZEUGPREISE",
  "TECHNISCHE WERTE",
];

for (const code of VEHICLES) {
  const txtPath = join(RAW, `${code}_OptionList.txt`);
  if (!existsSync(txtPath)) {
    console.warn(`Skipping equipment for ${code}: run "pdftotext -layout ${code}_OptionList.PDF ${code}_OptionList.txt" in data-raw/ first`);
    continue;
  }
  const text = readFileSync(txtPath, "utf-8");
  const lines = text.split("\n");
  let currentSection = "Overview";
  let buffer: string[] = [];
  const flush = () => {
    const joined = buffer.join("\n").trim();
    if (joined.length > 80) {
      equipmentChunks.push({ vehicleCode: code, section: currentSection, text: joined.slice(0, 2000) });
    }
    buffer = [];
  };
  for (const line of lines) {
    const headerHit = SECTION_HEADERS.find((h) => line.toUpperCase().includes(h));
    if (headerHit) {
      flush();
      currentSection = headerHit;
    }
    buffer.push(line);
    if (buffer.length > 60) flush();
  }
  flush();
}

writeFileSync(join(OUT, "equipment-chunks.json"), JSON.stringify(equipmentChunks));
console.log(`Wrote equipment-chunks.json (${equipmentChunks.length} chunks)`);

console.log("\nDone. Restart `npm run dev` to pick up the new src/data/*.json.");
