// Curated excerpts from the public BMW Group Report 2025 (page numbers refer
// to the report's own pagination). This is the grounding for the
// `strategic_fit` score factor: the model may only argue strategic alignment
// from these passages, and every requirement it scores cites the excerpt ids
// it relied on (see assessJudgmentFactors() in ai.ts and
// scripts/ai-judgment-factors.ts).
//
// These are BMW's own corporate statements — official, but not customer
// evidence. They justify "does this fit where BMW is heading", never "do
// customers want this".

import type { SourceRecord } from "./types";

export interface StrategyExcerpt {
  id: string; // stable citation id, e.g. "bmwgr25-p46-focus"
  page: number;
  topic: string;
  text: string;
}

export const BMW_REPORT_TITLE = "BMW Group Report 2025";

export const STRATEGY_EXCERPTS: StrategyExcerpt[] = [
  {
    id: "bmwgr25-p46-focus",
    page: 46,
    topic: "Strategic focus areas",
    text: "The BMW Group consistently places the needs of its customers at the centre by combining forward-looking technologies, exciting products and personalised support into a comprehensive experience. The focus areas are drivetrains with an emphasis on electromobility as well as digitalisation, sustainability and the circular economy.",
  },
  {
    id: "bmwgr25-p46-neue-klasse",
    page: 46,
    topic: "NEUE KLASSE rollout across the portfolio",
    text: "The NEUE KLASSE sets a new standard for digitalisation and vehicle performance. Its new technology toolkit and the new design language will be rolled out across the entire vehicle portfolio, encompassing all drivetrain types, by the end of the decade. The new technologies include BMW Panoramic iDrive, combined with a new display and user interface system stretching across the entire width of the windscreen, as well as the new Heart of Joy control unit, which not only significantly enhances the driving experience but also delivers a further boost to efficiency, which also means a longer range.",
  },
  {
    id: "bmwgr25-p46-drivetrain-choice",
    page: 46,
    topic: "Gen6 e-drive and technology openness",
    text: "The new sixth-generation BMW e-drive technology will significantly enhance range, charging time and manufacturing costs. At the same time, the BMW Group is continuing to refine its highly efficient combustion engine technologies, which means that customers will still be able to choose from state-of-the-art vehicles across all brands and vehicle classes, independent of the drivetrain system.",
  },
  {
    id: "bmwgr25-p46-bev-target",
    page: 46,
    topic: "BEV share target and drivetrain-mix volatility",
    text: "The BMW Group is anticipating that the share of all-electric vehicles will continue to rise, albeit with regional differences (strategic target of 50% by 2030). The dynamic nature of external factors may lead to considerable volatility in the drivetrain mix.",
  },
  {
    id: "bmwgr25-p54-gen6-battery",
    page: 54,
    topic: "Gen6 battery: range, charging speed, energy density",
    text: "The batteries increase range by 30% compared with the fifth generation, with an even greater improvement in some models. In the case of the new BMW iX3, this means a range of up to 805 km (WLTP). The charging speed is 30% faster and the cylindrical cells offer a 20% increase in volumetric energy density compared with the prismatic cells used in the fifth generation.",
  },
  {
    id: "bmwgr25-p55-charging-experience",
    page: 55,
    topic: "Customer charging experience",
    text: "In addition to the evolution in charging capacity in the NEUE KLASSE, the BMW Group is focusing on all other aspects relating to the customer charging experience. A well-developed, customer-friendly charging infrastructure will pave the way for the rapid and widespread use of electromobility. BMW and MINI customers have access to 3.4 million charging points worldwide through the navigation system or the relevant vehicle app.",
  },
  {
    id: "bmwgr25-p56-bidirectional",
    page: 56,
    topic: "Bidirectional charging (V2H / V2G / V2L)",
    text: "In addition to faster public charging, the bidirectional charging functionality is another major innovation in the BMW iX3. The energy stored in the high-voltage battery can be used not only for the drivetrain but also outside the vehicle: Vehicle-to-Home, Vehicle-to-Grid and Vehicle-to-Load.",
  },
  {
    id: "bmwgr25-p42-digital-expectations",
    page: 42,
    topic: "Customer expectations: digital ecosystems and automated driving",
    text: "Customers are shaping their requirements for vehicles with regard to the digital ecosystems they use daily. Automobiles are expected to provide reliable support in everyday life, seamlessly integrate into personal living environments and create a holistic experience. Software updates and upgrades have become standard. Alongside digitalisation, the shift towards automated and autonomous driving remains one of the key expectation for the future of mobility.",
  },
  {
    id: "bmwgr25-p53-panoramic-idrive",
    page: 53,
    topic: "Panoramic iDrive, Operating System X, LLM voice assistant",
    text: "BMW Panoramic iDrive combines the latest display and interaction solutions with all-new electronics and software architecture. BMW Operating System X lays the groundwork for a high degree of personalisation, regular over-the-air updates and seamless integration of the My BMW app. The further developed BMW Intelligent Personal Assistant will use Large Language Model (LLM) technology for the first time, thus allowing for natural and context-sensitive voice interaction.",
  },
  {
    id: "bmwgr25-p53-china-digital",
    page: 53,
    topic: "China-specific digital features",
    text: "BMW Operating System X for the Chinese market offers an array of exclusive digital features, including the AI-based BMW Intelligent Personal Assistant for China. The Large Language Model integrated into it is the result of a collaboration with Chinese technology company Alibaba.",
  },
  {
    id: "bmwgr25-p54-driver-assistance",
    page: 54,
    topic: "Highway and City Assistant, Symbiotic Drive",
    text: "The BMW iX3 is the first model to feature the latest generation of the Highway and City Assistant, enabling it to operate at up to 130 km/h on selected highways and adding extra features for driving in urban areas. BMW Symbiotic Drive establishes a seamless transition between driver assistance systems and driver control: the driver can adjust steering and brakes slightly without switching off the assistance features.",
  },
  {
    id: "bmwgr25-p45-quality",
    page: 45,
    topic: "Quality and reliability",
    text: "Key factors for customer satisfaction and enthusiasm, as well as the economic success of the BMW Group, are the quality and reliability of all products and services. Therefore, the Company has set a holistic understanding of quality aimed at providing the best customer experience (quality programme \"Q3 – Passion for Perfection\").",
  },
  {
    id: "bmwgr25-p47-circularity",
    page: 47,
    topic: "Circular economy and secondary materials",
    text: "The NEUE KLASSE aims for a higher level of sustainability throughout the entire vehicle life cycle, including the supply chain. The BMW Group is taking additional steps to increase the content of recycled materials. Circular economy requires holistic thinking – from product design to vehicle recycling.",
  },
  {
    id: "bmwgr25-p255-china-competition",
    page: 255,
    topic: "China: price-driven competition with local manufacturers",
    text: "The challenging market environment and competition from Chinese manufacturers may have a further impact on the BMW Group; for example, on sales of electrified models, which are in competition with local Chinese suppliers in a heavily price-driven market. Measures taken include adjustments to the BMW and MINI product ranges, targeted action to strengthen the brands and the expansion of offers tailored specifically to the Chinese market.",
  },
  {
    id: "bmwgr25-p263-market-outlook",
    page: 263,
    topic: "2026 market outlook by region",
    text: "Europe is expected to provide the majority of the positive momentum thanks to carbon regulations and new government subsidy programmes that should continue to drive sales of electrified vehicles. We expect sales of all-electric vehicles to go down in the USA due to changing regulatory conditions. The Chinese automobile market is expected to perform below the previous year's level.",
  },
  {
    id: "bmwgr25-p79-series-deliveries",
    page: 79,
    topic: "2025 deliveries by model series",
    text: "Deliveries 2025 vs. 2024: BMW 1 Series/2 Series 214,175 units (+8.0%); BMW 5 Series/6 Series 299,582 units (+19.5%, among the strongest growth rates); BMW 7 Series/8 Series 53,399 units (-5.6%).",
  },
];

export function getStrategyExcerpt(id: string): StrategyExcerpt | undefined {
  return STRATEGY_EXCERPTS.find((e) => e.id === id);
}

// Sources are workflow-scoped in the store (listSources filters by
// workflowId), so each workflow that cites an excerpt gets its own record.
export function strategySourceId(excerptId: string, workflowId: string): string {
  return `src_${excerptId}_${workflowId}`;
}

export function strategySourceRecord(excerpt: StrategyExcerpt, workflowId: string, retrievedAt: string): SourceRecord {
  return {
    id: strategySourceId(excerpt.id, workflowId),
    workflowId,
    datasetType: "web",
    reliability: "official",
    title: `${BMW_REPORT_TITLE}, p. ${excerpt.page} — ${excerpt.topic}`,
    excerpt: excerpt.text,
    url: null,
    retrievedAt,
  };
}
