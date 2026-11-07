# Board — B (World · @hzw-creator)
Only B appends here, via `bash scripts/post.sh`. Everyone reads it via `bash scripts/inbox.sh`.
Format: see COMMS.md. Newest messages at the bottom.

### B-001 · 14:46 · HELLO · to: ALL · sha 37055cb
@endilaz @minyuan2718

B (World) online — contract keeper + integration owner. Owns lib/world, app/api/world, shared/, pitch/, root config.
First 3 tasks:
1. M0 (now): npm install → typecheck → dev; push package-lock.json; post DONE M0. Will forward any compile errors in lib/brain or components/ to A / C with exact messages.
2. M1 (ETA 14:50): sim sanity run (reset → run(mock) → 60×10-min ticks) + tune so a special gets its 1st order in ~3 s and sells out in 20–40 s at 10 sim-min/s.
3. M2 (ETA 15:40): real 7-day replay in lib/world/replay.ts (baseline vs decideOffline from @/lib/brain, same seed).
Nothing needed from you yet — wait for DONE M0, then pull + npm install.

### B-002 · 14:47 · DONE · to: ALL · sha f1d1744
@endilaz @minyuan2718

M0 done: package-lock.json pushed (f1d1744). Repo builds clean on main — no compile errors anywhere.
- npm run typecheck: passes (0 errors)
- npm run dev: /stage 200, /phone 200
- POST /api/world/reset 200 · POST /api/brain/run {"imageDataUrl":"mock"} 200 · POST /api/world/tick {"minutes":60} 200 · GET /api/world/replay 200 (still placeholder fixture)
NEXT for you (A, C): git pull --rebase --autostash && npm install, then post HELLO and start M1.
Reminder: if npm install modifies package-lock.json locally, `git checkout -- package-lock.json` before committing.

### B-003 · 14:54 · ACK · to: A · sha f8535f9
@endilaz

Partial ACK of A-002 + A-003. Verified against code — you're right on these, B fixes them in lib/world (no contract change):
1. consume() shortages: sales become atomic — check every recipe line has stock (freshness>1) before recording any order; short → no sale. Applies to menu + specials.
2. Publish caps Special.unitsAvailable by sellable hero stock, and applyDecisions re-validates server-side: no CREATE_SPECIAL if the hero's only stock is freshness 1. Client decisions are no longer trusted blindly.
3. applyScan reconciles instead of adding: the scan observation overwrites the most at-risk existing lot(s) of that ingredient (qty/freshness/daysLeft) rather than stacking a new lot on top of seed stock.
4. forecastWaste: replace "all remaining portions reserved" with expected sell-through = min(remaining, demandRate(discount) × hours to min(expiry, special.expiresAt)).
5. Metrics: keys stay; I'll fix the doc comments. Suggested labels for C: wasteUsdAvoided → "at-risk stock sold via specials ($ cost)", revenueRecoveredUsd → "special sales". Any "waste avoided" headline comes only from the replay counterfactual.
6. Replay (M2): common random numbers (pre-generated customer stream shared by both runs), baseline vs decideOffline, fixed-markdown 3rd policy if time. REDUCE_REORDER modeled in restock; CUT_PREP labeled recommendation-only. marginPct disclosed as tracked-ingredient gross margin. Results get reported even if the agent loses.
NEXT for you (A): lockfile is in (B-002) — pull + npm install. None of this blocks your M1 (real vision JSON), which was due 14:50; please start it.

### B-004 · 14:54 · CONTRACT · to: ALL · sha 282a884
@endilaz @minyuan2718

Response to A-002/A-003 contract fields. Applying (additive, optional, per COMMS §4.2):
+ ReplayResult.provenance?: "placeholder" | "computed"   (fixture → "placeholder"; UI should show PLACEHOLDER when set)
+ ReplayResult.policy?: string                            (e.g. "decideOffline v0 vs no-action")
Declining for today (counterproposal):
- InventoryLot.eligibility, WorldState.revision, PlanResult.worldRevision, PublishRequest.planId, mandatory owner-approval flow: one laptop on localhost, and "on the app within seconds" is the pitch. The server-side re-validation in B's ACK (#2) covers the safety concern without new fields. The preview→approve path already exists (POST /api/brain/plan → POST /api/world/publish) if C wants an Approve button. Can revisit after M2 if there's time.
- DetectedItem.quantityUnit: each ingredient's unit is fixed in the catalog (each/loaf/pint/bunch/dozen). A's vision prompt should count in that unit — lib/brain change, no contract needed.
- Mold at freshness 2: A's call inside lib/brain/guardrails.ts (e.g. block if notes mention mold). No contract needed.
Affected: C (optional provenance badge on the replay slide). Nothing else changes.
