import type { RequirementCategory, StakeholderExpertise } from "./types";

// Which requirement categories fall inside a stakeholder's domain, for
// filtering the "evidence packet" shown on their review page down to what's
// actually relevant to them instead of the whole workflow.
//
// controlling and procurement are deliberately sparse here: cost and
// sourcing concerns cut across every category rather than belonging to one,
// so they mostly see what they're explicitly asked to review.
// That's exactly why this filter is never the only thing deciding what a
// stakeholder sees — see isRelevantToStakeholder below.
const CATEGORY_RELEVANCE: Record<StakeholderExpertise, RequirementCategory[]> = {
  research_development: ["comfort", "space", "usability", "infotainment_digital", "driving_experience", "range_charging", "design_quality"],
  manufacturing: ["design_quality", "space", "comfort", "variants_packages"],
  controlling: ["variants_packages", "range_charging"],
  procurement: ["variants_packages"],
  brand: ["design_quality", "infotainment_digital", "driving_experience", "variants_packages"],
};

export function isCategoryRelevant(category: RequirementCategory, expertise: StakeholderExpertise): boolean {
  return CATEGORY_RELEVANCE[expertise].includes(category);
}

// The actual filter to use: relevant-by-domain OR explicitly assigned a
// review. The "OR assigned" half is load-bearing — it's what keeps e.g.
// Procurement from losing visibility into a requirement they were
// specifically asked to review, just because its category isn't in their
// domain's list.
export function isRelevantToStakeholder(
  category: RequirementCategory,
  expertise: StakeholderExpertise,
  hasAssignedReview: boolean,
): boolean {
  return hasAssignedReview || isCategoryRelevant(category, expertise);
}
