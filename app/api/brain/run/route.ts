// POST /api/brain/run  { imageDataUrl } → { scan, plan, world }      Owner: Agent A
// The demo's big button: scan → add to inventory → forecast → plan → publish.
import type { RunRequest, RunResponse } from "@/shared/contracts";
import { planActions, scanImage } from "@/lib/brain";
import { applyDecisions, applyScan, forecastWaste, getWorld } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<RunRequest>;
    const scan = await scanImage(body.imageDataUrl ?? "", getWorld().ingredients);
    const afterScan = applyScan(scan);
    const plan = await planActions(scan, afterScan, forecastWaste(afterScan));
    const world = applyDecisions(plan.decisions);
    const out: RunResponse = { scan, plan, world };
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
