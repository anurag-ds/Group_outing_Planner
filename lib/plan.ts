import { mergeScores } from "./merge";
import { affinityOf, entityId, insights, searchEntity } from "./qloo";
import type { Candidate, PlanRequest, PlanResponse } from "./types";

const unique = <T,>(xs: T[]) => [...new Set(xs)];

export async function runPlan(req: PlanRequest): Promise<PlanResponse> {
  const warnings: string[] = [];

  // 1. Resolve every favourite name to a Qloo entity ID.
  const ids: Record<string, string[]> = {};
  await Promise.all(
    req.friends.flatMap((f) =>
      f.favorites.map(async (fav) => {
        const hit = await searchEntity(fav);
        if (hit) (ids[f.id] ??= []).push(hit.id);
        else warnings.push(`${f.name}: "${fav}" was not found in Qloo.`);
      }),
    ),
  );
  const active = req.friends.filter((f) => ids[f.id]?.length);
  if (active.length < 2) throw new Error("Need at least two friends with a favourite Qloo recognises.");

  const where = {
    "filter.type": "urn:entity:place",
    "filter.location.query": req.city,
    "filter.price_level.max": req.priceMax,
    take: 50,
  };

  // 2. Candidate pool: places that fit the whole group's taste.
  const pool = await insights({
    ...where,
    "signal.interests.entities": unique(active.flatMap((f) => ids[f.id])).join(","),
  });
  if (pool.length === 0) {
    warnings.push("Qloo returned no places for this city. Try another city or a larger one.");
    return { mode: "live", ranked: [], warnings };
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
      c.scores[f.id] = hit ? affinityOf(hit) : 0;
      if (hit?.query?.explainability) c.why![f.id] = hit.query.explainability;
    });
    return c;
  });

  // 4. Merge into one fair ranking.
  const ranked = mergeScores(candidates, active.map((f) => f.id)).slice(0, 3);
  return { mode: "live", ranked, warnings };
}
