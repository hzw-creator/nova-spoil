/**
 * lib/world/sim.ts — mutations: scans, decisions, ticking the clock. Owner: Agent B.
 * v0 is functional but simple. See agents/agent-b-world.md for what to improve.
 */
import type {
  AgentDecision, Freshness, InventoryLot, Order, ScanResult, WorldEvent, WorldEventKind, WorldState,
} from "@/shared/contracts";
import { forecastWaste } from "./forecast";
import { MENU_ORDERS_PER_HOUR } from "./seed";
import { nextId, rand, world } from "./store";

const MAX_ORDERS = 50;
const MAX_EVENTS = 40;

export function logEvent(w: WorldState, kind: WorldEventKind, message: string) {
  const e: WorldEvent = { id: nextId("evt"), at: w.simTime, kind, message };
  w.events.unshift(e);
  if (w.events.length > MAX_EVENTS) w.events.length = MAX_EVENTS;
}

export function refreshMetrics(w: WorldState): WorldState {
  w.metrics.projectedWasteUsd = Math.round(forecastWaste(w).reduce((s, f) => s + f.projectedWasteUsd, 0) * 100) / 100;
  return w;
}

/** Scanned items become "scan" lots (replacing any previous scan lot of the same ingredient). */
export function applyScan(scan: ScanResult): WorldState {
  const w = world();
  for (const item of scan.items) {
    if (!item.ingredientId || item.count <= 0) continue;
    w.inventory = w.inventory.filter((l) => !(l.source === "scan" && l.ingredientId === item.ingredientId));
    w.inventory.push({
      id: nextId("lot"),
      ingredientId: item.ingredientId,
      qty: item.count,
      freshness: item.freshness,
      daysLeft: item.daysLeft,
      source: "scan",
      updatedAt: w.simTime,
    });
  }
  const summary = scan.items.map((i) => `${i.count}× ${i.label} (fresh ${i.freshness}/5)`).join(", ");
  logEvent(w, "scan", `Camera scan: ${summary || "nothing recognized"}`);
  return refreshMetrics(w);
}

export function applyDecisions(decisions: AgentDecision[]): WorldState {
  const w = world();
  for (const d of decisions) {
    const ing = w.ingredients.find((i) => i.id === d.ingredientId);
    const name = ing?.name ?? d.ingredientId;
    switch (d.action) {
      case "CREATE_SPECIAL": {
        if (!d.special || d.safety?.blocked) break;
        // one live special per hero ingredient
        w.specials = w.specials.filter((s) => !(s.heroIngredientId === d.ingredientId && s.status === "live"));
        w.specials.unshift({ ...d.special, status: "live", unitsSold: 0 });
        logEvent(w, "special_published", `${d.special.emoji} ${d.special.name} live at $${d.special.price.toFixed(2)} (−${d.special.discountPct}%)`);
        break;
      }
      case "DISCARD": {
        const unsafe = w.inventory.filter((l) => l.ingredientId === d.ingredientId && l.freshness === 1);
        const qty = unsafe.reduce((s, l) => s + l.qty, 0);
        w.metrics.wasteUsdDiscarded += qty * (ing?.unitCost ?? 0);
        w.inventory = w.inventory.filter((l) => !unsafe.includes(l));
        logEvent(w, "discarded", `Discarded ${qty} ${name} — unsafe to sell`);
        break;
      }
      case "CUT_PREP":
        logEvent(w, "prep_cut", `Prep for ${name} cut ${d.prepCutPct ?? 0}%`);
        break;
      case "REDUCE_REORDER":
        logEvent(w, "reorder_adjusted", `Next ${name} order changed by ${d.reorderDelta ?? 0}`);
        break;
      default:
        break;
    }
  }
  return refreshMetrics(w);
}

/** Use stock oldest-first (lowest daysLeft). Returns cost of at-risk units consumed. */
function consume(w: WorldState, ingredientId: string, qty: number): number {
  let remaining = qty;
  let atRiskCost = 0;
  const cost = w.ingredients.find((i) => i.id === ingredientId)?.unitCost ?? 0;
  const lots = w.inventory
    .filter((l) => l.ingredientId === ingredientId && l.qty > 0 && l.freshness > 1)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qty, remaining);
    lot.qty = Math.round((lot.qty - take) * 1000) / 1000;
    remaining -= take;
    if (lot.daysLeft <= 2 || lot.freshness <= 3) atRiskCost += take * cost;
  }
  w.inventory = w.inventory.filter((l) => l.qty > 0);
  return atRiskCost;
}

function poisson(lambda: number): number {
  // Knuth; fine for small lambda
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

function customerXY(w: WorldState) {
  const a = rand() * Math.PI * 2;
  const r = 0.08 + rand() * 0.38;
  return { x: clamp01(w.restaurant.x + Math.cos(a) * r), y: clamp01(w.restaurant.y + Math.sin(a) * r) };
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Advance the sim clock and generate orders. */
export function tick(minutes: number): WorldState {
  const w = world();
  const m = Math.max(1, Math.min(240, Math.round(minutes)));
  const end = new Date(new Date(w.simTime).getTime() + m * 60_000);

  for (let i = 0; i < m; i++) {
    const now = new Date(new Date(w.simTime).getTime() + 60_000);
    w.simTime = now.toISOString();

    // normal menu orders
    for (const item of w.menu) {
      const perMin = (MENU_ORDERS_PER_HOUR[item.recipeId] ?? 0) / 60;
      const n = poisson(perMin);
      for (let k = 0; k < n; k++) {
        const recipe = w.recipes.find((r) => r.id === item.recipeId);
        recipe?.ingredients.forEach((l) => consume(w, l.ingredientId, l.qty));
        pushOrder(w, { name: item.name, qty: 1, price: item.price, menuItemId: item.id }, false);
      }
    }

    // AI specials: demand rises with discount
    for (const s of w.specials) {
      if (s.status !== "live") continue;
      if (now.toISOString() > s.expiresAt) {
        s.status = "expired";
        logEvent(w, "special_expired", `${s.name} expired (${s.unitsSold} sold)`);
        continue;
      }
      const perMin = (2.5 + s.discountPct / 6) / 60; // ~2.5/hr at 0%, ~7.5/hr at 30%
      const n = Math.min(poisson(perMin), s.unitsAvailable - s.unitsSold);
      for (let k = 0; k < n; k++) {
        const recipe = w.recipes.find((r) => r.id === s.recipeId);
        let saved = 0;
        recipe?.ingredients.forEach((l) => {
          const c = consume(w, l.ingredientId, l.qty);
          if (l.ingredientId === s.heroIngredientId) saved += c;
        });
        s.unitsSold++;
        w.metrics.wasteUsdAvoided += saved;
        w.metrics.revenueRecoveredUsd += s.price;
        w.metrics.ordersFromSpecials++;
        pushOrder(w, { name: s.name, qty: 1, price: s.price, specialId: s.id }, true);
        if (s.unitsSold >= s.unitsAvailable) {
          s.status = "sold_out";
          logEvent(w, "special_sold_out", `${s.emoji} ${s.name} sold out — ${s.unitsSold} rescued`);
        }
      }
    }

    // spoilage clock
    for (const lot of w.inventory) lot.daysLeft = Math.round((lot.daysLeft - 1 / 1440) * 10000) / 10000;
    const expired = w.inventory.filter((l) => l.daysLeft <= 0);
    for (const lot of expired) {
      const ing = w.ingredients.find((x) => x.id === lot.ingredientId);
      w.metrics.wasteUsdDiscarded += lot.qty * (ing?.unitCost ?? 0);
      logEvent(w, "discarded", `${lot.qty} ${ing?.name ?? lot.ingredientId} spoiled and were thrown out`);
    }
    w.inventory = w.inventory.filter((l) => l.daysLeft > 0);
  }
  w.simTime = end.toISOString();
  return refreshMetrics(w);
}

function pushOrder(w: WorldState, line: Order["lines"][number], fromSpecial: boolean) {
  const { x, y } = customerXY(w);
  w.recentOrders.unshift({ id: nextId("ord"), at: w.simTime, lines: [line], total: line.price * line.qty, x, y, fromSpecial });
  if (w.recentOrders.length > MAX_ORDERS) w.recentOrders.length = MAX_ORDERS;
  w.metrics.ordersTotal++;
}

export type { InventoryLot, Freshness };
