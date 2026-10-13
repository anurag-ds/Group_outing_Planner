import type { Candidate, Ranked } from "./types";

export interface MergeOptions {
  /** Weight on the group average. 1 = average only, 0 = worst-off friend only. */
  alpha?: number;
  /**
   * "center" (default): subtract each friend's own average affinity over the candidates, then add
   * the overall average back. Qloo affinities differ in level between friends (one friend's
   * favourites may score 0.9 everywhere and another's 0.8), so without this the friend with the
   * lower level decides every ranking. "none" uses raw affinities.
   */
  baseline?: "center" | "none";
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Merge per-friend affinity scores into one ranking.
 * combined = alpha * mean + (1 - alpha) * min, over the (adjusted) per-friend scores.
 * The min term stops a place that two friends love and one hates from winning.
 * A friend with no score for a candidate gets that friend's lowest known score.
 */
export function mergeScores(
  candidates: Candidate[],
  friendIds: string[],
  { alpha = 0.5, baseline = "center" }: MergeOptions = {},
): Ranked[] {
  if (friendIds.length === 0 || candidates.length === 0) return [];

  const raw: Record<string, number[]> = {};
  for (const f of friendIds) {
    const known = candidates.map((c) => c.scores[f]).filter((v): v is number => typeof v === "number");
    const floor = known.length ? Math.min(...known) : 0;
    raw[f] = candidates.map((c) => c.scores[f] ?? floor);
  }

  const means = friendIds.map((f) => avg(raw[f]));
  const grand = avg(means);
  const adj: Record<string, number[]> = {};
  friendIds.forEach((f, k) => {
    adj[f] = baseline === "center" ? raw[f].map((v) => v - means[k] + grand) : raw[f];
  });

  return candidates
    .map((c, i) => {
      const perFriend: Record<string, number> = {};
      const rawOut: Record<string, number> = {};
      for (const f of friendIds) {
        perFriend[f] = adj[f][i];
        rawOut[f] = raw[f][i];
      }
      const vals = Object.values(perFriend);
      const mean = avg(vals);
      const min = Math.min(...vals);
      return {
        id: c.id,
        name: c.name,
        combined: alpha * mean + (1 - alpha) * min,
        mean,
        min,
        perFriend,
        raw: rawOut,
        why: c.why,
        tags: c.tags,
      };
    })
    .sort((a, b) => b.combined - a.combined || b.min - a.min || a.name.localeCompare(b.name));
}
