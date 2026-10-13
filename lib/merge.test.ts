import { describe, expect, it } from "vitest";
import { mergeScores } from "./merge";
import type { Candidate } from "./types";

const c = (id: string, scores: Record<string, number>): Candidate => ({ id, name: id, scores });
const friends = ["a", "b", "c"];
const polarising = c("polarising", { a: 1, b: 1, c: 0.1 }); // mean 0.7, min 0.1
const fair = c("fair", { a: 0.6, b: 0.6, c: 0.6 }); // mean 0.6, min 0.6

describe("mergeScores", () => {
  it("prefers a place everyone is fine with over one that one friend dislikes", () => {
    const out = mergeScores([polarising, fair], friends, { baseline: "none" });
    expect(out[0].id).toBe("fair");
  });

  it("with alpha=1 it ranks by the group average only", () => {
    const out = mergeScores([polarising, fair], friends, { alpha: 1, baseline: "none" });
    expect(out[0].id).toBe("polarising");
  });

  it("centering stops the friend with lower affinities from deciding everything", () => {
    // a's scores sit around 0.9, b's around 0.8 (like real Qloo output)
    const cands = [c("x", { a: 0.95, b: 0.8 }), c("y", { a: 0.9, b: 0.84 })];
    expect(mergeScores(cands, ["a", "b"], { baseline: "none" })[0].id).toBe("y");
    expect(mergeScores(cands, ["a", "b"], { baseline: "center" })[0].id).toBe("x");
  });

  it("keeps raw affinities in the output", () => {
    const out = mergeScores([c("x", { a: 0.9, b: 0.8 })], ["a", "b"]);
    expect(out[0].raw).toEqual({ a: 0.9, b: 0.8 });
  });

  it("gives a missing score that friend's lowest known score", () => {
    const out = mergeScores([c("x", {}), c("y", { b: 0.5 }), c("z", { b: 0.7 })], ["b"], {
      baseline: "none",
    });
    expect(out.find((r) => r.id === "x")!.raw.b).toBe(0.5);
  });

  it("does not produce NaN when all scores are equal", () => {
    const out = mergeScores([c("x", { a: 0.4, b: 0.4 }), c("y", { a: 0.4, b: 0.4 })], ["a", "b"]);
    expect(out.every((r) => Number.isFinite(r.combined))).toBe(true);
    expect(out[0].combined).toBeCloseTo(0.4);
  });

  it("returns an empty list for empty input", () => {
    expect(mergeScores([], friends)).toEqual([]);
    expect(mergeScores([fair], [])).toEqual([]);
  });
});
