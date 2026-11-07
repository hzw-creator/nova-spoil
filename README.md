# Spoil Pricing — "Uber has surge pricing. DoorDash should have spoil pricing."

Nova hackathon (ScottyLabs, CMU) · DoorDash sponsor track · Nov 7 2026

## The pitch (30 seconds)
Restaurants run on **3–5% margins**, and food that spoils is money in the trash. DoorDash already
controls what customers see, when they see it, and at what price. So instead of only helping the owner
*track* inventory, **DoorDash can sell food before it spoils.**

A camera looks at the kitchen's produce. A vision model rates how fresh each item is. An AI agent
invents a special from whatever is about to go bad (using only the kitchen's real recipes), prices it, and puts it
on the DoorDash app within seconds. Simulated customers order it, and a counter shows the dollars rescued from the trash.
Rotten food is **never** sold: a hard-coded safety rule discards it and lowers the next supplier order.

**DoorDash pain points addressed:** #3 Inventory Management & Forecasting (main), #4 Financial Health
(margin and waste dollars), plus a new customer-facing marketplace product.
**Prize targets:** DoorDash Best Merchant Experience + Most Creative, Nova Grand Prize, Most InNOVAtive, Looks Good Works Good, Community Favorite.

## The 2-minute demo (what the judges see)
1. Stage screen: live camera on the left, mock DoorDash app in a phone frame on the right, map and counters at the bottom.
2. Presenter holds **brown bananas** up to the webcam and presses **Scan** (or the spacebar).
3. In about 3 s, the agent timeline animates: *Saw 12 bananas · freshness 2/5* → *10 units ($3.00) projected waste* → *Priced Warm Banana Bread $6 → $3.99*.
4. Phone pings: **"Warm Banana Bread — today only, $3.99 (was $6)."** (the exact dish depends on what the agent picks)
5. Press **Play**: the sim clock runs (10 sim-minutes per second), order dots pop up on the map, "$ rescued" ticks up, and the special sells out.
6. **Sad path:** hold up a **moldy avocado**. The guardrail fires: *Blocked: freshness 1/5 — never sell; discard and lower next order.* Nothing appears on the phone.
7. Last slide: the **7-day replay**, same demand with and without the agent: waste −X%, margin +Y pts (clearly labelled as simulated).

## Architecture
One Next.js app (App Router, TypeScript) running on one laptop. State lives in server memory (`globalThis`), so **run it locally, don't deploy to serverless.**

```
 Browser (/stage, /phone)                      Next.js server
 ┌──────────────────────────┐   HTTP JSON   ┌───────────────────────────────────────────┐
 │ C: components/, app/stage│ ────────────▶ │ A: app/api/brain/{scan,plan,run}           │
 │    webcam → dataURL      │               │      └─ lib/brain (vision · agent ·        │
 │    phone mockup, map,    │               │          pricing · guardrails · OpenRouter)│
 │    counters, timeline    │ ◀──────────── │ B: app/api/world/{state,tick,reset,        │
 └──────────────────────────┘   WorldState  │          publish,replay}                   │
                                            │      └─ lib/world (seed · store · sim ·    │
                                            │          forecast · replay)                │
                                            └───────────────────────────────────────────┘
               shared/contracts.ts = the types every part agrees on (owned by B)
```
- **The demo button** = `POST /api/brain/run`: scan → `applyScan` → `forecastWaste` → `planActions` → `applyDecisions` → returns `{scan, plan, world}`.
- **Import rules:** UI imports only `shared/*` and `components/*`, and talks to the server over HTTP. `lib/brain` never imports `lib/world`; the brain routes coordinate the two. Cross-folder imports go only through `lib/brain/index.ts` and `lib/world/index.ts`.
- **Mock-first:** with no API key, or `imageDataUrl: "mock"`, the brain returns `shared/fixtures.ts::MOCK_SCAN`. Everything runs end-to-end on day one.

## Run it
```bash
npm install                 # first time (B commits package-lock.json)
cp .env.example .env.local  # add OPENROUTER_API_KEY (optional — mocks work without it)
npm run dev                 # http://localhost:3000/stage   (phone view: /phone)
npm run typecheck
```
Smoke test without a browser:
```bash
curl -s -XPOST localhost:3000/api/world/reset | head -c 200
curl -s -XPOST localhost:3000/api/brain/run -H 'content-type: application/json' -d '{"imageDataUrl":"mock"}' | head -c 400
curl -s -XPOST localhost:3000/api/world/tick -H 'content-type: application/json' -d '{"minutes":60}' | head -c 300
```
Camera note: browsers only allow webcam access on `localhost` or HTTPS. Present from the laptop running the server. The `/phone` page needs no camera, so it can be opened from a real phone on the same wifi at `http://<laptop-ip>:3000/phone`.

## Implementation guide (who builds what)
| | Agent A: Brain | Agent B: World | Agent C: UI |
|---|---|---|---|
| Owns | `lib/brain/`, `app/api/brain/` | `lib/world/`, `app/api/world/`, `shared/`, `pitch/`, root config | `app/stage/`, `app/phone/`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/`, `public/` |
| Starts from | working v0: OpenRouter client, vision prompt, offline agent, pricing, guardrails | working v0: seed café, store, forecast, sim tick, placeholder replay | ugly v0 wiring page + typed `components/api.ts` |
| Core job | Vision works on real produce; LLM picks recipe + writes copy; guardrails | Realistic sim + **real 7-day replay numbers**; contract keeper; `npm install` + lockfile; demo script | The flashy stage screen + phone mockup + camera capture + animations |
| Brief | `agents/agent-a-brain.md` | `agents/agent-b-world.md` | `agents/agent-c-ui.md` |

Full API and type reference: `shared/CONTRACTS.md`. Rules: `RULES.md`. Coordination: `COMMS.md`.

## Honest limitations (say them before the judges ask)
- The sim and the 7-day numbers are **synthetic**; we can't get real restaurant data in a day.
- Apps that discount surplus food already exist (e.g. Too Good To Go sells surplus "bags"). What's new here: **camera-triggered**, the agent **creates a new dish from real recipes** instead of discounting leftovers, and it lives **inside the normal delivery menu**.
- Vision freshness scores are estimates. That's why the food-safety rule is hard-coded and fails safe.
