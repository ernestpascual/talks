import { DEFAULT_MANAGED_ROUTES, ManagedRoute, RouteStatus } from "./route-guard-types";

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export interface RedirectItem {
  slug: string;
  url: string;
  title?: string;
  createdAt: number;
  updatedAt?: number;
  clicks?: number;
}

const DEFAULT_REDIRECTS: Record<string, RedirectItem> = {
  live: {
    slug: "live",
    url: "/experience/aerocano-survey",
    title: "Live Audience Survey",
    createdAt: 1700000000000,
  },
  dragon: {
    slug: "dragon",
    url: "/experience/dragon-slayer",
    title: "Dragon Slayer (Lightsaber)",
    createdAt: 1700000000000,
  },
  radar: {
    slug: "radar",
    url: "/experience/find-your-officemate",
    title: "WRU?! Bluetooth Radar",
    createdAt: 1700000000000,
  },
  aerocano: {
    slug: "aerocano",
    url: "/talks/aerocano",
    title: "Aerocano Talk Presentation",
    createdAt: 1700000000000,
  },
  bbdo: {
    slug: "bbdo",
    url: "/talks/bbdo-ai-playday",
    title: "BBDO AI Playday Talk",
    createdAt: 1700000000000,
  },
  substrate: {
    slug: "substrate",
    url: "/experience/substrate-blob",
    title: "BBDO AI Creative Substrates",
    createdAt: 1700000000000,
  },
};

// Local development in-memory store
const globalRef = global as typeof globalThis & {
  localKVStore?: {
    redirects: Record<string, RedirectItem>;
    responses: string[];
    scores: Array<{ name: string; score: number; ts: number }>;
    cache: Record<string, string>;
  };
};

if (!globalRef.localKVStore) {
  globalRef.localKVStore = {
    redirects: { ...DEFAULT_REDIRECTS },
    responses: [
      "Sana matamis yung aerocano!",
      "Gusto ko ng dark chocolate notes.",
    ],
    scores: [] as Array<{ name: string; score: number; ts: number }>,
    cache: {},
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
    if (arg1?.startsWith("redirect:")) {
      const redirectSlug = arg1.replace(/^redirect:/, "");
      const item = store.redirects[redirectSlug];
      return (item ? JSON.stringify(item) : null) as unknown as T;
    }
    return (store.cache[arg1!] || null) as unknown as T;
  }
  if (op === "SET") {
    if (arg1?.startsWith("redirect:")) {
      const redirectSlug = arg1.replace(/^redirect:/, "");
      try {
        const parsed = JSON.parse(arg2!);
        store.redirects[redirectSlug] = parsed;
      } catch {
        store.redirects[redirectSlug] = {
          slug: redirectSlug,
          url: arg2!,
          createdAt: Date.now(),
        };
      }
    } else {
      store.cache[arg1!] = arg2!;
    }
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
    let deleted = 0;
    for (const key of command.slice(1)) {
      if (key?.startsWith("redirect:")) {
        const redirectSlug = key.replace(/^redirect:/, "");
        if (redirectSlug in store.redirects) {
          delete store.redirects[redirectSlug];
          deleted += 1;
        }
        continue;
      }
      if (key === "aerocano:scores") {
        store.scores = [];
        deleted += 1;
        continue;
      }
      if (key === "survey:responses") {
        store.responses = [];
        deleted += 1;
        continue;
      }
      if (key in store.cache) {
        delete store.cache[key];
        deleted += 1;
      }
    }
    return deleted as unknown as T;
  }

  return null;
}

export async function getRedirect(slug: string): Promise<string> {
  const result = await runKVCommand<string>(["GET", `redirect:${slug}`]);
  if (!result) {
    if (DEFAULT_REDIRECTS[slug]) return DEFAULT_REDIRECTS[slug].url;
    return "/experience/aerocano-survey";
  }
  try {
    const parsed = JSON.parse(result) as RedirectItem;
    if (typeof parsed === "object" && parsed.url) {
      return parsed.url;
    }
    return String(parsed).replace(/^"|"$/g, "") || "/experience/aerocano-survey";
  } catch {
    return String(result).replace(/^"|"$/g, "") || "/experience/aerocano-survey";
  }
}

export async function getRedirectItem(slug: string): Promise<RedirectItem | null> {
  const result = await runKVCommand<string>(["GET", `redirect:${slug}`]);
  if (!result) {
    return DEFAULT_REDIRECTS[slug] || null;
  }
  if (typeof result === "object" && result !== null) {
    const resultItem = result as unknown as Partial<RedirectItem>;
    if (!resultItem.slug || !resultItem.url) return null;
    return {
      ...(resultItem as RedirectItem),
      url: String(resultItem.url).replace(/^"|"$/g, ""),
    };
  }
  try {
    const parsed = JSON.parse(result) as RedirectItem;
    if (typeof parsed === "object" && parsed.slug && parsed.url) {
      return {
        ...parsed,
        url: String(parsed.url).replace(/^"|"$/g, ""),
      };
    }
    return {
      slug,
      url: String(result).replace(/^"|"$/g, ""),
      title: DEFAULT_REDIRECTS[slug]?.title || slug.toUpperCase(),
      createdAt: Date.now(),
    };
  } catch {
    return {
      slug,
      url: String(result).replace(/^"|"$/g, ""),
      title: DEFAULT_REDIRECTS[slug]?.title || slug.toUpperCase(),
      createdAt: Date.now(),
    };
  }
}

export async function getAllRedirects(): Promise<RedirectItem[]> {
  // Try to load index from KV
  const indexStr = await runKVCommand<string>(["GET", "redirects:index"]);
  let slugs: string[] = [];

  if (indexStr) {
    try {
      slugs = JSON.parse(indexStr);
    } catch {
      slugs = [];
    }
  }

  // Ensure default slugs are always present
  Object.keys(DEFAULT_REDIRECTS).forEach((s) => {
    if (!slugs.includes(s)) slugs.push(s);
  });

  if (globalRef.localKVStore?.redirects) {
    Object.keys(globalRef.localKVStore.redirects).forEach((s) => {
      if (!slugs.includes(s)) slugs.push(s);
    });
  }

  const items: RedirectItem[] = [];
  for (const slug of slugs) {
    const item = await getRedirectItem(slug);
    if (item && typeof item === "object" && item.slug && item.url) {
      items.push(item);
    }
  }

  return items.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

export async function setRedirect(
  slug: string,
  url: string,
  title?: string
): Promise<boolean> {
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleanSlug || !url.trim()) return false;

  const existing = await getRedirectItem(cleanSlug);
  const item: RedirectItem = {
    slug: cleanSlug,
    url: url.trim(),
    title: title?.trim() || existing?.title || cleanSlug.toUpperCase(),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  const setResult = await runKVCommand<string>([
    "SET",
    `redirect:${cleanSlug}`,
    JSON.stringify(item),
  ]);

  if (setResult === "OK") {
    // Update index in KV
    try {
      const indexStr = await runKVCommand<string>(["GET", "redirects:index"]);
      let slugs: string[] = [];
      if (indexStr) {
        try { slugs = JSON.parse(indexStr); } catch { slugs = []; }
      }
      if (!slugs.includes(cleanSlug)) {
        slugs.push(cleanSlug);
        await runKVCommand<string>(["SET", "redirects:index", JSON.stringify(slugs)]);
      }
    } catch {}
    return true;
  }
  return false;
}

export async function deleteRedirect(slug: string): Promise<boolean> {
  const cleanSlug = slug.trim().toLowerCase();
  const result = await runKVCommand<number>(["DEL", `redirect:${cleanSlug}`]);

  // Update index
  try {
    const indexStr = await runKVCommand<string>(["GET", "redirects:index"]);
    if (indexStr) {
      const slugs: string[] = JSON.parse(indexStr);
      const filtered = slugs.filter((s) => s !== cleanSlug);
      await runKVCommand<string>(["SET", "redirects:index", JSON.stringify(filtered)]);
    }
  } catch {}

  return result !== null;
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

export async function getCacheValue(key: string): Promise<string | null> {
  return runKVCommand<string>(["GET", key]);
}

export async function setCacheValue(key: string, value: string): Promise<boolean> {
  const result = await runKVCommand<string>(["SET", key, value]);
  return result === "OK";
}

export async function deleteCacheKeys(...keys: string[]): Promise<boolean> {
  if (keys.length === 0) return true;
  const result = await runKVCommand<number>(["DEL", ...keys]);
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

// =========================================================================
// ROUTE GUARDS & ACCESS CONTROL (Talks & Experience Protection & Disabling)
// =========================================================================

export async function getAllRouteGuards(): Promise<ManagedRoute[]> {
  const customStr = await runKVCommand<string>(["GET", "config:route_guards"]);
  let customMap: Record<string, ManagedRoute> = {};

  if (customStr) {
    try {
      customMap = JSON.parse(customStr);
    } catch {}
  }

  return DEFAULT_MANAGED_ROUTES.map((defaultRoute) => {
    if (customMap[defaultRoute.id]) {
      return {
        ...defaultRoute,
        ...customMap[defaultRoute.id],
      };
    }
    return defaultRoute;
  });
}

export async function getRouteGuard(id: string): Promise<ManagedRoute | null> {
  const all = await getAllRouteGuards();
  return all.find((r) => r.id === id) || null;
}

export async function setRouteGuard(
  id: string,
  updates: Partial<ManagedRoute>
): Promise<boolean> {
  const all = await getAllRouteGuards();
  const targetIndex = all.findIndex((r) => r.id === id);
  if (targetIndex === -1) return false;

  all[targetIndex] = {
    ...all[targetIndex],
    ...updates,
    updatedAt: Date.now(),
  };

  const map: Record<string, ManagedRoute> = {};
  all.forEach((r) => {
    map[r.id] = r;
  });

  const result = await runKVCommand<string>([
    "SET",
    "config:route_guards",
    JSON.stringify(map),
  ]);

  return result === "OK";
}

export async function checkRouteAccess(pathname: string): Promise<{
  status: RouteStatus;
  hasPassword: boolean;
  title: string;
  disabledMessage?: string;
  id: string;
}> {
  const all = await getAllRouteGuards();
  const normalized = pathname.toLowerCase().replace(/\/$/, "") || "/";

  // 1. Check direct exact match or prefix match (e.g. /talks/aerocano/1 matches /talks/aerocano)
  const exactMatch = all.find(
    (r) => r.id !== "all-talks" && r.id !== "all-experiences" &&
      (normalized === r.path || normalized.startsWith(r.path + "/"))
  );

  if (exactMatch && exactMatch.status !== "public") {
    return {
      status: exactMatch.status,
      hasPassword: !!exactMatch.password,
      title: exactMatch.title,
      disabledMessage: exactMatch.disabledMessage,
      id: exactMatch.id,
    };
  }

  // 2. Check master controls (/talks or /experience)
  if (normalized.startsWith("/talks")) {
    const masterTalks = all.find((r) => r.id === "all-talks");
    if (masterTalks && masterTalks.status !== "public") {
      return {
        status: masterTalks.status,
        hasPassword: !!masterTalks.password,
        title: masterTalks.title,
        disabledMessage: masterTalks.disabledMessage,
        id: masterTalks.id,
      };
    }
  }

  if (normalized.startsWith("/experience")) {
    const masterExp = all.find((r) => r.id === "all-experiences");
    if (masterExp && masterExp.status !== "public") {
      return {
        status: masterExp.status,
        hasPassword: !!masterExp.password,
        title: masterExp.title,
        disabledMessage: masterExp.disabledMessage,
        id: masterExp.id,
      };
    }
  }

  return {
    status: exactMatch?.status || "public",
    hasPassword: false,
    title: exactMatch?.title || "Public",
    id: exactMatch?.id || "public",
  };
}
