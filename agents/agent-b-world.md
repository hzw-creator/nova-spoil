# Agent B — World (@hzw-creator)
**You own:** `lib/world/**`, `app/api/world/**`, `shared/**` (contracts + fixtures), `pitch/**`, and root config (`package.json`, `package-lock.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `.env.example`, `.gitignore`).
**Mission:** a believable café that reacts to the agent, honest numbers that prove the value, and a repo that always builds. You're also the **contract keeper** and the **integration owner**.

## What already exists (v0, untested; nothing has been run yet)
- `seed.ts`: 7 ingredients, 5 menu recipes and 6 AI-only recipes, demand rates, seeded inventory (strawberries and old bananas start at risk).
- `store.ts`: globalThis state, id sequence, seeded RNG.
- `forecast.ts`: daily usage → projected waste per ingredient.
- `sim.ts`: `applyScan`, `applyDecisions`, `tick` (Poisson orders, specials demand ∝ discount, oldest-first consumption, spoilage clock, events).
- `replay.ts`: **placeholder** (returns the fixture).
- Routes: state, tick, reset, publish, replay.

## Task queue (top to bottom)
1. **M0 (by 14:30), make the repo build. Everyone is waiting on you:**
   - `npm install`, then `npm run typecheck`, then `npm run dev`. Fix any compile errors **in your folders**. If the errors are in A's or C's files, post exact errors to them right away.
   - Commit `package-lock.json`. Post `DONE M0` to ALL with "pull + npm install now".
2. **M1 (by 14:50), sim sanity:**
   - Write `lib/world/dev-sim.mjs` or a small route test that runs reset → run(mock) → tick 60 × 10 min. Check by hand: orders per hour ≈ 12 baseline, a 30%-off special sells out within about 1–2 sim hours, `wasteUsdAvoided` grows, nothing goes negative, and lots spoil when `daysLeft` hits 0.
   - Tune the numbers so the **demo looks good at 10 sim-min per second**: a special should get its first order within ~3 s and sell out within ~20–40 s real time.
   - Post `DONE M1` with a short table of numbers.
3. **M2 (by 15:40), real 7-day replay (`replay.ts`), your headline number:**
   - Simulate 7 days twice from the same seed. **Baseline:** no specials, stock spoils. **With agent:** every sim morning at 7:00 and again at 14:00, call `decideOffline(getState, forecastWaste(state))` from `@/lib/brain` and apply it.
   - Restock each morning using a simple fixed order. In the with-agent run, apply `REDUCE_REORDER` deltas. Introduce randomness the same way in both runs (same seed) so the comparison is fair.
   - Compute daily `wasteUsd`, `revenueUsd`, `foodCostUsd` and `marginPct`, plus totals, `wasteReductionPct`, `marginDeltaPts`. Fill `assumptions[]` honestly ("synthetic demand", "Poisson orders", "specials demand +X% per 10% discount").
   - Must run in under 1 s with no LLM and no `await`. Don't touch the live world: run the replay on a cloned state and restore the RNG afterwards.
4. **M3 (by 16:20), pitch material in `pitch/`:**
   - `pitch/NUMBERS.md`: replay results table and assumptions, the demo-run numbers, A's model and latency (from `lib/brain/NOTES.md`).
   - `pitch/DEMO_SCRIPT.md`: polish the 2-minute script, word for word, with who clicks what and the backup plan if the camera or wifi fails (`"mock"` scan + pre-recorded video).
   - Add a "scale" line: one ingredient-level formula for waste dollars saved per restaurant per week × number of restaurants. Use a placeholder variable for the restaurant count, never an invented statistic.
5. **If you have spare time:** a time-of-day demand curve (breakfast and lunch peaks); a weekday effect; `GET /api/world/forecast` returning `WasteForecast[]` for the owner panel (additive, so announce it as a CONTRACT FYI).

## Contract keeper duties
- You are the only one who edits `shared/`. Follow COMMS.md §4. Announce every change, even additive ones.
- Keep `shared/fixtures.ts` in sync with the types; C builds against it.
- You're also the first responder when `main` breaks. Run `npm run typecheck` after each pull and ping the author with the exact error.

## Cut order if behind
1. time-of-day curve → 2. afternoon decision pass in the replay → 3. polish of pitch docs (a bare table is fine). **Never cut:** the repo building at M0, the real replay numbers (or clearly marked placeholders), the demo script.
