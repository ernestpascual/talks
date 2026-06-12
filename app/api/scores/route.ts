import { NextRequest, NextResponse } from "next/server";
import { submitScore, getScores, clearScores } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const scores = await getScores();
  // Sort by score descending
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  return NextResponse.json({ success: true, scores: sorted });
}

export async function POST(req: NextRequest) {
  try {
    const { name, score } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }
    if (typeof score !== "number" || score < 0) {
      return NextResponse.json({ success: false, error: "Invalid score" }, { status: 400 });
    }
    const ok = await submitScore(name.trim(), score);
    return NextResponse.json({ success: ok });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const adminPassword = req.headers.get("x-admin-password");
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aerocano2025";
  if (adminPassword !== ADMIN_PASSWORD) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const ok = await clearScores();
  return NextResponse.json({ success: ok });
}
