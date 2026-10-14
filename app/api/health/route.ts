import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Reports whether the env vars look usable. It never returns a key or any part of one.
const check = (v: string | undefined) => ({
  set: Boolean(v && v.trim()),
  hasQuotesOrSpaces: Boolean(v && (/^["']|["']$/.test(v) || /\s/.test(v))),
  looksLikeAssignment: Boolean(v && v.includes("=")),
});

export async function GET() {
  const url = process.env.QLOO_API_URL ?? "https://hackathon.api.qloo.com";
  let host = "invalid";
  try {
    host = new URL(url).host;
  } catch {
    /* keep "invalid" */
  }
  return NextResponse.json({
    deployment: process.env.VERCEL_ENV ?? "local",
    qloo: { key: check(process.env.QLOO_API_KEY), urlHost: host, urlIsHackathon: host === "hackathon.api.qloo.com" },
    gemini: { key: check(process.env.GEMINI_API_KEY), model: process.env.GEMINI_MODEL ?? "gemini-flash-latest" },
  });
}
