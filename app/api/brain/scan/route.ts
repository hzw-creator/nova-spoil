// POST /api/brain/scan  { imageDataUrl } → ScanResult      Owner: Agent A
import type { ScanResponse } from "@/shared/contracts";
import { brainErrorResponse, readImageRequest, scanImage } from "@/lib/brain";
import { getWorld } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const image = await readImageRequest(req);
    const scan: ScanResponse = await scanImage(image, getWorld().ingredients);
    return Response.json(scan);
  } catch (e) {
    return brainErrorResponse(e);
  }
}
