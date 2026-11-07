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
  return freshness <= 1
    ? { blocked: true, reason: "Freshness 1/5 (unsafe) — food-safety rule: never sell, discard instead." }
    : { blocked: false, reason: "OK" };
}

/** Rule 2: the special must be a real recipe that actually uses the hero ingredient. */
export function checkRecipe(recipeId: string, heroId: string, recipes: Recipe[]): GuardResult {
  const r = recipes.find((x) => x.id === recipeId);
  if (!r) return { blocked: true, reason: `Recipe "${recipeId}" is not in the kitchen's recipe book.` };
  if (!r.ingredients.some((l) => l.ingredientId === heroId))
    return { blocked: true, reason: `${r.name} does not use ${heroId}.` };
  return { blocked: false, reason: "OK" };
}

/** Rule 3: price sanity — never below 1.5× ingredient cost, discount ≤ 60%. */
export function checkPrice(s: Pick<Special, "price" | "originalPrice" | "discountPct">, ingredientCost: number): GuardResult {
  if (s.price < ingredientCost * 1.5) return { blocked: true, reason: "Price below 1.5× ingredient cost." };
  if (s.discountPct > 60) return { blocked: true, reason: "Discount above 60% cap." };
  return { blocked: false, reason: "OK" };
}
