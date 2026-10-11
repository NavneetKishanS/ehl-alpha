// Builds the in-memory store's starting state.
//
// If a teammate has run `npm run ingest` (real BMW data present in
// src/data/*.json, gitignored), buildSeed() assembles real workflows for
// all three vehicle lines (F70/1 Series, G60/5 Series, G70/7 Series) from
// real verbatims, sales volumes and customer-study benchmarks — see
// buildRealSeed() below and docs/DATA_SETUP.md.
//
// Otherwise it falls back to buildMockSeed(): one hand-written "battery"
// workflow for the BMW 5 Series, so the app still runs end to end for
// anyone who hasn't copied the (confidential, never-committed) datasets
// yet.

import { nanoid } from "nanoid";
import type {
  Vehicle,
  VehicleComponent,
  Workflow,
  Requirement,
  Signal,
  SourceRecord,
  Stakeholder,
  StakeholderReview,
  AuditLogEntry,
  AISummary,
  ComponentKey,
} from "./types";
import {
  hasRealData,
  loadFeedback,
  loadSignals,
  loadSales,
  loadCustomerStudy,
  type RawSignal,
} from "./realData";
import { pickCandidates, titleFor, descriptionFor, assumptionsFor, evidenceLevelFor, categoryFor, buildScoreFactors, type Candidate } from "./deriveRequirements";
import { applyJudgmentCache } from "./aiFactors";

export function buildSeed() {
  return hasRealData() ? buildRealSeed() : buildMockSeed();
}

// ===========================================================================
// REAL DATA SEED
// ===========================================================================

const COMPONENT_KEYS: ComponentKey[] = ["battery", "exterior", "interior", "windows", "steering", "engine"];
const COMPONENT_LABEL: Record<ComponentKey, string> = {
  battery: "Battery & Charging",
  exterior: "Exterior & Design",
  interior: "Interior & Cabin",
  windows: "Windows & Glass",
  steering: "Steering & Cockpit",
  engine: "Powertrain",
};
const HOTSPOT: Record<ComponentKey, { xPct: number; yPct: number }> = {
  battery: { xPct: 49, yPct: 61 },
  exterior: { xPct: 50, yPct: 76 },
  interior: { xPct: 61, yPct: 46 },
  windows: { xPct: 76, yPct: 38 },
  steering: { xPct: 58, yPct: 50 },
  engine: { xPct: 24, yPct: 59 },
};
const VEHICLE_META: Record<string, { name: string; generation: string }> = {
  F70: { name: "BMW 1 Series", generation: "F70 → successor" },
  G60: { name: "BMW 5 Series", generation: "G60/G68 → successor" },
  G70: { name: "BMW 7 Series", generation: "G70 → successor" },
};
const PRIMARY_MARKET: Record<string, string> = { F70: "Europe", G60: "Europe", G70: "USA" };
const MARKET_CODE: Record<string, "EU" | "CN" | "US"> = { Europe: "EU", China: "CN", USA: "US" };

function buildRealSeed() {
  const feedback = loadFeedback();
  const feedbackById = new Map(feedback.map((f) => [f.id, f]));
  const rawSignals = loadSignals();
  const sales = loadSales();
  const customerStudy = loadCustomerStudy();

  const vehicleCodes = Array.from(new Set(rawSignals.map((s) => s.vehicleCode))).sort();

  const vehicles: Vehicle[] = vehicleCodes.map((code) => {
    const markets = sales
      .filter((s) => s.vehicleCode === code && s.volume2025 > 0 && s.marketCode in { EU: 1, CN: 1, US: 1 })
      .map((s) => s.market);
    return {
      id: `veh_${code.toLowerCase()}`,
      name: VEHICLE_META[code]?.name ?? code,
      generation: VEHICLE_META[code]?.generation ?? code,
      markets: markets.length ? markets : ["Europe"],
    };
  });

  const components: VehicleComponent[] = [];
  const workflows: Workflow[] = [];
  const requirements: Requirement[] = [];
  const signals: Signal[] = [];
  const sources: SourceRecord[] = [];
  const auditLog: AuditLogEntry[] = [];
  const aiSummaries: AISummary[] = [];
  const flagshipReviews: StakeholderReview[] = [];

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
  const sourceCache = new Map<string, SourceRecord>(); // dedupe by feedback id across requirements in one workflow

  for (const vehicleCode of vehicleCodes) {
    const vehicleId = `veh_${vehicleCode.toLowerCase()}`;
    const market = PRIMARY_MARKET[vehicleCode] ?? "Europe";
    const region = MARKET_CODE[market] ?? "EU";
    const signalsForVehicle = rawSignals.filter((s) => s.vehicleCode === vehicleCode && s.component !== "general");
    const maxFrequencyInVehicle = Math.max(1, ...signalsForVehicle.map((s) => s.frequency));

    for (const component of COMPONENT_KEYS) {
      const componentId = `comp_${vehicleCode.toLowerCase()}_${component}`;
      const signalsForComponent = signalsForVehicle.filter((s) => s.component === component);
      const candidates = pickCandidates(signalsForComponent, 4);

      let workflowId: string | null = null;

      if (candidates.length > 0) {
        const wfId = `wf_${vehicleCode.toLowerCase()}_${component}`;
        workflowId = wfId;
        const isFlagship = vehicleCode === "G60" && component === "battery";

        const workflow: Workflow = {
          id: wfId,
          vehicleId,
          componentId,
          market,
          status: isFlagship ? "pm_review" : "stakeholder_review",
          stages: [
            { key: "ingest", label: "Ingest datasets", status: "complete", startedAt: daysAgo(9), completedAt: daysAgo(9), owner: "pm" },
            { key: "enrich", label: "Enrich with web knowledge", status: "pending", startedAt: null, completedAt: null, owner: "ai" },
            { key: "extract", label: "Extract signals", status: "complete", startedAt: daysAgo(8), completedAt: daysAgo(8), owner: "ai" },
            { key: "derive", label: "Derive requirements", status: "complete", startedAt: daysAgo(7), completedAt: daysAgo(7), owner: "ai" },
            { key: "score", label: "Score & prioritize", status: "complete", startedAt: daysAgo(7), completedAt: daysAgo(7), owner: "ai" },
            { key: "stakeholder_review", label: "Stakeholder review", status: isFlagship ? "complete" : "active", startedAt: daysAgo(6), completedAt: isFlagship ? daysAgo(2) : null, owner: "stakeholder" },
            { key: "pm_decision", label: "PM decision", status: isFlagship ? "active" : "pending", startedAt: isFlagship ? daysAgo(2) : null, completedAt: null, owner: "pm" },
            { key: "deploy", label: "Move to deploy", status: "pending", startedAt: null, completedAt: null, owner: "pm" },
          ],
          createdAt: daysAgo(9),
          updatedAt: daysAgo(isFlagship ? 0 : 6),
        };
        workflows.push(workflow);

        // signals: every real theme for this component, not just the ones promoted to requirements
        for (const raw of signalsForComponent) {
          signals.push(toAppSignal(raw, wfId, vehicleCode, component));
        }

        // requirements + their sources, for the promoted candidates only
        candidates.forEach((candidate, i) => {
          const reqId = `req_${vehicleCode.toLowerCase()}_${component}_${i}`;
          const scoreFactors = buildScoreFactors({
            candidate,
            maxFrequencyInVehicle,
            component,
            vehicleCode,
            region,
            market,
            sales,
            study: customerStudy,
          });
          const score = weightedScore(scoreFactors);

          const linkedSourceIds = candidate.signal.feedbackIds.slice(0, 8).map((fid) => {
            const srcId = `src_${fid}`;
            if (!sourceCache.has(srcId)) {
              const fb = feedbackById.get(fid);
              const rec: SourceRecord = {
                id: srcId,
                workflowId: wfId,
                datasetType: "verbatim",
                reliability: "first_party",
                title: `Feedback ${fid}${fb ? ` (${fb.country}, ${fb.engineType})` : ""}`,
                excerpt: fb?.text ?? "(feedback text unavailable)",
                url: null,
                retrievedAt: daysAgo(9),
                country: fb?.country,
                engineType: fb?.engineType,
                feedbackType: fb?.feedbackType ?? undefined,
              };
              sourceCache.set(srcId, rec);
              sources.push(rec);
            }
            return srcId;
          });

          const req: Requirement = {
            id: reqId,
            workflowId: wfId,
            title: titleFor(candidate),
            description: descriptionFor(candidate),
            category: categoryFor(component),
            status: isFlagship && i === 0 ? "challenged" : "proposed",
            evidenceLevel: evidenceLevelFor(candidate),
            assumptions: assumptionsFor(candidate),
            uncertainties: [],
            linkedSignalIds: [signalIdFor(candidate.signal, vehicleCode, component)],
            linkedSourceIds,
            scoreFactors,
            score,
            effort: "medium",
            createdAt: daysAgo(7),
            updatedAt: daysAgo(isFlagship && i === 0 ? 1 : 7),
          };
          requirements.push(req);
        });

        if (isFlagship) {
          const top = candidates[0];
          const topReq = requirements.find((r) => r.workflowId === wfId && r.status === "challenged")!;
          const { reviews, logs, summaries } = buildFlagshipNarrative(wfId, topReq, top, daysAgo);
          auditLog.push(...logs);
          aiSummaries.push(...summaries);
          flagshipReviews.push(...reviews);
        } else {
          // lightweight: log the derive step so the audit trail isn't empty
          auditLog.push(
            mkLog(wfId, "requirement_proposed", "requirement", requirements[requirements.length - 1]?.id ?? wfId, aiActor(), null, { count: candidates.length }, `Derived ${candidates.length} draft requirement(s) from ${signalsForComponent.length} real feedback themes (${signalsForComponent.reduce((a, s) => a + s.frequency, 0)} verbatims total).`, daysAgo(7)),
          );
        }
      }

      components.push({ id: componentId, vehicleId, key: component, label: COMPONENT_LABEL[component], hotspot: HOTSPOT[component], workflowId });
    }
  }

  const stakeholders = DEFAULT_STAKEHOLDERS;
  // assign all 4 stakeholders as reviewers (pending) on the top requirement of every non-flagship workflow
  const reviews: StakeholderReview[] = [...flagshipReviews];
  for (const req of requirements) {
    if (req.status === "challenged") continue; // flagship already has bespoke reviews
    const isTopOfItsWorkflow = requirements.find((r) => r.workflowId === req.workflowId)?.id === req.id;
    if (!isTopOfItsWorkflow) continue;
    for (const sh of stakeholders) {
      reviews.push({
        id: `rev_${req.id}_${sh.id}`,
        workflowId: req.workflowId,
        stakeholderId: sh.id,
        requirementId: req.id,
        decision: "pending",
        expertOpinion: "",
        submittedAt: null,
        aiContextSnapshot: `Signal: ${req.title} (${req.evidenceLevel} evidence, score ${req.score.toFixed(1)}).`,
      });
    }
  }

  // LLM-assessed competitive_gap / strategic_fit, if `npm run ai:factors` has been run (Role B).
  applyJudgmentCache({ requirements, sources, auditLog, feedbackById });

  return { vehicles, components, workflows, requirements, signals, sources, stakeholders, reviews, auditLog, aiSummaries };
}

const DEFAULT_STAKEHOLDERS: Stakeholder[] = [
  { id: "sh_engineering", name: "Mara Voss — Engineering", expertise: "engineering", avatarColor: "#1c69d4" },
  { id: "sh_sales", name: "Li Wen — Sales", expertise: "sales", avatarColor: "#d97706" },
  { id: "sh_design", name: "Jonas Keller — Design", expertise: "design", avatarColor: "#8b5cf6" },
  { id: "sh_legal", name: "Amara Johnson — Legal & Regulatory", expertise: "legal_regulatory", avatarColor: "#16a34a" },
];

function toAppSignal(raw: RawSignal, workflowId: string, vehicleCode: string, component: ComponentKey): Signal {
  const total = raw.frequency;
  const sentiment: Signal["sentiment"] =
    raw.likes / total > 0.5 ? "positive" : (raw.difficultToUse + raw.defect) / total > 0.4 ? "negative" : raw.wants / total > 0.3 ? "mixed" : "neutral";
  return {
    id: signalIdFor(raw, vehicleCode, component),
    workflowId,
    theme: raw.theme,
    frequency: raw.frequency,
    sentiment,
    sampleVerbatims: raw.sampleVerbatims.slice(0, 4),
    sourceIds: raw.feedbackIds.slice(0, 8).map((id) => `src_${id}`),
    contradicts: [],
  };
}

function signalIdFor(raw: RawSignal, vehicleCode: string, component: ComponentKey): string {
  const slug = raw.theme.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
  return `sig_${vehicleCode.toLowerCase()}_${component}_${slug}`;
}

function weightedScore(factors: { weight: number; rawValue: number }[]): number {
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0) || 1;
  const weighted = factors.reduce((s, f) => s + f.rawValue * f.weight, 0);
  return Math.round((weighted / totalWeight) * 10) / 10;
}

// The one hand-authored narrative beat we keep even with real data: a PM
// challenge -> AI revision -> stakeholder review loop, rebased onto
// whichever requirement the real data actually produces as the #1 battery
// finding (so the story stays true even if re-running ingestion shifts
// the numbers).
function buildFlagshipNarrative(workflowId: string, req: Requirement, candidate: Candidate, daysAgo: (n: number) => string) {
  const freq = candidate.signal.frequency;
  const pct = Math.round(candidate.concentration * 100);

  const reviews: StakeholderReview[] = [
    { id: "rev_eng_flagship", workflowId, stakeholderId: "sh_engineering", requirementId: req.id, decision: "approve", expertOpinion: `${pct}% concentration on "${candidate.signal.theme}" across ${freq} verbatims lines up with what we're already seeing in warranty data. Technically addressable next cycle; flagging as a roadmap priority, not a blocker.`, submittedAt: daysAgo(5), aiContextSnapshot: `Signal: ${req.title} (${freq} verbatims).` },
    { id: "rev_sales_flagship", workflowId, stakeholderId: "sh_sales", requirementId: req.id, decision: "approve", expertOpinion: `This shows up in loss-reason conversations with customers cross-shopping. Approve — directly tied to the sales volume we're trying to grow in this segment.`, submittedAt: daysAgo(4), aiContextSnapshot: `Signal: ${req.title} (${freq} verbatims).` },
    { id: "rev_legal_flagship", workflowId, stakeholderId: "sh_legal", requirementId: req.id, decision: "reject", expertOpinion: `No regulatory blocker on the underlying requirement, but any public-facing claim derived from this needs substantiation before marketing use — flagging so it doesn't ship as an unverified claim.`, submittedAt: daysAgo(3), aiContextSnapshot: `Signal: ${req.title} (${freq} verbatims).` },
    { id: "rev_design_flagship", workflowId, stakeholderId: "sh_design", requirementId: req.id, decision: "pending", expertOpinion: "", submittedAt: null, aiContextSnapshot: `Signal: ${req.title} (${freq} verbatims).` },
  ];

  const logs: AuditLogEntry[] = [
    mkLog(workflowId, "requirement_proposed", "requirement", req.id, aiActor(), null, { title: req.title, score: req.score }, `Derived from ${freq} real verbatims tagged "${candidate.signal.theme}", ${pct}% sharing the same sentiment. Evidence level: ${req.evidenceLevel}.`, daysAgo(7)),
    mkLog(workflowId, "requirement_challenged", "requirement", req.id, pmActor(), { score: req.score }, { note: "PM pushed back on the first draft" }, `PM asked: "the first draft just restates the complaint — give me something I can act on, grounded in the actual numbers, not a paraphrase."`, daysAgo(6)),
    mkLog(workflowId, "ai_summary_generated", "requirement", req.id, aiActor(), null, { note: "revised" }, `Re-derived with explicit evidence: ${freq} verbatims, ${pct}% concentration, cross-referenced against sibling-model customer-study scores for competitive framing. PM's challenge moved the requirement from a restated complaint to a cited, scoreable one.`, daysAgo(6)),
    mkLog(workflowId, "stage_transition", "stage", "stakeholder_review", pmActor(), "pending", "active", `PM sent "${req.title}" to stakeholder review: Engineering, Sales, Design, Legal.`, daysAgo(5)),
    mkLog(workflowId, "stakeholder_review_submitted", "review", "rev_eng_flagship", stakeholderActor("sh_engineering", "Mara Voss — Engineering"), { decision: "pending" }, { decision: "approve" }, reviews[0].expertOpinion, daysAgo(5)),
    mkLog(workflowId, "stakeholder_review_submitted", "review", "rev_sales_flagship", stakeholderActor("sh_sales", "Li Wen — Sales"), { decision: "pending" }, { decision: "approve" }, reviews[1].expertOpinion, daysAgo(4)),
    mkLog(workflowId, "stakeholder_review_submitted", "review", "rev_legal_flagship", stakeholderActor("sh_legal", "Amara Johnson — Legal & Regulatory"), { decision: "pending" }, { decision: "reject" }, reviews[2].expertOpinion, daysAgo(3)),
    mkLog(workflowId, "stage_transition", "stage", "stakeholder_review", pmActor(), "active", "complete", "3 of 4 stakeholder reviews in; Design still pending. PM chose to proceed given majority signal.", daysAgo(2)),
    mkLog(workflowId, "stage_transition", "stage", "pm_decision", pmActor(), "pending", "active", "PM reviewing stakeholder input: 2 approve, 1 reject (process objection, not technical), 1 pending.", daysAgo(2)),
  ];

  const summaries: AISummary[] = [
    { id: "aisum_decision_trail", workflowId, type: "decision_trail", content: `Started from ${freq} real verbatims tagged "${candidate.signal.theme}" (${pct}% sharing the same sentiment). First AI draft restated the complaint without a concrete hook; PM challenged it as not actionable. AI revised using the actual frequency/concentration numbers and a cross-model customer-study comparison. Sent to 4 stakeholders: Engineering and Sales approved; Legal rejected on a process ground (any public claim needs substantiation before marketing use, not a product objection); Design has not responded yet. PM is now deciding whether to approve with a caveat requiring Legal sign-off before any public claim, or wait for Design.`, basedOnLogIds: [], generatedAt: daysAgo(1) },
    { id: "aisum_stakeholder_overview", workflowId, type: "stakeholder_overview", content: `3 of 4 stakeholders responded. Engineering confirms this matches internal warranty-data patterns and is addressable next cycle. Sales ties it directly to loss-reason conversations with cross-shopping customers. Legal's rejection is narrow: it blocks public marketing claims, not the underlying requirement. Design has not yet weighed in.`, basedOnLogIds: [], generatedAt: daysAgo(1) },
    { id: "aisum_limitations", workflowId, type: "limitations", content: `This requirement is derived entirely from internal verbatim frequency — no external competitor review data or engineering feasibility input is factored in yet (see the competitive_gap and effort_inverse score-factor rationales for exactly where those gaps are). Customer-study comparisons mix a direct 0-10 mean (CN/EU) with a distribution-reconstructed mean (US) — treat US figures as lower-precision.`, basedOnLogIds: [], generatedAt: daysAgo(1) },
  ];

  return { reviews, logs, summaries };
}

function aiActor() {
  return { type: "ai" as const, id: "ai_engine", name: "PM Kompass", model: "gpt-4.1" };
}
function pmActor() {
  return { type: "pm" as const, id: "pm_demo", name: "Product Manager" };
}
function stakeholderActor(id: string, name: string) {
  return { type: "stakeholder" as const, id, name };
}
function mkLog(
  workflowId: string,
  action: AuditLogEntry["action"],
  targetType: AuditLogEntry["targetType"],
  targetId: string,
  actor: AuditLogEntry["actor"],
  oldValue: unknown,
  newValue: unknown,
  rationale: string,
  timestamp: string,
): AuditLogEntry {
  return { id: `log_${nanoid(8)}`, workflowId, actor, action, targetType, targetId, oldValue, newValue, rationale, timestamp };
}

// ===========================================================================
// MOCK SEED (fallback when src/data/*.json isn't present)
// ===========================================================================

const MOCK_VEHICLE_ID = "veh_5series";
const MOCK_COMPONENT_BATTERY_ID = "comp_battery";
const MOCK_WORKFLOW_ID = "wf_battery_demo";

function buildMockSeed() {
  const vehicles: Vehicle[] = [
    { id: MOCK_VEHICLE_ID, name: "BMW 5 Series", generation: "Next generation (successor to G60)", markets: ["Europe", "China", "United States"] },
  ];

  const components: VehicleComponent[] = [
    { id: MOCK_COMPONENT_BATTERY_ID, vehicleId: MOCK_VEHICLE_ID, key: "battery", label: "Battery & Charging", hotspot: { xPct: 49, yPct: 61 }, workflowId: MOCK_WORKFLOW_ID },
    { id: "comp_exterior", vehicleId: MOCK_VEHICLE_ID, key: "exterior", label: "Exterior & Design", hotspot: { xPct: 50, yPct: 76 }, workflowId: null },
    { id: "comp_interior", vehicleId: MOCK_VEHICLE_ID, key: "interior", label: "Interior & Cabin", hotspot: { xPct: 61, yPct: 46 }, workflowId: null },
    { id: "comp_windows", vehicleId: MOCK_VEHICLE_ID, key: "windows", label: "Windows & Glass", hotspot: { xPct: 76, yPct: 38 }, workflowId: null },
    { id: "comp_steering", vehicleId: MOCK_VEHICLE_ID, key: "steering", label: "Steering & Cockpit", hotspot: { xPct: 58, yPct: 50 }, workflowId: null },
    { id: "comp_engine", vehicleId: MOCK_VEHICLE_ID, key: "engine", label: "Powertrain", hotspot: { xPct: 24, yPct: 59 }, workflowId: null },
  ];

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

  const workflow: Workflow = {
    id: MOCK_WORKFLOW_ID,
    vehicleId: MOCK_VEHICLE_ID,
    componentId: MOCK_COMPONENT_BATTERY_ID,
    market: "Europe",
    status: "pm_review",
    stages: [
      { key: "ingest", label: "Ingest datasets", status: "complete", startedAt: daysAgo(9), completedAt: daysAgo(9), owner: "pm" },
      { key: "enrich", label: "Enrich with web knowledge", status: "complete", startedAt: daysAgo(9), completedAt: daysAgo(8), owner: "ai" },
      { key: "extract", label: "Extract signals", status: "complete", startedAt: daysAgo(8), completedAt: daysAgo(8), owner: "ai" },
      { key: "derive", label: "Derive requirements", status: "complete", startedAt: daysAgo(8), completedAt: daysAgo(7), owner: "ai" },
      { key: "score", label: "Score & prioritize", status: "complete", startedAt: daysAgo(7), completedAt: daysAgo(7), owner: "ai" },
      { key: "stakeholder_review", label: "Stakeholder review", status: "complete", startedAt: daysAgo(6), completedAt: daysAgo(2), owner: "stakeholder" },
      { key: "pm_decision", label: "PM decision", status: "active", startedAt: daysAgo(2), completedAt: null, owner: "pm" },
      { key: "deploy", label: "Move to deploy", status: "pending", startedAt: null, completedAt: null, owner: "pm" },
    ],
    createdAt: daysAgo(9),
    updatedAt: daysAgo(0),
  };

  const sources: SourceRecord[] = [
    { id: "src_verb_1", workflowId: MOCK_WORKFLOW_ID, datasetType: "verbatim", reliability: "first_party", title: "Verbatim #4471 (EU, i5 owner)", excerpt: "\"DC fast charging from 10-80% takes nearly 30 minutes at the stations near me, Hyundai does it in 18.\"", url: null, retrievedAt: daysAgo(9) },
    { id: "src_study_1", workflowId: MOCK_WORKFLOW_ID, datasetType: "study", reliability: "first_party", title: "Customer study: charging satisfaction (EU, n=612)", excerpt: "Charging speed satisfaction: 58/100 (category average 71/100).", url: null, retrievedAt: daysAgo(9) },
  ];

  const signals: Signal[] = [
    { id: "sig_charge_speed", workflowId: MOCK_WORKFLOW_ID, theme: "DC fast-charging speed lags competitors", frequency: 184, sentiment: "negative", sampleVerbatims: [sources[0].excerpt], sourceIds: ["src_verb_1", "src_study_1"], contradicts: [] },
  ];

  const reqCharging: Requirement = {
    id: "req_fast_charging",
    workflowId: MOCK_WORKFLOW_ID,
    title: "Reduce DC fast-charging time to under 20 minutes (10-80%)",
    description: "Customers rate charging speed well below category average. Close the gap from ~28 min to <20 min for 10-80% charge.",
    category: "range_charging",
    status: "challenged",
    evidenceLevel: "strong",
    assumptions: ["350kW public charging infrastructure continues to expand through 2029."],
    uncertainties: ["This is placeholder/mock seed data — run `npm run ingest` against the real datasets for grounded numbers."],
    linkedSignalIds: ["sig_charge_speed"],
    linkedSourceIds: ["src_verb_1", "src_study_1"],
    scoreFactors: [
      { key: "customer_impact", label: "Customer impact", weight: 0.25, rawValue: 88, rationale: "Mock value." },
      { key: "frequency", label: "Signal frequency", weight: 0.15, rawValue: 82, rationale: "Mock value." },
      { key: "sales_relevance", label: "Sales relevance", weight: 0.15, rawValue: 75, rationale: "Mock value." },
      { key: "competitive_gap", label: "Competitive gap", weight: 0.15, rawValue: 90, rationale: "Mock value." },
      { key: "strategic_fit", label: "Strategic fit", weight: 0.1, rawValue: 80, rationale: "Mock value." },
      { key: "effort_inverse", label: "Feasibility (inverse effort)", weight: 0.1, rawValue: 35, rationale: "Mock value." },
      { key: "evidence_strength", label: "Evidence strength", weight: 0.1, rawValue: 92, rationale: "Mock value." },
    ],
    score: 79.8,
    effort: "high",
    createdAt: daysAgo(7),
    updatedAt: daysAgo(1),
  };

  const stakeholders: Stakeholder[] = DEFAULT_STAKEHOLDERS;
  const reviews: StakeholderReview[] = [
    { id: "rev_eng_charging", workflowId: MOCK_WORKFLOW_ID, stakeholderId: "sh_engineering", requirementId: "req_fast_charging", decision: "approve", expertOpinion: "Achievable with the next-gen cell chemistry already in validation.", submittedAt: daysAgo(5), aiContextSnapshot: "Mock review." },
    { id: "rev_design_charging", workflowId: MOCK_WORKFLOW_ID, stakeholderId: "sh_design", requirementId: "req_fast_charging", decision: "pending", expertOpinion: "", submittedAt: null, aiContextSnapshot: "Mock review." },
  ];

  const auditLog: AuditLogEntry[] = [
    mkLog(MOCK_WORKFLOW_ID, "workflow_created", "workflow", MOCK_WORKFLOW_ID, pmActor(), null, { componentId: MOCK_COMPONENT_BATTERY_ID, market: "Europe" }, "Started the Battery & Charging workflow (mock seed — run `npm run ingest` for real data).", daysAgo(9)),
    mkLog(MOCK_WORKFLOW_ID, "requirement_proposed", "requirement", "req_fast_charging", aiActor(), null, { title: reqCharging.title }, "Mock-seeded draft requirement.", daysAgo(7)),
  ];

  const aiSummaries: AISummary[] = [
    { id: "aisum_decision_trail", workflowId: MOCK_WORKFLOW_ID, type: "decision_trail", content: "This is placeholder mock data. Copy the real datasets into data-raw/ and run `npm run ingest` to replace this with a real, data-grounded demo (see docs/DATA_SETUP.md).", basedOnLogIds: [], generatedAt: daysAgo(1) },
  ];

  return { vehicles, components, workflows: [workflow], requirements: [reqCharging], signals, sources, stakeholders, reviews, auditLog, aiSummaries };
}
