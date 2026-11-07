/**
 * components/api.ts — typed client for the backend routes. Owner: Agent C.
 * The UI talks to the backend ONLY through HTTP (never import lib/brain or lib/world
 * into client components — lib/brain reads the API key).
 */
import type {
  ReplayResponse, RunResponse, ScanResponse, StateResponse, TickResponse, PlanResponse,
  AgentDecision, ScanResult,
} from "@/shared/contracts";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { signal: AbortSignal.timeout(30_000), ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const data = await res.json().catch(() => ({ error: `${path} returned an unreadable response (${res.status})` }));
  if (!res.ok) throw new Error(data?.error ?? `${path} failed (${res.status})`);
  return data as T;
}
const post = <T>(path: string, body?: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

export const api = {
  state: () => call<StateResponse>("/api/world/state"),
  reset: () => post<StateResponse>("/api/world/reset"),
  tick: (minutes: number) => post<TickResponse>("/api/world/tick", { minutes }),
  replay: () => call<ReplayResponse>("/api/world/replay"),
  publish: (decisions: AgentDecision[]) => post<StateResponse>("/api/world/publish", { decisions }),
  scan: (imageDataUrl: string) => post<ScanResponse>("/api/brain/scan", { imageDataUrl }),
  plan: (scan: ScanResult) => post<PlanResponse>("/api/brain/plan", { scan }),
  /** imageDataUrl "mock" → uses the fixture scan (works with no camera / no API key) */
  run: (imageDataUrl: string) => post<RunResponse>("/api/brain/run", { imageDataUrl }),
};
