// POST /api/brain/plan  { scan } → PlanResult   (does NOT change the world)   Owner: Agent A
import type { PlanResponse } from "@/shared/contracts";
import { BrainError, brainErrorResponse, planActions, validateScan } from "@/lib/brain";
import { forecastWaste, getWorld } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => { throw new BrainError("Request body must be valid JSON."); });
    const w = getWorld();
    const scan = validateScan(body?.scan, w.ingredients);
    const plan: PlanResponse = await planActions(scan, w, forecastWaste(w));
    return Response.json(plan);
  } catch (e) {
    return brainErrorResponse(e);
  }
}
