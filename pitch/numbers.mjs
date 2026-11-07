#!/usr/bin/env node
// Regenerates the replay section of pitch/NUMBERS.md from the running app. Owner: Agent B.
// Usage (dev server running): node pitch/numbers.mjs [baseUrl]   → prints markdown to stdout
const base = process.argv[2] ?? "http://localhost:3000";
const r = await fetch(`${base}/api/world/replay`).then((x) => x.json());
if (r.error) { console.error(r.error); process.exit(1); }

const $ = (n) => `$${n.toFixed(2)}`;
const out = [];
out.push(`_Provenance: **${r.provenance ?? "unverified"}** · policy: ${r.policy ?? "?"} · generated ${new Date().toISOString().slice(0, 16)}Z_`, "");
out.push("| Day | Waste (no agent) | Waste (agent) | Revenue (no agent) | Revenue (agent) | Margin* (no agent) | Margin* (agent) |");
out.push("|---|---:|---:|---:|---:|---:|---:|");
for (const d of r.days)
  out.push(`| ${d.label} | ${$(d.baseline.wasteUsd)} | ${$(d.withAgent.wasteUsd)} | ${$(d.baseline.revenueUsd)} | ${$(d.withAgent.revenueUsd)} | ${d.baseline.marginPct}% | ${d.withAgent.marginPct}% |`);
const b = r.totals.baseline, a = r.totals.withAgent;
out.push(`| **7 days** | **${$(b.wasteUsd)}** | **${$(a.wasteUsd)}** | **${$(b.revenueUsd)}** | **${$(a.revenueUsd)}** | **${b.marginPct}%** | **${a.marginPct}%** |`, "");
out.push(`**Waste reduction: ${r.wasteReductionPct}%** · **Margin change: ${r.marginDeltaPts > 0 ? "+" : ""}${r.marginDeltaPts} pts** · Revenue change: ${$(a.revenueUsd - b.revenueUsd)}`, "");
out.push("\\* Tracked-ingredient gross margin, not restaurant net margin.", "", "**Assumptions (shown on the slide):**");
for (const s of r.assumptions) out.push(`- ${s}`);
console.log(out.join("\n"));
