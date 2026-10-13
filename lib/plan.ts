import { mergeScores } from "./merge";
import { OUTINGS } from "./outings";
import { affinityOf, entityId, insights, searchEntity, type RawEntity } from "./qloo";
import type { Candidate, PlanRequest, PlanResponse, Resolved, Why } from "./types";

const unique = <T,>(xs: T[]) => [...new Set(xs)];

/** Qloo explainability: which input entities contributed, mapped back to the favourite's name. */
function whyOf(e: RawEntity, nameOf: Record<string, string>): Why[] {
  const list = (e.query?.explainability as any)?.["signal.interests.entities"];
  if (!Array.isArray(list)) return [];
  return list
    .map((x: any) => ({ name: nameOf[String(x.entity_id).toLowerCase()] ?? "a favourite", score: Number(x.score) || 0 }))
    .sort((a: Why, b: Why) => b.score - a.score);
}

export async function runPlan(req: PlanRequest): Promise<PlanResponse> {
  const warnings: string[] = [];
  const resolved: Resolved[] = [];

  // 1. Resolve every favourite name to a Qloo entity ID.
  const lookups = await Promise.all(
    req.friends.flatMap((f) => f.favorites.map(async (fav) => ({ f, fav, hit: await searchEntity(fav) }))),
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

  const where = {
    "filter.type": "urn:entity:place",
    "filter.location.query": req.city,
    "filter.price_level.max": req.priceMax,
    "filter.tags": req.outing ? OUTINGS[req.outing].tag : undefined,
    take: 50,
  };

  // 2. Candidate pool: places that fit the whole group's taste.
  const pool = await insights({
    ...where,
    "signal.interests.entities": unique(active.flatMap((f) => ids[f.id])).join(","),
  });
  if (pool.length === 0) {
    warnings.push("Qloo returned no places for this city and outing type. Try another outing type, budget or a larger city.");
    return { mode: "live", ranked: [], warnings, resolved };
  }
  const candidateIds = pool.map(entityId).join(",");

  // 3. Score the same candidates separately for each friend.
  const perFriend = await Promise.all(
    active.map((f) =>
      insights({
        ...where,
        "signal.interests.entities": ids[f.id].join(","),
        "filter.results.entities": candidateIds,
        "feature.explainability": true,
      }),
    ),
  );

  const candidates: Candidate[] = pool.map((p) => {
    const c: Candidate = { id: entityId(p), name: p.name ?? "Unnamed place", scores: {}, why: {} };
    active.forEach((f, i) => {
      const hit = perFriend[i].find((e) => entityId(e) === c.id);
      if (hit) {
        c.scores[f.id] = affinityOf(hit);
        c.why![f.id] = whyOf(hit, nameOf);
      }
    });
    return c;
  });

  // 4. Merge into one fair ranking.
  const ranked = mergeScores(candidates, active.map((f) => f.id)).slice(0, 3);
  return { mode: "live", ranked, warnings, resolved };
}
