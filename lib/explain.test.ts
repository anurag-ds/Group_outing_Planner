import { describe, expect, it } from "vitest";
import { templateExplanation } from "./explain";
import type { Ranked } from "./types";

const place = (raw: Record<string, number>, tags: string[] = []): Ranked => ({
  id: "p",
  name: "P",
  combined: 0.8,
  mean: 0.8,
  min: 0.7,
  perFriend: raw,
  raw,
  tags,
});

describe("templateExplanation", () => {
  it("names the best and lowest match using only the data", () => {
    const text = templateExplanation(place({ a: 0.91, b: 0.82 }, ["Cafe", "Quiet"]), { a: "Asha", b: "Ben" });
    expect(text).toBe("Cafe, Quiet. Best match for Asha (91), lowest for Ben (82).");
  });

  it("returns an empty string when there are no scores", () => {
    expect(templateExplanation(place({}), {})).toBe("");
  });
});
