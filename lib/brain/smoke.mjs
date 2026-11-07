// End-to-end checks against a running LOCAL demo; resets its synthetic world.
import assert from "node:assert/strict";
const base = process.argv[2] || "http://localhost:3000";
const url = new URL(base);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Smoke checks only run against a local demo.");
const request = async (path, body, raw = false) => {
  const response = await fetch(new URL(path, base), body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: raw ? body : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};
assert.equal((await fetch(new URL("/stage", base))).status, 200);
await request("/api/world/reset", {});
const before = (await request("/api/world/state")).body;
for (const [path, payload, raw] of [
  ["/api/brain/run", "{", true], ["/api/brain/run", { imageDataUrl: 123 }],
  ["/api/brain/run", { imageDataUrl: null }],
  ["/api/brain/run", { imageDataUrl: "mock", pricing: null }],
  ["/api/brain/run", { imageDataUrl: "mock", pricing: { minGrossMarginPct: 100, maxDiscountPct: 60 } }],
  ["/api/brain/run", { imageDataUrl: "mock", pricing: { minGrossMarginPct: 40, maxDiscountPct: "20" } }],
  ["/api/brain/scan", null], ["/api/brain/scan", { imageDataUrl: "https://example.com/a.jpg" }],
  ["/api/brain/plan", { scan: { items: [] } }],
]) {
  const result = await request(path, payload, raw);
  assert.equal(result.status, 400, path);
  assert.equal(typeof result.body.error, "string");
}
assert.deepEqual((await request("/api/world/state")).body, before, "invalid requests must not mutate stock or publish fixtures");
const scan = await request("/api/brain/scan", { imageDataUrl: "mock" });
assert.equal(scan.status, 200);
assert.equal(scan.body.mock, true);
const preview = await request("/api/brain/plan", { scan: scan.body });
assert.equal(preview.status, 200);
assert.deepEqual((await request("/api/world/state")).body, before, "preview is read-only against current world");
const run = await request("/api/brain/run", { imageDataUrl: "mock" });
assert.equal(run.status, 200);
assert.equal(run.body.plan.mock, true);
assert.ok(run.body.plan.decisions.some((d) => d.ingredientId === "avocado" && d.action === "DISCARD" && d.safety.blocked));
assert.ok(!run.body.world.specials.some((s) => s.heroIngredientId === "avocado"));
for (const step of run.body.plan.trace.filter((s) => s.kind === "publish"))
  assert.ok(run.body.world.specials.some((s) => s.status === "live" && step.label.includes(s.name)));
assert.equal(run.body.world.metrics.revenueRecoveredUsd, 0, "publishing is not a sale");
assert.equal(run.body.world.metrics.wasteUsdAvoided, 0, "publishing uses no at-risk stock");
const tick = await request("/api/world/tick", { minutes: 60 });
assert.equal(tick.status, 200);
assert.ok(tick.body.inventory.every((lot) => lot.qty >= 0));
await request("/api/world/reset", {});
const constrained = await request("/api/brain/run", { imageDataUrl: "mock", pricing: { minGrossMarginPct: 40, maxDiscountPct: 0 } });
assert.equal(constrained.status, 200);
assert.ok(constrained.body.world.specials.length > 0);
for (const special of constrained.body.world.specials) {
  assert.equal(special.price, special.originalPrice, "0% max discount must publish at catalog list price");
  assert.equal(special.discountPct, 0);
  const recipe = constrained.body.world.recipes.find((r) => r.id === special.recipeId);
  const cost = recipe.ingredients.reduce((sum, line) => sum + line.qty * constrained.body.world.ingredients.find((i) => i.id === line.ingredientId).unitCost, 0);
  assert.ok((1 - cost / special.price) * 100 >= 40 - 1e-9);
}
assert.ok(constrained.body.plan.trace.some((s) => s.detail?.includes("Tracked cost")));
console.log(JSON.stringify({ stage: 200, invalidRequests: "400 + no mutation", preview: "read-only", run: run.status,
  mock: run.body.plan.mock, blocked: "avocado", publicationTrace: "confirmed against returned world", tick: tick.status,
  specials: run.body.world.specials.map((s) => ({ name: s.name, price: s.price, units: s.unitsAvailable })),
  requestedPricing: "40% margin / 0% discount enforced server-side" }, null, 2));
