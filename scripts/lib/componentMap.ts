// Maps BMW's own VFC (Vehicle Feedback Classification) "Vfc level2 Name"
// taxonomy — 226 real categories across the three feedback datasets — onto
// the app's 6 landing-page components. Deterministic and keyword-based on
// purpose: every mapping decision has to be explainable to a judge asking
// "why is this verbatim under Battery & Charging?", not a black box.
//
// Unmatched categories fall into "general" and are still ingested (visible
// in the Evidence Explorer) but don't get their own landing-page hotspot.

import type { ComponentKey } from "../../src/lib/types";

type Rule = { keywords: string[]; component: ComponentKey };

// Checked before the keyword rules below: categories that would otherwise
// false-positive-match a rule's keyword (e.g. "Mobile device, wireless
// charging" is a phone charging pad, not vehicle battery charging — it
// would wrongly match battery's "charg" keyword without this).
const OVERRIDES: { match: (lower: string) => boolean; component: ComponentKey }[] = [
  { match: (l) => l.includes("mobile device"), component: "interior" },
];

// Order matters: first match wins. Put more specific rules before broader
// catch-alls (e.g. "charg" before generic "drivetrain").
const RULES: Rule[] = [
  {
    component: "battery",
    keywords: [
      "charg", "high voltage battery", "high-voltage", "electric range",
      "brake energy regeneration", "recuperation", "frunk", "wallbox",
      "vehicle battery",
    ],
  },
  {
    component: "engine",
    keywords: [
      "drivetrain", "engine", "transmission", "fuel", "acceleration",
      "exhaust", "cooling", "launch control", "automatic engine start",
      "my modes", "driving experience", "shift paddle", "selector lever",
    ],
  },
  {
    component: "steering",
    keywords: [
      "steering", "drive, driving dynamics", "handling", "braking",
      "cruise control", "driver assistance", "automated driving",
      "lane", "parking assistant", "park distance", "cross traffic",
      "collision warning", "surround view", "all-round view", "night vision",
      "traffic", "touch screen", "operating concept", "operating system",
      "connecteddrive and infotainment", "navigation", "head-up display",
      "instrument", "voice control", "intelligent personal assistant",
      "controller operation", "gesture control", "apple carplay",
      "android auto", "pedals", "stability control", "self-leveling",
      "speed limit", "fatigue alert",
    ],
  },
  {
    component: "windows",
    keywords: [
      "window", "panorama glass roof", "sun protection", "sun visor",
      "rearview mirror", "wiper", "windshield", "roof", "rain sensor",
      "interior mirror",
    ],
  },
  {
    component: "interior",
    keywords: [
      "seat", "interior", "cushioning", "ambient light", "cupholder",
      "armrest", "storage", "glove box", "trunk", "luggage", "space",
      "climat", "air conditioning", "audio", "sound", "acoustics",
      "rear seat entertainment", "floor mat", "headrest", "center console",
      "upholstery",
    ],
  },
  {
    component: "exterior",
    keywords: [
      "exterior", "body equipment", "wheels", "tire", "door", "lighting",
      "radiator grille", "bumper", "hood", "key", "lock", "unlock",
      "comfort access", "digital key", "welcome light", "garage door",
      "towing", "trailer", "running board", "convertible",
    ],
  },
];

export function mapCategoryToComponent(vfcLevel2Name: string | null | undefined): ComponentKey | "general" {
  if (!vfcLevel2Name || vfcLevel2Name === "no_class_found") return "general";
  const lower = vfcLevel2Name.toLowerCase();
  for (const override of OVERRIDES) {
    if (override.match(lower)) return override.component;
  }
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.component;
  }
  return "general";
}
