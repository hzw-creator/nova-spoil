// POST /api/brain/plan  { scan } → PlanResult   (does NOT change the world)   Owner: Agent A
import type { PlanRequest, PlanResponse } from "@/shared/contracts";
import { planActions } from "@/lib/brain";
import { forecastWaste, getWorld } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PlanRequest;
    if (!body?.scan) return Response.json({ error: "body.scan is required" }, { status: 400 });
    const w = getWorld();
    const plan: PlanResponse = await planActions(body.scan, w, forecastWaste(w));
    return Response.json(plan);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
