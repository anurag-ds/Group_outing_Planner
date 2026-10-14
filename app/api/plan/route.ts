import { NextResponse } from "next/server";
import { isOutingKey } from "../../../lib/outings";
import { mockPlan } from "../../../lib/mock";
import { runPlan } from "../../../lib/plan";
import { QlooError } from "../../../lib/qloo";
import type { PlanRequest } from "../../../lib/types";

function parse(body: any): PlanRequest | null {
  if (!body || typeof body.city !== "string" || !body.city.trim()) return null;
  if (!Array.isArray(body.friends) || body.friends.length < 2 || body.friends.length > 6) return null;
  const friends = body.friends.map((f: any, i: number) => ({
    id: String(f?.id ?? `f${i}`).slice(0, 40),
    name: String(f?.name ?? `Friend ${i + 1}`).slice(0, 40),
    favorites: Array.isArray(f?.favorites)
      ? f.favorites.map((x: unknown) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 5)
      : [],
  }));
  if (friends.some((f: { favorites: string[] }) => f.favorites.length === 0)) return null;
  const price = Number(body.priceMax);
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 200) : "";
  return {
    city: body.city.trim().slice(0, 80),
    friends,
    priceMax: price >= 1 && price <= 4 ? price : undefined,
    outing: isOutingKey(body.outing) ? body.outing : "any",
    notes: notes || undefined,
    compare: body.compare === true,
  };
}

// Simple per-instance rate limit so a public demo cannot burn the Qloo and Gemini quotas.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 12;
}

export async function POST(request: Request) {
  const req = parse(await request.json().catch(() => null));
  if (!req) {
    return NextResponse.json(
      { error: "Add a city and 2 to 6 friends, each with at least one favourite." },
      { status: 400 },
    );
  }
  if (!process.env.QLOO_API_KEY) return NextResponse.json(mockPlan(req));

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) {
    return NextResponse.json({ error: "Too many requests. Please wait a few minutes and try again." }, { status: 429 });
  }
  try {
    return NextResponse.json(await runPlan(req));
  } catch (err) {
    console.error("plan failed", err);
    if (err instanceof QlooError && err.status === 429) {
      return NextResponse.json(
        { error: "Qloo is busy right now. Please wait a minute and try again." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Planning failed" }, { status: 502 });
  }
}
