// Country -> market-region mapping, using the same 4-bucket taxonomy as
// sales_volumes.xlsx (EU/CN/US/RoW) so "market" means the same thing
// everywhere in the app, not just a relabeled country filter.
//
// Note: the real feedback datasets have zero China-origin rows (verified
// against the ingested data) even though Vehicle.markets lists "China" —
// BMW's China sales/customer-study numbers exist, but no verbatims from
// Chinese customers were included in the Feedback_Explorer files. The CN
// bucket is kept in the taxonomy for consistency; it'll just show 0 until
// that changes.

export type MarketCode = "EU" | "CN" | "US" | "RoW";

export const MARKET_LABEL: Record<MarketCode, string> = {
  EU: "Europe",
  CN: "China",
  US: "USA",
  RoW: "Rest of World",
};

const EU_COUNTRIES = new Set([
  "GB", "FR", "DE", "SE", "FI", "DK", "NO", "ES", "IT", "NL", "BE", "AT",
  "PT", "IE", "PL", "CZ", "GR", "HU", "RO", "LV", "LT", "EE", "SK", "SI",
  "LU", "MT", "CY", "BG", "HR",
]);
const CN_COUNTRIES = new Set(["CN", "HK", "MO"]);
const US_COUNTRIES = new Set(["US"]);

export function countryToMarket(country: string): MarketCode {
  if (US_COUNTRIES.has(country)) return "US";
  if (CN_COUNTRIES.has(country)) return "CN";
  if (EU_COUNTRIES.has(country)) return "EU";
  return "RoW";
}
