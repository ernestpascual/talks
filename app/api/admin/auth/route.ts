import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aerocano2025";

    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Password required" }, { status: 400 });
    }

    if (password.trim() !== ADMIN_PASSWORD.trim()) {
      return NextResponse.json({ success: false, error: "Incorrect password" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
}
