# Demo script (2 minutes) — Owner: Agent B

**Props:** 6–12 brown/spotty bananas, 1 moldy or badly bruised avocado (or a printed photo of one), 1 loaf of bread.
**Setup (by 16:45):** laptop running `npm run dev`, `/stage` fullscreen on the projector, `.env.local` has the key (or none: mock works offline). Optional: `/phone` open on a real phone on the same wifi.
**Right before going on:** press **R** (reset). The café restarts at Friday 7:00 AM and the run is deterministic.
**Presenter keys (C's stage):** **Space** = scan · **M** = mock scan (backup) · **P** = play/pause · **R** = reset.

| Time | Who / action | Say (word for word) |
|---|---|---|
| 0:00 | Speaker 1, title slide | "Restaurants run on razor-thin margins, and food that spoils is money in the trash. Uber has surge pricing. We built **spoil pricing**: a DoorDash-style prototype that sells food *before* it spoils." |
| 0:15 | Speaker 2 holds bananas to the camera, presses **Space** | "This café has bananas that won't be good for the regular menu much longer. Watch." |
| 0:20 | Point at the agent timeline as it animates | "A vision model gives each item a visual quality estimate. Our forecast says most of these bananas won't get used in time. The agent **selects an approved recipe** from the kitchen's own recipe book, and the price comes from code: urgency, surplus, and a cost floor." |
| 0:35 | Phone pings | "And it's live on the app: Warm Banana Bread, today only, $3.99, was $6." |
| 0:45 | Press **P** | "Ten sim-minutes per second. Nearby customers order it… it sells out… and this counter is the cost of at-risk ingredients that went into a sale instead of the bin." |
| 1:05 | Hold the moldy avocado, press **Space** | "Now the sad path. Moldy avocado. The agent **refuses**. Anything rated 1 out of 5 is never offered; that's a hard rule in plain code, not a prompt. It's discarded, and the agent recommends a smaller next order." |
| 1:25 | Replay slide | "Is it worth it? We replayed the same simulated week with and without the agent, same customers both times. Waste dropped 63%, and 80% on a second scenario we fixed before tuning, with revenue slightly up and margin roughly flat. Our first version actually lost money because its specials used bread the regular menu needed, so the agent now reserves a day of menu stock. Simulated, but every number is computed." |
| 1:45 | Close | "Every restaurant on DoorDash has a fridge. Spoil pricing turns what's about to go bad into a sale." |

Before presenting, fill the replay sentence with the latest `pitch/NUMBERS.md` figures (regenerate at freeze: `node pitch/numbers.mjs`).

## Backup plan
| Failure | Do this | Say |
|---|---|---|
| Camera won't start / vision is slow | Press **M** (mock scan: the same bananas + avocado + bread) | "Same scene from our test photo." |
| Wifi or API key fails | **M** works fully offline (no API call) | nothing; keep going |
| Vision returns something odd | Press **R**, then **M** | "Let's use the reference scan." |
| Whole laptop or app fails | Play the backup screen recording (record at 16:40 on the presenting laptop) | "Here's the recording from an hour ago." |

## Words to avoid (agreed on the board)
- ❌ "safe to eat" / "food-safety guarantee" → ✅ "visual quality estimate", "never-sell rule for anything rated 1"
- ❌ "the AI invents dishes" → ✅ "selects approved recipes"
- ❌ "saves restaurants X%" → ✅ "in our simulation"
- ❌ "money saved" for the live counter → ✅ "at-risk ingredient cost used" / "special sales"
- ❌ "DoorDash's app" as if real → ✅ "DoorDash-style prototype"
