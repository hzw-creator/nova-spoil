// POST /api/world/tick  { minutes } → WorldState      Owner: Agent B
import type { TickRequest } from "@/shared/contracts";
import { tick } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<TickRequest>;
  const minutes = Number(body.minutes ?? 10);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240)
    return Response.json({ error: "minutes must be 1..240" }, { status: 400 });
  return Response.json(tick(minutes));
}
