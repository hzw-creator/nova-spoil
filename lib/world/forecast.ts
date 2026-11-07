/**
 * lib/world/forecast.ts — projected waste per ingredient. Owner: Agent B.
 * v0: daily usage from normal-menu demand × recipe quantities. Improve if time allows
 * (time-of-day curve, weekday effect), but keep the output type stable.
 */
import type { WasteForecast, WorldState } from "@/shared/contracts";
import { MENU_ORDERS_PER_HOUR, OPEN_HOURS_PER_DAY } from "./seed";

export function dailyUsage(w: WorldState): Record<string, number> {
  const use: Record<string, number> = {};
  for (const r of w.recipes) {
    const perHour = MENU_ORDERS_PER_HOUR[r.id] ?? 0;
    for (const line of r.ingredients) {
      use[line.ingredientId] = (use[line.ingredientId] ?? 0) + line.qty * perHour * OPEN_HOURS_PER_DAY;
    }
  }
  return use;
}

export function forecastWaste(w: WorldState): WasteForecast[] {
  const use = dailyUsage(w);
  return w.ingredients.map((ing) => {
    const lots = w.inventory.filter((l) => l.ingredientId === ing.id && l.qty > 0);
    const onHand = lots.reduce((s, l) => s + l.qty, 0);
    const atRisk = lots.filter((l) => l.daysLeft <= 2 || l.freshness <= 3);
    const atRiskQty = atRisk.reduce((s, l) => s + l.qty, 0);
    const minDaysLeft = atRisk.length ? Math.min(...atRisk.map((l) => l.daysLeft)) : Infinity;
    // Normal demand eats the oldest stock first, so at-risk units get used at the daily rate.
    // Live specials will also consume the hero ingredient (that's the point of them).
    const reservedBySpecials = w.specials
      .filter((s) => s.status === "live" && s.heroIngredientId === ing.id)
      .reduce((sum, s) => {
        const per = w.recipes.find((r) => r.id === s.recipeId)?.ingredients.find((l) => l.ingredientId === ing.id)?.qty ?? 0;
        return sum + per * Math.max(0, s.unitsAvailable - s.unitsSold);
      }, 0);
    const expectedUseBeforeExpiry = atRisk.length ? (use[ing.id] ?? 0) * Math.max(minDaysLeft, 0) + reservedBySpecials : 0;
    // Unsafe lots (freshness 1) can never be sold: they are always waste.
    const unsafeQty = atRisk.filter((l) => l.freshness === 1).reduce((s, l) => s + l.qty, 0);
    const projectedWasteQty = Math.max(unsafeQty, atRiskQty - expectedUseBeforeExpiry, 0);
    return {
      ingredientId: ing.id,
      onHand,
      atRiskQty,
      minDaysLeft: Number.isFinite(minDaysLeft) ? minDaysLeft : 99,
      expectedUseBeforeExpiry: round2(expectedUseBeforeExpiry),
      projectedWasteQty: round2(projectedWasteQty),
      projectedWasteUsd: round2(projectedWasteQty * ing.unitCost),
    };
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;
