import type { Candidate, Ranked } from "./types";

export interface MergeOptions {
  /** Weight on the group average. 1 = average only, 0 = worst-off friend only. */
  alpha?: number;
  /** Rescale each friend's scores to 0..1 so nobody dominates by scoring high everywhere. */
  normalize?: boolean;
}

/**
 * Merge per-friend affinity scores into one ranking.
 * combined = alpha * mean + (1 - alpha) * min
 * The min term stops a place that two friends love and one hates from winning.
 * A friend with no score for a candidate counts as 0 for that candidate.
 */
export function mergeScores(
  candidates: Candidate[],
  friendIds: string[],
  { alpha = 0.5, normalize = true }: MergeOptions = {},
): Ranked[] {
  if (friendIds.length === 0 || candidates.length === 0) return [];

  const scaled: Record<string, number[]> = {};
  for (const f of friendIds) {
    const raw = candidates.map((c) => c.scores[f] ?? 0);
    if (!normalize) {
      scaled[f] = raw;
      continue;
    }
    const lo = Math.min(...raw);
    const hi = Math.max(...raw);
    scaled[f] = raw.map((v) => (hi === lo ? 0.5 : (v - lo) / (hi - lo)));
  }

  return candidates
    .map((c, i) => {
      const perFriend: Record<string, number> = {};
      for (const f of friendIds) perFriend[f] = scaled[f][i];
      const vals = Object.values(perFriend);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const min = Math.min(...vals);
      return {
        id: c.id,
        name: c.name,
        combined: alpha * mean + (1 - alpha) * min,
        mean,
        min,
        perFriend,
        why: c.why,
      };
    })
    .sort((a, b) => b.combined - a.combined || b.min - a.min || a.name.localeCompare(b.name));
}
