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
