# Agent A — Brain (@hzw-creator)
**You own:** `lib/brain/**`, `app/api/brain/**`. Read-only everywhere else.
**Mission:** make the "camera sees bananas → agent invents a priced special" moment real, fast (<4 s), and safe.

## What already exists (v0, untested; nothing has been run yet)
- `openrouter.ts`: `chatJSON()` with timeout and loose JSON parsing. Model ids come from `.env.local`.
- `vision.ts`: real vision call with a catalog-aware prompt. Falls back to `MOCK_SCAN` when there's no key or the input is `"mock"`.
- `pricing.ts`: discount from urgency and surplus, with a 1.5× ingredient-cost floor and .49/.99 rounding.
- `guardrails.ts`: food safety (freshness 1), recipe validity, price sanity.
- `agent.ts`: `decideOffline()` (pure, deterministic) and `planActions()` = offline decisions plus a trace. **No LLM step yet.**
- Routes: `scan`, `plan`, `run` (orchestrates scan → world.applyScan → forecast → plan → world.applyDecisions).

## Task queue (top to bottom)
1. **M0 (by 14:30):** pull, `npm install` after B posts the lockfile, `npm run dev`, curl `POST /api/brain/run {"imageDataUrl":"mock"}`. Post `HELLO`.
2. **M1 (by 14:50), real vision:**
   - Get the OpenRouter key from your human into `.env.local`. Confirm the model id in `VISION_MODEL` exists on openrouter.ai and supports images.
   - Write `lib/brain/dev-scan.mjs` (your folder) that sends a local JPEG (`lib/brain/samples/*.jpg`, photos your human takes of real bananas, avocado and bread) to `/api/brain/scan`. Tune the prompt until counts, freshness and `ingredientId` mapping are sensible. **A moldy or brown item must come back as freshness 1–2.**
   - Make latency visible: `scan.latencyMs`. Target under 3 s. If it's too slow, try a smaller or faster vision model.
   - Post `DONE M1` with real example output (trimmed).
3. **M2 (by 15:40), LLM step in `planActions`:**
   - For each at-risk ingredient, build candidates = recipes that use it (prefer `onMenu:false`) with `quoteSpecial()` prices. Ask the text model to return `{recipeId, name, description}` (fun, appetizing, ≤140 chars, mention it's made with ripe ingredients, no false health claims).
   - **Re-run guardrails on the LLM output.** An invalid `recipeId`, a price outside the quote, or a timeout means falling back to `decideOffline` for that ingredient. The LLM never sets the price; `pricing.ts` does.
   - Add trace steps of kind `"llm"` with the model's choice. Set `plan.mock=false` when the LLM was used.
   - Optional: run vision and the forecast in parallel. Run the LLM calls for multiple ingredients with `Promise.all`.
4. **M3 (by 16:20), sad path and polish:**
   - Moldy avocado → `DISCARD` decision with `safety.blocked=true`, a clear trace line, and no special published. Test with a real moldy or bruised item, or a printed photo of one.
   - Add a "something else in frame" case: unknown items (`ingredientId: null`) are listed in the trace as "ignored: not in catalog".
   - Add `?slow=1` support on `/api/brain/run` (adds ~300 ms between trace steps) if C asks for it. It's for dramatic pacing on stage.
   - Write `lib/brain/NOTES.md`: model used, latency, prompt summary, known failure modes. B uses it for the pitch.
5. **If you have spare time:** cache scans by image hash so a demo re-scan is instant; add `CUT_PREP`/`REDUCE_REORDER` decisions when no recipe can absorb the surplus; improve `pickRecipe` scoring (hero qty × margin).

## Interfaces you must keep stable
`scanImage`, `planActions`, `decideOffline`, `quoteSpecial` signatures (see shared/CONTRACTS.md). B's replay calls `decideOffline` in a loop: **keep it pure, synchronous, and LLM-free.**

## Cut order if behind
1. `?slow=1` → 2. multi-ingredient parallelism → 3. the LLM copywriting step (offline names/descriptions are acceptable). **Never cut:** real vision on a real banana, the freshness-1 guardrail.

## Who you talk to most
- **B** about forecast numbers and decision application (`applyScan`/`applyDecisions` behavior).
- **C** about what the trace looks like and how fast it arrives; tell C when real vision is live so it can stop using `"mock"`.
