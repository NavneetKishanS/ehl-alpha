// Seed data: a believable, fully-populated "battery" workflow for the BMW 5
// Series so every view (landing, PM workflow, stakeholder review, audit
// trail) has something real to render on first load. Other components are
// left empty so the landing page's "create new workflow" path is also
// demonstrable.
//
// Swap-out point for Role A: once real datasets (verbatims, equipment,
// sales, study) are uploaded, replace buildSeed()'s battery fixtures with
// an ingest() pipeline that produces the same shapes.

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
} from "./types";

const VEHICLE_ID = "veh_5series";
const COMPONENT_BATTERY_ID = "comp_battery";
const WORKFLOW_ID = "wf_battery_demo";

export function buildSeed() {
  const vehicles: Vehicle[] = [
    {
      id: VEHICLE_ID,
      name: "BMW 5 Series",
      generation: "Next generation (successor to G60)",
      markets: ["Europe", "China", "United States"],
    },
  ];

  const components: VehicleComponent[] = [
    { id: COMPONENT_BATTERY_ID, vehicleId: VEHICLE_ID, key: "battery", label: "Battery & Charging", hotspot: { xPct: 49, yPct: 61 }, workflowId: WORKFLOW_ID },
    { id: "comp_exterior", vehicleId: VEHICLE_ID, key: "exterior", label: "Exterior & Design", hotspot: { xPct: 50, yPct: 76 }, workflowId: null },
    { id: "comp_interior", vehicleId: VEHICLE_ID, key: "interior", label: "Interior & Cabin", hotspot: { xPct: 61, yPct: 46 }, workflowId: null },
    { id: "comp_windows", vehicleId: VEHICLE_ID, key: "windows", label: "Windows & Glass", hotspot: { xPct: 76, yPct: 38 }, workflowId: null },
    { id: "comp_steering", vehicleId: VEHICLE_ID, key: "steering", label: "Steering & Cockpit", hotspot: { xPct: 58, yPct: 50 }, workflowId: null },
    { id: "comp_engine", vehicleId: VEHICLE_ID, key: "engine", label: "Powertrain", hotspot: { xPct: 24, yPct: 59 }, workflowId: null },
  ];

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

  const workflow: Workflow = {
    id: WORKFLOW_ID,
    vehicleId: VEHICLE_ID,
    componentId: COMPONENT_BATTERY_ID,
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

  // ---------- sources ----------
  const sources: SourceRecord[] = [
    { id: "src_verb_1", workflowId: WORKFLOW_ID, datasetType: "verbatim", reliability: "first_party", title: "Verbatim #4471 (EU, i5 owner)", excerpt: "\"DC fast charging from 10-80% takes nearly 30 minutes at the stations near me, Hyundai does it in 18.\"", url: null, retrievedAt: daysAgo(9) },
    { id: "src_verb_2", workflowId: WORKFLOW_ID, datasetType: "verbatim", reliability: "first_party", title: "Verbatim #4502 (EU, i5 owner)", excerpt: "\"The range the car shows me in winter is way off from what I actually get. I never trust it.\"", url: null, retrievedAt: daysAgo(9) },
    { id: "src_verb_3", workflowId: WORKFLOW_ID, datasetType: "verbatim", reliability: "first_party", title: "Verbatim #4588 (EU, i5 owner)", excerpt: "\"Love that I can precondition the battery from the app before a trip, keep that.\"", url: null, retrievedAt: daysAgo(9) },
    { id: "src_study_1", workflowId: WORKFLOW_ID, datasetType: "study", reliability: "first_party", title: "Customer study: charging satisfaction (EU, n=612)", excerpt: "Charging speed satisfaction: 58/100 (category average 71/100). Range accuracy trust: 49/100.", url: null, retrievedAt: daysAgo(9) },
    { id: "src_equip_1", workflowId: WORKFLOW_ID, datasetType: "equipment", reliability: "first_party", title: "Equipment list: current 5 Series eDrive", excerpt: "Max DC charging: 205 kW, 10-80% in ~28 min (WLTP). No standard battery health readout.", url: null, retrievedAt: daysAgo(9) },
    { id: "src_sales_1", workflowId: WORKFLOW_ID, datasetType: "sales", reliability: "first_party", title: "Sales volumes by powertrain, EU, last 4 quarters", excerpt: "BEV mix of 5 Series sales grew from 19% to 31% QoQ in EU; China BEV mix at 44%.", url: null, retrievedAt: daysAgo(9) },
    { id: "src_web_1", workflowId: WORKFLOW_ID, datasetType: "web", reliability: "review_site", title: "Electrek: 2026 EV charging speed comparison", excerpt: "Hyundai Ioniq 6 and Kia EV6 now charge 10-80% in 18 minutes on 350kW stations; BMW i5 trails at ~28 min.", url: "https://electrek.co/example-charging-comparison", retrievedAt: daysAgo(8) },
    { id: "src_web_2", workflowId: WORKFLOW_ID, datasetType: "web", reliability: "forum", title: "Bimmerpost thread: \"range readout accuracy\"", excerpt: "47 replies, recurring complaint that indicated range drops faster than actual consumption in cold weather.", url: "https://bimmerpost.example/thread/range-readout", retrievedAt: daysAgo(8) },
    { id: "src_web_3", workflowId: WORKFLOW_ID, datasetType: "web", reliability: "official", title: "BMW Group Annual Report (latest) - electrification section", excerpt: "BMW targets 50% of global sales as BEV by 2030; charging infrastructure partnerships expanding in EU and China.", url: "https://bmwgroup.example/annual-report", retrievedAt: daysAgo(8) },
  ];

  // ---------- signals ----------
  const signals: Signal[] = [
    {
      id: "sig_charge_speed",
      workflowId: WORKFLOW_ID,
      theme: "DC fast-charging speed lags competitors",
      frequency: 184,
      sentiment: "negative",
      sampleVerbatims: [sources[0].excerpt, "\"My friend's Kia charges twice as fast, it's embarrassing.\""],
      sourceIds: ["src_verb_1", "src_study_1", "src_equip_1", "src_web_1"],
      contradicts: [],
    },
    {
      id: "sig_range_trust",
      workflowId: WORKFLOW_ID,
      theme: "Indicated range doesn't match real-world range, especially in winter",
      frequency: 131,
      sentiment: "negative",
      sampleVerbatims: [sources[1].excerpt],
      sourceIds: ["src_verb_2", "src_study_1", "src_web_2"],
      contradicts: [],
    },
    {
      id: "sig_precondition_love",
      workflowId: WORKFLOW_ID,
      theme: "Battery preconditioning via app is a loved, must-keep feature",
      frequency: 76,
      sentiment: "positive",
      sampleVerbatims: [sources[2].excerpt],
      sourceIds: ["src_verb_3"],
      contradicts: [],
    },
    {
      id: "sig_bev_growth",
      workflowId: WORKFLOW_ID,
      theme: "BEV mix of sales growing fastest in China and EU",
      frequency: 0,
      sentiment: "neutral",
      sampleVerbatims: [],
      sourceIds: ["src_sales_1", "src_web_3"],
      contradicts: [],
    },
  ];

  // ---------- requirements ----------
  function factorSet(vals: { impact: number; freq: number; sales: number; gap: number; strategic: number; effort: number; evidence: number }) {
    return [
      { key: "customer_impact", label: "Customer impact", weight: 0.25, rawValue: vals.impact, rationale: "How many customers this measurably affects." },
      { key: "frequency", label: "Signal frequency", weight: 0.15, rawValue: vals.freq, rationale: "How often this theme recurs across verbatims and reviews." },
      { key: "sales_relevance", label: "Sales relevance", weight: 0.15, rawValue: vals.sales, rationale: "Weighted by BEV sales mix and growth in target markets." },
      { key: "competitive_gap", label: "Competitive gap", weight: 0.15, rawValue: vals.gap, rationale: "Size of the gap vs. named competitors in web sources." },
      { key: "strategic_fit", label: "Strategic fit", weight: 0.1, rawValue: vals.strategic, rationale: "Alignment with BMW Group's stated electrification strategy." },
      { key: "effort_inverse", label: "Feasibility (inverse effort)", weight: 0.1, rawValue: vals.effort, rationale: "Rough engineering effort, inverted so lower effort scores higher." },
      { key: "evidence_strength", label: "Evidence strength", weight: 0.1, rawValue: vals.evidence, rationale: "Composite of source reliability and sample size." },
    ];
  }

  const reqCharging: Requirement = {
    id: "req_fast_charging",
    workflowId: WORKFLOW_ID,
    title: "Reduce DC fast-charging time to under 20 minutes (10-80%)",
    description:
      "Customers rate charging speed well below category average and explicitly compare us unfavorably to Hyundai/Kia on 350kW stations. Close the gap from ~28 min to <20 min for 10-80% charge.",
    category: "range_charging",
    status: "challenged",
    evidenceLevel: "strong",
    assumptions: ["350kW public charging infrastructure continues to expand in EU and China through 2029."],
    uncertainties: ["Actual achievable charge time depends on final cell chemistry, not yet locked by Engineering."],
    linkedSignalIds: ["sig_charge_speed"],
    linkedSourceIds: ["src_verb_1", "src_study_1", "src_equip_1", "src_web_1"],
    scoreFactors: factorSet({ impact: 88, freq: 82, sales: 75, gap: 90, strategic: 80, effort: 35, evidence: 92 }),
    score: 0,
    effort: "high",
    createdAt: daysAgo(7),
    updatedAt: daysAgo(1),
  };
  reqCharging.score = weightedScore(reqCharging);

  const reqRangeTrust: Requirement = {
    id: "req_range_accuracy",
    workflowId: WORKFLOW_ID,
    title: "Real-world-accurate range readout, with visible confidence band",
    description:
      "Show a range estimate that accounts for temperature, driving style and route, with an explicit confidence band instead of a single optimistic number, to rebuild trust.",
    category: "range_charging",
    status: "approved",
    evidenceLevel: "moderate",
    assumptions: [],
    uncertainties: ["Forum sentiment (src_web_2) is directional, not a sized sample."],
    linkedSignalIds: ["sig_range_trust"],
    linkedSourceIds: ["src_verb_2", "src_study_1", "src_web_2"],
    scoreFactors: factorSet({ impact: 70, freq: 65, sales: 60, gap: 50, strategic: 60, effort: 70, evidence: 68 }),
    score: 0,
    effort: "medium",
    createdAt: daysAgo(7),
    updatedAt: daysAgo(3),
  };
  reqRangeTrust.score = weightedScore(reqRangeTrust);

  const reqHealthCert: Requirement = {
    id: "req_battery_health_cert",
    workflowId: WORKFLOW_ID,
    title: "Shareable, OTA-updated battery state-of-health certificate",
    description:
      "A certificate customers can export when reselling, so battery health is no longer an invisible risk in used-BEV pricing. Forward-looking bet on used-EV market maturing.",
    category: "usability",
    status: "proposed",
    evidenceLevel: "weak",
    assumptions: ["Used-BEV resale market develops standardized demand for battery health disclosure by ~2028."],
    uncertainties: ["No direct verbatim evidence yet; derived from market trend extrapolation, not customer data."],
    linkedSignalIds: ["sig_bev_growth"],
    linkedSourceIds: ["src_sales_1", "src_web_3"],
    scoreFactors: factorSet({ impact: 40, freq: 10, sales: 55, gap: 45, strategic: 70, effort: 55, evidence: 25 }),
    score: 0,
    effort: "medium",
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  };
  reqHealthCert.score = weightedScore(reqHealthCert);

  const requirements = [reqCharging, reqRangeTrust, reqHealthCert];

  // ---------- stakeholders ----------
  const stakeholders: Stakeholder[] = [
    { id: "sh_engineering", name: "Mara Voss — Battery Systems Eng.", expertise: "engineering", avatarColor: "#1c69d4" },
    { id: "sh_sales_cn", name: "Li Wen — Sales, China", expertise: "sales", avatarColor: "#d97706" },
    { id: "sh_design", name: "Jonas Keller — Design", expertise: "design", avatarColor: "#8b5cf6" },
    { id: "sh_legal", name: "Amara Johnson — Legal & Regulatory", expertise: "legal_regulatory", avatarColor: "#16a34a" },
  ];

  const reviews: StakeholderReview[] = [
    {
      id: "rev_eng_charging",
      workflowId: WORKFLOW_ID,
      stakeholderId: "sh_engineering",
      requirementId: "req_fast_charging",
      decision: "approve",
      expertOpinion:
        "Sub-20-min is achievable with the next-gen cell chemistry already in validation, but only if the 800V architecture is locked this quarter. Flagging as a schedule risk, not a technical one.",
      submittedAt: daysAgo(5),
      aiContextSnapshot: "Signal: DC fast-charging speed lags competitors (184 mentions, strong evidence). Requirement asks for <20min 10-80%.",
    },
    {
      id: "rev_sales_charging",
      workflowId: WORKFLOW_ID,
      stakeholderId: "sh_sales_cn",
      requirementId: "req_fast_charging",
      decision: "approve",
      expertOpinion:
        "China customers cross-shop charging specs explicitly on dealer floors now. This is table stakes for the BEV mix we're targeting, approve without reservation.",
      submittedAt: daysAgo(4),
      aiContextSnapshot: "Signal: DC fast-charging speed lags competitors (184 mentions, strong evidence). Requirement asks for <20min 10-80%.",
    },
    {
      id: "rev_legal_charging",
      workflowId: WORKFLOW_ID,
      stakeholderId: "sh_legal",
      requirementId: "req_fast_charging",
      decision: "reject",
      expertOpinion:
        "No regulatory blocker, but marketing any specific charge-time number needs WLTP-style substantiation before publication; flagging so this doesn't ship as a claim without test data.",
      submittedAt: daysAgo(3),
      aiContextSnapshot: "Signal: DC fast-charging speed lags competitors (184 mentions, strong evidence). Requirement asks for <20min 10-80%.",
    },
    {
      id: "rev_design_charging",
      workflowId: WORKFLOW_ID,
      stakeholderId: "sh_design",
      requirementId: "req_fast_charging",
      decision: "pending",
      expertOpinion: "",
      submittedAt: null,
      aiContextSnapshot: "Signal: DC fast-charging speed lags competitors (184 mentions, strong evidence). Requirement asks for <20min 10-80%.",
    },
    {
      id: "rev_eng_range",
      workflowId: WORKFLOW_ID,
      stakeholderId: "sh_engineering",
      requirementId: "req_range_accuracy",
      decision: "approve",
      expertOpinion: "Confidence-band UI is a software-only change against existing telemetry. Low risk, approve.",
      submittedAt: daysAgo(4),
      aiContextSnapshot: "Signal: range readout trust gap (131 mentions, moderate evidence).",
    },
  ];

  // ---------- audit log (pre-existing history, written directly) ----------
  const auditLog: AuditLogEntry[] = [
    mkLog("workflow_created", "workflow", WORKFLOW_ID, { type: "pm", id: "pm_demo", name: "Product Manager" }, null, { componentId: COMPONENT_BATTERY_ID, market: "Europe" }, "Started the Battery & Charging workflow for the 5 Series successor, Europe market.", daysAgo(9)),
    mkLog("stage_transition", "stage", "ingest", aiActor(), "pending", "complete", "Ingested 4 datasets: 612 verbatims, equipment list, 4-quarter sales volumes, customer study. 3 malformed verbatim rows flagged and excluded.", daysAgo(9)),
    mkLog("stage_transition", "stage", "enrich", aiActor(), "pending", "complete", "Enriched with 3 web sources (1 review site, 1 forum, 1 official BMW report).", daysAgo(8)),
    mkLog("signal_extracted", "requirement", "sig_charge_speed", aiActor(), null, { theme: "DC fast-charging speed lags competitors", frequency: 184 }, "Clustered 184 related verbatims and web mentions into one theme.", daysAgo(8)),
    mkLog("signal_extracted", "requirement", "sig_range_trust", aiActor(), null, { theme: "Range readout trust gap", frequency: 131 }, "Clustered 131 related verbatims into one theme; flagged possible seasonal confound (winter).", daysAgo(8)),
    mkLog("requirement_proposed", "requirement", "req_fast_charging", aiActor(), null, { title: reqCharging.title, score: reqCharging.score }, "Derived from sig_charge_speed. Evidence level: strong (first-party + review site + equipment data agree).", daysAgo(7)),
    mkLog("requirement_proposed", "requirement", "req_range_accuracy", aiActor(), null, { title: reqRangeTrust.title, score: reqRangeTrust.score }, "Derived from sig_range_trust. Evidence level: moderate (forum sentiment not independently sized).", daysAgo(7)),
    mkLog("requirement_proposed", "requirement", "req_battery_health_cert", aiActor(), null, { title: reqHealthCert.title, score: reqHealthCert.score }, "Derived from market-trend extrapolation (used-BEV growth), not direct customer verbatims. Evidence level: weak, flagged for PM attention.", daysAgo(6)),
    mkLog(
      "requirement_challenged",
      "requirement",
      "req_fast_charging",
      pmActor(),
      { score: 71.2 },
      { note: "PM pushed back on the first draft" },
      "PM asked: 'the first draft requirement just said improve charging speed, give me a number grounded in the competitor data, not a vague direction.'",
      daysAgo(6),
    ),
    mkLog(
      "ai_summary_generated",
      "workflow",
      WORKFLOW_ID,
      aiActor(),
      null,
      { note: "revised proposal" },
      "Re-derived the requirement with an explicit target (<20 min 10-80%) sourced from src_web_1 (Electrek comparison showing competitors at 18 min) and src_equip_1 (our current 28 min). PM's challenge changed the requirement from directional to measurable.",
      daysAgo(6),
    ),
    mkLog("stage_transition", "stage", "stakeholder_review", pmActor(), "pending", "active", "PM sent req_fast_charging and req_range_accuracy to stakeholder review: Engineering, Sales China, Design, Legal.", daysAgo(5)),
    mkLog("stakeholder_review_submitted", "review", "rev_eng_charging", stakeholderActor("sh_engineering", "Mara Voss — Battery Systems Eng."), { decision: "pending" }, { decision: "approve" }, reviews[0].expertOpinion, daysAgo(5)),
    mkLog("stakeholder_review_submitted", "review", "rev_eng_range", stakeholderActor("sh_engineering", "Mara Voss — Battery Systems Eng."), { decision: "pending" }, { decision: "approve" }, reviews[4].expertOpinion, daysAgo(4)),
    mkLog("stakeholder_review_submitted", "review", "rev_sales_charging", stakeholderActor("sh_sales_cn", "Li Wen — Sales, China"), { decision: "pending" }, { decision: "approve" }, reviews[1].expertOpinion, daysAgo(4)),
    mkLog("stakeholder_review_submitted", "review", "rev_legal_charging", stakeholderActor("sh_legal", "Amara Johnson — Legal & Regulatory"), { decision: "pending" }, { decision: "reject" }, reviews[2].expertOpinion, daysAgo(3)),
    mkLog("stage_transition", "stage", "stakeholder_review", pmActor(), "active", "complete", "3 of 4 stakeholder reviews in; Design still pending. PM chose to proceed to decision given majority signal.", daysAgo(2)),
    mkLog("stage_transition", "stage", "pm_decision", pmActor(), "pending", "active", "PM reviewing stakeholder input: 2 approve, 1 reject (process objection, not technical), 1 pending.", daysAgo(2)),
  ];

  const aiSummaries: AISummary[] = [
    {
      id: "aisum_decision_trail",
      workflowId: WORKFLOW_ID,
      type: "decision_trail",
      content:
        "Started from 184 verbatim/web mentions of slow DC charging vs. competitors. First AI draft was directional (\"improve charging speed\"); PM challenged it as not measurable. AI revised using src_web_1 (competitors at 18 min) and src_equip_1 (we're at 28 min) to propose a concrete <20 min target. Sent to 4 stakeholders: Engineering and Sales China approved; Legal rejected on a process ground (charge-time claims need WLTP-style substantiation before marketing use, not a product objection); Design has not responded yet. PM is now deciding whether to approve with a caveat requiring Legal sign-off before any public claim, or wait for Design.",
      basedOnLogIds: [],
      generatedAt: daysAgo(1),
    },
    {
      id: "aisum_stakeholder_overview",
      workflowId: WORKFLOW_ID,
      type: "stakeholder_overview",
      content:
        "3 of 4 stakeholders responded. Engineering confirms technical feasibility conditional on locking the 800V architecture this quarter (schedule risk, not technical risk). Sales China treats this as table-stakes competitive parity, not a nice-to-have. Legal's rejection is narrow: it blocks public marketing claims, not the engineering requirement itself. Design has not yet weighed in — no blocking concern raised elsewhere that would need Design's input, but their review is still open.",
      basedOnLogIds: [],
      generatedAt: daysAgo(1),
    },
    {
      id: "aisum_limitations",
      workflowId: WORKFLOW_ID,
      type: "limitations",
      content:
        "req_battery_health_cert rests on 2 sales/web sources and zero direct customer verbatims — treat as a forward bet, not a validated need. req_range_accuracy's forum evidence (src_web_2) is 47 replies on one thread, not a sized sample; the customer study (n=612) corroborates directionally but wasn't designed to isolate winter effects. Market scope is Europe only; China and US data for this component have not been ingested yet.",
      basedOnLogIds: [],
      generatedAt: daysAgo(1),
    },
  ];

  return {
    vehicles,
    components,
    workflows: [workflow],
    requirements,
    signals,
    sources,
    stakeholders,
    reviews,
    auditLog,
    aiSummaries,
  };

  // ---- local helpers ----
  function weightedScore(req: Requirement): number {
    const totalWeight = req.scoreFactors.reduce((s, f) => s + f.weight, 0) || 1;
    const weighted = req.scoreFactors.reduce((s, f) => s + f.rawValue * f.weight, 0);
    return Math.round((weighted / totalWeight) * 10) / 10;
  }
}

function aiActor() {
  return { type: "ai" as const, id: "ai_engine", name: "Requirements Copilot", model: "claude-sonnet-5" };
}
function pmActor() {
  return { type: "pm" as const, id: "pm_demo", name: "Product Manager" };
}
function stakeholderActor(id: string, name: string) {
  return { type: "stakeholder" as const, id, name };
}

function mkLog(
  action: AuditLogEntry["action"],
  targetType: AuditLogEntry["targetType"],
  targetId: string,
  actor: AuditLogEntry["actor"],
  oldValue: unknown,
  newValue: unknown,
  rationale: string,
  timestamp: string,
): AuditLogEntry {
  return {
    id: `log_${nanoid(8)}`,
    workflowId: WORKFLOW_ID,
    actor,
    action,
    targetType,
    targetId,
    oldValue,
    newValue,
    rationale,
    timestamp,
  };
}
