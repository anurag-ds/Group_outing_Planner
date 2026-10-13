import { describe, expect, it } from "vitest";
import { interpretNotes, keepSeen, type TagRef } from "./agent";
import type { Content } from "./gemini";

const quiet: TagRef = { id: "urn:tag:ambience:qloo:quiet", name: "Quiet" };
const call = (name: string, args: Record<string, unknown>): Content => ({
  role: "model",
  parts: [{ functionCall: { name, args } }],
});

describe("keepSeen", () => {
  it("drops IDs that were never returned by a tag lookup", () => {
    const seen = new Map([[quiet.id, quiet]]);
    expect(keepSeen([quiet.id, "urn:tag:made:up"], seen)).toEqual([quiet]);
    expect(keepSeen("not an array", seen)).toEqual([]);
  });
});

describe("interpretNotes", () => {
  it("looks up tags, then keeps only the IDs Qloo returned", async () => {
    const replies = [
      call("find_tags", { query: "quiet" }),
      call("finish", { include_tag_ids: [quiet.id, "urn:tag:made:up"], exclude_tag_ids: [] }),
    ];
    let i = 0;
    const out = await interpretNotes("somewhere quiet", {
      generate: async () => replies[i++],
      findTags: async () => [quiet],
    });
    expect(out.include).toEqual([quiet]);
    expect(out.exclude).toEqual([]);
    expect(out.trace[0]).toContain("Quiet");
  });

  it("returns no filters when the model calls no tool", async () => {
    const out = await interpretNotes("anything", {
      generate: async () => ({ role: "model", parts: [{ text: "hello" }] }),
      findTags: async () => [],
    });
    expect(out.include).toEqual([]);
    expect(out.exclude).toEqual([]);
  });

  it("stops after a few steps if the model keeps searching", async () => {
    let calls = 0;
    const out = await interpretNotes("loop", {
      generate: async () => {
        calls++;
        return call("find_tags", { query: "x" });
      },
      findTags: async () => [],
    });
    expect(calls).toBeLessThanOrEqual(4);
    expect(out.include).toEqual([]);
  });
});
