/**
 * lib/brain/vision.ts — camera frame → ScanResult. Owner: Agent A.
 * v0: real OpenRouter call (untested — verify with real produce first!) + fixture fallback.
 */
import type { DetectedItem, Freshness, Ingredient, ScanResult } from "@/shared/contracts";
import { MOCK_SCAN } from "@/shared/fixtures";
import { chatJSON, hasKey, VISION_MODEL } from "./openrouter";

const SYSTEM = `You are the produce inspector for a restaurant kitchen.
Look at the photo and list every food ingredient you can see.
Return ONLY JSON: {"items":[{"label":string,"ingredientId":string|null,"count":number,
"freshness":1|2|3|4|5,"daysLeft":number,"confidence":number,"notes":string,
"box":{"x":number,"y":number,"w":number,"h":number}}]}
Freshness scale: 5 perfect, 4 good, 3 use soon, 2 must use today, 1 unsafe (mold, rot, slime) — never round a moldy item up.
daysLeft = realistic days before it must be thrown out (0 if unsafe).
box = normalized 0..1 bounding box of the group. count = your best estimate of units.
ingredientId must be one of the catalog ids provided, or null if the item is not in the catalog.`;

export async function scanImage(imageDataUrl: string, catalog: Ingredient[]): Promise<ScanResult> {
  const started = Date.now();
  if (!imageDataUrl || imageDataUrl === "mock" || !hasKey()) {
    return { ...MOCK_SCAN, scanId: `scan_mock_${started}` };
  }
  const catalogText = catalog.map((c) => `${c.id} (${c.name}, unit: ${c.unit})`).join("; ");
  const out = await chatJSON<{ items?: Partial<DetectedItem>[] }>({
    model: VISION_MODEL(),
    timeoutMs: 15_000,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `Catalog ids: ${catalogText}` },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  });
  const ids = new Set(catalog.map((c) => c.id));
  const items: DetectedItem[] = (out.items ?? []).map((raw) => ({
    label: String(raw.label ?? "unknown item"),
    ingredientId: raw.ingredientId && ids.has(raw.ingredientId) ? raw.ingredientId : null,
    count: Math.max(0, Math.round(Number(raw.count ?? 1))),
    freshness: clampFreshness(raw.freshness),
    daysLeft: Math.max(0, Number(raw.daysLeft ?? 1)),
    confidence: Math.min(1, Math.max(0, Number(raw.confidence ?? 0.5))),
    notes: raw.notes ? String(raw.notes) : undefined,
    box: raw.box,
  }));
  return { scanId: `scan_${started}`, items, model: VISION_MODEL(), latencyMs: Date.now() - started, mock: false };
}

function clampFreshness(f: unknown): Freshness {
  const n = Math.round(Number(f));
  return (n >= 1 && n <= 5 ? n : 3) as Freshness;
}
