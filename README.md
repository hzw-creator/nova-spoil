# spoil pricing

uber has surge pricing. we think doordash should have spoil pricing.

built at nova (scottylabs' genai hackathon at cmu) on nov 7, 2026, for the doordash track.

## Inspiration

restaurants run on 3–5% margins. a case of avocados that goes brown on a slow tuesday isn't just gross, it's a real chunk of that week's profit going straight into the trash. most tools for this (inventory trackers, waste logs) tell the owner what went wrong after it already happened.

but doordash is in a pretty unique position: it controls what customers see, when they see it, and how much it costs. so instead of helping owners track food that's about to spoil, why not just sell it before it spoils?

## The doordash challenge

doordash's track split restaurant operations into two halves. the front of house is the customer-facing chaos during peak hours: orders flying in from different channels, food getting packed and handed off, and lots of room for missing items and mixed-up orders. the back of house is everything the owner deals with behind the scenes: inventory, staffing, and finances, with records scattered across sales reports, supplier invoices, receipts, and payouts.

they broke that down into five pain points:

1. order management & preparation timing (front)
2. order packing & pickup (front)
3. inventory management & forecasting (back)
4. bookkeeping & financial health (back)
5. staffing & skill optimization (back)

we went after the back of house, mainly 3 and 4.

inventory management & forecasting (3): doordash called out inaccurate physical counts, spoilage, waste, and fluctuating demand as the big roadblocks. spoil pricing hits all four. the camera does the count and judges freshness at the same time, so nobody has to walk the walk-in with a clipboard. the forecast compares what's on the shelf against how much normal orders will actually use before it expires, so the owner knows what's going to be wasted before it happens. then, instead of just warning them, the agent does something about it: it turns the surplus into a special that sells. when something is past saving, it lowers the next supplier order so the same mistake doesn't happen again next week.

bookkeeping & financial health (4): at 3–5% margins, a few dollars of thrown-out produce every day really adds up. every decision spoil pricing makes is tracked in dollars: food cost rescued from the trash, revenue from specials, and stock that still had to be discarded. the 7-day replay puts waste and margin with and without the agent next to each other, so the owner can see what it's actually worth to them instead of guessing.

doordash also asked teams to be creative and ambitious, and to feel free to tackle pain points beyond the five. this is where we think spoil pricing gets interesting: most inventory tools stop at the owner's dashboard, but doordash is the one platform that sits between the restaurant and its customers. that means it can actually move the food. specials also show up with a fixed quantity and an expiration time, so the kitchen knows exactly how many to make.

## What it does

point a camera at the kitchen's produce. a vision model looks at everything on the shelf and rates how fresh each item is (5 = perfect, 1 = do not serve). from there, an agent figures out what's going to go bad before normal orders use it up, picks a dish from the restaurant's actual recipe book that uses that ingredient, prices it, and puts it on a mock doordash app as a today-only special. all in a few seconds!!

for example: hold up a bunch of brown bananas, and a few seconds later "warm banana bread, today only, $3.99 (was $6)" shows up on the phone (the exact dish depends on what the agent picks). hit play and the simulated café runs at 10 minutes per second. orders start popping up on the map, the special sells out, and a counter tracks how many dollars of food got saved from the trash.

rotten food never gets sold. if the camera sees something moldy (freshness 1), a hard-coded rule blocks it, logs it as waste, and lowers the next supplier order instead. this lives in plain code, not in a prompt, because "the llm decided the moldy avocado was fine" is not a risk we want to take.

we also run a 7-day replay: the same simulated week of customers, once without the agent and once with it, so you can compare waste and margin side by side.

## How it works

it's one next.js app (app router, typescript) running on a single laptop, split into three parts:

- brain (`lib/brain`, `app/api/brain`): camera frame → vision model through openrouter → a list of items with counts and freshness. then the agent: forecast → pick a recipe → price it → check the guardrails. pricing is plain code (urgency and surplus push the discount up, and it never drops below 1.5× the ingredient cost). the llm only chooses between valid recipes and writes the menu copy. it never sets the price.
- world (`lib/world`, `app/api/world`): the fake restaurant, "sunny side café" in oakland. ingredients, recipes, the menu, inventory lots with freshness and days left, a forecast of what will get thrown out, and a simulation where customers order (poisson arrivals, with more orders for bigger discounts) and stock spoils over time. the 7-day replay lives here too.
- ui (`app/stage`, `app/phone`, `components`): the main screen (camera, the agent's steps as they happen, a phone mockup of the delivery app, an order map, counters) and a standalone phone page you can open on a real phone on the same wifi.

the main button is `POST /api/brain/run`: scan → add the scanned items to inventory → forecast waste → plan → publish specials. it returns the scan, the plan, and the new world state in one response.

state lives in server memory, so run it locally instead of deploying somewhere serverless (it would lose state between requests).

with no api key, or with `"mock"` sent as the image, the brain falls back to a canned scan, so the whole thing runs end to end without a camera or internet.

types shared between the three parts are in `shared/contracts.ts`, and the full api reference is in `shared/CONTRACTS.md`.

## Running it

```bash
npm install
cp .env.example .env.local   # add OPENROUTER_API_KEY (optional, mocks work without it)
npm run dev                  # http://localhost:3000/stage   (phone view at /phone)
npm run typecheck
```

quick check without a browser:

```bash
curl -s -XPOST localhost:3000/api/world/reset | head -c 200
curl -s -XPOST localhost:3000/api/brain/run -H 'content-type: application/json' -d '{"imageDataUrl":"mock"}' | head -c 400
curl -s -XPOST localhost:3000/api/world/tick -H 'content-type: application/json' -d '{"minutes":60}' | head -c 300
```

browsers only allow webcam access on localhost or https, so run the main screen on the laptop that's running the server. the phone page doesn't need a camera, so you can open it from a phone at `http://<laptop-ip>:3000/phone`.

## How we built it

we split the project into those three parts (brain, world, and ui), and each of us ran a coding agent on one of them. each agent could only write to its own folders (`ownership.json` has the exact split), and they talked to each other through message files in `board/`. git hooks and a github action kept everyone in their own lane, so there were no merge conflicts. `RULES.md` and `COMMS.md` explain the setup if you're curious.
