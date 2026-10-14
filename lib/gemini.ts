import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Minimal Gemini REST client (generateContent). Set GEMINI_MODEL if the default alias stops working.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
const RETRY_STATUS = [500, 503]; // Google is busy: worth one quick retry (429 is a daily quota, so no retry)
const CACHE_DIR = process.env.GEMINI_CACHE_DIR ?? path.join(os.tmpdir(), "gemini-cache");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface Part {
  text?: string;
  functionCall?: { name: string; args?: Record<string, any> };
  functionResponse?: { name: string; response: unknown };
  [k: string]: unknown; // keep unknown fields (e.g. thought signatures) when replaying history
}
export interface Content {
  role: "user" | "model";
  parts: Part[];
}
export interface GenerateArgs {
  system?: string;
  contents: Content[];
  tools?: unknown[]; // when set, the model must call one of the declared functions
  json?: boolean; // ask for a JSON reply
}

export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

export async function generate({ system, contents, tools, json }: GenerateArgs): Promise<Content> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature: 0.2, ...(json ? { responseMimeType: "application/json" } : {}) },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (tools) {
    body.tools = tools;
    body.toolConfig = { functionCallingConfig: { mode: "ANY" } };
  }

  // Identical requests (for example the example group) are answered from a private server-side cache.
  const cacheFile = path.join(CACHE_DIR, createHash("sha1").update(MODEL + JSON.stringify(body)).digest("hex") + ".json");
  try {
    const hit = JSON.parse(await readFile(cacheFile, "utf8"));
    if (Date.now() - hit.ts < CACHE_TTL_MS) return hit.content as Content;
  } catch {
    /* cache miss */
  }

  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const data = await res.json();
        const content: Content = data?.candidates?.[0]?.content ?? { role: "model", parts: [] };
        if (content.parts.length > 0) {
          await mkdir(CACHE_DIR, { recursive: true });
          await writeFile(cacheFile, JSON.stringify({ ts: Date.now(), content })).catch(() => {});
        }
        return content;
      }
      if (attempt < 1 && RETRY_STATUS.includes(res.status)) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

export const textOf = (c: Content) => c.parts.map((p) => p.text ?? "").join("");

export function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as T;
  } catch {
    return null;
  }
}
