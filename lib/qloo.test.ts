import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

process.env.QLOO_API_KEY = "test-key";
process.env.QLOO_CACHE_DIR = mkdtempSync(path.join(os.tmpdir(), "qloo-test-"));
process.env.QLOO_RETRY_MS = "1";

const reply = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("qlooGet", () => {
  it("retries a 429 and then succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(429)).mockResolvedValueOnce(reply(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { qlooGet } = await import("./qloo");
    await expect(qlooGet("/search", { query: "retry-case" })).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after repeated 429s with a QlooError", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => reply(429));
    vi.stubGlobal("fetch", fetchMock);
    const { qlooGet, QlooError } = await import("./qloo");
    await expect(qlooGet("/search", { query: "giveup-case" })).rejects.toBeInstanceOf(QlooError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 401", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => reply(401));
    vi.stubGlobal("fetch", fetchMock);
    const { qlooGet } = await import("./qloo");
    await expect(qlooGet("/search", { query: "auth-case" })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
