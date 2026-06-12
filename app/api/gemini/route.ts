import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import type { SurveyInsights } from "@/lib/talks/aerocano/survey-insights";

const SYSTEM_PROMPT = `You are the analytical engine for a real-time Bento UI dashboard. Your task is to analyze incoming batches of user answers to the question "Ano gusto mo sa kape?" (How do you like your coffee?) and translate them into structured insights.

Your output must be strictly in JSON format. Do not include any conversational filler, markdown formatting outside of the JSON block, or explanations.

Analyze the provided array of text answers and map them to the following Bento Box insights. ONLY include a widget in your JSON output if the current batch of data provides relevant information for it. If an insight cannot be derived from the current data, omit it from the output.

### AVAILABLE BENTO INSIGHTS & TRIGGERS:

1. "archetype_leaderboard": Categorize each answer and return the tally for each:
   - "The Purist": Black, Americano, no sugar, brewed.
   - "The Alchemist": Complex orders, specific milks, exact pumps.
   - "The Hustler": Espresso, extra shot, "pampagising" (to wake up), strong.
   - "The Comfort Seeker": Sweet, mocha, 3-in-1, creamy, caramel.
   - "The Aesthetician": Dirty matcha, Spanish latte, cold foam, trendy.

2. "hot_vs_iced": Count the mentions of hot vs. iced preferences. (e.g., {"hot": 5, "iced": 12})

3. "purist_vs_mixologist": Count users who want it plain/black vs. those who add elements (milk, sugar, syrup). (e.g., {"plain": 3, "mixed": 10})

4. "sweetness_target": Calculate the general sentiment of sweetness desired on a scale of 0-100% based on keywords (e.g., "no sugar" = 0, "sakto lang" = 50, "matamis" = 100). Return the average.

5. "vibe_check_emoji": Return a single emoji representing the dominant mood of this batch. (🔥 for hustle/strong, 😌 for sweet/relaxing, 💔 for bitter/sad/hugot, 🧊 for chill/iced).

6. "hugot_detector": Boolean (true/false). Set to true if ANY answer contains a dramatic, emotional, or broken-hearted Filipino joke (e.g., "Yung matapang, para ipaglaban ako", "Yung hindi nanlalamig").

7. "tito_tita_energy": A percentage score (0-100) based on the presence of traditional terms (Kapeng Barako, 3-in-1, black and hot, complaining about sweets).

8. "kahit_ano_counter": Count the number of people who express decision fatigue or indifference (e.g., "Kahit ano", "Basta kape", "Kahit ano basta libre").

9. "weirdest_order": Identify the single most unconventional, chaotic, or statistically unique order in the batch. Return the exact quote.

10. "the_why_cloud": Extract an array of the top 5 most common adjectives or reasons used to describe the coffee (e.g., ["pampagising", "comforting", "matapang"]).

### INPUT FORMAT:
You will receive a JSON array of strings.
Example: ["Iced Americano lang", "Yung matapang, tulad ng pagmamahal ko sa kanya", "Matcha espresso oat milk"]

### OUTPUT FORMAT (STRICT JSON):
{
  "archetype_leaderboard": {
    "The Purist": 1,
    "The Alchemist": 1,
    "The Hustler": 0,
    "The Comfort Seeker": 0,
    "The Aesthetician": 0
  },
  "hot_vs_iced": {
    "hot": 0,
    "iced": 1
  },
  "vibe_check_emoji": "💔",
  "hugot_detector": true,
  "weirdest_order": "Matcha espresso oat milk"
}`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(prompt: string, maxRetries = 3) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status =
        typeof error === "object" && error && "status" in error
          ? Number((error as { status?: number }).status)
          : null;
      const shouldRetry =
        status === 429 ||
        status === 503 ||
        message.includes("429") ||
        message.includes("503");

      if (!shouldRetry || attempt === maxRetries - 1) {
        throw error;
      }

      await delay(2 ** attempt * 1000);
    }
  }

  throw new Error("Gemini did not return a response");
}

function parseInsights(text: string): SurveyInsights {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as SurveyInsights;
}

export async function POST(request: NextRequest) {
  try {
    const { answers } = await request.json();

    if (!Array.isArray(answers) || answers.some((answer) => typeof answer !== "string")) {
      return NextResponse.json(
        { error: "answers must be an array of strings" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing in .env" },
        { status: 500 },
      );
    }

    const normalizedAnswers = answers
      .map((answer: string) => answer.trim())
      .filter(Boolean)
      .slice(-100);

    if (normalizedAnswers.length === 0) {
      return NextResponse.json({ insights: {} });
    }

    const prompt = JSON.stringify(normalizedAnswers);
    const result = await generateWithRetry(prompt);
    const text = result.response.text();
    const insights = parseInsights(text);

    return NextResponse.json({ insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An error occurred";
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
