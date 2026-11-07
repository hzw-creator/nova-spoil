#!/usr/bin/env node
/**
 * Ownership guard. Two modes:
 *   node scripts/check-ownership.mjs --staged            (pre-commit: checks staged files for this machine's agent)
 *   node scripts/check-ownership.mjs --agent B f1 f2 …   (manual check)
 *   node scripts/check-ownership.mjs --ci                (GitHub Actions: checks every pushed commit)
 * Agent identity: .git/nova-agent (written by scripts/setup-agent.sh) or $NOVA_AGENT.
 * Humans can bypass locally with NOVA_HUMAN=1 (or git commit --no-verify).
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync, appendFileSync } from "node:fs";

const own = JSON.parse(readFileSync(new URL("../ownership.json", import.meta.url), "utf8"));

export function ownerOf(file) {
  for (const [id, a] of Object.entries(own.agents)) if (a.paths.some((p) => match(p, file))) return id;
  if (own.human.some((p) => match(p, file))) return "HUMAN";
  return "UNOWNED";
}
const match = (p, f) => (p.endsWith("/") ? f.startsWith(p) : f === p);

function violations(agent, files) {
  return files
    .map((f) => ({ f, owner: ownerOf(f) }))
    .filter(({ owner }) => owner !== agent)
    .map(({ f, owner }) => `  ${f}  (owner: ${owner === "UNOWNED" ? "nobody — ask on the board which agent should own it" : owner})`);
}

function whoAmI() {
  if (process.env.NOVA_AGENT) return process.env.NOVA_AGENT.toUpperCase();
  const p = execSync("git rev-parse --git-dir").toString().trim() + "/nova-agent";
  return existsSync(p) ? readFileSync(p, "utf8").trim().toUpperCase() : null;
}

const args = process.argv.slice(2);

if (args[0] === "--staged") {
  if (process.env.NOVA_HUMAN === "1") process.exit(0);
  const agent = whoAmI();
  if (!agent) {
    console.error("✋ No agent identity. Run: bash scripts/setup-agent.sh A|B|C   (humans: NOVA_HUMAN=1 git commit …)");
    process.exit(1);
  }
  const files = execSync("git diff --cached --name-only --diff-filter=ACMRD").toString().split("\n").filter(Boolean);
  const bad = violations(agent, files);
  if (bad.length) {
    console.error(`✋ Agent ${agent} may not commit these files:\n${bad.join("\n")}\n` +
      `Unstage them (git restore --staged <file> && git checkout -- <file>) and ask the owner on the board: bash scripts/post.sh NEED <owner>`);
    process.exit(1);
  }
  process.exit(0);
}

if (args[0] === "--agent") {
  const bad = violations(args[1].toUpperCase(), args.slice(2));
  console.log(bad.length ? `✋ violations:\n${bad.join("\n")}` : "✅ all files owned by agent " + args[1]);
  process.exit(bad.length ? 1 : 0);
}

if (args[0] === "--ci") {
  const ev = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const byLogin = Object.fromEntries(Object.entries(own.agents).map(([id, a]) => [a.github.toLowerCase(), id]));
  const report = [];
  for (const c of ev.commits ?? []) {
    const trailer = /^Agent:\s*([ABC])\s*$/im.exec(c.message ?? "")?.[1];
    const login = (c.author?.username ?? "").toLowerCase();
    if (/^Human:\s*yes/im.test(c.message ?? "")) continue; // humans may touch anything
    const agent = trailer ?? byLogin[login];
    if (!agent) { report.push(`- ${c.id.slice(0, 7)} has no "Agent: X" trailer and unknown author "${login}"`); continue; }
    const files = [...(c.added ?? []), ...(c.modified ?? []), ...(c.removed ?? [])];
    const bad = violations(agent, files);
    if (bad.length) report.push(`- ${c.id.slice(0, 7)} (Agent ${agent}) touched files it does not own:\n${bad.join("\n")}`);
  }
  if (report.length) {
    const text = `Ownership guard found problems:\n${report.join("\n")}`;
    console.error(text);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `report<<EOF\n${text}\nEOF\n`);
    process.exit(1);
  }
  console.log("✅ every pushed commit stayed in its owner's folders");
  process.exit(0);
}

console.error("usage: --staged | --agent X files… | --ci");
process.exit(2);
