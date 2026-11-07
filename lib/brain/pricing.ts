/**
 * lib/brain/pricing.ts — discount + quantity for a special. Owner: Agent A.
 * Pure code (no LLM). Explainable on a slide: urgency and surplus push the discount up,
 * the cost floor caps it.
 */
import type { Freshness, Ingredient, Recipe, WasteForecast } from "@/shared/contracts";

export interface PriceQuote {
  price: number;
  discountPct: number;
  units: number; // how many specials to offer
  ingredientCost: number; // total recipe ingredient cost per unit
}

export function quoteSpecial(
  recipe: Recipe,
  hero: Ingredient,
  forecast: WasteForecast,
  freshness: Freshness,
  catalog: Ingredient[],
): PriceQuote {
  const heroQtyPerUnit = recipe.ingredients.find((l) => l.ingredientId === hero.id)?.qty ?? 1;
  const units = Math.max(1, Math.ceil(forecast.projectedWasteQty / heroQtyPerUnit));

  // urgency: 0 (≥3 days left) → 1 (≤0.5 days left); freshness 2 adds urgency
  const urgency = clamp((3 - forecast.minDaysLeft) / 2.5, 0, 1) * (freshness <= 2 ? 1 : 0.7);
  // surplus: more units to move → deeper discount (saturates at 15 units)
  const surplus = clamp(units / 15, 0, 1);
  const targetDiscountPct = Math.round(10 + 30 * urgency + 15 * surplus); // 10%..55%

  const ingredientCost = recipe.ingredients.reduce((s, l) => {
    const ing = catalog.find((c) => c.id === l.ingredientId);
    return s + (ing?.unitCost ?? 0) * l.qty;
  }, 0);
  // floor: never price below 1.5× ingredient cost
  const floor = ingredientCost * 1.5;
  let price = Math.min(recipe.basePrice, roundPrice(recipe.basePrice * (1 - targetDiscountPct / 100)));
  if (price < floor) {
    price = roundPriceUp(floor);
  }
  const discountPct = Math.round((1 - price / recipe.basePrice) * 100);
  return { price, discountPct, units, ingredientCost };
}

/** $X.49 / $X.99 style prices */
function roundPrice(p: number) {
  const whole = Math.floor(p);
  return p - whole < 0.5 ? whole + 0.49 : whole + 0.99;
}
function roundPriceUp(p: number) {
  const whole = Math.floor(p);
  if (p <= whole + 0.49) return whole + 0.49;
  if (p <= whole + 0.99) return whole + 0.99;
  return whole + 1.49;
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
