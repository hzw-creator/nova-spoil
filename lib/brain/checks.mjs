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
console.log("PASS: exported guards reject malformed input, discounts agree, and pricing preserves the cost floor.");
