/**
 * lib/world/seed.ts — the fake restaurant. Owner: Agent B.
 * Pantry staples (flour, butter, sugar, oil, salt) are assumed always in stock and not tracked.
 */
import type { Ingredient, Recipe, MenuItem, InventoryLot } from "@/shared/contracts";

export const RESTAURANT = {
  name: "Sunny Side Café",
  neighborhood: "Oakland, Pittsburgh",
  x: 0.5,
  y: 0.5,
};

/** Sim clock starts Friday 7:00 AM. */
export const SIM_START = "2026-11-06T07:00:00.000Z";

export const INGREDIENTS: Ingredient[] = [
  { id: "banana", name: "Banana", emoji: "🍌", unit: "each", unitCost: 0.3, shelfLifeDays: 5 },
  { id: "avocado", name: "Avocado", emoji: "🥑", unit: "each", unitCost: 1.6, shelfLifeDays: 4 },
  { id: "bread", name: "Sourdough loaf", emoji: "🍞", unit: "loaf", unitCost: 4.5, shelfLifeDays: 3 },
  { id: "strawberry", name: "Strawberries", emoji: "🍓", unit: "pint", unitCost: 3.5, shelfLifeDays: 4 },
  { id: "spinach", name: "Spinach", emoji: "🥬", unit: "bunch", unitCost: 2.2, shelfLifeDays: 5 },
  { id: "tomato", name: "Tomato", emoji: "🍅", unit: "each", unitCost: 0.7, shelfLifeDays: 6 },
  { id: "egg", name: "Eggs", emoji: "🥚", unit: "dozen", unitCost: 3.8, shelfLifeDays: 21 },
];

export const RECIPES: Recipe[] = [
  // ── normal menu ──
  { id: "avo-toast", name: "Avocado Toast", emoji: "🥑", basePrice: 11, prepMinutes: 6, onMenu: true, tags: ["savory"],
    ingredients: [{ ingredientId: "bread", qty: 0.125 }, { ingredientId: "avocado", qty: 1 }, { ingredientId: "tomato", qty: 0.5 }] },
  { id: "egg-sandwich", name: "Egg & Spinach Sandwich", emoji: "🥪", basePrice: 9, prepMinutes: 7, onMenu: true, tags: ["savory"],
    ingredients: [{ ingredientId: "bread", qty: 0.125 }, { ingredientId: "egg", qty: 0.17 }, { ingredientId: "spinach", qty: 0.25 }, { ingredientId: "tomato", qty: 0.5 }] },
  { id: "berry-pancakes", name: "Berry Banana Pancakes", emoji: "🥞", basePrice: 12, prepMinutes: 10, onMenu: true, tags: ["sweet", "breakfast"],
    ingredients: [{ ingredientId: "strawberry", qty: 0.25 }, { ingredientId: "banana", qty: 0.5 }, { ingredientId: "egg", qty: 0.08 }] },
  { id: "green-smoothie", name: "Green Smoothie", emoji: "🥤", basePrice: 8, prepMinutes: 3, onMenu: true, tags: ["drink"],
    ingredients: [{ ingredientId: "spinach", qty: 0.5 }, { ingredientId: "banana", qty: 0.5 }] },
  { id: "tomato-toast", name: "Tomato Toast", emoji: "🍅", basePrice: 10, prepMinutes: 5, onMenu: true, tags: ["savory"],
    ingredients: [{ ingredientId: "bread", qty: 0.125 }, { ingredientId: "tomato", qty: 1.5 }] },
  // ── AI-special-only recipes (the agent may pick these) ──
  { id: "bananas-foster-toast", name: "Bananas Foster French Toast", emoji: "🍌", basePrice: 12, prepMinutes: 9, onMenu: false, tags: ["sweet", "breakfast"],
    ingredients: [{ ingredientId: "bread", qty: 0.25 }, { ingredientId: "banana", qty: 2 }, { ingredientId: "egg", qty: 0.17 }] },
  { id: "banana-bread", name: "Warm Banana Bread", emoji: "🍞", basePrice: 6, prepMinutes: 4, onMenu: false, tags: ["sweet", "bakery"],
    ingredients: [{ ingredientId: "banana", qty: 3 }, { ingredientId: "egg", qty: 0.08 }] },
  { id: "guac-bowl", name: "Smashed Guac Bowl", emoji: "🥣", basePrice: 10, prepMinutes: 5, onMenu: false, tags: ["savory"],
    ingredients: [{ ingredientId: "avocado", qty: 2 }, { ingredientId: "tomato", qty: 1 }] },
  { id: "strawberry-shortcake", name: "Strawberry Shortcake", emoji: "🍰", basePrice: 8, prepMinutes: 6, onMenu: false, tags: ["sweet", "dessert"],
    ingredients: [{ ingredientId: "strawberry", qty: 0.5 }] },
  { id: "shakshuka", name: "Spinach Shakshuka", emoji: "🍳", basePrice: 13, prepMinutes: 12, onMenu: false, tags: ["savory"],
    ingredients: [{ ingredientId: "egg", qty: 0.17 }, { ingredientId: "spinach", qty: 0.5 }, { ingredientId: "tomato", qty: 2 }] },
  { id: "panzanella", name: "Sourdough Panzanella", emoji: "🥗", basePrice: 10, prepMinutes: 6, onMenu: false, tags: ["savory", "salad"],
    ingredients: [{ ingredientId: "bread", qty: 0.25 }, { ingredientId: "tomato", qty: 2 }] },
];

export const MENU: MenuItem[] = RECIPES.filter((r) => r.onMenu).map((r) => ({
  id: `menu_${r.id}`,
  recipeId: r.id,
  name: r.name,
  emoji: r.emoji,
  description: "",
  price: r.basePrice,
  available: true,
}));

/** Relative popularity of normal menu items (orders per sim hour at base rate). */
export const MENU_ORDERS_PER_HOUR: Record<string, number> = {
  "avo-toast": 2.5,
  "egg-sandwich": 2,
  "berry-pancakes": 1.2,
  "green-smoothie": 0.8,
  "tomato-toast": 0.7,
};

/** Hours per day the café is open (used for daily demand). */
export const OPEN_HOURS_PER_DAY = 10;

export function seedInventory(now: string): InventoryLot[] {
  const lot = (id: string, ingredientId: string, qty: number, freshness: 1 | 2 | 3 | 4 | 5, daysLeft: number): InventoryLot => ({
    id, ingredientId, qty, freshness, daysLeft, source: "seed", updatedAt: now,
  });
  return [
    lot("lot_banana_a", "banana", 14, 5, 4),
    lot("lot_banana_b", "banana", 8, 3, 2),
    lot("lot_avocado_a", "avocado", 30, 4, 3),
    lot("lot_bread_a", "bread", 5, 5, 3),
    lot("lot_strawberry_a", "strawberry", 6, 3, 1.5),
    lot("lot_spinach_a", "spinach", 8, 4, 4),
    lot("lot_tomato_a", "tomato", 40, 5, 5),
    lot("lot_egg_a", "egg", 5, 5, 18),
  ];
}
