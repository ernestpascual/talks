import { NextRequest, NextResponse } from "next/server";
import { get, ref, serverTimestamp, update } from "firebase/database";

import { realtimeDatabase } from "@/lib/firebase";
import { SUBSTRATE_TUNING_PATH } from "@/lib/substrate-blob";

export async function GET() {
  const tuningRef = ref(realtimeDatabase, SUBSTRATE_TUNING_PATH);
  const snapshot = await get(tuningRef);
  if (!snapshot.exists()) {
    await update(tuningRef, { visible: false, updatedAt: serverTimestamp() });
  }
  const value = snapshot.val() as { visible?: unknown } | null;
  const visible = value?.visible === true;
  return NextResponse.json({ success: true, visible });
}

export async function POST(request: NextRequest) {
  try {
    const adminPassword = request.headers.get("x-admin-password");
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aerocano2025";

    if (adminPassword && adminPassword !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (typeof body.visible !== "boolean") {
      return NextResponse.json(
        { success: false, error: "visible boolean is required" },
        { status: 400 }
      );
    }

    await update(ref(realtimeDatabase, SUBSTRATE_TUNING_PATH), {
      visible: body.visible,
      updatedAt: serverTimestamp(),
    });
    return NextResponse.json({ success: true, visible: body.visible });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
