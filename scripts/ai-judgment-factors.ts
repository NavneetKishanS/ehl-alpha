// Precomputes the two judgment-call score factors — competitive_gap and
// strategic_fit — for every requirement, one OpenAI call per requirement,
// and caches them in src/data/ai-judgment-factors.json. The app applies the
// cache at seed time (src/lib/aiFactors.ts); without the cache it simply
// keeps the deterministic baselines from deriveRequirements.ts.
//
// Grounding per requirement:
//   - competitive_gap: customer-study rows for the component (BMW models) +
//     real verbatims that name a competitor brand (theme first, then the
//     rest of the component)
//   - strategic_fit: BMW Group Report 2025 excerpts (src/lib/strategyContext.ts)
//
// Usage:
//   npm run ai:factors                        # only requirements not cached yet (or whose title changed)
//   npm run ai:factors -- --force             # re-score everything
//   npm run ai:factors -- --only=wf_g60_battery

import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "fs";
import { buildSeed } from "../src/lib/seed";
import { hasRealData, loadCustomerStudy, loadFeedback, loadSignals } from "../src/lib/realData";
import { assessJudgmentFactors, liveAIAvailable, strongModel } from "../src/lib/ai";
import { STUDY_CATEGORY_KEYWORDS } from "../src/lib/deriveRequirements";
import { STRATEGY_EXCERPTS } from "../src/lib/strategyContext";
import { judgmentCachePath, loadJudgmentCache, type JudgmentCache } from "../src/lib/aiFactors";
import type { FeedbackRecord, Requirement } from "../src/lib/types";

loadEnvConfig(process.cwd());
process.env.EHL_SKIP_AI_FACTORS = "1";

const COMPETITOR_RE =
  /\b(tesla|mercedes|benz|audi|volvo|porsche|lexus|hyundai|kia|genesis|polestar|byd|nio|xpeng|li auto|zeekr|xiaomi|jaguar|range rover|land rover|volkswagen|vw|lucid|rivian|cadillac|lincoln|toyota|honda|nissan|ford|huawei|aito)\b/i;
const MAX_THEME_MENTIONS = 8;
const MAX_MENTIONS = 12;
const CONCURRENCY = 4;
const REGION: Record<string, "EU" | "CN" | "US"> = { Europe: "EU", China: "CN", USA: "US" };

async function main() {
  if (!hasRealData()) {
    console.error("No ingested data in src/data/ — see docs/DATA_SETUP.md.");
    process.exit(1);
  }
  if (!liveAIAvailable()) {
    console.error("OPENAI_API_KEY is not set. Copy .env.local.example to .env.local and add a key.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);

  const seed = buildSeed();
  const feedbackById = new Map(loadFeedback().map((f) => [f.id, f]));
  const rawSignals = loadSignals();
  const study = loadCustomerStudy();
  const cache: JudgmentCache = loadJudgmentCache();

  const todo = seed.requirements.filter(
    (r) => (!only || r.workflowId === only) && (force || cache[r.id]?.title !== r.title),
  );
  console.log(`Scoring ${todo.length} of ${seed.requirements.length} requirement(s) with ${strongModel()}…`);

  function competitorMentions(feedbackIds: string[], taken: Set<string>, limit: number) {
    const out: { sourceId: string; text: string; country?: string }[] = [];
    const seenText = new Set<string>();
    for (const id of feedbackIds) {
      if (out.length >= limit) break;
      const fb: FeedbackRecord | undefined = feedbackById.get(id);
      if (!fb || taken.has(fb.id) || seenText.has(fb.text) || !COMPETITOR_RE.test(fb.text)) continue;
      taken.add(fb.id);
      seenText.add(fb.text);
      out.push({ sourceId: `src_${fb.id}`, text: fb.text, country: fb.country });
    }
    return out;
  }

  async function score(req: Requirement) {
    const workflow = seed.workflows.find((w) => w.id === req.workflowId);
    const component = seed.components.find((c) => c.id === workflow?.componentId);
    const vehicle = seed.vehicles.find((v) => v.id === workflow?.vehicleId);
    if (!workflow || !component || !vehicle) return;
    const vehicleCode = vehicle.id.replace("veh_", "").toUpperCase();

    const keywords = STUDY_CATEGORY_KEYWORDS[component.key];
    const studyRows = study.filter((r) => keywords.some((k) => r.category.toLowerCase().includes(k)));

    const signal = seed.signals.find((s) => req.linkedSignalIds.includes(s.id));
    const componentSignals = rawSignals.filter((s) => s.vehicleCode === vehicleCode && s.component === component.key);
    const themeIds = componentSignals.find((s) => s.theme === signal?.theme)?.feedbackIds ?? [];
    const taken = new Set<string>();
    const mentions = competitorMentions(themeIds, taken, MAX_THEME_MENTIONS);
    mentions.push(...competitorMentions(componentSignals.flatMap((s) => s.feedbackIds), taken, MAX_MENTIONS - mentions.length));

    const result = await assessJudgmentFactors({
      requirement: req,
      vehicleName: vehicle.name,
      componentLabel: component.label,
      market: `${workflow.market} (${REGION[workflow.market] ?? "EU"})`,
      studyRows,
      competitorMentions: mentions,
      strategy: STRATEGY_EXCERPTS,
    });
    if (!result) {
      console.warn(`  ✗ ${req.id}: no result, keeping deterministic baseline`);
      return;
    }
    cache[req.id] = {
      requirementId: req.id,
      workflowId: req.workflowId,
      title: req.title,
      model: result.model,
      generatedAt: new Date().toISOString(),
      competitive_gap: result.competitive_gap,
      strategic_fit: result.strategic_fit,
    };
    const base = (key: string) => req.scoreFactors.find((f) => f.key === key)?.rawValue;
    console.log(
      `  ✓ ${req.id}: gap ${base("competitive_gap")} -> ${result.competitive_gap.value} (${result.competitive_gap.basis}), ` +
        `fit ${base("strategic_fit")} -> ${result.strategic_fit.value} (${result.strategic_fit.basis}), ${mentions.length} competitor mention(s)`,
    );
  }

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(todo.slice(i, i + CONCURRENCY).map(score));
    writeFileSync(judgmentCachePath(), JSON.stringify(cache, null, 2) + "\n");
  }
  console.log(`Wrote ${Object.keys(cache).length} cached judgment(s) to ${judgmentCachePath()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
