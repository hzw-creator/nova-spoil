/**
 * lib/brain/openrouter.ts — minimal OpenRouter client (OpenAI-compatible chat API). Owner: Agent A.
 * Server-side only: never import this from a "use client" file (it reads the API key).
 */

export const hasKey = () => Boolean(process.env.OPENROUTER_API_KEY);

export const VISION_MODEL = () => process.env.VISION_MODEL || "google/gemini-2.5-flash";
export const TEXT_MODEL = () => process.env.TEXT_MODEL || "google/gemini-2.5-flash";

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | Part[] };

/**
 * Call a chat model and parse its reply as JSON.
 * Throws on HTTP error, timeout, or unparseable output — callers should catch and fall back.
 */
export async function chatJSON<T>(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Nova Spoil Pricing",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 1200,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    return parseJSONLoose<T>(text);
  } finally {
    clearTimeout(timer);
  }
}

/** Models sometimes wrap JSON in ```json fences or add prose; extract the first {...} block. */
export function parseJSONLoose<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error(`Model did not return JSON: ${cleaned.slice(0, 200)}`);
  }
}
