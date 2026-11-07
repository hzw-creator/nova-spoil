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
console.log(JSON.stringify({ stage: 200, invalidRequests: "400 + no mutation", preview: "read-only", run: run.status,
  mock: run.body.plan.mock, blocked: "avocado", publicationTrace: "confirmed against returned world", tick: tick.status,
  specials: run.body.world.specials.map((s) => ({ name: s.name, price: s.price, units: s.unitsAvailable })) }, null, 2));
