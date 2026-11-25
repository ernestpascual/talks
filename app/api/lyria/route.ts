import { NextRequest, NextResponse } from "next/server";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function findAudioInResponse(obj: any): { data: string; mimeType: string } | null {
  if (!obj || typeof obj !== "object") return null;

  // 1. Direct output_audio convenience property
  if (obj.output_audio?.data && typeof obj.output_audio.data === "string") {
    return {
      data: obj.output_audio.data,
      mimeType: obj.output_audio.mime_type || obj.output_audio.mimeType || "audio/mp3",
    };
  }
  if (obj.outputAudio?.data && typeof obj.outputAudio.data === "string") {
    return {
      data: obj.outputAudio.data,
      mimeType: obj.outputAudio.mimeType || obj.outputAudio.mime_type || "audio/mp3",
    };
  }

  // 2. Audio object with data
  if (obj.audio?.data && typeof obj.audio.data === "string") {
    return {
      data: obj.audio.data,
      mimeType: obj.audio.mime_type || obj.audio.mimeType || "audio/mp3",
    };
  }

  // 3. Audio field directly containing base64 string
  if (typeof obj.audio === "string" && obj.audio.length > 500) {
    return {
      data: obj.audio,
      mimeType: obj.mime_type || obj.mimeType || "audio/mp3",
    };
  }

  // 4. InlineData with mimeType starting with audio/
  if (obj.inlineData && obj.inlineData.data) {
    return {
      data: obj.inlineData.data,
      mimeType: obj.inlineData.mimeType || obj.inlineData.mime_type || "audio/mp3",
    };
  }
  if (obj.inline_data && obj.inline_data.data) {
    return {
      data: obj.inline_data.data,
      mimeType: obj.inline_data.mime_type || obj.inline_data.mimeType || "audio/mp3",
    };
  }

  // 5. Specific structure with type="audio"
  if (
    (obj.type === "audio" || obj.mimeType?.startsWith("audio/") || obj.mime_type?.startsWith("audio/")) &&
    (obj.data || obj.content || obj.base64)
  ) {
    const rawData = obj.data || obj.content || obj.base64;
    if (typeof rawData === "string" && rawData.length > 100) {
      return {
        data: rawData,
        mimeType: obj.mimeType || obj.mime_type || "audio/mp3",
      };
    }
  }

  // 6. Recursive search across steps, outputs, parts, etc.
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      const found = findAudioInResponse(obj[key]);
      if (found) return found;
    }
  }

  return null;
}

function findBase64AudioFallback(obj: any): { data: string; mimeType: string } | null {
  if (!obj) return null;
  if (typeof obj === "string") {
    if (obj.length > 5000 && /^[A-Za-z0-9+/=\r\n]+$/.test(obj)) {
      const mime = obj.startsWith("SUQz") ? "audio/mp3" : obj.startsWith("UklGR") ? "audio/wav" : "audio/mp3";
      return { data: obj, mimeType: mime };
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findBase64AudioFallback(item);
      if (found) return found;
    }
  } else if (typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      const found = findBase64AudioFallback(obj[k]);
      if (found) return found;
    }
  }
  return null;
}

function findTextInResponse(obj: any): string[] {
  const texts: string[] = [];
  function search(val: any) {
    if (!val) return;
    if (typeof val === "string") {
      if (val.length > 2 && val.length < 5000 && !/^[A-Za-z0-9+/=]{100,}$/.test(val)) {
        texts.push(val);
      }
    } else if (Array.isArray(val)) {
      val.forEach(search);
    } else if (typeof val === "object") {
      if (val.text && typeof val.text === "string") {
        texts.push(val.text);
      } else {
        for (const k of Object.keys(val)) {
          if (k !== "audio" && k !== "data" && k !== "output_audio" && k !== "outputAudio") {
            search(val[k]);
          }
        }
      }
    }
  }
  search(obj);
  return texts;
}

async function pollInteraction(
  interactionId: string,
  apiKey: string,
  maxWaitMs = 60000,
  intervalMs = 2000
): Promise<any> {
  const cleanId = interactionId.startsWith("interactions/")
    ? interactionId
    : `interactions/${interactionId}`;
  const getUrl = `https://generativelanguage.googleapis.com/v1beta/${cleanId}?key=${apiKey.trim()}`;

  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await delay(intervalMs);

    const res = await fetch(getUrl, {
      method: "GET",
      headers: {
        "x-goog-api-key": apiKey.trim(),
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Lyria] Poll error for ${cleanId} (HTTP ${res.status}):`, errText);
      continue;
    }

    const data = await res.json();
    const status = data.status || data.state;
    console.log(`[Lyria Poll] Interaction ${cleanId} status: ${status}`);

    if (status === "completed" || status === "COMPLETED" || status === "succeeded") {
      return data;
    }

    if (status === "failed" || status === "FAILED" || status === "cancelled") {
      throw new Error(
        data.error?.message || data.error || `Lyria music generation ended with status: ${status}`
      );
    }

    // Check if audio has arrived early even before status flag toggles
    const earlyAudio = findAudioInResponse(data) || findBase64AudioFallback(data);
    if (earlyAudio) {
      return data;
    }
  }

  throw new Error("Music generation timed out after 60 seconds while waiting for Google Lyria to finish.");
}

export async function GET() {
  const envKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.LYRIA_API_KEY ||
    "";

  const configuredKeyName = process.env.GEMINI_API_KEY
    ? "GEMINI_API_KEY"
    : process.env.GOOGLE_AI_API_KEY
    ? "GOOGLE_AI_API_KEY"
    : process.env.GOOGLE_API_KEY
    ? "GOOGLE_API_KEY"
    : process.env.LYRIA_API_KEY
    ? "LYRIA_API_KEY"
    : null;

  return NextResponse.json({
    configured: Boolean(envKey && envKey.trim().length > 5),
    envVarName: configuredKeyName,
    models: [
      {
        id: "lyria-3.5",
        name: "Google Lyria 3.5 (Full Song)",
        description: "High-fidelity full musical arrangement with verse, chorus, and structure (up to 3 min).",
      },
      {
        id: "lyria-3-clip-preview",
        name: "Google Lyria 3 Clip Preview",
        description: "Low-latency generation for 30-second loops, stems, and sonic textures.",
      },
    ],
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      model = "lyria-3.5",
      apiKey: manualApiKey,
      genre,
      mood,
      tempo,
      isInstrumental = true,
      durationSeconds,
    } = body;

    const apiKey =
      (manualApiKey && typeof manualApiKey === "string" && manualApiKey.trim()) ||
      request.headers.get("x-google-api-key") ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.LYRIA_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Google AI API key is missing. Please add GEMINI_API_KEY or GOOGLE_AI_API_KEY to your .env.local file or enter a temporary key in the studio header.",
        },
        { status: 400 }
      );
    }

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: "Prompt description is required." },
        { status: 400 }
      );
    }

    // Compose prompt with musical conditioning
    const descriptors: string[] = [];
    if (genre) descriptors.push(`Genre: ${genre}`);
    if (mood) descriptors.push(`Mood: ${mood}`);
    if (tempo) descriptors.push(`Tempo: ${tempo}`);
    if (isInstrumental) {
      descriptors.push("Format: Instrumental piece, no vocals");
    } else {
      descriptors.push("Format: Include vocal melody and song performance");
    }
    if (durationSeconds) {
      descriptors.push(`Target duration: approximately ${durationSeconds} seconds`);
    }

    const fullPrompt = descriptors.length > 0
      ? `${prompt.trim()}\n\n[Production Details]\n${descriptors.join("\n")}`
      : prompt.trim();

    // Call Google Generative Language Interactions API
    const targetModel = model === "lyria-3-clip-preview" ? "lyria-3-clip-preview" : "lyria-3.5";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey.trim()}`;

    const requestPayload = {
      model: targetModel,
      input: fullPrompt,
      response_format: { type: "audio" },
    };

    console.log(`[Lyria API] Starting interaction with model: ${targetModel}`);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    const responseData = await res.json();
    console.log(`[Lyria API Initial Response Status]: ${res.status}`);

    if (!res.ok) {
      const errorMessage =
        responseData?.error?.message ||
        responseData?.error ||
        `Google Generative Language API responded with HTTP ${res.status}`;
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          statusCode: res.status,
          details: responseData,
        },
        { status: res.status }
      );
    }

    let finalResponse = responseData;

    // Check if audio data is already present in initial response
    let audioInfo = findAudioInResponse(finalResponse) || findBase64AudioFallback(finalResponse);

    // If not immediately present, check if this is an async Interaction that needs polling
    if (!audioInfo) {
      const interactionId =
        responseData.id ||
        responseData.name ||
        responseData.interaction_id ||
        responseData.interactionId;
      const status = responseData.status || responseData.state;

      console.log(`[Lyria API Initial Data]: id=${interactionId}, status=${status}`);

      if (interactionId && (status === "in_progress" || status === "running" || !status)) {
        console.log(`[Lyria API] Polling interaction ${interactionId} until completion...`);
        finalResponse = await pollInteraction(interactionId, apiKey);
        audioInfo = findAudioInResponse(finalResponse) || findBase64AudioFallback(finalResponse);
      }
    }

    const textualNotes = findTextInResponse(finalResponse);

    if (!audioInfo || !audioInfo.data) {
      console.error("[Lyria API] No audio data found in response. Full JSON keys:", Object.keys(finalResponse));
      return NextResponse.json(
        {
          success: false,
          error: "Google Lyria returned a response without audio data.",
          details: finalResponse,
          notes: textualNotes,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      audioBase64: audioInfo.data,
      mimeType: audioInfo.mimeType,
      model: targetModel,
      prompt: fullPrompt,
      notes: textualNotes,
      createdAt: Date.now(),
    });
  } catch (error: any) {
    console.error("Lyria generation failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error during Lyria music synthesis.",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
