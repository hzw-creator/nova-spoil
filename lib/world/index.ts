/**
 * lib/world/index.ts — the ONLY file other agents may import from lib/world.
 * Owner: Agent B. Signatures here are part of the contract (see shared/CONTRACTS.md).
 */
import type { WorldState } from "@/shared/contracts";
import { freshWorld, resetRng, setWorld, world } from "./store";
import { logEvent, refreshMetrics } from "./sim";

export { forecastWaste } from "./forecast";
export { applyScan, applyDecisions, tick } from "./sim";
export { runReplay } from "./replay";

/** Current state (with refreshed projected-waste metric). */
export function getWorld(): WorldState {
  return refreshMetrics(world());
}

/** Back to the seeded Friday-morning café. Deterministic. */
export function resetWorld(): WorldState {
  resetRng();
  const w = setWorld(freshWorld());
  logEvent(w, "reset", "Café reset to Friday 7:00 AM");
  return refreshMetrics(w);
}
