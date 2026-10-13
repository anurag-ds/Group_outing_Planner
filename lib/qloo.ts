import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BASE_URL = process.env.QLOO_API_URL ?? "https://hackathon.api.qloo.com";
// Private server-side cache, kept outside the repo. Never commit Qloo response data.
const CACHE_DIR = process.env.QLOO_CACHE_DIR ?? path.join(os.tmpdir(), "qloo-cache");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const HINTS: Record<number, string> = {
  400: "Bad parameters, or the city (locality) was not found.",
  401: "Check X-Api-Key and that QLOO_API_URL is https://hackathon.api.qloo.com.",
  403: "Unsupported entity type. Use urn:entity:place, artist, movie, etc.",
  404: "Endpoint path is missing or wrong.",
};

export class QlooError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

export interface RawEntity {
  entity_id?: string;
  id?: string;
  name?: string;
  query?: { affinity?: number; explainability?: unknown };
}

/** GET with X-Api-Key header, timeout, and a 24h file cache. */
export async function qlooGet(endpoint: string, params: Params = {}): Promise<any> {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new Error("QLOO_API_KEY is not set");

  const url = new URL(endpoint, BASE_URL);
  for (const [k, v] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const cacheFile = path.join(
    CACHE_DIR,
    createHash("sha1").update(url.toString()).digest("hex") + ".json",
  );
  try {
    const hit = JSON.parse(await readFile(cacheFile, "utf8"));
    if (Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  } catch {
    /* cache miss */
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, { headers: { "X-Api-Key": key }, signal: ctrl.signal });
    if (!res.ok) {
      throw new QlooError(res.status, `Qloo ${res.status} on ${endpoint}. ${HINTS[res.status] ?? ""}`.trim());
    }
    const data = await res.json();
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheFile, JSON.stringify({ ts: Date.now(), data })).catch(() => {});
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Verified on a real response: results[] with entity_id, name, popularity, disambiguation. */
export async function searchEntity(
  name: string,
): Promise<{ id: string; name: string; note?: string } | null> {
  const data = await qlooGet("/search", { query: name });
  const list = data?.results ?? data?.entities ?? [];
  const hit = Array.isArray(list) ? list[0] : undefined;
  const id = hit?.entity_id ?? hit?.id;
  if (!id) return null;
  const note = typeof hit?.disambiguation === "string" ? hit.disambiguation : undefined;
  return { id: String(id), name: String(hit?.name ?? name), note };
}

/** Verified: entities at results.entities, score at query.affinity, explainability at query.explainability. */
export async function insights(params: Params): Promise<RawEntity[]> {
  const data = await qlooGet("/v2/insights", params);
  return data?.results?.entities ?? data?.entities ?? [];
}

export const entityId = (e: RawEntity) => String(e.entity_id ?? e.id ?? "");
export const affinityOf = (e: RawEntity) => e.query?.affinity ?? 0;
