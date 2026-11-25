import { NextResponse } from "next/server";

export async function POST() {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  const now = Date.now();
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
    }),
    cache: "no-store",
  });

  const payload = await response.json() as { name?: string; error?: { message?: string } };
  if (!response.ok || !payload.name) {
    return NextResponse.json({ error: payload.error?.message || "Could not create a Live API token" }, { status: response.status || 500 });
  }

  return NextResponse.json({ token: payload.name, model: "gemini-3.8-live" });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
