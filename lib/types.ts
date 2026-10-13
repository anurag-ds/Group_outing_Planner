export type OutingKey = "any" | "dinner" | "cafe" | "drinks" | "museum" | "park";

export interface Friend {
  id: string;
  name: string;
  favorites: string[]; // plain names: artists, movies, restaurants, brands
}

export interface PlanRequest {
  city: string;
  friends: Friend[];
  priceMax?: number; // Qloo price level 1-4
  outing?: OutingKey; // narrows places with a Qloo genre tag
  notes?: string; // free-text wishes, interpreted by the agent
  compare?: boolean; // also ask an LLM with no Qloo data, for side-by-side comparison
}

/** Which of a friend's favourites pushed a place up, from Qloo explainability. */
export interface Why {
  name: string;
  score: number;
}

/** One place with each friend's raw Qloo affinity (0..1). */
export interface Candidate {
  id: string;
  name: string;
  scores: Record<string, number>;
  why?: Record<string, Why[]>;
  tags?: string[];
}

export interface Ranked {
  id: string;
  name: string;
  combined: number; // on the affinity scale, used for ranking
  mean: number;
  min: number;
  perFriend: Record<string, number>; // affinity adjusted for each friend's own baseline
  raw: Record<string, number>; // Qloo affinity as returned
  why?: Record<string, Why[]>;
  tags?: string[];
  explanation?: string;
}

/** How a typed favourite was understood by Qloo. */
export interface Resolved {
  friend: string;
  input: string;
  matched: string | null;
  note?: string;
}

export interface AgentTrace {
  trace: string[];
  include: string[];
  exclude: string[];
}

export interface LlmOnlyPick {
  name: string;
  why: string;
}

export interface PlanResponse {
  mode: "live" | "mock";
  ranked: Ranked[];
  warnings: string[];
  resolved?: Resolved[];
  agent?: AgentTrace;
  llmOnly?: LlmOnlyPick[];
}
