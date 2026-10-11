// Deterministic requirement derivation + scoring from real ingested data.
// No AI involved here on purpose — see docs/ROLE_B_AI.md for which of
// these factors stay deterministic forever (frequency, sales_relevance,
// evidence_strength) vs. which Role B upgrades to an LLM call with cited
// sources (competitive_gap, strategic_fit) once real web/competitor data
// is available. `effort` is intentionally never computed here — it's a
// placeholder until an R&D stakeholder confirms it via review.

import type { ComponentKey, RequirementCategory, ScoreFactor } from "./types";
import type { RawSignal } from "./realData";
import type { CustomerStudyScore, SalesVolume } from "./types";

export type DerivedKind = "pain" | "opportunity" | "preserve";

export interface Candidate {
  signal: RawSignal;
  kind: DerivedKind;
  concentration: number; // 0-1, how dominant the driving sentiment is within this theme
}

export function classifySignal(signal: RawSignal): Candidate {
  const { frequency, likes, wants, difficultToUse, defect } = signal;
  const negative = difficultToUse + defect;
  const shares = [
    { kind: "preserve" as const, value: likes / frequency },
    { kind: "opportunity" as const, value: wants / frequency },
    { kind: "pain" as const, value: negative / frequency },
  ];
  shares.sort((a, b) => b.value - a.value);
  return { signal, kind: shares[0].kind, concentration: shares[0].value };
}

// Pick up to `max` signals for a component, prioritizing pain points,
// then customer-requested gaps, then strengths worth protecting (US-2.2) —
// in that order, since the brief asks us to focus on gaps/opportunities
// first and "must not lose" second.
export function pickCandidates(signals: RawSignal[], max = 4): Candidate[] {
  const classified = signals
    .map(classifySignal)
    .filter((c) => c.signal.frequency >= 3); // below this, not enough evidence to act on
  const byKind = (k: DerivedKind) =>
    classified.filter((c) => c.kind === k).sort((a, b) => b.signal.frequency - a.signal.frequency);

  const pains = byKind("pain");
  const opportunities = byKind("opportunity");
  const preserves = byKind("preserve");

  const picked: Candidate[] = [];
  picked.push(...pains.slice(0, 2));
  if (opportunities[0]) picked.push(opportunities[0]);
  if (preserves[0] && picked.length < max) picked.push(preserves[0]);
  return picked.slice(0, max);
}

const COMPONENT_TO_CATEGORY: Record<ComponentKey, RequirementCategory> = {
  battery: "range_charging",
  engine: "driving_experience",
  steering: "usability",
  windows: "comfort",
  interior: "comfort",
  exterior: "design_quality",
};

export function categoryFor(component: ComponentKey): RequirementCategory {
  return COMPONENT_TO_CATEGORY[component];
}

export function titleFor(candidate: Candidate): string {
  const { signal, kind } = candidate;
  if (kind === "pain") return `Reduce friction: ${signal.theme}`;
  if (kind === "opportunity") return `Deliver what customers are asking for: ${signal.theme}`;
  return `Protect this strength in the next generation: ${signal.theme}`;
}

export function descriptionFor(candidate: Candidate): string {
  const { signal, kind, concentration } = candidate;
  const pct = Math.round(concentration * 100);
  const countries = Object.entries(signal.countries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c)
    .join(", ");
  const sample = signal.sampleVerbatims[0]?.slice(0, 200) ?? "";
  const label =
    kind === "pain" ? "flagged as Difficult to Use / Defect" : kind === "opportunity" ? "explicitly requested (Wants)" : "called out as a Like";
  return `${signal.frequency} verbatims mention "${signal.theme}" (top markets: ${countries || "n/a"}); ${pct}% ${label}. Representative feedback: "${sample}${sample.length >= 200 ? "…" : ""}"`;
}

export function assumptionsFor(candidate: Candidate): string[] {
  if (candidate.kind === "opportunity") {
    return ["Assumes the requested capability stays technically and commercially viable through the next model year."];
  }
  if (candidate.kind === "preserve") {
    return ["Assumes competitors do not close this gap before the next generation launches."];
  }
  return [];
}

function evidenceLevel(frequency: number): "strong" | "moderate" | "weak" {
  if (frequency >= 15) return "strong";
  if (frequency >= 5) return "moderate";
  return "weak";
}

export function evidenceLevelFor(candidate: Candidate) {
  return evidenceLevel(candidate.signal.frequency);
}

// Keyword map from our 6 components to the customer-study's own category
// labels (its 36 categories are a different taxonomy than VFC, so this is
// a second, separate mapping — see docs/DATA_SETUP.md).
export const STUDY_CATEGORY_KEYWORDS: Record<ComponentKey, string[]> = {
  battery: ["fuel economy", "energy efficiency"],
  engine: ["acceleration", "roadholding", "sportiness"],
  steering: ["easy to read", "instruments", "navigation", "driving position"],
  windows: ["all round visibility", "visibility"],
  interior: ["interior", "seating", "roominess", "luggage", "comfort"],
  exterior: ["exterior styling", "build quality"],
};

export function competitiveGap(
  component: ComponentKey,
  vehicleCode: string,
  region: "CN" | "EU" | "US",
  study: CustomerStudyScore[],
): { value: number; rationale: string } {
  const keywords = STUDY_CATEGORY_KEYWORDS[component];
  const rows = study.filter(
    (r) => r.region === region && keywords.some((k) => r.category.toLowerCase().includes(k)),
  );
  if (rows.length === 0) {
    return { value: 50, rationale: "No customer-study category could be matched to this component; defaulting to neutral." };
  }
  const ours = rows.filter((r) => r.model.includes(vehicleCode));
  const others = rows.filter((r) => !r.model.includes(vehicleCode));
  if (ours.length === 0 || others.length === 0) {
    return { value: 50, rationale: "Matched customer-study categories but no same-region comparison model; defaulting to neutral." };
  }
  const ourMean = avg(ours.map((r) => r.mean));
  const bestOther = Math.max(...others.map((r) => r.mean));
  const gap = bestOther - ourMean; // positive = we're behind
  const value = clamp(Math.round(50 + gap * 15), 0, 100);
  return {
    value,
    rationale: `Customer study (${region}): we score ${ourMean.toFixed(2)}/10 vs. best sibling model ${bestOther.toFixed(2)}/10 on related categories.`,
  };
}

export function salesRelevance(vehicleCode: string, market: string, sales: SalesVolume[]): { value: number; rationale: string } {
  const row = sales.find((s) => s.vehicleCode === vehicleCode && s.market === market);
  if (!row || row.volume2025 === 0) {
    return { value: 30, rationale: `No ${market} sales volume on record for ${vehicleCode}.` };
  }
  const growth = (row.volume2030 - row.volume2025) / row.volume2025;
  const value = clamp(Math.round(50 + growth * 150), 0, 100);
  return {
    value,
    rationale: `${market} volume: ${row.volume2025.toLocaleString()} (2025) → ${row.volume2030.toLocaleString()} (2030 est.), ${(growth * 100).toFixed(0)}% growth.`,
  };
}

export function strategicFit(component: ComponentKey): { value: number; rationale: string } {
  const elevated: ComponentKey[] = ["battery", "steering"];
  return elevated.includes(component)
    ? { value: 70, rationale: "Aligned with BMW Group's stated electrification/connected-driving strategy." }
    : { value: 50, rationale: "No explicit strategic-priority signal found for this component; defaulting to neutral." };
}

export function buildScoreFactors(args: {
  candidate: Candidate;
  maxFrequencyInVehicle: number;
  component: ComponentKey;
  vehicleCode: string;
  region: "CN" | "EU" | "US";
  market: string;
  sales: SalesVolume[];
  study: CustomerStudyScore[];
}): ScoreFactor[] {
  const { candidate, maxFrequencyInVehicle, component, vehicleCode, region, market, sales, study } = args;
  const freqRaw = clamp(Math.round((candidate.signal.frequency / maxFrequencyInVehicle) * 100), 0, 100);
  const impactRaw = clamp(Math.round(candidate.concentration * 100), 0, 100);
  const gap = competitiveGap(component, vehicleCode, region, study);
  const sr = salesRelevance(vehicleCode, market, sales);
  const sf = strategicFit(component);
  const ev = evidenceLevel(candidate.signal.frequency) === "strong" ? 90 : evidenceLevel(candidate.signal.frequency) === "moderate" ? 65 : 35;

  return [
    { key: "customer_impact", label: "Customer impact", weight: 0.25, rawValue: impactRaw, rationale: `${Math.round(candidate.concentration * 100)}% of this theme's feedback shares the same sentiment (${candidate.kind}).` },
    { key: "frequency", label: "Signal frequency", weight: 0.15, rawValue: freqRaw, rationale: `${candidate.signal.frequency} verbatims, ${freqRaw}% of this vehicle's single largest theme.` },
    { key: "sales_relevance", label: "Sales relevance", weight: 0.15, rawValue: sr.value, rationale: sr.rationale },
    { key: "competitive_gap", label: "Competitive gap", weight: 0.15, rawValue: gap.value, rationale: gap.rationale },
    { key: "strategic_fit", label: "Strategic fit", weight: 0.1, rawValue: sf.value, rationale: sf.rationale },
    { key: "effort_inverse", label: "Feasibility (inverse effort)", weight: 0.1, rawValue: 50, rationale: "Not yet estimated — placeholder pending R&D stakeholder review." },
    { key: "evidence_strength", label: "Evidence strength", weight: 0.1, rawValue: ev, rationale: `${candidate.signal.frequency} first-party verbatims → ${evidenceLevel(candidate.signal.frequency)} evidence.` },
  ];
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
