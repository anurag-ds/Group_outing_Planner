import { describe, expect, it } from "vitest";
import { interpretNotes, keepSeen, type TagRef } from "./agent";
import type { Content } from "./gemini";

const quiet: TagRef = { id: "urn:tag:ambience:qloo:quiet", name: "Quiet", type: "urn:tag:ambience:qloo" };
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

describe("keepSeen duplicates", () => {
  it("keeps one tag per name even if the model picked two IDs", () => {
    const other: TagRef = { id: "urn:tag:noise_level:qloo:quiet", name: "Quiet" };
    const seen = new Map([[quiet.id, quiet], [other.id, other]]);
    expect(keepSeen([quiet.id, other.id], seen)).toEqual([quiet]);
  });
});

describe("interpretNotes", () => {
  it("looks up tags, then keeps only the IDs Qloo returned", async () => {
    const replies = [
      call("find_tags", { query: "quiet" }),
      call("finish", { include_tag_ids: [quiet.id, "urn:tag:made:up"], exclude_tag_ids: [] }),
    ];
    let i = 0;
    const out = await interpretNotes("somewhere quiet", "cafe", {
      generate: async () => replies[i++],
      findTags: async () => [quiet],
    });
    expect(out.include).toEqual([quiet]);
    expect(out.exclude).toEqual([]);
    expect(out.trace[0]).toContain("Quiet (ambience)");
  });

  it("tells the model which outing the group chose", async () => {
    let first = "";
    await interpretNotes("vegetarian", "museum", {
      generate: async ({ contents }) => {
        first = contents[0].parts[0].text ?? "";
        return { role: "model", parts: [{ text: "done" }] };
      },
      findTags: async () => [],
    });
    expect(first).toContain("Museum");
  });

  it("returns no filters when the model calls no tool", async () => {
    const out = await interpretNotes("anything", "any", {
      generate: async () => ({ role: "model", parts: [{ text: "hello" }] }),
      findTags: async () => [],
    });
    expect(out.include).toEqual([]);
    expect(out.exclude).toEqual([]);
  });

  it("stops after a few steps if the model keeps searching", async () => {
    let calls = 0;
    const out = await interpretNotes("loop", "any", {
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
