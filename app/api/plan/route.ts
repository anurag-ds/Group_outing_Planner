import { NextResponse } from "next/server";
import { mockPlan } from "../../../lib/mock";
import { runPlan } from "../../../lib/plan";
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
  return {
    city: body.city.trim().slice(0, 80),
    friends,
    priceMax: price >= 1 && price <= 4 ? price : undefined,
  };
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
  try {
    return NextResponse.json(await runPlan(req));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Planning failed" }, { status: 502 });
  }
}
