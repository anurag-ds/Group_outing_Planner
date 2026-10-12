export interface Friend {
  id: string;
  name: string;
  favorites: string[]; // plain names: artists, movies, restaurants, brands
}

export interface PlanRequest {
  city: string;
  friends: Friend[];
  priceMax?: number; // Qloo price level 1-4
}

/** One place with each friend's raw affinity score (0..1). */
export interface Candidate {
  id: string;
  name: string;
  scores: Record<string, number>;
  why?: Record<string, unknown>; // per-friend explainability from Qloo
}

export interface Ranked {
  id: string;
  name: string;
  combined: number;
  mean: number;
  min: number;
  perFriend: Record<string, number>; // scaled 0..1
  why?: Record<string, unknown>;
}

export interface PlanResponse {
  mode: "live" | "mock";
  ranked: Ranked[];
  warnings: string[];
}
