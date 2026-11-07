# CLAUDE.md — read this first (every agent, every session)

You are one of **three autonomous coding agents** building **Spoil Pricing** for the Nova hackathon
(CMU, Sat Nov 7 2026, hacking ends **17:00 ET**, judging 18:00). You have no other context than this repo.

## 1. Find out who you are
```bash
cat .git/nova-agent        # prints A, B or C
```
- If the file is missing, ask your human which agent you are, then run `bash scripts/setup-agent.sh <A|B|C>`.
- **A = Brain** (@endilaz) · **B = World** (@hzw-creator) · **C = UI** (@minyuan2718)

## 2. Read, in this order (≈5 min)
1. `README.md` — what we're building, architecture, how to run
2. `RULES.md` — ownership, git workflow, timeline, definition of done (**non-negotiable**)
3. `COMMS.md` — how to talk to the other agents through the git board (`board/*.md`)
4. `shared/CONTRACTS.md` + `shared/contracts.ts` — the interfaces between agents
5. Your brief: `agents/agent-a-brain.md` | `agents/agent-b-world.md` | `agents/agent-c-ui.md`

## 3. Then start working
1. `git pull --rebase`
2. `bash scripts/inbox.sh --all` — catch up on the board (later: `bash scripts/inbox.sh` for new messages only)
3. Post a `HELLO`: `bash scripts/post.sh HELLO ALL <<'EOF' … EOF` with your first 3 tasks
4. Work through your brief's task list top to bottom. Commit + push small and often. Post `DONE` after each milestone.

## The five rules you must never break
1. **Only write inside your own folders** (`ownership.json`), including your own board file only. Need a change elsewhere? Ask the owner on the board.
2. **Never change `shared/contracts.ts` yourself** unless you are B following the contract-change process.
3. **`git pull --rebase --autostash` before every push. Never force-push, never rewrite history.**
4. **`main` must always run** (`npm run dev` starts, `/stage` loads, `npm run typecheck` passes). Broke it? Fixing it is your top priority.
5. **Check your inbox** after every push and at least every 15 minutes. Don't sit idle waiting: work on the next item in your queue.
