#!/usr/bin/env bash
# Shared helpers for the git-based board (board/A.md, board/B.md, board/C.md, board/HUMAN.md).
# Each writer appends ONLY to its own file, so the board never has merge conflicts.
# Sourced by post.sh and inbox.sh.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
GIT_DIR="$(git rev-parse --git-dir)"
BRANCH="${NOVA_BRANCH:-main}"

me() {
  if [ "${NOVA_HUMAN:-0}" = "1" ]; then echo HUMAN; return; fi
  tr -d '[:space:]' < "$GIT_DIR/nova-agent" 2>/dev/null || echo "?"
}

login_of() { node -e "const o=require('$ROOT/ownership.json');console.log(o.agents['$1']?.github ?? '')"; }

# push with retries: someone else may push between our pull and our push
push_with_retry() {
  for i in 1 2 3 4 5; do
    git pull -q --rebase --autostash origin "$BRANCH" && git push -q origin "HEAD:$BRANCH" && return 0
    echo "push attempt $i failed, retrying…" >&2
    sleep $((i * 2))
  done
  echo "❌ could not push. Run: git status; git pull --rebase --autostash; git push" >&2
  return 1
}
