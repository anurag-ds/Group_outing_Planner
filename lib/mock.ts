import { mergeScores } from "./merge";
import type { PlanRequest, PlanResponse } from "./types";

// Fictional, hand-written places so the UI works before the Qloo key arrives.
const PLACES = [
  "Lantern Rooftop Kitchen",
  "The Vinyl Verandah",
  "Saffron & Smoke",
  "Midnight Chai Co.",
  "Paper Plane Bistro",
  "Old Mill Taproom",
  "Green Door Cafe",
  "Coastline Grill",
];

function hash01(s: string) {
  let x = 0;
  for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return (x % 1000) / 1000;
}

export function mockPlan(req: PlanRequest): PlanResponse {
  const candidates = PLACES.map((name) => ({
    id: name,
    name,
    scores: Object.fromEntries(
      req.friends.map((f) => [f.id, 0.2 + 0.8 * hash01(f.id + name + f.favorites.join())]),
    ),
  }));
  return {
    mode: "mock",
    ranked: mergeScores(candidates, req.friends.map((f) => f.id)).slice(0, 3),
    warnings: ["Mock mode: QLOO_API_KEY is not set, so these places and scores are made up."],
  };
}
