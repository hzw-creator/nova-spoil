// lib/world/dev-sim.mjs — demo sanity run. Owner: Agent B. Usage (dev server running): node lib/world/dev-sim.mjs [ticks=36] [baseUrl]
// reset → run(mock) → N × 10-min ticks (1 tick = 1 real second at demo speed); prints decisions, stock, counters, pacing.
const BASE = process.argv[3] ?? "http://localhost:3000";
const post = (p, b) => fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b ?? {}) }).then((r) => r.json());
const ticks = Number(process.argv[2] ?? 12);

await post("/api/world/reset");
const r = await post("/api/brain/run", { imageDataUrl: "mock" });
const fmtD = (d) => `${d.ingredientId}:${d.action}${d.special ? ` units=${d.special.unitsAvailable} $${d.special.price} -${d.special.discountPct}%` : ""}${d.safety?.blocked ? " BLOCKED" : ""}`;
console.log("decisions:", r.plan.decisions.map(fmtD).join(" | "));
const w0 = r.world;
console.log("specials:", w0.specials.map((s) => `${s.name} units=${s.unitsAvailable} ${s.status}`).join(" | "));
console.log("inventory:", w0.inventory.map((l) => `${l.id}=${l.qty}@f${l.freshness}/${l.daysLeft}d`).join(" "));
console.log("events:\n  " + w0.events.slice(0, 5).map((e) => e.message).join("\n  "));
console.log("metrics:", JSON.stringify(w0.metrics));

let firstSpecialOrderTick = null;
for (let i = 1; i <= ticks; i++) {
  const w = await post("/api/world/tick", { minutes: 10 });
  const sold = w.specials.reduce((s, x) => s + x.unitsSold, 0);
  if (firstSpecialOrderTick === null && sold > 0) firstSpecialOrderTick = i;
  if (i % 6 === 0 || i === ticks)
    console.log(`t+${i * 10}min ${w.simTime.slice(11, 16)} orders=${w.metrics.ordersTotal} fromSpecials=${w.metrics.ordersFromSpecials} discarded=$${w.metrics.wasteUsdDiscarded.toFixed(2)} atRiskUsed=$${w.metrics.wasteUsdAvoided.toFixed(2)} specialSales=$${w.metrics.revenueRecoveredUsd.toFixed(2)} projWaste=$${w.metrics.projectedWasteUsd} | ${w.specials.map((s) => `${s.name} ${s.unitsSold}/${s.unitsAvailable} ${s.status}`).join(", ")} | negLots=${w.inventory.filter((l) => l.qty < 0).length} unavailable=[${w.menu.filter((m) => !m.available).map((m) => m.name).join(",")}]`);
}
console.log("first special order at tick (1 tick = 1 real s in demo):", firstSpecialOrderTick);
