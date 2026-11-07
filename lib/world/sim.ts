/**
 * lib/world/sim.ts — mutations: scans, decisions, ticking the clock. Owner: Agent B.
 *
 * Invariants (agreed on the board, B-005 / B-009):
 *  - Sales are atomic: an order is recorded only if EVERY recipe line has sellable stock; otherwise no sale.
 *  - Sellable stock = qty > 0, freshness > 1, daysLeft > 0. Freshness-1 stock is never consumed.
 *  - Publishing a special re-validates it server-side and caps unitsAvailable by ALL recipe ingredients.
 *  - A camera scan updates only that ingredient's camera-batch lot (see seed.ts CAMERA_INGREDIENTS).
 */
import type {
  AgentDecision, Freshness, InventoryLot, Order, Recipe, ScanResult, Special, WorldEvent, WorldEventKind, WorldState,
} from "@/shared/contracts";
import { forecastWaste } from "./forecast";
import { CAMERA_INGREDIENTS, MENU_ORDERS_PER_HOUR, cameraLotId, expectedSpecialOrders, isOpenAt } from "./seed";

/** Deterministic per-special offset in [0.35, 0.65] so different specials don't sell in lockstep. */
function arrivalOffset(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return 0.35 + ((h >>> 0) % 1000) / 1000 * 0.3;
}
import { nextId, rand, world } from "./store";

const MAX_ORDERS = 50;
const MAX_EVENTS = 40;
const EPS = 1e-9;

export function logEvent(w: WorldState, kind: WorldEventKind, message: string) {
  const e: WorldEvent = { id: nextId("evt"), at: w.simTime, kind, message };
  w.events.unshift(e);
  if (w.events.length > MAX_EVENTS) w.events.length = MAX_EVENTS;
}

export function refreshMetrics(w: WorldState): WorldState {
  w.metrics.projectedWasteUsd = Math.round(forecastWaste(w).reduce((s, f) => s + f.projectedWasteUsd, 0) * 100) / 100;
  return w;
}

// ───────────────────────── stock helpers ─────────────────────────

const isSellable = (l: InventoryLot) => l.qty > 0 && l.freshness > 1 && l.daysLeft > 0;
const isAtRiskLot = (l: InventoryLot) => l.daysLeft <= 2 || l.freshness <= 3;
const isFreshness = (n: unknown): n is Freshness => n === 1 || n === 2 || n === 3 || n === 4 || n === 5;

export function sellableQty(w: WorldState, ingredientId: string): number {
  return w.inventory.filter((l) => l.ingredientId === ingredientId && isSellable(l)).reduce((s, l) => s + l.qty, 0);
}

/** How many portions of `recipe` current sellable stock can make (min over all recipe lines). */
export function portionsAvailable(w: WorldState, recipe: Recipe): number {
  if (!recipe.ingredients.length) return 0;
  return Math.min(...recipe.ingredients.map((l) => (l.qty > 0 ? Math.floor(sellableQty(w, l.ingredientId) / l.qty + EPS) : Infinity)));
}

/** Use sellable stock oldest-first (lowest daysLeft). Caller guarantees enough stock. Returns cost of at-risk units used. */
function consume(w: WorldState, ingredientId: string, qty: number): number {
  let remaining = qty;
  let atRiskCost = 0;
  const cost = w.ingredients.find((i) => i.id === ingredientId)?.unitCost ?? 0;
  const lots = w.inventory.filter((l) => l.ingredientId === ingredientId && isSellable(l)).sort((a, b) => a.daysLeft - b.daysLeft);
  for (const lot of lots) {
    if (remaining <= EPS) break;
    const take = Math.min(lot.qty, remaining);
    lot.qty = Math.round((lot.qty - take) * 1000) / 1000;
    remaining -= take;
    if (isAtRiskLot(lot)) atRiskCost += take * cost;
  }
  return atRiskCost;
}

/** Atomically make one portion: all lines or nothing. Returns at-risk cost used per ingredient, or null if short. */
function makeOne(w: WorldState, recipe: Recipe): Record<string, number> | null {
  if (portionsAvailable(w, recipe) < 1) return null;
  const used: Record<string, number> = {};
  for (const l of recipe.ingredients) used[l.ingredientId] = (used[l.ingredientId] ?? 0) + consume(w, l.ingredientId, l.qty);
  w.inventory = w.inventory.filter((l) => l.qty > 0);
  return used;
}

// ───────────────────────── scans ─────────────────────────

/** Each valid scanned item overwrites its ingredient's camera-batch lot. Everything else is ignored (and logged). */
export function applyScan(scan: ScanResult): WorldState {
  const w = world();
  const applied: string[] = [];
  const ignored: string[] = [];
  for (const item of scan.items ?? []) {
    const id = item.ingredientId;
    const valid =
      !!id && w.ingredients.some((i) => i.id === id) && (CAMERA_INGREDIENTS as readonly string[]).includes(id) &&
      Number.isFinite(item.count) && item.count >= 0 && isFreshness(item.freshness) && Number.isFinite(item.daysLeft);
    if (!valid || !id) { ignored.push(item.label || "unknown item"); continue; }
    if (item.count === 0) {
      // explicit zero observation clears the camera batch (A-005)
      w.inventory = w.inventory.filter((l) => l.id !== cameraLotId(id));
      applied.push(`0× ${item.label} (batch cleared)`);
      continue;
    }
    const lot: InventoryLot = {
      id: cameraLotId(id),
      ingredientId: id,
      qty: item.count,
      freshness: item.freshness,
      daysLeft: Math.max(0, item.daysLeft),
      source: "scan",
      updatedAt: w.simTime,
    };
    const i = w.inventory.findIndex((l) => l.id === lot.id);
    if (i >= 0) w.inventory[i] = lot; else w.inventory.push(lot);
    applied.push(`${item.count}× ${item.label} (fresh ${item.freshness}/5)`);
  }
  let msg = `Camera scan: ${applied.join(", ") || "nothing recognized"}`;
  if (ignored.length) msg += ` · ignored (not a camera batch / unreadable): ${ignored.join(", ")}`;
  logEvent(w, "scan", msg);
  return refreshMetrics(w);
}

// ───────────────────────── decisions ─────────────────────────

const MAX_SPECIAL_HOURS = 12;

/** Total ingredient cost of one portion (tracked ingredients only). */
export function recipeCost(w: WorldState, recipe: Recipe): number {
  return recipe.ingredients.reduce((sum, l) => sum + (w.ingredients.find((i) => i.id === l.ingredientId)?.unitCost ?? 0) * l.qty, 0);
}

/**
 * Server-side re-validation of a proposed special (C-008). Returns a normalized copy with server-derived
 * originalPrice (menu price), discountPct (from price) and createdAt (server simTime), or the rejection reason.
 * Client timestamps and list prices are never trusted.
 */
function validateSpecial(w: WorldState, d: AgentDecision, s: Special): { ok: Special; reason?: undefined } | { reason: string } {
  const recipe = w.recipes.find((r) => r.id === s.recipeId);
  if (!recipe) return { reason: `recipe "${s.recipeId}" is not in the recipe book` };
  if (s.heroIngredientId !== d.ingredientId) return { reason: "hero ingredient does not match the decision" };
  if (!recipe.ingredients.some((l) => l.ingredientId === s.heroIngredientId)) return { reason: `${recipe.name} does not use ${s.heroIngredientId}` };
  const originalPrice = recipe.basePrice;
  const floor = recipeCost(w, recipe) * 1.5;
  if (!(Number.isFinite(s.price) && s.price > 0 && s.price <= originalPrice + EPS)) return { reason: `price $${s.price} not within (0, menu price $${originalPrice}]` };
  if (s.price < floor - EPS) return { reason: `price $${s.price} below 1.5× ingredient cost ($${floor.toFixed(2)})` };
  const discountPct = Math.max(0, Math.round((1 - s.price / originalPrice) * 100));
  if (discountPct > 60) return { reason: "discount above 60% cap" };
  if (!(Number.isFinite(s.unitsAvailable) && s.unitsAvailable >= 1)) return { reason: "invalid unitsAvailable" };
  const nowMs = new Date(w.simTime).getTime();
  const exp = new Date(s.expiresAt).getTime();
  if (!(Number.isFinite(exp) && exp > nowMs && exp <= nowMs + MAX_SPECIAL_HOURS * 3_600_000))
    return { reason: `expiresAt must be within the next ${MAX_SPECIAL_HOURS} sim hours` };
  return { ok: { ...s, originalPrice, discountPct, createdAt: w.simTime } };
}

export function applyDecisions(decisions: AgentDecision[]): WorldState {
  return refreshMetrics(applyDecisionsTo(world(), decisions));
}

/** Same as applyDecisions but on an explicit state (used by the replay on its own cloned world). */
export function applyDecisionsTo(w: WorldState, decisions: AgentDecision[]): WorldState {
  for (const d of decisions) {
    const ing = w.ingredients.find((i) => i.id === d.ingredientId);
    const name = ing?.name ?? d.ingredientId;
    switch (d.action) {
      case "CREATE_SPECIAL": {
        const proposed = d.special;
        if (!proposed || d.safety?.blocked) break;
        const v = validateSpecial(w, d, proposed);
        const recipe = w.recipes.find((r) => r.id === proposed.recipeId);
        const cap = recipe ? portionsAvailable(w, recipe) : 0;
        if (v.reason !== undefined || cap < 1) {
          // visible to presenters: the returned world is publication truth (C-008)
          logEvent(w, "special_expired", `❌ ${proposed.name} NOT published — ${v.reason ?? "not enough sellable stock for every recipe ingredient"}`);
          break;
        }
        const sp = v.ok;
        const units = Math.min(Math.floor(sp.unitsAvailable), cap);
        // one live special per hero ingredient
        w.specials = w.specials.filter((s) => !(s.heroIngredientId === d.ingredientId && s.status === "live"));
        w.specials.unshift({ ...sp, status: "live", unitsSold: 0, unitsAvailable: units });
        const capped = units < sp.unitsAvailable ? ` · capped to ${units} by stock` : "";
        logEvent(w, "special_published", `${sp.emoji} ${sp.name} live at $${sp.price.toFixed(2)} (−${sp.discountPct}%)${capped}`);
        break;
      }
      case "DISCARD": {
        const unsafe = w.inventory.filter((l) => l.ingredientId === d.ingredientId && l.freshness === 1);
        const qty = unsafe.reduce((s, l) => s + l.qty, 0);
        w.metrics.wasteUsdDiscarded += qty * (ing?.unitCost ?? 0);
        w.inventory = w.inventory.filter((l) => !unsafe.includes(l));
        logEvent(w, "discarded", `Discarded ${qty} ${name} — freshness 1/5, never sold`);
        break;
      }
      case "CUT_PREP":
        logEvent(w, "prep_cut", `Recommendation: cut ${name} prep ${d.prepCutPct ?? 0}%`);
        break;
      case "REDUCE_REORDER":
        logEvent(w, "reorder_adjusted", `Recommendation: change next ${name} order by ${d.reorderDelta ?? 0}`);
        break;
      default:
        break;
    }
  }
  return w;
}

// ───────────────────────── clock ─────────────────────────

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

    const open = isOpenAt(w.simTime);

    // normal menu orders (a dish we can't fully make is a lost sale, never a phantom one)
    for (const item of w.menu) {
      if (!open) break;
      const recipe = w.recipes.find((r) => r.id === item.recipeId);
      if (!recipe) continue;
      const n = poisson((MENU_ORDERS_PER_HOUR[item.recipeId] ?? 0) / 60);
      for (let k = 0; k < n; k++) {
        if (!makeOne(w, recipe)) break;
        pushOrder(w, { name: item.name, qty: 1, price: item.price, menuItemId: item.id }, false);
      }
      item.available = portionsAvailable(w, recipe) >= 1;
    }

    // AI specials: demand rises with discount
    for (const s of w.specials) {
      if (s.status !== "live") continue;
      if (now.toISOString() > s.expiresAt) {
        s.status = "expired";
        logEvent(w, "special_expired", `${s.name} expired (${s.unitsSold} sold)`);
        continue;
      }
      const recipe = w.recipes.find((r) => r.id === s.recipeId);
      if (!recipe || !open) continue;
      const created = new Date(s.createdAt).getTime();
      const minutesLive = Number.isFinite(created) ? (now.getTime() - created) / 60_000 : Infinity;
      // Demo pacing: special orders arrive at the EXPECTED rate (k-th order when expected orders cross k − offset),
      // not a Poisson draw, so the live demo doesn't hinge on one lucky random number. The 7-day replay uses
      // random arrivals instead. Disclosed in pitch/NUMBERS.md.
      const due = Math.floor(expectedSpecialOrders(s.discountPct, 0, minutesLive) + arrivalOffset(s.id));
      const n = Math.max(0, Math.min(due - s.unitsSold, s.unitsAvailable - s.unitsSold));
      for (let k = 0; k < n; k++) {
        const used = makeOne(w, recipe);
        if (!used) {
          s.status = "sold_out";
          logEvent(w, "special_sold_out", `${s.emoji} ${s.name} ran out of ingredients — ${s.unitsSold} sold`);
          break;
        }
        s.unitsSold++;
        w.metrics.wasteUsdAvoided += used[s.heroIngredientId] ?? 0;
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
