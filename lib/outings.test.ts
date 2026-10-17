import { describe, expect, it } from "vitest";
import { OUTINGS, isOutingKey } from "./outings";

describe("OUTINGS", () => {
  it("keeps sweets and bakeries out of dinner but not cafe", () => {
    expect(OUTINGS.dinner.exclude).toContain("urn:tag:genre:place:restaurant:ice_cream_shop");
    expect(OUTINGS.dinner.exclude).toContain("urn:tag:genre:place:restaurant:cafe");
    expect(OUTINGS.cafe.exclude).toBeUndefined();
  });

  it("never excludes the tag an outing asks for", () => {
    for (const o of Object.values(OUTINGS)) {
      if (o.tag) expect(o.exclude ?? []).not.toContain(o.tag);
    }
  });

  it("validates keys", () => {
    expect(isOutingKey("dinner")).toBe(true);
    expect(isOutingKey("brunch")).toBe(false);
  });
});
