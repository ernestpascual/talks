import { NextRequest, NextResponse } from "next/server";
import { getRedirect, setRedirect } from "@/lib/db";
import { ADMIN_PASSWORD } from "@/lib/admin-config";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") || "live";
  const url = await getRedirect(slug);
  return NextResponse.json({ success: true, url });
}

export async function POST(request: NextRequest) {
  try {
    const password = request.headers.get("x-admin-password");
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { slug, url } = await request.json();
    if (!slug || !url) {
      return NextResponse.json(
        { success: false, error: "Slug and URL are required" },
        { status: 400 },
      );
    }

    const ok = await setRedirect(slug, url);
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
