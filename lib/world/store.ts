/**
 * lib/world/store.ts — in-memory world state. Owner: Agent B.
 *
 * Stored on globalThis so it survives Next.js hot reloads in `next dev`.
 * Single-process only: works with `npm run dev` / `npm start` on one laptop.
 * (Serverless hosting like Vercel would lose state between requests — don't deploy there for the demo.)
 */
import type { WorldState } from "@/shared/contracts";
import { INGREDIENTS, MENU, RECIPES, RESTAURANT, SIM_START, seedInventory } from "./seed";

type G = typeof globalThis & { __novaWorld?: WorldState; __novaSeq?: number; __novaRng?: number };
const g = globalThis as G;

export function freshWorld(): WorldState {
  return {
    simTime: SIM_START,
    restaurant: { ...RESTAURANT },
    ingredients: INGREDIENTS.map((i) => ({ ...i })),
    inventory: seedInventory(SIM_START),
    recipes: RECIPES.map((r) => ({ ...r, ingredients: r.ingredients.map((l) => ({ ...l })) })),
    menu: MENU.map((m) => ({ ...m })),
    specials: [],
    recentOrders: [],
    events: [],
    metrics: {
      wasteUsdAvoided: 0,
      revenueRecoveredUsd: 0,
      wasteUsdDiscarded: 0,
      projectedWasteUsd: 0,
      ordersTotal: 0,
      ordersFromSpecials: 0,
    },
  };
}

export function world(): WorldState {
  if (!g.__novaWorld) g.__novaWorld = freshWorld();
  return g.__novaWorld;
}

export function setWorld(w: WorldState): WorldState {
  g.__novaWorld = w;
  return w;
}

export function nextId(prefix: string): string {
  g.__novaSeq = (g.__novaSeq ?? 0) + 1;
  return `${prefix}_${g.__novaSeq}`;
}

/** Seeded RNG (mulberry32) so demos are reproducible after reset. */
export function rand(): number {
  let t = (g.__novaRng = ((g.__novaRng ?? 1337) + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function resetRng(seed = 1337) {
  g.__novaRng = seed;
  g.__novaSeq = 0;
}
