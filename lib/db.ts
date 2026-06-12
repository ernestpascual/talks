const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

// Local development in-memory store
const globalRef = global as typeof globalThis & {
  localKVStore?: {
    redirects: Record<string, string>;
    responses: string[];
    scores: Array<{ name: string; score: number; ts: number }>;
  };
};

if (!globalRef.localKVStore) {
  globalRef.localKVStore = {
    redirects: {
      live: "/experience/aerocano-survey",
    },
    responses: [
      "Sana matamis yung aerocano!",
      "Gusto ko ng dark chocolate notes.",
    ],
    scores: [] as Array<{ name: string; score: number; ts: number }>,
  };
}

async function runKVCommand<T>(command: string[]): Promise<T | null> {
  if (KV_URL && KV_TOKEN) {
    try {
      const res = await fetch(KV_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("Vercel KV Error:", await res.text());
        return null;
      }

      const data = await res.json();
      return data.result as T;
    } catch (err) {
      console.error("Failed to connect to Vercel KV:", err);
      return null;
    }
  }

  // Fallback to in-memory store
  const store = globalRef.localKVStore!;
  const [op, arg1, arg2, arg3] = command;

  if (op === "GET") {
    return (store.redirects[arg1!] || null) as unknown as T;
  }
  if (op === "SET") {
    store.redirects[arg1!] = arg2!;
    return "OK" as unknown as T;
  }
  if (op === "RPUSH") {
    if (arg1 === "aerocano:scores") {
      store.scores.push(JSON.parse(arg2!));
      return store.scores.length as unknown as T;
    }
    store.responses.push(arg2!);
    return store.responses.length as unknown as T;
  }
  if (op === "LRANGE") {
    const list = arg1 === "aerocano:scores"
      ? store.scores.map((s) => JSON.stringify(s))
      : store.responses;
    const start = Number(arg2 || 0);
    const end = Number(arg3 || -1);
    if (end === -1) return list.slice(start) as unknown as T;
    return list.slice(start, end + 1) as unknown as T;
  }
  if (op === "DEL") {
    if (arg1 === "aerocano:scores") {
      store.scores = [];
      return 1 as unknown as T;
    }
    if (arg1 === "survey:responses") {
      store.responses = [];
      return 1 as unknown as T;
    }
    return 0 as unknown as T;
  }

  return null;
}

export async function getRedirect(slug: string): Promise<string> {
  const result = await runKVCommand<string>(["GET", `redirect:${slug}`]);
  return result || "/experience/aerocano-survey";
}

export async function setRedirect(slug: string, url: string): Promise<boolean> {
  const result = await runKVCommand<string>(["SET", `redirect:${slug}`, url]);
  return result === "OK";
}

export async function submitResponse(text: string): Promise<boolean> {
  // Sanitize the response
  const sanitized = text.trim().slice(0, 200);
  if (!sanitized) return false;
  const result = await runKVCommand<number>(["RPUSH", "survey:responses", sanitized]);
  return result !== null;
}

export async function getResponses(): Promise<string[]> {
  const result = await runKVCommand<string[]>(["LRANGE", "survey:responses", "0", "-1"]);
  return result || [];
}

export async function clearResponses(): Promise<boolean> {
  const result = await runKVCommand<number>(["DEL", "survey:responses"]);
  return result !== null;
}

export type ScoreEntry = { name: string; score: number; ts: number };

export async function submitScore(name: string, score: number): Promise<boolean> {
  const entry: ScoreEntry = { name: name.trim().slice(0, 40), score, ts: Date.now() };
  const serialized = JSON.stringify(entry);
  const result = await runKVCommand<number>(["RPUSH", "aerocano:scores", serialized]);
  return result !== null;
}

export async function getScores(): Promise<ScoreEntry[]> {
  const result = await runKVCommand<string[]>(["LRANGE", "aerocano:scores", "0", "-1"]);
  if (!result) return [];
  return result
    .map((s) => { try { return JSON.parse(s) as ScoreEntry; } catch { return null; } })
    .filter(Boolean) as ScoreEntry[];
}

export async function clearScores(): Promise<boolean> {
  const result = await runKVCommand<number>(["DEL", "aerocano:scores"]);
  return result !== null;
}
