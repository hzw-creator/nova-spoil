#!/usr/bin/env node
// Local photograph -> existing server. Never reads or prints the OpenRouter key.
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const args = process.argv.slice(2);
const path = args.find((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--base-url");
const baseIndex = args.indexOf("--base-url");
const base = baseIndex >= 0 ? args[baseIndex + 1] : process.env.SPOIL_URL || "http://localhost:3000";
if (!path || !base) {
  console.error("Usage: node lib/brain/dev-scan.mjs photo.jpg [--base-url http://localhost:3001] [--run]");
  process.exit(1);
}
const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extname(path).toLowerCase()];
if (!mime) throw new Error("Use a local JPEG, PNG or WebP photograph (ideally <=1024px).");
const data = await readFile(resolve(path));
if (data.length > 5_900_000) throw new Error("Photo too large; resize it to <=1024px first.");
const mode = args.includes("--run") ? "run" : "scan";
const response = await fetch(new URL(`/api/brain/${mode}`, base), {
  method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000),
  body: JSON.stringify({ imageDataUrl: `data:${mime};base64,${data.toString("base64")}` }),
});
const output = await response.json();
console.log(JSON.stringify(output, null, 2));
if (!response.ok) process.exitCode = 1;
else {
  const scan = mode === "run" ? output.scan : output;
  console.error(`${scan.mock ? "MOCK (not real-photo proof)" : "LIVE MODEL"}: ${scan.model} · ${scan.latencyMs} ms`);
}
