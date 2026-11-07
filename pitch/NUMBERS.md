# Numbers for the pitch — Owner: Agent B

Everything here is **simulated** on a synthetic café. Present it as a DoorDash-style prototype, not as measured results.
Regenerate the replay section at freeze time: `node pitch/numbers.mjs > /tmp/r.md` (with `npm run dev` running) and paste it below.

## 1. 7-day replay: same customers, with vs without the agent (`GET /api/world/replay`)
_Provenance: **computed** · policy: decideOffline v1 (A 1de3081: menu-stock reserve + plan-wide stock budget; 07:00 + 14:00 daily) vs no-action baseline · generated 2026-11-07T20:32Z_

| Day | Waste (no agent) | Waste (agent) | Revenue (no agent) | Revenue (agent) | Margin* (no agent) | Margin* (agent) |
|---|---:|---:|---:|---:|---:|---:|
| Fri | $0.00 | $0.00 | $708.00 | $687.97 | 82.7% | 82% |
| Sat | $2.93 | $0.00 | $915.00 | $918.99 | 80.4% | 80.7% |
| Sun | $0.00 | $0.00 | $939.00 | $939.00 | 80.6% | 80.6% |
| Mon | $0.98 | $0.00 | $686.00 | $686.41 | 80.9% | 79.5% |
| Tue | $12.98 | $0.00 | $582.00 | $589.96 | 79% | 80.4% |
| Wed | $13.84 | $11.25 | $696.00 | $701.49 | 78.7% | 78.8% |
| Thu | $0.00 | $0.00 | $819.00 | $848.96 | 80.9% | 80.3% |
| **7 days** | **$30.73** | **$11.25** | **$5345.00** | **$5372.78** | **80.5%** | **80.4%** |

**Waste reduction: 63.4%** · **Margin change: -0.1 pts** · Revenue change: $27.78

\* Tracked-ingredient gross margin, not restaurant net margin.

**Assumptions (shown on the slide):**
- SIMULATED: synthetic café (7 tracked ingredients, 5 menu dishes), not real restaurant data.
- Same pre-generated customer stream for both runs (seed 20261107); Poisson menu orders, 7:00–17:00 daily, weekday demand ×0.75–×1.35 (busy weekends), no time-of-day curve.
- Fixed daily supplier order = 1.25× average expected usage (whole units), every morning; produce arrives with 60–100% of shelf life left; first day starts from seeded stock.
- Synthetic kitchen assumption (not a food-safety rule): regular dishes use visual-quality ≥ 3 stock; quality-2 (overripe) stock is used only in repurposing specials (e.g. banana bread), otherwise it spoils. Quality drifts down as shelf life runs out.
- Special demand: 0.3–1.05 orders/hr base (weak price response), ×3 launch burst decaying over ~40 min; random arrivals here (the live demo uses smoothed arrivals).
- 25% of special orders replace a regular menu order (cannibalization). Specials draw from shared stock, so they can cause menu stockouts (lost menu sales: baseline 27, agent 31).
- Margin = tracked-ingredient gross margin only: excludes pantry staples, labor, packaging, rent and platform fees.
- Evaluates the deterministic offline policy only, not camera or LLM accuracy. The agent cannot change supplier orders here (it only adjusts them after an unsafe-item discard, which this replay has none of).
- Tuning history (dev seed): v0 policy cut waste 57.9% but lost $197.73 revenue and 0.5 margin pts (its specials used bread the menu needed). v1 adds a one-day menu-stock reserve for non-hero ingredients, a development-scenario heuristic, not independently validated.
- Agent run: 9 specials published, 22 special orders (Strawberry Shortcake 3 sold / 1×, Warm Banana Bread 2 sold / 2×, Bananas Foster French Toast 11 sold / 3×, Sourdough Panzanella 4 sold / 2×, Spinach Shakshuka 2 sold / 1×).
- Sensitivity, without the quality-≥3 kitchen assumption (menu may use quality-2 stock): waste $11.71 → $0, margin 80.9% → 80.6%.
- Secondary scenario (seed 77031, fixed before tuning but its results are visible to policy developers, so not a held-out test): waste $40.48 → $7.88, revenue $5071 → $5181.28, margin 79.9% → 80.1%. Headline numbers use the development seed 20261107; any policy tuning was done against it.
- Sanity check: agent with zero special demand matches baseline (waste $30.73 vs $30.73). Replay computed in 281 ms.

**How to say it (honest version):** "In our simulated week, with the same customers both times, the agent cut ingredient waste by 63% on our development scenario and by 80% on a second scenario we fixed before tuning, with revenue slightly up and margin roughly flat. Our first policy actually *lost* money: its specials used up bread the regular menu needed. We fixed that by reserving a day of menu stock, and we're showing you both."
Don't say "saves X% for restaurants". Say "in our simulation".

## 2. Live demo run (mock scan, deterministic after Reset)
| Step | What happens |
|---|---|
| Scan (mock: 12 spotty bananas, 1 moldy avocado, 2 loaves) | bananas → visual quality 2/5 · avocado → 1/5 · bread → 4/5 |
| Guardrail | Avocado: **blocked**, discarded ($1.60), never offered |
| Specials published | Warm Banana Bread **4 units, $6 → $3.99 (−34%)** · Strawberry Shortcake **3 units, $8 → $5.99 (−25%)** |
| Play (10 sim-min per second) | first special order **~2 s**; both specials sold out **~25 s** |
| After 5 sim hours | 7 special orders · **$33.93 special sales** · **$8.85 at-risk ingredient cost used** |

Live-demo special orders arrive at the *expected* rate (smoothed, so the demo doesn't depend on a lucky draw). The replay uses random arrivals.
Freshness numbers are **visual quality estimates** from a vision model, not food-safety certification. The freshness-1 block is a demo rule in plain code.

## 3. Brain (Agent A)
- Vision model: **`google/gemini-2.5-flash` via OpenRouter**. Live reference photos (A-012): spotty banana 2.0 s, moldy avocado **1.3 s → visual quality 1, visible mold, blocked**. Full live `/run` (scan + text-model recipe pick + publish): **~3.7 s** (scan 2.7 s). Public reference photos, not yet the presenter camera. Mock path is offline (~850 ms fixture). More in `lib/brain/NOTES.md`.
- If the live model call fails or times out, the planner falls back to the deterministic offline policy; it never substitutes fixture observations for a failed live scan.
- The agent **selects approved recipes** from the kitchen's recipe book. It never invents dishes. Prices come from code (urgency + surplus, 1.5× cost floor, ≤60% off).

## 4. Scale (formula only, no invented statistics)
```
weekly waste $ avoided per restaurant  =  Σ_ingredients (at-risk units/week × unit cost × share repurposed)
platform impact / week                 =  that  ×  N_restaurants_using_it
```
From our simulation, the per-restaurant figure is **$19.48/week of tracked-ingredient waste avoided** on the development scenario ($30.73 → $11.25) and **$32.60/week** on the secondary one ($40.48 → $7.88). These are for 7 tracked ingredients at one small café. Use `N` as a placeholder, never a made-up count.

## 5. Limitations to say before judges ask
- Synthetic demand and inventory; 7 days; one café.
- The replay evaluates the deterministic offline policy, not camera or LLM accuracy.
- "Kitchen assumption": regular dishes use quality ≥3 stock and overripe stock goes to repurposing specials. This is a modeling choice. Without it, baseline waste is much lower (see the sensitivity line above).
- Margin = tracked-ingredient gross margin (no labor, rent, packaging, platform fees).
- Surplus-food apps exist (e.g. Too Good To Go). What's new here: camera-triggered, the agent picks a real recipe instead of a mystery bag, and the offer sits inside the normal delivery menu.
