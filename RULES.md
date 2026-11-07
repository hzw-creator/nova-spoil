# RULES.md — how three agents work in one repo without breaking each other

## 1. Ownership (who may write where)
`ownership.json` is the source of truth. Summary:

| Agent | GitHub | May write | Everything else |
|---|---|---|---|
| **A: Brain** | @hzw-creator | `lib/brain/**`, `app/api/brain/**`, `board/A.md` | read-only |
| **B: World** | @endilaz | `lib/world/**`, `app/api/world/**`, `shared/**`, `pitch/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `.env.example`, `.gitignore`, `board/B.md` | read-only |
| **C: UI** | @minyuan2718 | `app/stage/**`, `app/phone/**`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/**`, `public/**`, `board/C.md` | read-only |
| Humans only | — | `board/HUMAN.md`, `CLAUDE.md`, `README.md`, `RULES.md`, `COMMS.md`, `ownership.json`, `agents/**`, `scripts/**`, `.githooks/**`, `.github/**`, `.claude/**` | agents never edit |

- **Reading anything is always allowed.** Importing across folders is allowed **only** through `lib/brain/index.ts`, `lib/world/index.ts`, `shared/*`, and (for UI) `components/*`.
- **New files** go inside your own folders. Need a new top-level folder or a new page route? Ask a human on the board.
- **Need an npm package?** Post `NEED` to B with the package name and reason. B adds it and pushes the lockfile. Nobody else edits `package.json`.
- **Notes or scratch files:** keep them in your own folder (`lib/brain/NOTES.md`, `lib/world/NOTES.md`, `components/NOTES.md`).

### How it's enforced (several layers, since no single one is airtight)
1. **Claude Code deny rules:** `scripts/setup-agent.sh` writes `.claude/settings.local.json` that blocks the Edit/Write tools outside your folders.
2. **Git pre-commit hook** (`.githooks/pre-commit`) rejects any commit touching files you don't own. **Do not use `--no-verify`.**
3. **prepare-commit-msg hook** adds an `Agent: X` trailer to every commit.
4. **GitHub Action** `ownership-guard` re-checks every push to `main`. A violation shows as a red ✗ in the Actions tab; humans will tell the offender on `board/HUMAN.md`.
5. **You.** Shell commands (`sed -i`, `>`, `mv`) can bypass layer 1, so never use them on files you don't own.

If you discover you changed someone else's file: `git checkout origin/main -- <file>`, then ask the owner on the board.

## 2. Git workflow
- Everyone commits **directly to `main`**. Folders never overlap, so rebases are trivial.
- **Humans** committing anything (docs, rules, `board/HUMAN.md`) prefix the command with `NOVA_HUMAN=1` so the hooks allow it and add a `Human: yes` trailer.
- Before every push: `git pull --rebase --autostash && npm run typecheck`, then `git push`.
- **Small commits, often** (at least every 30 min). Message format: `A: vision prompt handles moldy items` (prefix = your letter).
- **Forbidden:** `git push --force`, `git reset --hard origin/...` on shared work, `git rebase -i`, amending pushed commits, committing `.env.local` or API keys, committing `node_modules/` or `.next/`.
- **Lockfile:** only B commits `package-lock.json`. If `npm install` changes it on your machine, run `git checkout -- package-lock.json` before committing.
- **Rebase conflict?** It can only happen in a file you own, or because someone broke a rule. Resolve your own file. For any other file, take `origin/main`'s version and post `FYI` on the board.

## 3. `main` must always run
Definition of "runs": `npm run typecheck` passes, `npm run dev` starts, `/stage` loads, and `POST /api/brain/run {"imageDataUrl":"mock"}` returns 200.
- Never push code that breaks this. Put unfinished work behind a flag or keep it unexported.
- **If `main` breaks:** whoever broke it fixes or reverts it (`git revert <sha>`) within 10 minutes. Anyone who notices posts `BLOCKED` tagging the author.
- **Contract changes** follow COMMS.md §4. Never change a type or route shape on your own.

## 4. Timeline (ET, today)
| Time | Milestone | Done when |
|---|---|---|
| **14:30 · M0 Setup** | All three agents posted `HELLO`; B pushed `package-lock.json`; everyone can `npm run dev` | board shows 3 HELLOs + B's `DONE M0` |
| **14:50 · M1 Parts work alone** | A: real vision returns sensible JSON for a phone photo of produce. B: realistic tick plus forecast checked by hand. C: stage layout with all panels on mock data. | each agent posts `DONE M1` with proof (curl output / screenshot path) |
| **15:40 · M2 Happy path** | Real webcam → Scan → special appears on phone → Play → orders and counters move | C posts `DONE M2` after a full run-through; A and B confirm |
| **16:20 · M3 Sad path + numbers + polish** | Moldy item blocked on screen; real 7-day replay numbers; animations; demo script | `DONE M3` from all three |
| **16:35 · FREEZE** | Bug fixes only. No new features, no refactors. | — |
| **17:00** | Hacking ends. Last push before 16:55. | — |

If you're behind a milestone by more than 15 minutes, post `BLOCKED` or `FYI` with what you're cutting. The **cut order** is in each brief.

## 5. Definition of done (any task)
- Typechecks, runs, and is pushed to `main`.
- Works with mocks **and** with the real dependency when available.
- Errors are handled: no unhandled promise rejections, routes return `{error}` with a status code, and the UI shows a friendly message instead of crashing.
- Posted on the board with what changed and what the next agent can now do.

## 6. Secrets and safety
- The API key lives only in `.env.local` on the machine that runs the demo. Never print it, log it, or commit it.
- Food-safety guardrails (freshness 1 → never sell) are **plain code in `lib/brain/guardrails.ts`**. Never rely on a prompt alone.
- Don't add analytics, external network calls (other than OpenRouter), or anything that needs a login.
