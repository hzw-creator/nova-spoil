// POST /api/brain/run  { imageDataUrl } → { scan, plan, world }      Owner: Agent A
// The demo's big button: scan → add to inventory → forecast → plan → publish.
import type { RunResponse } from "@/shared/contracts";
import { brainErrorResponse, planActions, readImageRequest, scanImage } from "@/lib/brain";
import { applyDecisions, applyScan, forecastWaste, getWorld } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const started = Date.now();
    const image = await readImageRequest(req);
    const scan = await scanImage(image, getWorld().ingredients);
    const afterScan = applyScan(scan);
    // Plan against a snapshot: /tick can continue while a live text request is in flight.
    const snapshot = structuredClone(afterScan);
    const plan = await planActions(scan, snapshot, forecastWaste(snapshot));
    for (const step of plan.trace) step.tMs += scan.latencyMs;
    const world = applyDecisions(plan.decisions);
    for (const decision of plan.decisions) {
      if (decision.action !== "CREATE_SPECIAL" || !decision.special) continue;
      const published = world.specials.find((s) => s.id === decision.special?.id && s.status === "live");
      plan.trace.push({ tMs: Date.now() - started, kind: published ? "publish" : "guardrail",
        label: published ? `Published ${published.name} · ${published.unitsAvailable} portions at $${published.price.toFixed(2)}`
          : `Not published: ${decision.special.name} · current inventory or guard rejected the proposal`,
        detail: published ? "Confirmed in returned world state; sales have not occurred yet."
          : world.events.find((e) => e.message.includes(decision.special!.name) && e.message.includes("NOT published"))?.message });
    }
    plan.latencyMs = Date.now() - started;
    const out: RunResponse = { scan, plan, world };
    return Response.json(out);
  } catch (e) {
    return brainErrorResponse(e);
  }
}
