/**
 * shared/fixtures.ts — canned data so every agent can work before the others are done.
 * Owner: Agent B. Anyone may READ/import it. Keep it consistent with contracts.ts.
 */
import type { ScanResult, ReplayResult } from "./contracts";

/** What a scan of "a bunch of brown bananas + a rotten avocado + fresh bread" returns. */
export const MOCK_SCAN: ScanResult = {
  scanId: "scan_mock_1",
  model: "mock",
  latencyMs: 850,
  mock: true,
  items: [
    {
      label: "ripe bananas with brown spots",
      ingredientId: "banana",
      count: 12,
      freshness: 2,
      daysLeft: 1,
      confidence: 0.93,
      notes: "Heavy browning on most peels; perfect for baking.",
      box: { x: 0.08, y: 0.3, w: 0.42, h: 0.4 },
    },
    {
      label: "avocado, mushy and dark",
      ingredientId: "avocado",
      count: 1,
      freshness: 1,
      daysLeft: 0,
      confidence: 0.81,
      notes: "Soft, sunken skin, visible mold near stem. Unsafe.",
      box: { x: 0.55, y: 0.45, w: 0.15, h: 0.2 },
    },
    {
      label: "sourdough loaf",
      ingredientId: "bread",
      count: 2,
      freshness: 4,
      daysLeft: 2,
      confidence: 0.88,
      box: { x: 0.72, y: 0.25, w: 0.24, h: 0.3 },
    },
  ],
};

/** Placeholder until B implements the real replay. Numbers are NOT real. */
export const MOCK_REPLAY: ReplayResult = {
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({
    day: i + 1,
    label,
    baseline: { wasteUsd: 42 + i * 3, revenueUsd: 1800 + i * 120, foodCostUsd: 560 + i * 35, marginPct: 68.9 },
    withAgent: { wasteUsd: 15 + i, revenueUsd: 1860 + i * 125, foodCostUsd: 540 + i * 33, marginPct: 71.0 },
  })),
  totals: {
    baseline: { wasteUsd: 357, revenueUsd: 15120, foodCostUsd: 4655, marginPct: 69.2 },
    withAgent: { wasteUsd: 126, revenueUsd: 15645, foodCostUsd: 4473, marginPct: 71.4 },
  },
  wasteReductionPct: 64.7,
  marginDeltaPts: 2.2,
  assumptions: ["PLACEHOLDER — replace with lib/world/replay.ts output"],
  provenance: "placeholder",
  policy: "none (fixture numbers, not simulated)",
};
