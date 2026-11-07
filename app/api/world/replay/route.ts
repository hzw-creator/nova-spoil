// GET /api/world/replay → ReplayResult (7-day baseline vs agent)      Owner: Agent B
import { runReplay } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(runReplay());
}
