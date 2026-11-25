import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

import { isDungeonRole } from "@/lib/dungeons";

function parseJson(text: string) {
  return JSON.parse(text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as { pass?: boolean; reason?: string };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { assignedRole?: unknown; statedRole?: unknown; intent?: unknown };
    if (!isDungeonRole(body.assignedRole) || typeof body.statedRole !== "string" || typeof body.intent !== "string") {
      return NextResponse.json({ error: "assignedRole, statedRole, and intent are required" }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({
      model: "gemini-3.7-flash",
      systemInstruction: `You are the sentient gate in a medieval prompt game. Judge two requirements only:
1. The player's stated role must semantically match their assigned role (warrior, mage, or archer).
2. Their intent must clearly be an attempt to open, unlock, unseal, breach, lift, or otherwise gain entry through the city gate. Creative role-specific methods are welcome.
Return strict JSON with {"pass": boolean, "reason": string}. Keep reason to one short sentence, addressed to the player. Do not add markdown.`,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: JSON.stringify(body) }] }],
      generationConfig: { responseMimeType: "application/json" },
    });
    const verdict = parseJson(result.response.text());
    return NextResponse.json({ pass: Boolean(verdict.pass), reason: verdict.reason || "The gate has rendered its judgment." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The gate could not judge the prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
