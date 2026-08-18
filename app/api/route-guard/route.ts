import { NextRequest, NextResponse } from "next/server";
import { getAllRouteGuards, setRouteGuard, checkRouteAccess } from "@/lib/db";

export async function GET(request: NextRequest) {
  const all = request.nextUrl.searchParams.get("all");
  const path = request.nextUrl.searchParams.get("path");

  if (all === "1" || all === "true") {
    const routes = await getAllRouteGuards();
    return NextResponse.json({ success: true, routes });
  }

  if (path) {
    const access = await checkRouteAccess(path);
    return NextResponse.json({ success: true, access });
  }

  const routes = await getAllRouteGuards();
  return NextResponse.json({ success: true, routes });
}

export async function POST(request: NextRequest) {
  try {
    const adminPassword = request.headers.get("x-admin-password");
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aerocano2025";

    if (adminPassword !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id, status, password, disabledMessage } = await request.json();

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "id and status are required" },
        { status: 400 }
      );
    }

    const ok = await setRouteGuard(id, {
      status,
      password: password !== undefined ? password : "",
      disabledMessage: disabledMessage !== undefined ? disabledMessage : "",
    });

    return NextResponse.json({ success: ok });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
