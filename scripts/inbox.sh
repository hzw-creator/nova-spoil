#!/usr/bin/env bash
# Read board messages addressed to me (or ALL) that I haven't seen yet.
# Reads straight from origin/main (git fetch), so it never touches your working tree.
# Usage: bash scripts/inbox.sh          → new messages for me, then marks them read
#        bash scripts/inbox.sh --all    → last 20 messages from everyone (catch-up after a restart)
#        bash scripts/inbox.sh --wait   → fetch every 60 s until something arrives (max 15 min)
source "$(dirname "$0")/board.sh"
ME="$(me)"
[ "$ME" != "?" ] || { echo "No agent identity. Run: bash scripts/setup-agent.sh A|B|C"; exit 1; }
SEEN="$GIT_DIR/nova-inbox-seen"
touch "$SEEN"

read_board() {
  git fetch -q origin "$BRANCH" 2>/dev/null || echo "⚠️  git fetch failed (offline?) — showing last fetched state" >&2
  for X in A B C HUMAN; do
    git show "origin/$BRANCH:board/$X.md" 2>/dev/null || true
    printf '\n'
  done
}

parse() { # $1 = new|all
  ME="$ME" SEEN="$SEEN" MODE="$1" node -e '
    const fs = require("fs");
    const me = process.env.ME, mode = process.env.MODE;
    const seen = new Set(fs.readFileSync(process.env.SEEN, "utf8").split("\n").filter(Boolean));
    const text = fs.readFileSync(0, "utf8");
    const re = /^### (\S+) · (\S+) · (\S+) · to: (\S+) · sha (\S+)\n([\s\S]*?)(?=^### |^# Board|(?![\s\S]))/gm;
    const msgs = [];
    for (const m of text.matchAll(re)) {
      const [, id, time, type, to, sha, body] = m;
      const from = id.split("-")[0];
      msgs.push({ id, time, type, to, sha, from, body: body.trim() });
    }
    msgs.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
    let picked;
    if (mode === "all") picked = msgs.slice(-20);
    else picked = msgs.filter((m) => m.from !== me && !seen.has(m.id) &&
      (m.to === "ALL" || m.to.split(",").includes(me)));
    for (const m of picked) console.log(`\n──── ${m.id} · ${m.time} · [${m.from} → ${m.to}] ${m.type} · sha ${m.sha}\n${m.body}`);
    if (mode !== "all") fs.appendFileSync(process.env.SEEN, picked.map((m) => m.id + "\n").join(""));
    console.error(picked.length ? `\n(${picked.length} message(s))` : "(no new messages)");
    process.exit(picked.length ? 0 : 3);
  '
}

behind() {
  local n; n="$(git rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo 0)"
  [ "$n" -gt 0 ] && echo "ℹ️  origin/$BRANCH is $n commit(s) ahead of you → git pull --rebase --autostash" >&2 || true
}

case "${1:-}" in
  --all) read_board | parse all || true; behind ;;
  --wait)
    for _ in $(seq 1 15); do
      if read_board | parse new; then behind; exit 0; fi
      sleep 60
    done
    echo "(waited 15 min, nothing new — keep working on your own queue)" ;;
  *) read_board | parse new || true; behind ;;
esac
