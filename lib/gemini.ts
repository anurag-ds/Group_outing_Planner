// Minimal Gemini REST client (generateContent). Set GEMINI_MODEL if the default alias stops working.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
const RETRY_STATUS = [429, 500, 503]; // busy or rate limited: worth one quick retry

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
        return data?.candidates?.[0]?.content ?? { role: "model", parts: [] };
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
