import { NextRequest, NextResponse } from "next/server";
import { getResponses, submitResponse } from "@/lib/db";

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
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
