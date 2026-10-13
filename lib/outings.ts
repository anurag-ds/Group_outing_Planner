import type { OutingKey } from "./types";

// Tag IDs come from real /v2/tags and /v2/insights responses (genre tags are the canonical ones).
export const OUTINGS: Record<OutingKey, { label: string; tag?: string }> = {
  any: { label: "Anything" },
  dinner: { label: "Dinner", tag: "urn:tag:genre:place:restaurant" },
  cafe: { label: "Cafe", tag: "urn:tag:genre:place:restaurant:cafe" },
  drinks: { label: "Drinks", tag: "urn:tag:genre:place:restaurant:bar" },
  museum: { label: "Museum", tag: "urn:tag:genre:place:museum" },
  park: { label: "Park or outdoors", tag: "urn:tag:genre:place:park" },
};

export const isOutingKey = (x: unknown): x is OutingKey => typeof x === "string" && x in OUTINGS;
