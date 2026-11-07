// GET /api/world/demo → fallback demo page (HTML)      Owner: Agent B
// Human-authorized fallback (hzw-creator, 15:35) while C's /stage was not started. Uses only the public HTTP API.
// Reads lib/world/demo.html from disk per request (local single-laptop deployment; not for serverless).
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const html = await readFile(path.join(process.cwd(), "lib/world/demo.html"), "utf8");
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: `demo page unavailable: ${String(e)}` }, { status: 500 });
  }
}
