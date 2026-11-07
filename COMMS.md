# COMMS.md — how the agents talk to each other (git only, no GitHub CLI or tokens)

The **board** is four files in the repo:

| File | Written by (only!) | GitHub handle |
|---|---|---|
| `board/A.md` | Agent A: Brain | @hzw-creator |
| `board/B.md` | Agent B: World | @endilaz |
| `board/C.md` | Agent C: UI | @minyuan2718 |
| `board/HUMAN.md` | the humans (announcements, answers, decisions) | — |

You **append only to your own file** (the pre-commit hook enforces it). You **read everyone's file** from `origin/main`.
Each file has exactly one writer, so the board can never have merge conflicts.
There are no notifications: **you must poll** (§3). @handles in messages are for the humans skimming the files on GitHub.

## 1. Posting
Always use the script. It numbers the message, adds the header and your latest commit sha, appends to `board/<you>.md`,
commits **only that file** (your other uncommitted work is left alone), and pushes (with retries):
```bash
bash scripts/post.sh DONE C <<'EOF'
M1 done: POST /api/brain/run now uses the real vision model when OPENROUTER_API_KEY is set.
- Latency ~2.5 s; `scan.items[].box` is filled (normalized 0..1).
NEXT for you (C): draw the boxes over the frozen webcam frame — field is DetectedItem.box.
EOF
```
- `TYPE` is one of the types below. `TO` is `A`, `B`, `C`, `HUMAN`, a combo like `B,C`, or `ALL`.
- Humans post with `NOVA_HUMAN=1 bash scripts/post.sh FYI ALL <<'EOF' … EOF` (goes to `board/HUMAN.md`).
- **Post your code before announcing it.** `git push` your work first, then post `DONE`, so the sha in the header points at it.

A message in the file looks like this. The script writes it, so never hand-edit old messages:
```
### A-004 · 14:48 · DONE · to: C · sha 1be77d0
@minyuan2718

M1 done: ...
```

### Message types
| Type | Use it when | Must include |
|---|---|---|
| `HELLO` | first post of your session | your role, your first 3 tasks, ETA for M1 |
| `DONE` | you finished a task or milestone **and pushed** | what works now, how to verify (curl / page), **what the recipient can now do** |
| `NEXT` | you're handing a specific task to another agent | exact task, files and types involved, why it matters for the demo |
| `NEED` | you need something from another agent but can keep working meanwhile | the exact request (field, endpoint, package), deadline |
| `BLOCKED` | you cannot continue and have nothing else useful to do | what you tried, the exact error, what would unblock you |
| `CONTRACT` | you propose a change to `shared/contracts.ts` or a route shape | diff-style proposal, who is affected (see §4) |
| `ACK` | you accept a CONTRACT / NEXT / NEED | "ACK B-007", your ETA |
| `FYI` | heads-up, no action required | — |

Refer to earlier messages by their id (`B-007`).

### Writing good messages
- **Lead with the outcome**, then the details. Keep it under ~12 lines.
- Name exact files, functions, fields and endpoints. Never write "the thing" or "the API".
- Every `DONE` ends with **NEXT for you (X): …**, or "nothing needed from you".
- Proof beats claims: paste 3–5 lines of curl output, or the path of a screenshot committed in your own folder.
- Never paste secrets.

## 2. Reading
```bash
bash scripts/inbox.sh          # new messages to you or ALL (marks them read); also tells you if you're behind origin
bash scripts/inbox.sh --all    # last 20 messages from everyone, to catch up after a restart
bash scripts/inbox.sh --wait   # fetch every 60 s until something arrives (max 15 min)
```
`inbox.sh` reads from `origin/main` and never changes your working tree. To get the others' **code**, still run
`git pull --rebase --autostash`.

## 3. Polling rhythm (mandatory)
Check your inbox:
1. at session start (use `--all` the first time),
2. **after every `git push`**,
3. before starting a new task from your queue,
4. at least **every 15 minutes** of work,
5. when blocked: `--wait`, but first look for *any* other useful task in your brief (polish, tests, edge cases).

Reply to anything addressed to you within one polling cycle, even if it's just `ACK B-007, ETA 15:10`.

## 4. Contract changes (`shared/contracts.ts`, route paths and bodies)
1. Proposer posts `CONTRACT` to ALL with the exact change, e.g. `+ Special.imageUrl?: string (optional)`.
2. **Additive optional fields:** B may apply them right away (no one breaks), then posts `DONE`.
3. **Renames, removals, required fields or changed route shapes:** B waits for an `ACK` from every affected agent, then applies. Each agent updates its own code and posts `DONE`.
4. Only **B** edits `shared/`. A and C request changes; they never edit it.
5. **After 16:00 no breaking contract changes** at all. Add optional fields only.

## 5. Handoff etiquette
- If you finish early, offer help with `FYI ALL: free for 20 min, can take X`. Help happens **inside your own folders** (e.g., A writes a helper in `lib/brain` that C calls over HTTP), or by testing someone else's work and reporting bugs with exact repro steps.
- If someone is silent for 25+ minutes after being addressed, post again and continue with your best assumption, stated explicitly.
- Disagreement? State the trade-off in one message. The owner of the folder decides. If it's cross-cutting, address `HUMAN` and keep working on something else.
- Humans answer in `board/HUMAN.md`. **A HUMAN message overrides any agent decision.**

## 6. Examples
```
### B-002 · 14:12 · DONE · to: ALL · sha 9f2c1ab
@hzw-creator @minyuan2718

M0: package-lock.json pushed. `npm install && npm run dev` works; /stage loads, Run (mock) publishes a special.
NEXT for you (A, C): git pull --rebase --autostash && npm install, then post HELLO.
```
```
### C-005 · 15:05 · NEED · to: A · sha 1be77d0
@hzw-creator

For the timeline animation I need each AgentStep ~400 ms apart. Option: `?slow=1` on /api/brain/run that sleeps
300 ms between steps. Not blocking: I fake the stagger client-side until then.
```
```
### A-009 · 15:20 · CONTRACT · to: ALL · sha 77aa012
@endilaz @minyuan2718

Proposal (additive): `+ AgentDecision.llmModel?: string` so the UI can show which model wrote the copy. Affected: C (optional).
```
