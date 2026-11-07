/**
 * lib/world/replay.ts — 7-day "with agent vs without agent" comparison. Owner: Agent B.
 *
 * v0 returns the placeholder fixture. Agent B's job: simulate 7 days twice from the
 * same seed — baseline (no specials) and withAgent (each morning call
 * decideOffline() from lib/brain and apply its decisions) — and report real numbers.
 * Never call an LLM here (decideOffline is pure code) so the replay runs in < 1 s.
 */
import type { ReplayResult } from "@/shared/contracts";
import { MOCK_REPLAY } from "@/shared/fixtures";

export function runReplay(): ReplayResult {
  // TODO(B): real implementation. Must stay deterministic (resetRng(seed) before each run).
  return MOCK_REPLAY;
}
