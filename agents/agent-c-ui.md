# Agent C — UI (@minyuan2718)
**You own:** `app/stage/**`, `app/phone/**`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/**`, `public/**`.
**Mission:** the stage screen wins or loses this hackathon. It must look like a real product (DoorDash-quality polish), read from the back of a room, and make the "banana → special on the phone" moment feel magical. This also targets the **Looks Good, Works Good** prize.

## What already exists
- `components/api.ts`: typed fetch client for every route. **Talk to the backend only through this.** Never import `lib/*` into client components.
- `app/stage/page.tsx`: ugly wiring test (Reset / Run mock / Play). Replace it.
- `app/phone/page.tsx`: bare mock phone list that polls state.
- Tailwind v4 (`@import "tailwindcss"` in globals.css) and `framer-motion` are in package.json.

## The stage screen (`/stage`, 1920×1080 projector, dark theme)
```
┌──────────────────────────── header: "Spoil Pricing" · café name · sim clock · [Reset] [Scan ⎵] [Play ▶] ─┐
│ CAMERA (left, ~40%)                │ AGENT TIMELINE (middle)          │ PHONE MOCKUP (right)          │
│ live <video> from getUserMedia     │ plan.trace lines appear one by   │ iPhone frame, mock DoorDash   │
│ on Scan: freeze frame + draw       │ one (kind icons: 👁 vision,      │ restaurant page: hero card for│
│ scan.items[].box with labels and   │ 📉 forecast, 🧠 llm, 🛡 guardrail, │ the live special (strike-     │
│ freshness color (5 green → 1 red)  │ 🏷 tool, 🚀 publish)             │ through old price, −X% badge, │
│                                    │ blocked guardrail lines in red   │ "N left"), push notification  │
│                                    │                                  │ slides in on publish          │
├────────────────────────────────────┴──────────────────────────────────┴───────────────────────────────┤
│ MAP (stylized SVG, café pin in center, order dots pop at Order.x/y; special orders pulse red)        │
│ COUNTERS: 💸 $ rescued from trash (wasteUsdAvoided) · 🧾 revenue recovered · 🛵 orders from specials · │
│           🗑 projected waste $ (goes DOWN after a special) — big animated numbers                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Plus a **replay view** (`/stage?view=replay` or a toggle): two bars per day (baseline vs agent) for waste $, and a big "−X% waste · +Y pts margin" headline from `api.replay()`. Mark it "simulated".

## Task queue (top to bottom)
1. **M0 (by 14:30):** pull, `npm install` after B's lockfile, `npm run dev`, open `/stage`, click Run (mock). Post `HELLO`.
2. **M1 (by 14:50), layout on mock data:** build all panels with `api.run("mock")` and `api.tick(10)`. Split into components in `components/` (`CameraPanel`, `Timeline`, `PhoneMockup`, `OrderMap`, `Counters`, `ReplayChart`). Post `DONE M1` with a screenshot committed to `public/shots/`.
3. **M2 (by 15:40), real camera and the magic moment:**
   - `getUserMedia` webcam in `CameraPanel`. On Scan, draw the video frame to a canvas, downscale to ≤1024 px wide, call `toDataURL("image/jpeg", 0.8)`, then `api.run(dataUrl)`. Show a scanning shimmer while waiting.
   - Animate `plan.trace` lines with ~350 ms stagger (framer-motion). Then the phone push notification slides in, then the special card appears.
   - **Play** = `setInterval(() => api.tick(10), 1000)`. Animate new order dots and count-up the counters.
   - Keyboard shortcuts for the presenter: **Space** = Scan, **P** = play/pause, **R** = reset, **M** = scan with `"mock"` (backup if the camera fails).
4. **M3 (by 16:20), sad path and polish:**
   - A `DISCARD` decision / blocked guardrail shows a red 🛡 card: "Blocked: unsafe — not sold", and the phone shows nothing new. This is a key demo beat; make it obvious.
   - Replay view with real numbers from B.
   - `/phone` matches the stage phone mockup (same component) so it can be opened on a real phone.
   - Empty, loading and error states. Nothing crashes if a route returns `{error}`.
5. **If you have spare time:** sound effect on publish (`public/ding.mp3`, only if you have a royalty-free file or generate a beep with WebAudio); confetti when a special sells out; a QR code on screen linking to `/phone` for the audience (Community Favorite), built with a tiny inline generator or a package requested from B.

## Design rules
- Big type (counters ≥ 48 px), high contrast, 1–2 accent colors (`--dd-red`). Every animation under 600 ms.
- Don't use DoorDash's real logo or trademarked artwork. Call the phone app "DoorDash-style" in text, with a generic red delivery-app look.
- Everything must work offline with `"mock"` (the projector machine may have bad wifi).

## Cut order if behind
1. replay chart animation (a static table is fine) → 2. map polish (dots on a plain circle) → 3. `/phone` on a real device. **Never cut:** camera → special on the phone, the red guardrail card, the counters, the Space/M shortcuts.
