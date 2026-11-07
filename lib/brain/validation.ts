import { z } from "zod";
import type { Ingredient, ScanResult } from "@/shared/contracts";
import { isValidPricingSettings, type PricingOptions } from "./pricing";

export class BrainError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export const boxSchema = z.object({
  x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1),
  w: z.number().finite().positive().max(1), h: z.number().finite().positive().max(1),
}).refine((b) => b.x + b.w <= 1.000001 && b.y + b.h <= 1.000001);

export const itemSchema = z.object({
  label: z.string().trim().min(1).max(120), ingredientId: z.string().min(1).max(80).nullable(),
  count: z.number().finite().min(0).max(10_000), freshness: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  daysLeft: z.number().finite().min(0).max(365), confidence: z.number().finite().min(0).max(1),
  notes: z.string().max(600).optional(), box: boxSchema.optional(),
});

/** Reject invalid input before no-key fallback, so malformed requests cannot publish fixture stock. */
export function validateImageInput(value: unknown): string {
  if (typeof value !== "string") throw new BrainError("imageDataUrl must be a string (or use \"mock\").");
  if (value === "" || value === "mock") return value;
  if (value.length > 8_000_000) throw new BrainError("Image too large; resize to 1024 pixels before scanning.", 413);
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new BrainError("Use a JPEG, PNG or WebP base64 data URL, or \"mock\".");
  const payload = value.slice(value.indexOf(",") + 1);
  if (payload.length % 4 !== 0) throw new BrainError("Image base64 is incomplete.");
  return value;
}

export async function readImageRequest(req: Request): Promise<string> {
  const body = await req.json().catch(() => { throw new BrainError("Request body must be valid JSON."); });
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BrainError("Request body must be an object.");
  return validateImageInput("imageDataUrl" in body ? body.imageDataUrl : "");
}

export function validatePricingSettings(value: unknown): PricingOptions | undefined {
  if (value === undefined) return undefined;
  if (!isValidPricingSettings(value)) throw new BrainError("pricing requires finite minGrossMarginPct 35..80 and maxDiscountPct 0..60.");
  return { minGrossMarginPct: value.minGrossMarginPct, maxDiscountPct: value.maxDiscountPct };
}

export async function readRunRequest(req: Request): Promise<{ imageDataUrl: string; pricing?: PricingOptions }> {
  const body = await req.json().catch(() => { throw new BrainError("Request body must be valid JSON."); });
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BrainError("Request body must be an object.");
  return { imageDataUrl: validateImageInput("imageDataUrl" in body ? body.imageDataUrl : ""), pricing: validatePricingSettings(body.pricing) };
}

/** For the preview endpoint; this does not establish camera or stored-plan authority. */
export function validateScan(value: unknown, catalog: Ingredient[]): ScanResult {
  const parsed = z.object({
    scanId: z.string().min(1).max(120), model: z.string().min(1).max(120),
    latencyMs: z.number().finite().nonnegative(), mock: z.boolean(), items: z.array(itemSchema).max(50),
  }).safeParse(value);
  if (!parsed.success) throw new BrainError("scan has malformed observations; rescan or use the demo fixture.");
  if (parsed.data.items.some((item) => item.ingredientId !== null && !catalog.some((i) => i.id === item.ingredientId)))
    throw new BrainError("scan includes an unknown catalog id; mark it null for review.");
  return parsed.data;
}

export function brainErrorResponse(error: unknown): Response {
  return Response.json({ error: error instanceof BrainError ? error.message : "Brain request failed; retry or use the labeled mock demo." },
    { status: error instanceof BrainError ? error.status : 500 });
}
