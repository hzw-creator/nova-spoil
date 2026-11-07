/**
 * shared/contracts.ts — THE interface between agents A (Brain), B (World), C (UI).
 *
 * Owner: Agent B (hzw-creator) applies changes, but ONLY via the contract-change
 * process in COMMS.md (propose on the board → affected agents ack → B edits).
 * Adding a new OPTIONAL field is cheap; renaming/removing a field breaks others.
 *
 * Conventions
 *  - Money is USD as a plain number (e.g. 8.5). Round only for display.
 *  - Times are ISO strings in SIMULATED time (WorldState.simTime), not wall clock.
 *  - Map coordinates are normalized 0..1 (x → right, y → down) so the UI can
 *    draw any map it likes.
 */

// ───────────────────────── Catalog (static-ish data) ─────────────────────────

export type IngredientId = string; // "banana" | "avocado" | "bread" | ... see lib/world/seed.ts

/** 5 = perfect, 4 = good, 3 = use soon, 2 = must use today, 1 = unsafe / do not sell */
export type Freshness = 1 | 2 | 3 | 4 | 5;

export interface Ingredient {
  id: IngredientId;
  name: string;
  emoji: string;
  unit: "each" | "lb" | "loaf" | "bunch" | "dozen" | "pint";
  unitCost: number; // what the restaurant paid per unit
  shelfLifeDays: number; // when fresh (freshness 5)
}

export interface RecipeLine {
  ingredientId: IngredientId;
  qty: number; // in the ingredient's unit
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  basePrice: number;
  prepMinutes: number;
  ingredients: RecipeLine[];
  tags: string[]; // e.g. ["breakfast", "sweet"]
  /** true = on the normal menu; false = only usable as an AI special */
  onMenu: boolean;
}

export interface MenuItem {
  id: string;
  recipeId: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  available: boolean;
}

// ───────────────────────── World state (owned by B) ─────────────────────────

/** A batch of one ingredient with a single freshness level. */
export interface InventoryLot {
  id: string;
  ingredientId: IngredientId;
  qty: number;
  freshness: Freshness;
  daysLeft: number; // sim days until it must be thrown out
  source: "seed" | "scan";
  updatedAt: string;
}

export interface Special {
  id: string;
  recipeId: string;
  name: string; // may differ from recipe name (agent-written)
  emoji: string;
  description: string; // agent-written, <= 140 chars
  price: number;
  originalPrice: number;
  discountPct: number; // 0..60
  heroIngredientId: IngredientId; // the at-risk ingredient this special rescues
  reason: string; // one-line, shown in the owner UI ("12 bananas spoil in 1 day")
  createdAt: string;
  expiresAt: string;
  status: "live" | "sold_out" | "expired";
  unitsAvailable: number;
  unitsSold: number;
}

export interface OrderLine {
  name: string;
  qty: number;
  price: number;
  menuItemId?: string;
  specialId?: string;
}

export interface Order {
  id: string;
  at: string;
  lines: OrderLine[];
  total: number;
  x: number; // 0..1 map position of the customer
  y: number;
  fromSpecial: boolean;
}

export interface Metrics {
  /** UI label: "At-risk ingredient cost used". Cost of at-risk hero units consumed by special sales.
   *  NOT counterfactual avoided waste (normal demand might have used some); that claim comes only from the replay. */
  wasteUsdAvoided: number;
  revenueRecoveredUsd: number; // UI label: "Special sales". Revenue from specials.
  wasteUsdDiscarded: number; // cost of stock thrown out (expired / unsafe)
  projectedWasteUsd: number; // UI label: "Projected waste (estimate)". Live specials count only their expected sell-through.
  /** Expected regular-menu use per open day (units, average weekday, constant rate). Lets the agent reserve non-hero stock for the menu. */
  dailyMenuUse?: number;
  ordersTotal: number;
  ordersFromSpecials: number;
}

export type WorldEventKind =
  | "reset"
  | "scan"
  | "special_published"
  | "special_sold_out"
  | "special_expired"
  | "order"
  | "discarded"
  | "prep_cut"
  | "reorder_adjusted";

export interface WorldEvent {
  id: string;
  at: string;
  kind: WorldEventKind;
  message: string; // human-readable, the UI can show it verbatim
}

export interface WorldState {
  simTime: string;
  restaurant: { name: string; neighborhood: string; x: number; y: number };
  ingredients: Ingredient[];
  inventory: InventoryLot[];
  recipes: Recipe[];
  menu: MenuItem[];
  specials: Special[];
  recentOrders: Order[]; // newest first, max 50
  events: WorldEvent[]; // newest first, max 40
  metrics: Metrics;
}

/** B's forecast, consumed by A's agent. */
export interface WasteForecast {
  ingredientId: IngredientId;
  onHand: number; // units across all lots
  atRiskQty: number; // units in lots with daysLeft <= 2 or freshness <= 3
  minDaysLeft: number;
  expectedUseBeforeExpiry: number; // units normal demand will consume in time
  projectedWasteQty: number; // max(0, atRisk - expectedUse)
  projectedWasteUsd: number;
}

// ───────────────────────── Brain (owned by A) ─────────────────────────

export interface DetectedItem {
  label: string; // raw label from the vision model ("spotty bananas")
  ingredientId: IngredientId | null; // mapped to the catalog; null = unknown item
  count: number;
  freshness: Freshness;
  daysLeft: number;
  confidence: number; // 0..1
  notes?: string; // "brown spots on 60% of peel"
  box?: { x: number; y: number; w: number; h: number }; // normalized 0..1, optional
}

export interface ScanResult {
  scanId: string;
  items: DetectedItem[];
  model: string;
  latencyMs: number;
  mock: boolean;
}

export type ActionType =
  | "CREATE_SPECIAL"
  | "CUT_PREP"
  | "REDUCE_REORDER"
  | "DISCARD"
  | "NO_ACTION";

export interface AgentDecision {
  ingredientId: IngredientId;
  action: ActionType;
  rationale: string; // one sentence, shown in UI
  special?: Special; // required when action = CREATE_SPECIAL (status "live", not yet published)
  prepCutPct?: number; // CUT_PREP
  reorderDelta?: number; // REDUCE_REORDER, negative units
  safety?: { blocked: boolean; reason: string }; // guardrail result
  projectedWasteUsdBefore: number;
  projectedWasteUsdAfter: number;
}

/** One line of the agent's visible "thinking" timeline for the UI. */
export interface AgentStep {
  tMs: number; // ms since the run started
  kind: "vision" | "forecast" | "llm" | "tool" | "guardrail" | "publish";
  label: string; // short, e.g. "Detected 12 bananas · freshness 2"
  detail?: string;
}

export interface PlanResult {
  planId: string;
  decisions: AgentDecision[];
  trace: AgentStep[];
  latencyMs: number;
  mock: boolean;
}

// ───────────────────────── Replay (owned by B, uses A's decideOffline) ─────────────────────────

export interface DayMetrics {
  wasteUsd: number;
  revenueUsd: number;
  foodCostUsd: number;
  marginPct: number; // UI label: "Tracked-ingredient gross margin". (revenue - foodCost) / revenue * 100; excludes staples, labor, packaging, platform fees
}

export interface ReplayDay {
  day: number; // 1..7
  label: string; // "Mon"
  baseline: DayMetrics;
  withAgent: DayMetrics;
}

export interface ReplayResult {
  days: ReplayDay[];
  totals: { baseline: DayMetrics; withAgent: DayMetrics };
  wasteReductionPct: number;
  marginDeltaPts: number;
  assumptions: string[]; // shown on the slide — be honest that this is simulated
  /** "computed" = real output of lib/world/replay.ts; "placeholder" = fixture. Missing → UI shows "unverified". */
  provenance?: "placeholder" | "computed";
  /** Which policies were compared, e.g. "decideOffline v0 vs no-action". */
  policy?: string;
}

// ───────────────────────── HTTP API bodies ─────────────────────────
// Every route returns either the documented type or ApiError with a 4xx/5xx.

export interface ApiError {
  error: string;
}

export interface ScanRequest {
  imageDataUrl: string; // "data:image/jpeg;base64,..."; empty string or "mock" → fixture
}
export type ScanResponse = ScanResult;

export interface PlanRequest {
  scan: ScanResult;
}
export type PlanResponse = PlanResult;

export interface RunRequest {
  imageDataUrl: string; // same rules as ScanRequest
}
export interface RunResponse {
  scan: ScanResult;
  plan: PlanResult;
  world: WorldState;
}

export interface TickRequest {
  minutes: number; // sim minutes to advance, 1..240
}
export type TickResponse = WorldState;

export interface PublishRequest {
  decisions: AgentDecision[];
}
export type PublishResponse = WorldState;

export type StateResponse = WorldState;
export type ResetResponse = WorldState;
export type ReplayResponse = ReplayResult;
