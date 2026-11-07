// GET /api/world/state → WorldState      Owner: Agent B
import { getWorld } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getWorld());
}
