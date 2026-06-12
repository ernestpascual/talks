import { NextRequest, NextResponse } from "next/server";
import { getRedirect } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const target = await getRedirect(slug);
  return NextResponse.redirect(new URL(target, request.url));
}
export const dynamic = "force-dynamic";
export const revalidate = 0;
