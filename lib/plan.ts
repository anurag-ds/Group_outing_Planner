import { interpretNotes } from "./agent";
import { explainPicks, llmOnlyPicks, templateExplanation } from "./explain";
import { geminiEnabled } from "./gemini";
import { mergeScores } from "./merge";
import { mapLimit } from "./pool";
import { OUTINGS } from "./outings";
import { affinityOf, entityId, insights, QlooError, searchEntity, type RawEntity } from "./qloo";
import type { AgentTrace, Candidate, PlanRequest, PlanResponse, Resolved, Why } from "./types";

const unique = <T,>(xs: T[]) => [...new Set(xs)];

/** Qloo explainability: which input entities contributed, mapped back to the favourite's name. */
function whyOf(e: RawEntity, nameOf: Record<string, string>): Why[] {
  const list = (e.query?.explainability as any)?.["signal.interests.entities"];
  if (!Array.isArray(list)) return [];
  return list
    .map((x: any) => ({ name: nameOf[String(x.entity_id).toLowerCase()] ?? "a favourite", score: Number(x.score) || 0 }))
    .sort((a: Why, b: Why) => b.score - a.score);
}

const KEEP_TAG = /:(ambience|genre|setting|activity_type|time_of_day_fit|cuisine|dining_option):/;
const tagNames = (e: RawEntity) =>
  unique((e.tags ?? []).filter((t) => t.id && KEEP_TAG.test(t.id)).map((t) => t.name ?? "").filter(Boolean)).slice(0, 6);

export async function runPlan(req: PlanRequest): Promise<PlanResponse> {
  const warnings: string[] = [];
  const resolved: Resolved[] = [];
  const names: Record<string, string> = Object.fromEntries(req.friends.map((f) => [f.id, f.name]));

  let quotaHit = false;
  const noteAI = (err: unknown, what: string) => {
    console.error(`${what} failed`, err);
    if (String((err as Error)?.message ?? err).includes("Gemini 429")) quotaHit = true;
    else warnings.push(`${what} was skipped because the AI step failed.`);
  };

  // 1. Resolve every favourite name to a Qloo entity ID.
  const lookups = await mapLimit(
    req.friends.flatMap((f) => f.favorites.map((fav) => ({ f, fav }))),
    3,
    async ({ f, fav }) => ({ f, fav, hit: await searchEntity(fav) }),
  );
  const ids: Record<string, string[]> = {};
  const nameOf: Record<string, string> = {};
  for (const { f, fav, hit } of lookups) {
    resolved.push({ friend: f.name, input: fav, matched: hit?.name ?? null, note: hit?.note });
    if (hit) {
      (ids[f.id] ??= []).push(hit.id);
      nameOf[hit.id.toLowerCase()] = hit.name;
    } else {
      warnings.push(`${f.name}: "${fav}" was not found in Qloo.`);
    }
  }
  const active = req.friends.filter((f) => ids[f.id]?.length);
  if (active.length < 2) throw new Error("Need at least two friends with a favourite Qloo recognises.");

  // 2. Agent: turn free-text wishes into real Qloo tags (soft preferences and hard exclusions).
  let agent: AgentTrace | undefined;
  let wishParams: Record<string, string | undefined> = {};
  if (req.notes) {
    if (!geminiEnabled()) {
      warnings.push("Your notes were ignored because GEMINI_API_KEY is not set.");
    } else {
      try {
        const a = await interpretNotes(req.notes);
        agent = { trace: a.trace, include: a.include.map((t) => t.name), exclude: a.exclude.map((t) => t.name) };
        wishParams = {
          "signal.interests.tags": a.include.map((t) => t.id).join(",") || undefined,
          "filter.exclude.tags": a.exclude.map((t) => t.id).join(",") || undefined,
        };
      } catch (err) {
        noteAI(err, "Applying your notes");
      }
    }
  }

  const where = {
    "filter.type": "urn:entity:place",
    "filter.location.query": req.city,
    "filter.price_level.max": req.priceMax,
    "filter.tags": req.outing ? OUTINGS[req.outing].tag : undefined,
    take: 50,
  };
  const groupSignal = { "signal.interests.entities": unique(active.flatMap((f) => ids[f.id])).join(",") };

  // 3. Candidate pool: places that fit the whole group's taste (and the wishes, if any).
  let pool: RawEntity[];
  try {
    pool = await insights({ ...where, ...groupSignal, ...wishParams });
  } catch (err) {
    if (!(err instanceof QlooError) || err.status !== 400 || Object.values(wishParams).every((v) => !v)) throw err;
    warnings.push("Qloo rejected the preference filters, so they were not applied.");
    agent = undefined;
    pool = await insights({ ...where, ...groupSignal });
  }
  if (pool.length === 0) {
    warnings.push("Qloo returned no places for this city and outing type. Try another outing type, budget or a larger city.");
    return { mode: "live", ranked: [], warnings, resolved, agent };
  }
  const candidateIds = pool.map(entityId).join(",");

  // 4. Score the same candidates separately for each friend.
  const perFriend = await mapLimit(active, 3, (f) =>
    insights({
      ...where,
      "signal.interests.entities": ids[f.id].join(","),
      "filter.results.entities": candidateIds,
      "feature.explainability": true,
    }),
  );

  const candidates: Candidate[] = pool.map((p) => {
    const c: Candidate = { id: entityId(p), name: p.name ?? "Unnamed place", scores: {}, why: {}, tags: tagNames(p) };
    active.forEach((f, i) => {
      const hit = perFriend[i].find((e) => entityId(e) === c.id);
      if (hit) {
        c.scores[f.id] = affinityOf(hit);
        c.why![f.id] = whyOf(hit, nameOf);
      }
    });
    return c;
  });

  // 5. Merge into one fair ranking.
  const ranked = mergeScores(candidates, active.map((f) => f.id)).slice(0, 3);
  ranked.forEach((r) => (r.explanation = templateExplanation(r, names)));

  // 6. Optional AI extras: explanations from Qloo data only, and the LLM-only comparison.
  let llmOnly: PlanResponse["llmOnly"];
  if (geminiEnabled()) {
    const [explained, other] = await Promise.allSettled([
      explainPicks(ranked, names),
      req.compare ? llmOnlyPicks(req) : Promise.resolve(undefined),
    ]);
    if (explained.status === "fulfilled") ranked.forEach((r) => (r.explanation = explained.value[r.id] ?? r.explanation));
    else noteAI(explained.reason, "Writing AI explanations");
    if (other.status === "fulfilled") llmOnly = other.value;
    else noteAI(other.reason, "Running the LLM-only comparison");
  } else if (req.compare) {
    warnings.push("The comparison needs GEMINI_API_KEY.");
  }

  if (quotaHit) {
    warnings.push(
      "The free Gemini quota is used up for now. Notes and the LLM-only comparison are unavailable, and the summaries below come straight from Qloo data.",
    );
  }
  return { mode: "live", ranked, warnings, resolved, agent, llmOnly };
}
