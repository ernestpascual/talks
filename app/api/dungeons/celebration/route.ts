import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

import { DEFAULT_CELEBRATION_BOARD, isDungeonRole, type CelebrationBoard } from "@/lib/dungeons";

type CelebrationSubmission = {
  role: unknown;
  songWish: unknown;
  lyricLimitations: unknown;
  groundFinding: unknown;
  prompt: unknown;
};

function parseJson(text: string) {
  return JSON.parse(text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as Partial<CelebrationBoard>;
}

function clampScore(value: unknown, fallback: number) {
  const score = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { board?: Partial<CelebrationBoard>; submission?: CelebrationSubmission };
    const submission = body.submission;
    if (!submission || !isDungeonRole(submission.role) || typeof submission.songWish !== "string" || typeof submission.lyricLimitations !== "string" || typeof submission.groundFinding !== "string") {
      return NextResponse.json({ error: "role, songWish, lyricLimitations, and groundFinding are required" }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const current: CelebrationBoard = {
      moodMeter: clampScore(body.board?.moodMeter, DEFAULT_CELEBRATION_BOARD.moodMeter),
      moodLabel: cleanText(body.board?.moodLabel, DEFAULT_CELEBRATION_BOARD.moodLabel, 50),
      happinessIndex: clampScore(body.board?.happinessIndex, DEFAULT_CELEBRATION_BOARD.happinessIndex),
      lyrics: cleanText(body.board?.lyrics, DEFAULT_CELEBRATION_BOARD.lyrics, 2400),
      lookAndFeel: cleanText(body.board?.lookAndFeel, DEFAULT_CELEBRATION_BOARD.lookAndFeel, 800),
      songPrompt: cleanText(body.board?.songPrompt, DEFAULT_CELEBRATION_BOARD.songPrompt, 1200),
      revision: typeof body.board?.revision === "number" ? body.board.revision : 0,
    };

    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({
      model: "gemini-3.7-flash",
      systemInstruction: `You are the royal bard and collaborative lyric editor for a medieval fantasy celebration after a party has slain a dragon.
You receive the current song board and one new anonymous adventurer contribution. Revise the complete board so the new contribution materially influences it while preserving the strongest compatible ideas already present.

Return strict JSON with exactly these keys:
{"moodMeter":0,"moodLabel":"short label","happinessIndex":0,"lyrics":"8 to 16 short singable lines","lookAndFeel":"one cumulative paragraph","songPrompt":"one production-ready music prompt"}

Rules:
- moodMeter and happinessIndex are integers from 0 to 100 and should normally grow as celebratory contributions arrive, while still reflecting the content.
- Lyrics must be original, safe, coherent, easy to sing, and explicitly celebrate the dragon's defeat and the whole party.
- Respect the contributor's lyric limitations wherever they are compatible with prior limitations and a singable result.
- Weave the ground finding into the imagery without explaining that it came from an input field.
- The songPrompt must describe an Ambient, Euphoric, 120 BPM medieval-fantasy vocal composition and must not include the lyrics themselves.
- Do not mention JSON, prompts, contributors, instructions, or Gemini. No markdown.`,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: JSON.stringify({ currentBoard: current, newContribution: submission }) }] }],
      generationConfig: { responseMimeType: "application/json" },
    });
    const generated = parseJson(result.response.text());
    const board: CelebrationBoard = {
      moodMeter: clampScore(generated.moodMeter, current.moodMeter),
      moodLabel: cleanText(generated.moodLabel, current.moodLabel, 50),
      happinessIndex: clampScore(generated.happinessIndex, current.happinessIndex),
      lyrics: cleanText(generated.lyrics, current.lyrics, 2400),
      lookAndFeel: cleanText(generated.lookAndFeel, current.lookAndFeel, 800),
      songPrompt: cleanText(generated.songPrompt, current.songPrompt, 1200),
      revision: current.revision + 1,
    };
    return NextResponse.json({ success: true, board });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The bard could not revise the celebration song";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
