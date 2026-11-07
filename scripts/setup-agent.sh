#!/usr/bin/env bash
# Usage: bash scripts/setup-agent.sh A|B|C
# Run ONCE per clone, before the agent starts. Sets identity, installs git hooks,
# and writes .claude/settings.local.json that denies Claude Code edits outside the agent's folders.
set -euo pipefail
AGENT="$(echo "${1:-}" | tr '[:lower:]' '[:upper:]')"
case "$AGENT" in A|B|C) ;; *) echo "usage: bash scripts/setup-agent.sh A|B|C"; exit 1;; esac

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
GIT_DIR="$(git rev-parse --git-dir)"

echo "$AGENT" > "$GIT_DIR/nova-agent"
git config core.hooksPath .githooks
chmod +x .githooks/* scripts/*.sh 2>/dev/null || true

# Claude Code: deny Edit/Write to every path this agent does not own.
mkdir -p .claude
AGENT="$AGENT" node -e '
const own = require("./ownership.json");
const me = process.env.AGENT;
const others = [];
for (const [id, a] of Object.entries(own.agents)) if (id !== me) others.push(...a.paths);
others.push(...own.human);
const rule = (p) => p.endsWith("/") ? `./${p}**` : `./${p}`;
const deny = [];
for (const p of others) { deny.push(`Edit(${rule(p)})`); deny.push(`Write(${rule(p)})`); }
// destructive git commands that could clobber teammates
deny.push("Bash(git push --force:*)", "Bash(git push -f:*)", "Bash(git reset --hard origin:*)", "Bash(git rebase -i:*)");
require("fs").writeFileSync(".claude/settings.local.json", JSON.stringify({ permissions: { deny } }, null, 2) + "\n");
console.log(`wrote .claude/settings.local.json (${deny.length} deny rules)`);
'

LOGIN="$(node -e "console.log(require('./ownership.json').agents['$AGENT'].github)")"
echo "✅ This clone is Agent $AGENT (@$LOGIN). Hooks: $(git config core.hooksPath)."
git ls-remote --exit-code origin >/dev/null 2>&1 && echo "✅ can reach origin" || echo "⚠️  cannot reach origin — check: git remote -v, and that your GitHub account has push access"
echo "Next: read CLAUDE.md, then: bash scripts/inbox.sh --all"
