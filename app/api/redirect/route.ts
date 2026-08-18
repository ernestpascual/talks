import { NextRequest, NextResponse } from "next/server";
import { getRedirect, getRedirectItem, getAllRedirects, setRedirect, deleteRedirect } from "@/lib/db";

export async function GET(request: NextRequest) {
  const all = request.nextUrl.searchParams.get("all");
  if (all === "1" || all === "true") {
    const redirects = await getAllRedirects();
    return NextResponse.json({ success: true, redirects });
  }

  const slug = request.nextUrl.searchParams.get("slug") || "live";
  const item = await getRedirectItem(slug);
  const url = item?.url || await getRedirect(slug);
  return NextResponse.json({ success: true, url, redirect: item });
}

export async function POST(request: NextRequest) {
  try {
    const password = request.headers.get("x-admin-password");
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aerocano2025";

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { slug, url, title } = await request.json();
    if (!slug || !url) {
      return NextResponse.json(
        { success: false, error: "Slug and URL are required" },
        { status: 400 },
      );
    }

    const ok = await setRedirect(slug, url, title);
    return NextResponse.json({ success: ok });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const password = request.headers.get("x-admin-password");
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aerocano2025";

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Slug is required" },
        { status: 400 },
      );
    }

    const ok = await deleteRedirect(slug);
    return NextResponse.json({ success: ok });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
