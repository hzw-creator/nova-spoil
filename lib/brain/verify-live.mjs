#!/usr/bin/env node
// Resets the LOCAL synthetic world, scans a real file and verifies publication/discard plus sales.
// Does not copy, upload to Git, or print the input photograph. OpenRouter sees it via the existing API.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const args = process.argv.slice(2);
let imagePath, base = "http://localhost:3000", expected = "banana", discard = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base-url") base = args[++i];
  else if (args[i] === "--expect-special") { expected = args[++i]; discard = false; }
  else if (args[i] === "--expect-discard") { expected = args[++i]; discard = true; }
  else if (!imagePath && !args[i].startsWith("--")) imagePath = args[i];
  else throw new Error(`Unknown argument: ${args[i]}`);
}
if (!imagePath || !base || !expected) throw new Error("Usage: node lib/brain/verify-live.mjs photo.jpg [--base-url http://localhost:3001] [--expect-special banana | --expect-discard avocado]");
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname)) throw new Error("Verification resets the world; use a localhost server only.");
const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extname(imagePath).toLowerCase()];
if (!mime) throw new Error("Use JPEG, PNG or WebP; ideally <=1024px.");
const image = await readFile(imagePath);
if (image.length > 5_900_000) throw new Error("Image too large; use a smaller JPEG, PNG or WebP.");
const post = async (path, body) => {
  const response = await fetch(new URL(path, base), { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const json = await response.json();
  assert.equal(response.status, 200, `${path}: ${json.error ?? "unexpected HTTP status"}`);
  return json;
};
await post("/api/world/reset", {});
const result = await post("/api/brain/run", { imageDataUrl: `data:${mime};base64,${image.toString("base64")}` });
assert.equal(result.scan.mock, false, "A fixture response is not live-photo proof; configure the server's OpenRouter key.");
const observed = result.scan.items.find((item) => item.ingredientId === expected && item.count > 0);
assert.ok(observed, `No unambiguous ${expected} observation; review the scan rather than inventing a result.`);
const decision = result.plan.decisions.find((d) => d.ingredientId === expected);
assert.ok(decision, `No action for ${expected}; the photo may not show surplus/overripe stock.`);
let world = result.world;
let offer, tickedMinutes = 0;
if (discard) {
  assert.equal(observed.freshness, 1);
  assert.equal(decision.action, "DISCARD");
  assert.equal(decision.safety?.blocked, true);
  assert.ok(!world.specials.some((s) => s.heroIngredientId === expected && s.status === "live"));
  assert.ok(result.plan.trace.some((step) => step.kind === "guardrail" && step.label.includes("Blocked")));
} else {
  assert.ok(observed.freshness > 1);
  assert.equal(decision.action, "CREATE_SPECIAL", decision.rationale);
  offer = world.specials.find((s) => s.id === decision.special?.id && s.status === "live");
  assert.ok(offer, "Returned world did not confirm this exact proposal id.");
  assert.ok(offer.price > 0 && offer.price <= offer.originalPrice);
  assert.ok(result.plan.trace.some((step) => step.kind === "publish" && step.label.includes(offer.name)));
  const lot = world.inventory.find((l) => l.id === `lot_cam_${expected}`);
  assert.equal(lot?.qty, observed.count, "Camera batch must match the actual observation, not the seed count.");
  while (tickedMinutes < 240 && offer.status === "live") {
    world = await post("/api/world/tick", { minutes: 10 });
    tickedMinutes += 10;
    assert.ok(world.inventory.every((lot) => Number.isFinite(lot.qty) && lot.qty >= 0));
    offer = world.specials.find((s) => s.id === offer.id);
    assert.ok(offer, "Published offer disappeared during playback.");
  }
  assert.ok(offer.unitsSold > 0, "No sale occurred before the verification limit.");
  assert.equal(offer.status, "sold_out", "Offer did not sell out; report this scenario rather than claim success.");
  assert.ok(world.metrics.revenueRecoveredUsd > 0);
}
console.log(JSON.stringify({ proof: "LIVE LOCAL FILE (not necessarily a webcam capture)", model: result.scan.model,
  scanMs: result.scan.latencyMs, runMs: result.plan.latencyMs, scanMock: result.scan.mock, planMock: result.plan.mock,
  observed, action: decision.action, safetyBlocked: decision.safety?.blocked, offer: offer && {
    name: offer.name, recipeId: offer.recipeId, price: offer.price, originalPrice: offer.originalPrice,
    unitsAvailable: offer.unitsAvailable, unitsSold: offer.unitsSold, status: offer.status,
  }, tickedMinutes, metrics: world.metrics }, null, 2));
