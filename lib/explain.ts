import { generate, parseJson, textOf } from "./gemini";
import type { LlmOnlyPick, PlanRequest, Ranked } from "./types";
import { OUTINGS } from "./outings";

const EXPLAIN_SYSTEM = `You write short explanations for a friend-group outing picker.
Use ONLY the facts in the JSON. One sentence per place, at most 28 words: why it fits the group and who has the lowest match percent.
Do not mention addresses, prices, menus, opening hours, or anything not in the data.
Reply with a JSON object that maps each place id to its sentence.`;

/** One-sentence explanations built only from Qloo data (match %, tags, explainability). */
export async function explainPicks(ranked: Ranked[], names: Record<string, string>): Promise<Record<string, string>> {
  const facts = ranked.map((p) => {
    const weakest = Object.entries(p.raw).sort((a, b) => a[1] - b[1])[0]?.[0];
    return {
      id: p.id,
      place: p.name,
      tags: p.tags ?? [],
      lowest_match: weakest ? names[weakest] : null,
      friends: Object.entries(p.raw).map(([id, v]) => ({
        name: names[id],
        qloo_match_percent: Math.round(v * 100),
        because_of: (p.why?.[id] ?? []).slice(0, 2).map((w) => w.name),
      })),
    };
  });
  const reply = await generate({
    system: EXPLAIN_SYSTEM,
    contents: [{ role: "user", parts: [{ text: JSON.stringify(facts) }] }],
    json: true,
  });
  const parsed = parseJson<Record<string, unknown>>(textOf(reply)) ?? {};
  const out: Record<string, string> = {};
  for (const p of ranked) {
    const s = parsed[p.id];
    if (typeof s === "string" && s.trim()) out[p.id] = s.trim().slice(0, 240);
  }
  return out;
}

/** The comparison: the same request answered by an LLM with no Qloo data. */
export async function llmOnlyPicks(req: PlanRequest): Promise<LlmOnlyPick[]> {
  const outing = OUTINGS[req.outing ?? "any"].label.toLowerCase();
  const group = req.friends.map((f) => `${f.name}: ${f.favorites.join(", ")}`).join("; ");
  const reply = await generate({
    system: `Suggest 3 specific places for a friend group. Reply with a JSON array of {"name": string, "why": string}, "why" under 25 words.`,
    contents: [
      {
        role: "user",
        parts: [{ text: `City: ${req.city}. Outing: ${outing}. Wishes: ${req.notes || "none"}. Group favourites - ${group}` }],
      },
    ],
    json: true,
  });
  const parsed = parseJson<unknown>(textOf(reply));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((x: any) => typeof x?.name === "string")
    .slice(0, 3)
    .map((x: any) => ({ name: String(x.name).slice(0, 80), why: String(x.why ?? "").slice(0, 200) }));
}

/** Fallback summary built only from Qloo data, used when no AI is available. */
export function templateExplanation(p: Ranked, names: Record<string, string>): string {
  const sorted = Object.entries(p.raw).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return "";
  const [topId, topV] = sorted[0];
  const [lowId, lowV] = sorted[sorted.length - 1];
  const nm = (id: string) => names[id] ?? id;
  const kind = (p.tags ?? []).slice(0, 3).join(", ");
  return `${kind ? `${kind}. ` : ""}Best match for ${nm(topId)} (${Math.round(topV * 100)}), lowest for ${nm(lowId)} (${Math.round(lowV * 100)}).`;
}
