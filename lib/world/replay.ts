/**
 * lib/world/replay.ts — 7-day "with agent vs without agent" comparison. Owner: Agent B.
 *
 * Design (agreed on the board, A-003 / B-003 / B-005):
 *  - Common random numbers: ONE pre-generated customer stream (menu orders per minute, special-curious
 *    customers, cannibalization draws) is shared by every policy, so differences come from the policy only.
 *  - Policies: "none" (baseline, no specials) vs "decideOffline" (A's pure offline agent, called at 07:00
 *    and 14:00 each day, decisions applied through the same server-side validation + stock caps as live).
 *  - Sanity case: the agent with zero special demand must match the baseline exactly.
 *  - Results are reported as computed, even if the agent loses.
 *  - Runs on its own cloned world with its own RNG; the live world, RNG and id sequence are untouched.
 *  - Pure, synchronous, no LLM. Target < 1 s.
 */
import type { DayMetrics, Freshness, InventoryLot, ReplayDay, ReplayResult, WorldState } from "@/shared/contracts";
import { decideOffline } from "@/lib/brain";
import { dailyUsage, forecastWaste } from "./forecast";
import { CLOSE_HOUR, MENU_ORDERS_PER_HOUR, OPEN_HOUR, SIM_START, specialOrdersPerHour } from "./seed";
import { MENU_MIN_FRESHNESS, SPECIAL_MIN_FRESHNESS, applyDecisionsTo, makeOne } from "./sim";
import { freshWorld, restoreGlobals, snapshotGlobals } from "./store";

const DAYS = 7;
const SEED = 20261107; // development scenario (policy changes may be tuned against it)
const SECONDARY_SEED = 77031; // fixed before any policy tuning (15:20 ET); results disclosed since, so it is a fixed SECONDARY scenario, not held-out validation
/** Fixed daily order = this × expected daily usage, rounded up to whole units. Kitchens over-order to avoid stockouts. */
const ORDER_BUFFER = 1.25;
/** Share of special orders that are customers who would otherwise have bought a regular menu item. */
const CANNIBALIZATION = 0.25;
const DECISION_HOURS = [7, 14];
const MIN_PER_DAY = 1440;

type Policy = "none" | "decideOffline";

/** Demand multiplier by weekday (Sun..Sat). Busy weekends, slow Mon/Tue; the supplier order stays fixed. */
const WEEKDAY_DEMAND = [1.25, 0.75, 0.8, 0.9, 1.0, 1.15, 1.35];
/** Delivered produce arrives with this fraction of its nominal shelf life left (uniform range). */
const DELIVERY_LIFE_MIN = 0.6;

interface Streams {
  menu: Uint8Array; // [minute * nMenu + j] = regular orders for menu item j in that minute
  specialU: Float64Array; // [minute * nIng + k] = uniform draw for a special-curious customer for hero ingredient k
  cannibalU: Float64Array; // same shape, decides whether that customer is cannibalized from the menu
  deliveryLife: Float64Array; // [day * nIng + k] = fraction of shelf life left on that morning's delivery
}

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, rnd: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}

function makeStreams(w: WorldState, seed: number): Streams {
  const rnd = mulberry32(seed);
  const minutes = DAYS * MIN_PER_DAY;
  const nMenu = w.menu.length;
  const nIng = w.ingredients.length;
  const menu = new Uint8Array(minutes * nMenu);
  const specialU = new Float64Array(minutes * nIng);
  const cannibalU = new Float64Array(minutes * nIng);
  const startDow = new Date(SIM_START).getUTCDay();
  for (let t = 0; t < minutes; t++) {
    const mult = WEEKDAY_DEMAND[(startDow + Math.floor(t / MIN_PER_DAY)) % 7];
    for (let j = 0; j < nMenu; j++) menu[t * nMenu + j] = poisson(((MENU_ORDERS_PER_HOUR[w.menu[j].recipeId] ?? 0) * mult) / 60, rnd);
    for (let k = 0; k < nIng; k++) {
      specialU[t * nIng + k] = rnd();
      cannibalU[t * nIng + k] = rnd();
    }
  }
  const deliveryLife = new Float64Array(DAYS * nIng);
  for (let i = 0; i < deliveryLife.length; i++) deliveryLife[i] = DELIVERY_LIFE_MIN + rnd() * (1 - DELIVERY_LIFE_MIN);
  return { menu, specialU, cannibalU, deliveryLife };
}

/** Freshness drifts down as shelf life runs out (never improves). */
function agedFreshness(lot: InventoryLot, shelfLifeDays: number): Freshness {
  const r = lot.daysLeft / Math.max(shelfLifeDays, 0.1);
  const derived: Freshness = r > 0.6 ? 5 : r > 0.4 ? 4 : r > 0.25 ? 3 : 2;
  return Math.min(lot.freshness, derived) as Freshness;
}

const emptyDay = (): Omit<DayMetrics, "marginPct"> => ({ wasteUsd: 0, revenueUsd: 0, foodCostUsd: 0 });
const finish = (d: Omit<DayMetrics, "marginPct">): DayMetrics => ({
  wasteUsd: r2(d.wasteUsd),
  revenueUsd: r2(d.revenueUsd),
  foodCostUsd: r2(d.foodCostUsd),
  marginPct: d.revenueUsd > 0 ? r1(((d.revenueUsd - d.foodCostUsd) / d.revenueUsd) * 100) : 0,
});

interface RunOut {
  days: DayMetrics[];
  specialsPublished: number;
  byRecipe: Record<string, { published: number; sold: number }>;
  specialOrders: number;
  lostMenuSales: number;
}

function simulate(policy: Policy, streams: Streams, specialDemandScale = 1, menuMinFresh = MENU_MIN_FRESHNESS): RunOut {
  const w = freshWorld();
  w.events = [];
  const nMenu = w.menu.length;
  const nIng = w.ingredients.length;
  const ingIndex = new Map(w.ingredients.map((i, k) => [i.id, k]));
  const unitCost = new Map(w.ingredients.map((i) => [i.id, i.unitCost]));
  const shelf = new Map(w.ingredients.map((i) => [i.id, i.shelfLifeDays]));
  const recipeOf = new Map(w.recipes.map((r) => [r.id, r]));
  const usage = dailyUsage(w);
  const fixedOrder = new Map(w.ingredients.map((i) => [i.id, Math.ceil((usage[i.id] ?? 0) * ORDER_BUFFER)]));
  const reorderCut = new Map<string, number>();

  const days: DayMetrics[] = [];
  let today = emptyDay();
  let specialsPublished = 0;
  const byRecipe: Record<string, { published: number; sold: number }> = {};
  let specialOrders = 0;
  let lostMenuSales = 0;
  let suppressMenu = 0; // cannibalized customers: their regular order is replaced by the special
  const startMs = new Date(SIM_START).getTime();

  const costOf = (recipeId: string) =>
    (recipeOf.get(recipeId)?.ingredients ?? []).reduce((s, l) => s + (unitCost.get(l.ingredientId) ?? 0) * l.qty, 0);

  for (let t = 0; t < DAYS * MIN_PER_DAY; t++) {
    const nowMs = startMs + t * 60_000;
    w.simTime = new Date(nowMs).toISOString();
    const hour = new Date(nowMs).getUTCHours();
    const minute = new Date(nowMs).getUTCMinutes();
    const day = Math.floor(t / MIN_PER_DAY);

    // morning delivery (day 1 starts from the seeded inventory)
    if (hour === OPEN_HOUR && minute === 0 && day > 0) {
      for (const ing of w.ingredients) {
        const qty = Math.max(0, (fixedOrder.get(ing.id) ?? 0) + (reorderCut.get(ing.id) ?? 0));
        reorderCut.delete(ing.id);
        if (qty <= 0) continue;
        const lot: InventoryLot = {
          id: `rp_${ing.id}_${day}`, ingredientId: ing.id, qty, freshness: 5, source: "seed", updatedAt: w.simTime,
          daysLeft: ing.shelfLifeDays * streams.deliveryLife[day * nIng + (ingIndex.get(ing.id) ?? 0)],
        };
        lot.freshness = agedFreshness(lot, ing.shelfLifeDays);
        w.inventory.push(lot);
      }
    }

    // agent decisions
    if (policy === "decideOffline" && minute === 0 && DECISION_HOURS.includes(hour)) {
      const decisions = decideOffline(w, forecastWaste(w));
      applyDecisionsTo(w, decisions);
      for (const d of decisions) if (d.special && w.specials.some((s) => s.id === d.special?.id && s.status === "live")) { specialsPublished++; (byRecipe[d.special.name] ??= { published: 0, sold: 0 }).published++; }
      for (const d of decisions) if ((d.reorderDelta ?? 0) < 0) reorderCut.set(d.ingredientId, (reorderCut.get(d.ingredientId) ?? 0) + (d.reorderDelta ?? 0));
    }

    if (hour >= OPEN_HOUR && hour < CLOSE_HOUR) {
      // specials first: a special-curious customer arrives with probability rate/60 this minute
      for (const s of w.specials) {
        if (s.status !== "live") continue;
        if (w.simTime > s.expiresAt) { s.status = "expired"; continue; }
        if (s.unitsSold >= s.unitsAvailable) { s.status = "sold_out"; continue; }
        const k = ingIndex.get(s.heroIngredientId) ?? 0;
        const minutesLive = (nowMs - new Date(s.createdAt).getTime()) / 60_000;
        const p = (specialOrdersPerHour(s.discountPct, minutesLive) * specialDemandScale) / 60;
        if (streams.specialU[t * nIng + k] >= p) continue;
        const recipe = recipeOf.get(s.recipeId);
        const used = recipe ? makeOne(w, recipe, SPECIAL_MIN_FRESHNESS) : null;
        if (!used) { s.status = "sold_out"; continue; }
        s.unitsSold++;
        (byRecipe[s.name] ??= { published: 0, sold: 0 }).sold++;
        specialOrders++;
        today.revenueUsd += s.price;
        today.foodCostUsd += costOf(s.recipeId);
        if (streams.cannibalU[t * nIng + k] < CANNIBALIZATION) suppressMenu++;
        if (s.unitsSold >= s.unitsAvailable) s.status = "sold_out";
      }
      // regular menu orders from the shared stream
      for (let j = 0; j < nMenu; j++) {
        const item = w.menu[j];
        const recipe = recipeOf.get(item.recipeId);
        for (let n = streams.menu[t * nMenu + j]; n > 0; n--) {
          if (suppressMenu > 0) { suppressMenu--; continue; }
          const used = recipe ? makeOne(w, recipe, menuMinFresh) : null;
          if (!used) { lostMenuSales++; continue; }
          today.revenueUsd += item.price;
          today.foodCostUsd += costOf(item.recipeId);
        }
      }
    }

    // spoilage clock + freshness drift
    for (const lot of w.inventory) {
      lot.daysLeft -= 1 / MIN_PER_DAY;
      lot.freshness = agedFreshness(lot, shelf.get(lot.ingredientId) ?? 5);
    }
    const spoiled = w.inventory.filter((l) => l.daysLeft <= 0 || l.freshness === 1);
    for (const lot of spoiled) {
      const c = lot.qty * (unitCost.get(lot.ingredientId) ?? 0);
      today.wasteUsd += c;
      today.foodCostUsd += c;
    }
    if (spoiled.length) w.inventory = w.inventory.filter((l) => !spoiled.includes(l));

    if ((t + 1) % MIN_PER_DAY === 0) {
      days.push(finish(today));
      today = emptyDay();
    }
  }
  return { days, specialsPublished, byRecipe, specialOrders, lostMenuSales };
}

function totals(days: DayMetrics[]): DayMetrics {
  const s = days.reduce((a, d) => ({ wasteUsd: a.wasteUsd + d.wasteUsd, revenueUsd: a.revenueUsd + d.revenueUsd, foodCostUsd: a.foodCostUsd + d.foodCostUsd }), emptyDay());
  return finish(s);
}

export function runReplay(): ReplayResult {
  const saved = snapshotGlobals(); // applyDecisionsTo logs events → bumps the global id sequence
  try {
    const t0 = Date.now();
    const streams = makeStreams(freshWorld(), SEED);
    const base = simulate("none", streams);
    const agent = simulate("decideOffline", streams);
    const sanity = simulate("decideOffline", streams, 0);
    const noRuleBase = simulate("none", streams, 1, SPECIAL_MIN_FRESHNESS);
    const noRuleAgent = simulate("decideOffline", streams, 1, SPECIAL_MIN_FRESHNESS);
    const hoStreams = makeStreams(freshWorld(), SECONDARY_SEED);
    const hoBase = totals(simulate("none", hoStreams).days);
    const hoAgent = totals(simulate("decideOffline", hoStreams).days);
    const ms = Date.now() - t0;

    const tb = totals(base.days);
    const ta = totals(agent.days);
    const ts = totals(sanity.days);
    const startDow = new Date(SIM_START).getUTCDay();
    const label = (i: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][(startDow + i) % 7];
    const days: ReplayDay[] = base.days.map((b, i) => ({ day: i + 1, label: label(i), baseline: b, withAgent: agent.days[i] }));
    const sanityOk = Math.abs(ts.wasteUsd - tb.wasteUsd) < 0.01 && Math.abs(ts.revenueUsd - tb.revenueUsd) < 0.01;

    return {
      days,
      totals: { baseline: tb, withAgent: ta },
      wasteReductionPct: tb.wasteUsd > 0 ? r1(((tb.wasteUsd - ta.wasteUsd) / tb.wasteUsd) * 100) : 0,
      marginDeltaPts: r1(ta.marginPct - tb.marginPct),
      provenance: "computed",
      policy: "decideOffline v0 (07:00 + 14:00 daily) vs no-action baseline",
      assumptions: [
        "SIMULATED: synthetic café (7 tracked ingredients, 5 menu dishes), not real restaurant data.",
        `Same pre-generated customer stream for both runs (seed ${SEED}); Poisson menu orders, ${OPEN_HOUR}:00–${CLOSE_HOUR}:00 daily, weekday demand ×${Math.min(...WEEKDAY_DEMAND)}–×${Math.max(...WEEKDAY_DEMAND)} (busy weekends), no time-of-day curve.`,
        `Fixed daily supplier order = ${ORDER_BUFFER}× average expected usage (whole units), every morning; produce arrives with ${DELIVERY_LIFE_MIN * 100}–100% of shelf life left; first day starts from seeded stock.`,
        `Synthetic kitchen assumption (not a food-safety rule): regular dishes use visual-quality ≥ 3 stock; quality-2 (overripe) stock is used only in repurposing specials (e.g. banana bread), otherwise it spoils. Quality drifts down as shelf life runs out.`,
        `Special demand: ${specialOrdersPerHour(0)}–${specialOrdersPerHour(60).toFixed(2)} orders/hr base (weak price response), ×3 launch burst decaying over ~40 min; random arrivals here (the live demo uses smoothed arrivals).`,
        `${Math.round(CANNIBALIZATION * 100)}% of special orders replace a regular menu order (cannibalization). Specials draw from shared stock, so they can cause menu stockouts (lost menu sales: baseline ${base.lostMenuSales}, agent ${agent.lostMenuSales}).`,
        "Margin = tracked-ingredient gross margin only: excludes pantry staples, labor, packaging, rent and platform fees.",
        "Evaluates the deterministic offline policy only, not camera or LLM accuracy. The agent cannot change supplier orders here (it only adjusts them after an unsafe-item discard, which this replay has none of).",
        `Agent run: ${agent.specialsPublished} specials published, ${agent.specialOrders} special orders (${Object.entries(agent.byRecipe).map(([n, v]) => `${n} ${v.sold} sold / ${v.published}×`).join(", ")}).`,
        `Sensitivity, without the quality-≥3 kitchen assumption (menu may use quality-2 stock): waste $${totals(noRuleBase.days).wasteUsd} → $${totals(noRuleAgent.days).wasteUsd}, margin ${totals(noRuleBase.days).marginPct}% → ${totals(noRuleAgent.days).marginPct}%.`,
        `Secondary scenario (seed ${SECONDARY_SEED}, fixed before tuning but its results are visible to policy developers, so not a held-out test): waste $${hoBase.wasteUsd} → $${hoAgent.wasteUsd}, revenue $${hoBase.revenueUsd} → $${hoAgent.revenueUsd}, margin ${hoBase.marginPct}% → ${hoAgent.marginPct}%. Headline numbers use the development seed ${SEED}; any policy tuning was done against it.`,
        `Sanity check: agent with zero special demand ${sanityOk ? "matches" : "DOES NOT match"} baseline (waste $${ts.wasteUsd} vs $${tb.wasteUsd}). Replay computed in ${ms} ms.`,
      ],
    };
  } finally {
    restoreGlobals(saved);
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
