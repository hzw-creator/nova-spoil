# Brain implementation notes — Agent A

Primary flow: **one-click demo mode** (`POST /api/brain/run`). Fixed camera-batch identities and visual quality estimates; no stored-plan authority, stale-plan protection, or food-safety certification. Unknown/ambiguous observations require review and do not update a known batch.

## Models and measured evidence

- Vision/text defaults: `google/gemini-2.5-flash`, configurable via `VISION_MODEL` / `TEXT_MODEL`. Key stays in the existing local `.env` or `.env.local`; never logged or committed.
- Model id and image input verified against [OpenRouter's endpoint metadata](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash/endpoints), Nov 7, 2026. [Chat API reference](https://openrouter.ai/docs/api/reference/overview).
- Public CC0 banana reference (`samples/overripe-banana.jpg`): LIVE, mock=false, count=1, freshness=1, daysLeft=0, 2039 ms. The peel is split open, so this is a conservative block example rather than a freshness-2 happy path.
- Public mold reference (temporary local file, attribution in `samples/README.md`): LIVE, mock=false, avocado count=1, freshness=1, daysLeft=0, confidence=0.98, notes="Visible mold on the avocado.", 1292 ms.
- End-to-end live mold-reference `/run`: scan 2735 ms, complete response 3696 ms; avocado DISCARD/blocked, no avocado special, live text choice for an independent seeded Strawberry Shortcake, `plan.mock=false`, and publication confirmed in returned state. This verifies mixed blocked/eligible ingredient handling; it does not claim the scanned avocado created that dessert.
- Initial mold calls returned invalid confidence values and were ignored. Prompt now explicitly requires confidence 0..1, never a percentage. These few references demonstrate provider/parsing behavior, not classifier accuracy.
- Presenter webcam / locally photographed produce has **not** been verified. No such photo was available during implementation. End-to-end mock mode is deterministic even when a key is present.

## Vision and HTTP behavior

- Prompt requests catalog-unit counts and an explicit unit/ambiguity/spoilage flag, kept internal to parsing (no contract change). Six eggs may be 0.5 dozen; berries are never guessed into pints, nor leaves into bunches.
- Finite required fields; no coercing strings, guessing missing freshness, or clamping bad quantities. Invalid/ambiguous items become unknown review entries. Duplicate ingredient groups are ignored rather than overwriting one batch twice. Valid count=0 can clear the bound camera batch.
- Visible-spoilage flag and positive mold/rot/slime notes force freshness=1, daysLeft=0. Negated "no visible mold" is not positive evidence. Keyword matching and the model both have limitations; absence of a flag does not establish safety.
- Bounding boxes must be finite and wholly within 0..1; invalid boxes are omitted. Up to 50 observations, <=8 MB data URL, JPEG/PNG/WebP only. UI should still send <=1024px frames.
- Invalid request JSON/types return 400 (oversized images 413). Bad model top-level shape returns 502. Provider failures return a friendly 5xx; a failed live call never silently substitutes mock inventory.
- Empty string / "mock" / absent key retain the documented fixture fallback, clearly marked `scan.mock=true`. Mock scan latency is measured, not the fixture's decorative delay.
- `/plan` is a read-only preview against CURRENT inventory. It does not reconcile the supplied scan into inventory and is not an approval workflow. The agreed primary flow is `/run`.

## Policy, guardrails and LLM

- Public guard exports: `checkFoodSafety`, `checkRecipe`, `checkPrice`, `GuardResult`. B integrates these with server-derived recipe list price and full unrounded ingredient cost.
- Food rule rejects freshness=1 and invalid/non-finite values. Recipe rule requires an approved recipe using the hero, with valid positive quantities. Price rule rejects non-finite values, above-list prices, below 1.5x cost, raw discount >60%, and a declared discount inconsistent with the final price.
- Price code rounds UP to preserve cost/discount floors; final discount derives from actual price.
- `decideOffline` stays pure, synchronous, deterministic and LLM-free. Unsafe inventory triggers discard even without a scan. All recipe lines must be available; quantities share a FIFO stock budget across the whole plan.
- Non-hero menu stock reserve uses `WasteForecast.normalDailyUsage` (B-owned optional field), menu-eligible freshness>=3 stock, and the same oldest-first consumption order as the sim. Missing demand disables reservation but retains all-ingredient stock caps. This is a heuristic using average open-day demand; no weekend or time-of-day calibration.
- Recipes prefer off-menu, then higher hero usage. The budget can reject a recipe that would consume reserved supporting ingredients. This was tuned in response to the development scenario's bread bottleneck, not independently validated.
- One bounded text-model call (4s timeout) chooses among server-quoted candidates and supplies name/description. Strict schema, approved recipe check, length/claim checks, and final stock/price revalidation; the model cannot set a price. Invalid outputs/timeouts fall back to deterministic choices. `plan.mock=false` only when a valid live choice was applied. An unknown/unsafe ingredient is never sent for special selection.
- Publishing or recommending less prep does not claim realized savings: decision `projectedWasteUsdAfter` remains the pre-offer estimate. `/run` confirms publication from returned `world.specials` and emits rejection trace if missing. Per-plan offer ids prevent an old offer from masquerading as a successful new publication.
- New policy on B's development replay: waste $30.73 -> $11.25 (-63.4%), revenue $5345 -> $5372.78, tracked-ingredient margin 80.5% -> 80.4% (-0.1 pts). B owns final replay labels/numbers; retain secondary/sensitivity outcomes and losses. Replay evaluates the offline policy, not vision or LLM accuracy.

## Verification

```sh
npm run typecheck
node lib/brain/checks.mjs             # guards, strict parsing, pure policy, shared budget, model fallback
node lib/brain/checks.mjs --replay    # additionally print computed replay, including negative results
node lib/brain/smoke.mjs http://localhost:3001  # resets synthetic world; /stage + APIs + tick
node lib/brain/dev-scan.mjs lib/brain/samples/overripe-banana.jpg --base-url http://localhost:3001
# --run opts into scan + plan + publication; default CLI mode is scan only.
```

Verification server uses port 3001 because another local server occupied 3000 and returned 404 for `/stage`. This is a local test convenience, not a contract/default-port change.

Known limits: reference photos only, small sample count, model/keyword false negatives and positives, estimates of hidden food quality are unreliable, ambiguous units require review, average-demand reserve is heuristic, offer caps are not durable reservations, and asynchronous live planning can become stale before B's final validation. No `?slow=1` (not requested by C) or image cache was added.
