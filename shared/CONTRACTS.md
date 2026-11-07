# CONTRACTS.md — interfaces between agents
Types live in `shared/contracts.ts` (source of truth; this file explains them). Owner: **B**. Change process: COMMS.md §4.

## HTTP routes
All bodies are JSON. Errors return `{ "error": string }` with a 4xx or 5xx status.

| Method & path | Owner | Body | Returns | Side effects |
|---|---|---|---|---|
| `POST /api/brain/scan` | A | `ScanRequest { imageDataUrl }` | `ScanResult` | none |
| `POST /api/brain/plan` | A | `PlanRequest { scan }` | `PlanResult` | none (preview only) |
| `POST /api/brain/run` | A | `RunRequest { imageDataUrl }` | `RunResponse { scan, plan, world }` | adds scan lots, publishes specials, discards unsafe stock |
| `GET  /api/world/state` | B | — | `WorldState` | none |
| `POST /api/world/tick` | B | `TickRequest { minutes: 1..240 }` | `WorldState` | advances sim clock, creates orders, spoils stock |
| `POST /api/world/reset` | B | — | `WorldState` | back to seeded Friday 7:00 AM (deterministic) |
| `POST /api/world/publish` | B | `PublishRequest { decisions }` | `WorldState` | applies decisions from `/plan` (owner "Approve" flow) |
| `GET  /api/world/replay` | B | — | `ReplayResult` | none (runs a 7-day sim internally, <1 s, no LLM) |

`imageDataUrl`: a `data:image/jpeg;base64,...` string. C should downscale to ≤1024 px wide at JPEG quality ~0.8 before sending.
`""` or `"mock"` → the fixture scan (`shared/fixtures.ts::MOCK_SCAN`). With no `OPENROUTER_API_KEY`, every scan is the fixture.

## Library functions (server-side imports between A and B)
Import **only** from the index files.

`lib/world/index.ts` (B)
```ts
getWorld(): WorldState
resetWorld(): WorldState
applyScan(scan: ScanResult): WorldState
forecastWaste(w: WorldState): WasteForecast[]
applyDecisions(decisions: AgentDecision[]): WorldState
tick(minutes: number): WorldState
runReplay(): ReplayResult
```
`lib/brain/index.ts` (A). It must never import `lib/world`.
```ts
scanImage(imageDataUrl: string, catalog: Ingredient[]): Promise<ScanResult>
planActions(scan: ScanResult, world: WorldState, forecasts: WasteForecast[]): Promise<PlanResult>
decideOffline(world: WorldState, forecasts: WasteForecast[], scan?: ScanResult): AgentDecision[]   // pure, no LLM — used by B's replay
quoteSpecial(recipe, hero, forecast, freshness, catalog): PriceQuote
```

## Key semantics
- **Freshness** 5 perfect · 4 good · 3 use soon · 2 must use today · **1 unsafe → never sold** (guardrail, plain code).
- **At-risk lot** = `daysLeft <= 2 || freshness <= 3`. `WasteForecast.projectedWasteQty = max(unsafeQty, atRiskQty − expectedUseBeforeExpiry, 0)`.
- **One live special per hero ingredient.** Publishing a new one replaces the old.
- A special's demand rate rises with `discountPct` (B's sim). Each sale consumes recipe ingredients oldest-first. `metrics.wasteUsdAvoided` += cost of at-risk hero units consumed.
- `AgentDecision.special` is complete (status `"live"`, `unitsSold: 0`) so B can publish it as-is.
- `AgentStep[]` (`plan.trace`) is meant to be **animated** by C, one line at a time, in `tMs` order.
- Sim time starts **Fri 2026-11-06 07:00 UTC-labelled ISO** (treat it as local café time). The UI ticks `10` sim-minutes per real second during the demo.

## Seeded café (lib/world/seed.ts)
"Sunny Side Café, Oakland". Ingredients: banana, avocado, bread, strawberry, spinach, tomato, egg.
Normal menu: Avocado Toast, Egg & Spinach Sandwich, Berry Banana Pancakes, Green Smoothie, Tomato Toast.
AI-special-only recipes: Bananas Foster French Toast, Warm Banana Bread, Smashed Guac Bowl, Strawberry Shortcake, Spinach Shakshuka, Sourdough Panzanella.
Before any scan, strawberries (1.5 days left) and a batch of older bananas are already at risk. That's useful for testing.
