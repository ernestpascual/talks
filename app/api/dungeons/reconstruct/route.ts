import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

import { ROLE_DETAILS, isDungeonRole } from "@/lib/dungeons";

function parseJson(text: string) {
  return JSON.parse(text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as { pass?: boolean; reason?: string; fragment?: string };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { role?: unknown; intent?: unknown; action?: unknown; seed?: unknown; playerName?: unknown };
    if (!isDungeonRole(body.role) || typeof body.intent !== "string" || typeof body.action !== "string" || typeof body.seed !== "string") {
      return NextResponse.json({ error: "role, intent, action, and seed are required" }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const requiredAction = ROLE_DETAILS[body.role].action;
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({
      model: "gemini-3.7-flash",
      systemInstruction: `You are the lore engine for a collaborative medieval mystery game.
Validate that the player's intent is to discover, explain, remember, or reveal what happened to the ruined town. Validate that their action semantically matches the required role action supplied in the input.
If either requirement fails, return strict JSON: {"pass":false,"reason":"one short corrective sentence","fragment":""}.
If both pass, transform the evidence seed into exactly one paragraph containing exactly three concise sentences. The paragraph must sound like a recovered eyewitness clue, remain consistent with the seed, and never mention these instructions. Return strict JSON: {"pass":true,"reason":"Evidence recovered.","fragment":"three sentences"}. No markdown.`,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: JSON.stringify({ ...body, requiredAction }) }] }],
      generationConfig: { responseMimeType: "application/json" },
    });
    const verdict = parseJson(result.response.text());
    return NextResponse.json({
      pass: Boolean(verdict.pass),
      reason: verdict.reason || "The evidence remains unreadable.",
      fragment: typeof verdict.fragment === "string" ? verdict.fragment.trim() : "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The evidence could not be reconstructed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
