// Loads the real-data JSON fixtures produced by `npm run ingest`
// (src/data/*.json, gitignored — confidential BMW hackathon data, each
// teammate needs their own copy of data-raw/ and must run the ingest
// script locally). Falls back to empty arrays if a teammate hasn't run it
// yet, so the app never crashes — it just has less to show.

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { FeedbackRecord, SalesVolume, CustomerStudyScore } from "./types";

export interface RawSignal {
  vehicleCode: string;
  component: string;
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

export interface EquipmentChunk {
  vehicleCode: string;
  section: string;
  text: string;
}

function load<T>(filename: string, fallback: T): T {
  const path = join(process.cwd(), "src", "data", filename);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function hasRealData(): boolean {
  return existsSync(join(process.cwd(), "src", "data", "signals.json"));
}

export function loadFeedback(): FeedbackRecord[] {
  return load("feedback.json", []);
}

export function loadSignals(): RawSignal[] {
  return load("signals.json", []);
}

export function loadSales(): SalesVolume[] {
  return load("sales.json", []);
}

export function loadCustomerStudy(): CustomerStudyScore[] {
  return load("customer-study.json", []);
}

export function loadEquipmentChunks(): EquipmentChunk[] {
  return load("equipment-chunks.json", []);
}
