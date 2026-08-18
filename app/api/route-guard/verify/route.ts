import { NextRequest, NextResponse } from "next/server";
import { getAllRouteGuards } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { path, password } = await request.json();

    if (!path || !password) {
      return NextResponse.json(
        { success: false, error: "Path and password are required" },
        { status: 400 }
      );
    }

    const all = await getAllRouteGuards();
    const normalized = path.toLowerCase().replace(/\/$/, "") || "/";

    // Check specific route
    const exactMatch = all.find(
      (r) => r.id !== "all-talks" && r.id !== "all-experiences" &&
        (normalized === r.path || normalized.startsWith(r.path + "/"))
    );

    const masterTalks = all.find((r) => r.id === "all-talks");
    const masterExp = all.find((r) => r.id === "all-experiences");

    const validPasswords: string[] = [];

    if (exactMatch?.password) {
      validPasswords.push(exactMatch.password.trim());
    }
    if (normalized.startsWith("/talks") && masterTalks?.password) {
      validPasswords.push(masterTalks.password.trim());
    }
    if (normalized.startsWith("/experience") && masterExp?.password) {
      validPasswords.push(masterExp.password.trim());
    }

    // Also allow the master ADMIN_PASSWORD to unlock any route
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aerocano2025";
    validPasswords.push(ADMIN_PASSWORD.trim());

    if (validPasswords.includes(password.trim())) {
      return NextResponse.json({
        success: true,
        token: `unlocked_${Date.now()}`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Incorrect password" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
