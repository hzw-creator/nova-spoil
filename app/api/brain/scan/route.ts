// POST /api/brain/scan  { imageDataUrl } → ScanResult      Owner: Agent A
import type { ScanRequest, ScanResponse } from "@/shared/contracts";
import { scanImage } from "@/lib/brain";
import { getWorld } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<ScanRequest>;
    const scan: ScanResponse = await scanImage(body.imageDataUrl ?? "", getWorld().ingredients);
    return Response.json(scan);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
