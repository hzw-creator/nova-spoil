// POST /api/world/publish  { decisions } → WorldState      Owner: Agent B
// Lets the UI publish a plan from /api/brain/plan after the owner taps "Approve".
import type { PublishRequest } from "@/shared/contracts";
import { applyDecisions } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<PublishRequest>;
  if (!Array.isArray(body.decisions)) return Response.json({ error: "decisions[] required" }, { status: 400 });
  return Response.json(applyDecisions(body.decisions));
}
