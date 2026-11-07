// POST /api/world/reset → WorldState (seeded Friday 7:00 AM)      Owner: Agent B
import { resetWorld } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json(resetWorld());
}
