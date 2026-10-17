import type { OutingKey } from "./types";

// Tag IDs come from real /v2/tags and /v2/insights responses (genre tags are the canonical ones).
// Qloo's restaurant tag is a broad parent that also covers cafes, bakeries and ice cream shops,
// so some outings also exclude sub-types that are not a meal or a drink.
const SWEETS_AND_BAKES = [
  "urn:tag:genre:place:restaurant:ice_cream_shop",
  "urn:tag:genre:place:restaurant:bakery",
  "urn:tag:genre:place:restaurant:bagel_shop",
  "urn:tag:genre:place:restaurant:dessert",
  "urn:tag:genre:place:restaurant:dessert_shop",
];

export const OUTINGS: Record<OutingKey, { label: string; tag?: string; exclude?: string[] }> = {
  any: { label: "Anything" },
  dinner: {
    label: "Dinner",
    tag: "urn:tag:genre:place:restaurant",
    exclude: [...SWEETS_AND_BAKES, "urn:tag:genre:place:restaurant:coffee", "urn:tag:genre:place:restaurant:cafe"],
  },
  cafe: { label: "Cafe", tag: "urn:tag:genre:place:restaurant:cafe" },
  drinks: { label: "Drinks", tag: "urn:tag:genre:place:restaurant:bar", exclude: SWEETS_AND_BAKES },
  museum: { label: "Museum", tag: "urn:tag:genre:place:museum" },
  park: { label: "Park or outdoors", tag: "urn:tag:genre:place:park" },
};

export const isOutingKey = (x: unknown): x is OutingKey => typeof x === "string" && x in OUTINGS;
