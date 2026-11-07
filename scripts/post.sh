#!/usr/bin/env bash
# Post a message to the board: appends to board/<ME>.md, commits ONLY that file, pushes.
# Usage:
#   bash scripts/post.sh <TYPE> <TO> <<'EOF'
#   message body (markdown)
#   EOF
#   TYPE: HELLO | DONE | NEXT | NEED | BLOCKED | CONTRACT | ACK | FYI
#   TO:   A, B, C, HUMAN, a combo like "B,C", or ALL
# Your other uncommitted work is left untouched (autostash).
source "$(dirname "$0")/board.sh"
TYPE="$(echo "${1:?TYPE required}" | tr '[:lower:]' '[:upper:]')"
TO="$(echo "${2:?TO required}" | tr '[:lower:]' '[:upper:]' | tr -d ' ')"
BODY="$(cat)"
[ -n "$BODY" ] || { echo "empty body (pass it on stdin)"; exit 1; }
FROM="$(me)"
[ "$FROM" != "?" ] || { echo "No agent identity. Run: bash scripts/setup-agent.sh A|B|C"; exit 1; }
FILE="board/$FROM.md"

# start from the latest remote state of our own file
git pull -q --rebase --autostash origin "$BRANCH" || true

N="$(grep -c '^### ' "$ROOT/$FILE" || true)"
ID="$(printf '%s-%03d' "$FROM" $((N + 1)))"
if [ "$TO" = "ALL" ]; then TARGETS="A B C"; else TARGETS="$(echo "$TO" | tr ',' ' ')"; fi
MENTIONS=""
for t in $TARGETS; do
  [ "$t" = "$FROM" ] && continue
  L="$(login_of "$t")"; [ -n "$L" ] && MENTIONS="$MENTIONS @$L"
done
SHA="$(git rev-parse --short HEAD)"
STAMP="$(date '+%H:%M')"

printf '\n### %s · %s · %s · to: %s · sha %s\n%s\n\n%s\n' "$ID" "$STAMP" "$TYPE" "$TO" "$SHA" "${MENTIONS# }" "$BODY" >> "$ROOT/$FILE"
git add "$ROOT/$FILE"
git commit -q --only "$ROOT/$FILE" -m "$FROM: board $ID $TYPE → $TO"
push_with_retry && echo "posted $ID [$FROM → $TO] $TYPE"
