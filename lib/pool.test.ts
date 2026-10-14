import { describe, expect, it } from "vitest";
import { mapLimit } from "./pool";

describe("mapLimit", () => {
  it("keeps order and never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("handles an empty list", async () => {
    expect(await mapLimit([], 3, async (x) => x)).toEqual([]);
  });
});
