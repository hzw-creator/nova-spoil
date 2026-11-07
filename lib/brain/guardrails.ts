/**
 * lib/brain/guardrails.ts — hard safety rules that override the LLM. Owner: Agent A.
 * These are the "sad path" of the demo. Keep them in plain code, never in a prompt only.
 */
import type { Freshness, Recipe, Special } from "@/shared/contracts";

export interface GuardResult {
  blocked: boolean;
  reason: string;
}

/** Rule 1: freshness 1 (mold/rot) is never sold. */
export function checkFoodSafety(freshness: Freshness): GuardResult {
  if (!Number.isInteger(freshness) || freshness < 1 || freshness > 5)
    return { blocked: true, reason: "Invalid visual quality estimate — review required; never sell." };
  return freshness === 1
    ? { blocked: true, reason: "Freshness 1/5 — blocked by demo rule: discard, never sell." }
    : { blocked: false, reason: "Visual quality rule passed; this is not a food-safety certification." };
}

/** Rule 2: the special must be a real recipe that actually uses the hero ingredient. */
export function checkRecipe(recipeId: string, heroId: string, recipes: Recipe[]): GuardResult {
  const r = recipes.find((x) => x.id === recipeId);
  if (!r) return { blocked: true, reason: `Recipe "${recipeId}" is not in the kitchen's recipe book.` };
  if (!Number.isFinite(r.basePrice) || r.basePrice <= 0 || !r.ingredients.length ||
      r.ingredients.some((l) => !l.ingredientId || !Number.isFinite(l.qty) || l.qty <= 0))
    return { blocked: true, reason: "Recipe has invalid prices or ingredient quantities." };
  if (!r.ingredients.some((l) => l.ingredientId === heroId))
    return { blocked: true, reason: `${r.name} does not use ${heroId}.` };
  return { blocked: false, reason: "OK" };
}

/** Rule 3: price sanity — never below 1.5× ingredient cost, discount ≤ 60%. */
export function checkPrice(s: Pick<Special, "price" | "originalPrice" | "discountPct">, ingredientCost: number): GuardResult {
  if (![s.price, s.originalPrice, s.discountPct, ingredientCost].every(Number.isFinite) ||
      s.price <= 0 || s.originalPrice <= 0 || ingredientCost < 0)
    return { blocked: true, reason: "Price, list price, discount and cost must be finite valid numbers." };
  if (s.price > s.originalPrice) return { blocked: true, reason: "Special price exceeds the recipe list price." };
  if (s.price + 1e-9 < ingredientCost * 1.5) return { blocked: true, reason: "Price below 1.5× ingredient cost." };
  const actualDiscount = (1 - s.price / s.originalPrice) * 100;
  if (s.discountPct < 0 || s.discountPct > 60 || actualDiscount > 60 + 1e-9)
    return { blocked: true, reason: "Discount outside the 0–60% cap." };
  if (Math.abs(s.discountPct - actualDiscount) > 0.5 + 1e-9)
    return { blocked: true, reason: "Discount does not match the quoted price and list price." };
  return { blocked: false, reason: "OK" };
}
