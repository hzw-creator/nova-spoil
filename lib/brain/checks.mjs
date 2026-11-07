// Run with Node 22.15+: node lib/brain/checks.mjs (uses the installed TypeScript compiler).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    const url = specifier.startsWith("@/") ? new URL(specifier.slice(2), root)
      : specifier.startsWith(".") && context.parentURL?.endsWith(".ts") ? new URL(specifier, context.parentURL) : null;
    if (url) {
      for (const suffix of ["", ".ts", "/index.ts"]) {
        const candidate = new URL(url.href + suffix);
        if (candidate.pathname.endsWith(".ts") && existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith(".ts")) return next(url, context);
    return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});

const { checkFoodSafety, checkPrice, checkRecipe, quoteSpecial } = await import("./index.ts");
for (const value of [NaN, Infinity, 0, 1, 2.5, 6, "2", undefined])
  assert.equal(checkFoodSafety(value).blocked, true, `freshness ${value} must block`);
assert.equal(checkFoodSafety(2).blocked, false);
const price = { price: 3.99, originalPrice: 6, discountPct: 34 };
assert.equal(checkPrice(price, 2).blocked, false);
for (const bad of [{ ...price, price: NaN }, { ...price, originalPrice: Infinity },
  { ...price, discountPct: -1 }, { ...price, discountPct: 0 },
  { price: 3.96, originalPrice: 10, discountPct: 60 }])
  assert.equal(checkPrice(bad, 1).blocked, true);
assert.equal(checkPrice(price, NaN).blocked, true);
assert.equal(checkPrice({ price: 3.49, originalPrice: 6, discountPct: 42 }, 2.4).blocked, true);
const recipe = { id: "r", basePrice: 6, ingredients: [{ ingredientId: "banana", qty: 1 }] };
assert.equal(checkRecipe("r", "avocado", [recipe]).blocked, true);
assert.equal(checkRecipe("r", "banana", [{ ...recipe, ingredients: [{ ingredientId: "banana", qty: NaN }] }]).blocked, true);
const hero = { id: "banana", unitCost: 2.4 };
const quote = quoteSpecial(recipe, hero, { projectedWasteQty: 12, minDaysLeft: 0.5 }, 2, [hero]);
assert.ok(quote.price >= quote.ingredientCost * 1.5, "rounding must preserve the cost floor");
assert.equal(checkPrice({ ...quote, originalPrice: 6 }, quote.ingredientCost).blocked, false);
const { validatePricingSettings } = await import("./index.ts");
for (const settings of [null, {}, { minGrossMarginPct: "40", maxDiscountPct: 60 },
  { minGrossMarginPct: 34, maxDiscountPct: 60 }, { minGrossMarginPct: 81, maxDiscountPct: 60 },
  { minGrossMarginPct: 40, maxDiscountPct: NaN }, { minGrossMarginPct: 40, maxDiscountPct: 61 }])
  assert.throws(() => validatePricingSettings(settings));
const noDiscount = { minGrossMarginPct: 40, maxDiscountPct: 0 };
const fullPrice = quoteSpecial(recipe, hero, { projectedWasteQty: 12, minDaysLeft: 0.5 }, 2, [hero], noDiscount);
assert.equal(fullPrice.price, 6);
assert.equal(fullPrice.discountPct, 0);
assert.equal(checkPrice({ ...fullPrice, originalPrice: 6 }, 2.4, noDiscount).blocked, false);
assert.equal(checkPrice(price, 2, noDiscount).blocked, true, "publication must reject a quote outside the requested discount cap");
const margin = { minGrossMarginPct: 70, maxDiscountPct: 60 };
const costly = quoteSpecial(recipe, hero, { projectedWasteQty: 12, minDaysLeft: 0.5 }, 2, [hero], margin);
assert.equal(checkPrice({ ...costly, originalPrice: 6 }, costly.ingredientCost, margin).blocked, true, "infeasible margin must not create an above-list offer");
const fractionalList = { ...recipe, basePrice: 6.2 };
assert.equal(quoteSpecial(fractionalList, hero, { projectedWasteQty: 12, minDaysLeft: 0.5 }, 2, [hero], noDiscount).price, 6.2,
  "rounding may use exact list price rather than exceed it");
console.log("PASS: exported guards reject malformed input, discounts agree, and pricing preserves the cost floor.");

const { normalizeVisionOutput, mentionsSpoilage } = await import("./vision.ts");
const { validateImageInput, validateScan } = await import("./validation.ts");
const catalog = [{ id: "banana", unit: "each" }, { id: "egg", unit: "dozen" }];
const raw = { label: "spotty bananas", ingredientId: "banana", count: 6, freshness: 2, daysLeft: 1,
  confidence: 0.9, countUnit: "each", quantityAmbiguous: false, visibleSpoilage: false, notes: "No visible mold." };
const normalize = (item) => normalizeVisionOutput({ items: [item] }, catalog)[0];
assert.equal(normalize(raw).freshness, 2);
assert.equal(normalize({ ...raw, notes: "Visible mold near stem." }).freshness, 1);
assert.equal(normalize({ ...raw, visibleSpoilage: true }).daysLeft, 0);
for (const bad of [{ ...raw, count: NaN }, { ...raw, freshness: "2" }, { ...raw, countUnit: "bunch" },
  { ...raw, count: 0.5 }, { ...raw, quantityAmbiguous: true }])
  assert.equal(normalize(bad).ingredientId, null, "ambiguous observations cannot mutate known inventory");
assert.equal(normalize({ ...raw, ingredientId: "egg", count: 0.5, countUnit: "dozen" }).count, 0.5);
assert.equal(normalize({ ...raw, count: 0 }).ingredientId, "banana", "explicit zero remains a valid clear");
assert.equal(normalize({ ...raw, box: { x: 0.9, y: 0.1, w: 0.5, h: 0.3 } }).box, undefined);
assert.ok(normalizeVisionOutput({ items: [raw, raw] }, catalog).every((i) => i.ingredientId === null));
assert.throws(() => normalizeVisionOutput({ items: "bad" }, catalog));
assert.equal(mentionsSpoilage("No mold; brown peel spots."), false);
assert.equal(mentionsSpoilage("Rotting avocado"), true);
for (const bad of [null, {}, 123, "https://example.com/photo.jpg", "data:image/jpeg;base64,abc"])
  assert.throws(() => validateImageInput(bad));
assert.equal(validateImageInput("mock"), "mock");
assert.throws(() => validateScan({ items: [] }, catalog));
console.log("PASS: mold blocks, invalid/ambiguous quantities stay unknown, boxes are bounded, malformed requests fail closed.");

const { decideOffline, planActions, scanImage } = await import("./index.ts");
const { resetWorld, applyScan, forecastWaste, runReplay } = await import("@/lib/world");
const { MOCK_SCAN } = await import("@/shared/fixtures");
resetWorld();
const seeded = structuredClone(applyScan(MOCK_SCAN));
const forecasts = forecastWaste(seeded);
{
  const key = process.env.OPENROUTER_API_KEY;
  const fetch = globalThis.fetch;
  delete process.env.OPENROUTER_API_KEY;
  globalThis.fetch = async () => { throw new Error("No-key scan must never contact a model"); };
  try {
    const image = `data:image/jpeg;base64,${readFileSync(new URL("./samples/overripe-banana.jpg", import.meta.url)).toString("base64")}`;
    const fixture = await scanImage(image, seeded.ingredients);
    assert.equal(fixture.mock, true, "real image with no key must be labeled fixture observations");
    assert.deepEqual(fixture.items, MOCK_SCAN.items);
    const plan = await planActions(fixture, seeded, forecasts);
    assert.ok(plan.trace[0].detail.includes("camera image is not analyzed"));
    fixture.items[0].count = 9999;
    assert.deepEqual((await scanImage(image, seeded.ingredients)).items, MOCK_SCAN.items, "fixture responses cannot share mutable observations");
  } finally {
    globalThis.fetch = fetch;
    if (key === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = key;
  }
}
console.log("PASS: a real image without a key returns isolated, explicitly labeled fixture data and makes no network call.");
const original = JSON.stringify(seeded);
const offline = decideOffline(seeded, forecasts, MOCK_SCAN);
assert.deepEqual(offline, decideOffline(seeded, forecasts, MOCK_SCAN));
assert.equal(JSON.stringify(seeded), original, "offline policy cannot mutate its caller");
assert.ok(offline.some((d) => d.ingredientId === "avocado" && d.action === "DISCARD" && d.safety.blocked));
assert.ok(decideOffline(seeded, forecasts).some((d) => d.ingredientId === "avocado" && d.action === "DISCARD"), "unsafe inventory blocks even without a scan");
for (const decision of offline) assert.equal(decision.projectedWasteUsdAfter, decision.projectedWasteUsdBefore, "offers and prep recommendations cannot claim sales");
const shared = structuredClone(seeded);
shared.inventory = [
  { id: "b", ingredientId: "banana", qty: 2, freshness: 2, daysLeft: 1 },
  { id: "s", ingredientId: "strawberry", qty: 2, freshness: 2, daysLeft: 1 },
  { id: "l", ingredientId: "bread", qty: 1, freshness: 4, daysLeft: 2 },
];
shared.recipes = [
  { id: "banana-bread-test", name: "Banana bake", basePrice: 10, onMenu: false, ingredients: [{ ingredientId: "banana", qty: 1 }, { ingredientId: "bread", qty: 0.25 }] },
  { id: "berry-test", name: "Berry bake", basePrice: 10, onMenu: false, ingredients: [{ ingredientId: "strawberry", qty: 0.5 }, { ingredientId: "bread", qty: 0.25 }] },
];
const sharedForecasts = [
  { ingredientId: "banana", projectedWasteQty: 2, projectedWasteUsd: 10, minDaysLeft: 1, normalDailyUsage: 0 },
  { ingredientId: "strawberry", projectedWasteQty: 2, projectedWasteUsd: 5, minDaysLeft: 1, normalDailyUsage: 0 },
  { ingredientId: "bread", projectedWasteQty: 0, projectedWasteUsd: 0, minDaysLeft: 2, normalDailyUsage: 0.5 },
];
const budgeted = decideOffline(shared, sharedForecasts);
const breadUsed = budgeted.filter((d) => d.special).reduce((sum, d) => sum + d.special.unitsAvailable * 0.25, 0);
assert.ok(breadUsed > 0 && breadUsed <= 0.5, "all proposals share one stock budget and preserve normal-menu reserve");
const withoutDemand = decideOffline(shared, sharedForecasts.map(({ normalDailyUsage, ...f }) => f));
assert.ok(withoutDemand.filter((d) => d.special).reduce((sum, d) => sum + d.special.unitsAvailable * 0.25, 0) <= 1,
  "missing demand disables reservation but never disables shared stock caps");
console.log("PASS: offline policy is pure/repeatable, blocks unsafe stock, shares portions and reserves menu stock.");
const impossibleWorld = structuredClone(shared);
impossibleWorld.inventory = [{ id: "big", ingredientId: "banana", qty: 20, freshness: 2, daysLeft: 1 }];
impossibleWorld.recipes = [{ id: "costly", name: "Costly banana dish", basePrice: 6, onMenu: false,
  ingredients: [{ ingredientId: "banana", qty: 10 }] }];
const expensivePlan = await planActions({ ...MOCK_SCAN, items: [] }, impossibleWorld, [sharedForecasts[0]], { minGrossMarginPct: 80, maxDiscountPct: 60 });
assert.ok(!expensivePlan.decisions.some((d) => d.special), "infeasible requested margin produces no above-list offer");
assert.ok(expensivePlan.trace.some((s) => s.kind === "guardrail" && s.label.includes("80%")));
assert.ok(decideOffline(impossibleWorld, [sharedForecasts[0]]).some((d) => d.special), "legacy offline replay still uses its original settings");

const savedFetch = globalThis.fetch;
const savedKey = process.env.OPENROUTER_API_KEY;
process.env.OPENROUTER_API_KEY = "test-only-placeholder";
const liveScan = { ...MOCK_SCAN, mock: false };
try {
  let attempted = 0;
  globalThis.fetch = async (_url, options) => {
    attempted++;
    const request = JSON.parse(options.body);
    const candidates = JSON.parse(request.messages[1].content);
    const choices = candidates.map((hero) => ({ ingredientId: hero.ingredientId, recipeId: hero.candidates[0].recipeId,
      name: hero.candidates[0].name, description: `Today's special, made with ripe ${hero.ingredientId}.` }));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ choices }) } }] });
  };
  const livePlan = await planActions(liveScan, seeded, forecasts);
  assert.equal(livePlan.mock, false);
  assert.ok(livePlan.trace.some((s) => s.kind === "llm"));
  assert.equal(attempted, 1, "batch model selection uses one bounded call");
  const mockPlan = await planActions(MOCK_SCAN, seeded, forecasts);
  assert.equal(mockPlan.mock, true);
  assert.equal(attempted, 1, "mock scan must not call the live text model even with a key");
  const unknownPlan = await planActions({ ...MOCK_SCAN, items: [{ label: "apple", ingredientId: null, count: 1,
    freshness: 4, daysLeft: 3, confidence: 0.9 }] }, seeded, forecasts);
  assert.ok(unknownPlan.trace.some((s) => s.kind === "vision" && s.label.includes("Ignored: apple")));
  assert.ok(!unknownPlan.decisions.some((d) => d.ingredientId === "apple"), "unknown observations never acquire inventory/recipe authority");
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({ choices: [
    { ingredientId: "banana", recipeId: "invented", name: "Bad", description: "Made with ripe banana.", price: 0.01 },
  ] }) } }] });
  const invalid = await planActions(liveScan, seeded, forecasts);
  assert.equal(invalid.mock, true);
  assert.deepEqual(invalid.decisions.map((d) => d.special?.price), mockPlan.decisions.map((d) => d.special?.price));
  globalThis.fetch = async () => { throw new Error("Simulated provider failure"); };
  const failed = await planActions(liveScan, seeded, forecasts);
  assert.equal(failed.mock, true);
  assert.deepEqual(failed.decisions.map((d) => d.special?.recipeId), mockPlan.decisions.map((d) => d.special?.recipeId));
  const inputImage = `data:image/jpeg;base64,${readFileSync(new URL("./samples/overripe-banana.jpg", import.meta.url)).toString("base64")}`;
  await assert.rejects(() => scanImage(inputImage, seeded.ingredients), /Simulated provider failure/,
    "failed live vision must reject, never return fixture stock");
  globalThis.fetch = async () => new Response("private provider diagnostic", { status: 503 });
  await assert.rejects(() => scanImage(inputImage, seeded.ingredients), { message: "OpenRouter request failed (HTTP 503)." },
    "provider bodies cannot escape through the public error path");
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '{"items":"malformed"}' } }] });
  await assert.rejects(() => scanImage(inputImage, seeded.ingredients), (error) => error.status === 502,
    "invalid live observations fail closed rather than becoming a mock scan");
} finally {
  globalThis.fetch = savedFetch;
  if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = savedKey;
}
console.log("PASS: model selection falls back safely; unknowns are ignored; vision failures reject without fixtures or provider diagnostics.");
if (process.argv.includes("--replay")) {
  const replay = runReplay();
  console.log(JSON.stringify({ policy: replay.policy, provenance: replay.provenance, wasteReductionPct: replay.wasteReductionPct,
    marginDeltaPts: replay.marginDeltaPts, totals: replay.totals, assumptions: replay.assumptions }, null, 2));
}
