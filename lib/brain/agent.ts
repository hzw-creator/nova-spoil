/**
 * lib/brain/agent.ts — decide what to do about at-risk stock. Owner: Agent A.
 *
 * decideOffline(): pure code, deterministic, no LLM. Used by B's 7-day replay AND as the
 *                  fallback when the LLM is unavailable.
 * planActions():   v0 = decideOffline + trace. TODO(A): add the LLM step that picks the best
 *                  recipe among candidates and writes the special's name/description,
 *                  then re-run guardrails on whatever the LLM returns.
 */
import type {
  AgentDecision, AgentStep, Freshness, PlanResult, Recipe, ScanResult, Special, WasteForecast, WorldState,
} from "@/shared/contracts";
import { checkFoodSafety, checkPrice, checkRecipe } from "./guardrails";
import { quoteSpecial } from "./pricing";

const SPECIAL_HOURS = 6;

export function decideOffline(world: WorldState, forecasts: WasteForecast[], scan?: ScanResult): AgentDecision[] {
  const decisions: AgentDecision[] = [];
  const seen = new Set<string>();

  // 1) Anything the camera saw as unsafe → DISCARD (sad path)
  for (const item of scan?.items ?? []) {
    if (!item.ingredientId || seen.has(item.ingredientId)) continue;
    const safety = checkFoodSafety(item.freshness);
    if (safety.blocked) {
      const f = forecasts.find((x) => x.ingredientId === item.ingredientId);
      seen.add(item.ingredientId);
      decisions.push({
        ingredientId: item.ingredientId,
        action: "DISCARD",
        rationale: `${item.count}× ${item.label} is unsafe — discarding and lowering next order.`,
        safety,
        reorderDelta: -item.count,
        projectedWasteUsdBefore: f?.projectedWasteUsd ?? 0,
        projectedWasteUsdAfter: f?.projectedWasteUsd ?? 0,
      });
    }
  }

  // 2) Projected waste → CREATE_SPECIAL from the best recipe
  const ranked = [...forecasts].filter((f) => f.projectedWasteQty > 0 && !seen.has(f.ingredientId))
    .sort((a, b) => b.projectedWasteUsd - a.projectedWasteUsd);
  for (const f of ranked) {
    const hero = world.ingredients.find((i) => i.id === f.ingredientId);
    if (!hero) continue;
    const recipe = pickRecipe(world.recipes, f.ingredientId);
    const freshness = worstFreshness(world, f.ingredientId);
    if (!recipe) {
      decisions.push({
        ingredientId: f.ingredientId, action: "CUT_PREP", prepCutPct: 30,
        rationale: `No recipe can rescue ${hero.name}; cutting prep 30%.`,
        projectedWasteUsdBefore: f.projectedWasteUsd, projectedWasteUsdAfter: f.projectedWasteUsd * 0.7,
      });
      continue;
    }
    const q = quoteSpecial(recipe, hero, f, freshness, world.ingredients);
    const special = buildSpecial(world, recipe, f.ingredientId, q, `${round(f.projectedWasteQty)} ${hero.name.toLowerCase()} would spoil in ${round(f.minDaysLeft)} day(s)`);
    const safety = worstOf(checkRecipe(recipe.id, f.ingredientId, world.recipes), checkPrice(special, q.ingredientCost));
    decisions.push({
      ingredientId: f.ingredientId,
      action: safety.blocked ? "NO_ACTION" : "CREATE_SPECIAL",
      rationale: safety.blocked ? safety.reason : `Turn surplus ${hero.name.toLowerCase()} into ${recipe.name} at −${q.discountPct}%.`,
      special: safety.blocked ? undefined : special,
      safety,
      projectedWasteUsdBefore: f.projectedWasteUsd,
      projectedWasteUsdAfter: safety.blocked ? f.projectedWasteUsd : 0,
    });
    seen.add(f.ingredientId);
  }
  return decisions;
}

export async function planActions(scan: ScanResult, world: WorldState, forecasts: WasteForecast[]): Promise<PlanResult> {
  const started = Date.now();
  const trace: AgentStep[] = [];
  const step = (kind: AgentStep["kind"], label: string, detail?: string) =>
    trace.push({ tMs: Date.now() - started, kind, label, detail });

  for (const i of scan.items) step("vision", `Saw ${i.count}× ${i.label} · freshness ${i.freshness}/5`, i.notes);
  for (const f of forecasts.filter((x) => x.projectedWasteQty > 0))
    step("forecast", `${f.ingredientId}: ${round(f.projectedWasteQty)} units ($${f.projectedWasteUsd.toFixed(2)}) projected waste`);

  // TODO(A): LLM step here — send candidates (recipes using each hero ingredient + quotes) and ask
  // for {recipeId, name, description}. Validate with guardrails; on any error fall back to offline.
  const decisions = decideOffline(world, forecasts, scan);

  for (const d of decisions) {
    if (d.safety?.blocked) step("guardrail", `Blocked: ${d.safety.reason}`);
    if (d.special) step("tool", `Priced ${d.special.name}: $${d.special.originalPrice} → $${d.special.price}`, d.rationale);
  }
  return { planId: `plan_${started}`, decisions, trace, latencyMs: Date.now() - started, mock: true };
}

// ── helpers ──

/** Prefer AI-only recipes that use the most of the hero ingredient. */
export function pickRecipe(recipes: Recipe[], heroId: string): Recipe | undefined {
  return recipes
    .filter((r) => r.ingredients.some((l) => l.ingredientId === heroId))
    .sort((a, b) => Number(a.onMenu) - Number(b.onMenu) || heroQty(b, heroId) - heroQty(a, heroId))[0];
}
const heroQty = (r: Recipe, id: string) => r.ingredients.find((l) => l.ingredientId === id)?.qty ?? 0;

function worstFreshness(world: WorldState, id: string): Freshness {
  const lots = world.inventory.filter((l) => l.ingredientId === id && l.freshness > 1);
  return (lots.length ? Math.min(...lots.map((l) => l.freshness)) : 3) as Freshness;
}

function buildSpecial(world: WorldState, recipe: Recipe, heroId: string, q: ReturnType<typeof quoteSpecial>, reason: string): Special {
  const created = new Date(world.simTime);
  return {
    id: `sp_${recipe.id}_${created.getTime()}`,
    recipeId: recipe.id,
    name: recipe.name,
    emoji: recipe.emoji,
    description: `Today only — made with perfectly ripe ${heroId}s from our kitchen.`,
    price: q.price,
    originalPrice: recipe.basePrice,
    discountPct: q.discountPct,
    heroIngredientId: heroId,
    reason,
    createdAt: created.toISOString(),
    expiresAt: new Date(created.getTime() + SPECIAL_HOURS * 3_600_000).toISOString(),
    status: "live",
    unitsAvailable: q.units,
    unitsSold: 0,
  };
}

function worstOf(...rs: { blocked: boolean; reason: string }[]) {
  return rs.find((r) => r.blocked) ?? { blocked: false, reason: "OK" };
}
const round = (n: number) => Math.round(n * 10) / 10;
