import { NextRequest, NextResponse } from "next/server";
import { clearResponses, getResponses, submitResponse } from "@/lib/db";

export async function GET() {
  const list = await getResponses();
  return NextResponse.json({ success: true, list });
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "Text is required" },
        { status: 400 },
      );
    }
    const ok = await submitResponse(text);
    return NextResponse.json({ success: ok });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const adminPassword = request.headers.get("x-admin-password");
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aerocano2025";

  if (adminPassword !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const ok = await clearResponses();
  return NextResponse.json({ success: ok });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
