// Applies cached LLM judgments for the two judgment-call score factors
// (competitive_gap, strategic_fit) on top of the deterministic baselines from
// deriveRequirements.ts, at seed time. The cache is written offline by
// `npm run ai:factors` (scripts/ai-judgment-factors.ts), so page loads never
// wait on a model and the demo is identical on every restart.
//
// Each applied judgment keeps the formula baseline visible in the factor
// rationale, links its cited sources to the requirement, and writes a
// `score_recomputed` audit entry with the exact before/after values.

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { AuditLogEntry, FeedbackRecord, Requirement, SourceRecord } from "./types";
import type { JudgmentFactor } from "./ai";
import { getStrategyExcerpt, strategySourceId, strategySourceRecord } from "./strategyContext";

export interface CachedJudgment {
  requirementId: string;
  workflowId: string;
  title: string; // a cached entry only applies while the requirement's title still matches (ids are positional)
  model: string;
  generatedAt: string;
  competitive_gap: JudgmentFactor;
  strategic_fit: JudgmentFactor;
}

export type JudgmentCache = Record<string, CachedJudgment>;

const JUDGMENT_KEYS = ["competitive_gap", "strategic_fit"] as const;

export function judgmentCachePath(): string {
  return join(process.cwd(), "src", "data", "ai-judgment-factors.json");
}

export function loadJudgmentCache(): JudgmentCache {
  const path = judgmentCachePath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as JudgmentCache;
  } catch {
    return {};
  }
}

/** Returns how many requirements had cached judgments applied. */
export function applyJudgmentCache(args: {
  requirements: Requirement[];
  sources: SourceRecord[];
  auditLog: AuditLogEntry[];
  feedbackById: Map<string, FeedbackRecord>;
}): number {
  // The generator script scores from the deterministic baseline, not from a previous AI run.
  if (process.env.EHL_SKIP_AI_FACTORS === "1") return 0;
  const cache = loadJudgmentCache();
  const { requirements, sources, auditLog, feedbackById } = args;
  const knownSourceIds = new Set(sources.map((s) => s.id));
  let applied = 0;

  for (const req of requirements) {
    const entry = cache[req.id];
    if (!entry || entry.title !== req.title) continue; // stale after a re-ingest

    const before: Record<string, number> = { score: req.score };
    const after: Record<string, number> = {};
    const linked = new Set(req.linkedSourceIds);

    req.scoreFactors = req.scoreFactors.map((factor) => {
      const key = JUDGMENT_KEYS.find((k) => k === factor.key);
      const judgment = key ? entry[key] : undefined;
      if (!key || !judgment) return factor;
      before[key] = factor.rawValue;
      after[key] = judgment.value;
      for (const id of judgment.citedSourceIds) {
        const sourceId = ensureSource(id, req.workflowId, entry.generatedAt, sources, knownSourceIds, feedbackById);
        if (sourceId) linked.add(sourceId);
      }
      return {
        ...factor,
        rawValue: judgment.value,
        rationale: `AI-assessed (${entry.model}, ${judgment.basis}): ${judgment.rationale} Formula baseline was ${factor.rawValue}.`,
      };
    });
    if (Object.keys(after).length === 0) continue;

    req.linkedSourceIds = Array.from(linked);
    req.score = weightedScore(req);
    after.score = req.score;

    auditLog.push({
      id: `log_aifactors_${req.id}`,
      workflowId: req.workflowId,
      actor: { type: "ai", id: "ai_engine", name: "PM Kompass", model: entry.model },
      action: "score_recomputed",
      targetType: "requirement",
      targetId: req.id,
      oldValue: before,
      newValue: { ...after, generatedAt: entry.generatedAt },
      rationale:
        "Initial AI scoring of the judgment factors (before any PM review), replacing the formula baselines: " +
        JUDGMENT_KEYS.filter((k) => k in after)
          .map((k) => `${k.replace("_", " ")} ${before[k]} -> ${after[k]} (${entry[k].basis}): ${entry[k].rationale}`)
          .join(" | "),
      // placed just after the requirement was proposed, so the trail reads in order
      timestamp: new Date(new Date(req.createdAt).getTime() + 60_000).toISOString(),
    });
    applied++;
  }
  return applied;
}

// Resolves a cited id to a SourceRecord id, creating the record if this is
// the first time it is cited. Returns null for ids that resolve to nothing.
function ensureSource(
  citedId: string,
  workflowId: string,
  retrievedAt: string,
  sources: SourceRecord[],
  known: Set<string>,
  feedbackById: Map<string, FeedbackRecord>,
): string | null {
  const excerpt = getStrategyExcerpt(citedId);
  if (excerpt) {
    const id = strategySourceId(excerpt.id, workflowId);
    if (!known.has(id)) {
      sources.push(strategySourceRecord(excerpt, workflowId, retrievedAt));
      known.add(id);
    }
    return id;
  }
  if (!citedId.startsWith("src_")) return null;
  if (known.has(citedId)) return citedId;
  const fb = feedbackById.get(citedId.slice("src_".length));
  if (!fb) return null;
  sources.push({
    id: citedId,
    workflowId,
    datasetType: "verbatim",
    reliability: "first_party",
    title: `Feedback ${fb.id} (${fb.country}, ${fb.engineType})`,
    excerpt: fb.text,
    url: null,
    retrievedAt,
    country: fb.country,
    engineType: fb.engineType,
    feedbackType: fb.feedbackType ?? undefined,
  });
  known.add(citedId);
  return citedId;
}

function weightedScore(req: Requirement): number {
  const totalWeight = req.scoreFactors.reduce((s, f) => s + f.weight, 0) || 1;
  const weighted = req.scoreFactors.reduce((s, f) => s + f.rawValue * f.weight, 0);
  return Math.round((weighted / totalWeight) * 10) / 10;
}
