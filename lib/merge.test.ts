import { describe, expect, it } from "vitest";
import { mergeScores } from "./merge";
import type { Candidate } from "./types";

const c = (id: string, scores: Record<string, number>): Candidate => ({ id, name: id, scores });
const friends = ["a", "b", "c"];
const polarising = c("polarising", { a: 1, b: 1, c: 0.1 }); // mean 0.7, min 0.1
const fair = c("fair", { a: 0.6, b: 0.6, c: 0.6 }); // mean 0.6, min 0.6

describe("mergeScores", () => {
  it("prefers a place everyone is fine with over one that one friend dislikes", () => {
    const out = mergeScores([polarising, fair], friends, { normalize: false });
    expect(out[0].id).toBe("fair");
  });

  it("with alpha=1 it ranks by the group average only", () => {
    const out = mergeScores([polarising, fair], friends, { alpha: 1, normalize: false });
    expect(out[0].id).toBe("polarising");
  });

  it("normalising puts every friend on the same 0..1 scale", () => {
    const out = mergeScores(
      [c("x", { a: 0.9, b: 0.2 }), c("y", { a: 0.8, b: 0.1 })],
      ["a", "b"],
    );
    const x = out.find((r) => r.id === "x")!;
    const y = out.find((r) => r.id === "y")!;
    expect(x.perFriend.a).toBe(1);
    expect(y.perFriend.a).toBe(0);
    expect(x.perFriend.b).toBe(1);
  });

  it("treats a missing score as the lowest possible", () => {
    const out = mergeScores([c("x", { a: 0.8 })], ["a", "b"], { normalize: false });
    expect(out[0].perFriend.b).toBe(0);
  });

  it("does not produce NaN when all scores are equal", () => {
    const out = mergeScores([c("x", { a: 0.4, b: 0.4 }), c("y", { a: 0.4, b: 0.4 })], ["a", "b"]);
    expect(out.every((r) => Number.isFinite(r.combined))).toBe(true);
    expect(out[0].perFriend.a).toBe(0.5);
  });

  it("returns an empty list for empty input", () => {
    expect(mergeScores([], friends)).toEqual([]);
    expect(mergeScores([fair], [])).toEqual([]);
  });
});
