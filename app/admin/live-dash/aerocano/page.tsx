"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { isAuthenticated, getAdminPassword } from "@/lib/admin-auth";

function subscribe() {
  return () => {};
}

type ScoreEntry = { name: string; score: number; ts: number };

interface JsonTreeNodeProps {
  name: string;
  value: any;
  depth?: number;
  defaultOpen?: boolean;
}

function JsonTreeNode({ name, value, depth = 0, defaultOpen = true }: JsonTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen && depth < 2);
  const isObject = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);

  const getTypeLabel = () => {
    if (value === null) return "null";
    if (isArray) return `Array(${value.length})`;
    if (isObject) return `Object(${Object.keys(value).length})`;
    return typeof value;
  };

  const getValueColor = () => {
    if (value === null) return "text-zinc-500";
    if (typeof value === "string") return "text-emerald-400 font-normal";
    if (typeof value === "number") return "text-amber-400 font-bold";
    if (typeof value === "boolean") return "text-purple-400 font-bold";
    return "text-zinc-400";
  };

  return (
    <div className="font-mono text-xs leading-relaxed">
      <div
        className={`flex items-start gap-1 py-0.5 px-2 rounded hover:bg-zinc-900/60 transition cursor-pointer select-none ${
          depth > 0 ? "ml-4 border-l border-zinc-800/80" : ""
        }`}
        onClick={() => isObject && setIsOpen(!isOpen)}
      >
        {isObject ? (
          <span className="text-zinc-500 w-3 inline-block font-bold">
            {isOpen ? "▼" : "▶"}
          </span>
        ) : (
          <span className="w-3 inline-block" />
        )}

        <span className="text-cyan-400 font-semibold">{name}:</span>

        {isObject ? (
          <span className="text-zinc-500 text-[11px] font-normal">
            {getTypeLabel()} {!isOpen && (isArray ? "[ ... ]" : "{ ... }")}
          </span>
        ) : (
          <span className={`break-all ${getValueColor()}`}>
            {typeof value === "string" ? `"${value}"` : String(value)}
          </span>
        )}
      </div>

      {isObject && isOpen && (
        <div className="space-y-0.5">
          {Object.entries(value).map(([k, v]) => (
            <JsonTreeNode
              key={k}
              name={k}
              value={v}
              depth={depth + 1}
              defaultOpen={depth < 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminLiveDashAerocanoPage() {
  const authed = useSyncExternalStore(subscribe, isAuthenticated, () => false);

  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [geminiCache, setGeminiCache] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [treeSearch, setTreeSearch] = useState("");
  const [copiedTree, setCopiedTree] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [scoresRes, surveyRes, geminiRes] = await Promise.all([
        fetch("/api/scores", { cache: "no-store" }),
        fetch("/api/survey", { cache: "no-store" }),
        fetch("/api/gemini", { cache: "no-store" }).catch(() => null),
      ]);

      const scoresData = await scoresRes.json();
      if (scoresData.success) setScores(scoresData.scores || []);

      const surveyData = await surveyRes.json();
      if (surveyData.success) setResponses(surveyData.list || []);

      if (geminiRes && geminiRes.ok) {
        const gData = await geminiRes.json();
        setGeminiCache(gData.result || gData);
      }
    } catch (err) {
      console.error("Failed to load Aerocano telemetry:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Compute live hierarchical data tree
  const liveDataTree = {
    experience: "aerocano",
    status: "active",
    syncedAt: new Date().toISOString(),
    metrics: {
      totalScores: scores.length,
      highestScore: scores.length > 0 ? Math.max(...scores.map((s) => s.score)) : 0,
      averageScore:
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length)
          : 0,
      totalSurveyResponses: responses.length,
      averageResponseLength:
        responses.length > 0
          ? Math.round(responses.reduce((a, b) => a + b.length, 0) / responses.length)
          : 0,
    },
    rawSurveySubmissions: responses.map((text, idx) => ({
      submissionId: `#${responses.length - idx}`,
      text,
      charCount: text.length,
      receivedIndex: idx,
    })),
    leaderboardScores: scores.map((entry, idx) => ({
      rank: idx + 1,
      name: entry.name,
      score: entry.score,
      timestamp: entry.ts,
      formattedTime: new Date(entry.ts).toLocaleString(),
    })),
    geminiTelemetryAnalysis: geminiCache || {
      analyzed: false,
      note: "Live Gemini summary generated during slide deck interaction",
    },
    storageBackend: {
      type: "Vercel KV / Upstash Redis",
      cachedKeys: ["aerocano:scores", "survey:responses", "redirect:live"],
      isPersistent: true,
    },
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(liveDataTree, null, 2));
    setCopiedTree(true);
    setTimeout(() => setCopiedTree(false), 2000);
  };

  async function handleClearScores() {
    let pw = getAdminPassword();
    if (!pw) {
      pw = prompt("Enter admin password to clear scores:") || "";
    }
    if (!pw) return;

    setClearing(true);
    try {
      const res = await fetch("/api/scores", {
        method: "DELETE",
        headers: { "x-admin-password": pw },
      });
      const data = await res.json();
      if (data.success) {
        setScores([]);
        setClearMsg("Scores reset successfully.");
      } else {
        setClearMsg("Failed — check password.");
      }
    } catch {
      setClearMsg("Error clearing scores.");
    } finally {
      setClearing(false);
      setTimeout(() => setClearMsg(null), 4000);
    }
  }

  async function handleClearResponses() {
    let pw = getAdminPassword();
    if (!pw) {
      pw = prompt("Enter admin password to clear survey responses:") || "";
    }
    if (!pw) return;

    setClearing(true);
    try {
      const res = await fetch("/api/survey", {
        method: "DELETE",
        headers: { "x-admin-password": pw },
      });
      const data = await res.json();
      if (data.success) {
        setResponses([]);
        setClearMsg("Survey responses cleared.");
      } else {
        setClearMsg("Failed — check password.");
      }
    } catch {
      setClearMsg("Error clearing survey.");
    } finally {
      setClearing(false);
      setTimeout(() => setClearMsg(null), 4000);
    }
  }

  const filteredResponses = responses.filter((r) =>
    r.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen w-full bg-zinc-950 text-white font-sans antialiased p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mb-2">
              <Link href="/admin" className="hover:text-zinc-300 transition">
                ADMIN
              </Link>
              <span>/</span>
              <span className="text-amber-400 font-bold">LIVE DASHBOARDS</span>
              <span>/</span>
              <span className="text-white">AEROCANO</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>☕ Aerocano Live Experience</span>
              <span className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
                LIVE TELEMETRY
              </span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Real-time survey submissions, shake-it score leaderboards, and raw KV data hierarchy.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition active:scale-95"
            >
              <span>{loading ? "Refreshing..." : "↻ Refresh Data"}</span>
            </button>
            <Link
              href="/talks/aerocano"
              className="px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-black hover:bg-amber-400 transition"
            >
              Open Talk Deck →
            </Link>
          </div>
        </div>

        {/* Status Message Notification */}
        {clearMsg && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-mono text-amber-300">
            {clearMsg}
          </div>
        )}

        {/* Top Analytics Bento Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-md">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              Survey Answers
            </span>
            <div className="text-3xl font-mono font-bold text-white mt-1">
              {responses.length}
            </div>
            <span className="text-[11px] text-zinc-500">raw submissions</span>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-md">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              Total Shakes
            </span>
            <div className="text-3xl font-mono font-bold text-amber-400 mt-1">
              {scores.length}
            </div>
            <span className="text-[11px] text-zinc-500">participants logged</span>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-md">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              Highest Score
            </span>
            <div className="text-3xl font-mono font-bold text-emerald-400 mt-1">
              {scores.length > 0 ? Math.max(...scores.map((s) => s.score)) : 0}
            </div>
            <span className="text-[11px] text-zinc-500">record shakes</span>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-md">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              Storage Health
            </span>
            <div className="text-3xl font-mono font-bold text-cyan-400 mt-1">
              100%
            </div>
            <span className="text-[11px] text-zinc-500">Vercel KV Connected</span>
          </div>
        </div>

        {/* SECTION: Current Tree of Data (Hierarchical Tree Visualizer) */}
        <section className="rounded-3xl border border-cyan-500/20 bg-zinc-900/50 p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-cyan-950/20 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h2 className="text-lg font-black uppercase tracking-wider text-white">
                  Current Tree of Data
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                Interactive real-time object hierarchy of all Aerocano KV entries and live telemetry.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/30 text-xs font-mono text-cyan-300 hover:bg-cyan-900/40 transition"
              >
                <span>{copiedTree ? "✓ Copied!" : "📋 Copy Full JSON"}</span>
              </button>
            </div>
          </div>

          {/* Tree Explorer Container */}
          <div className="rounded-2xl border border-zinc-800 bg-black/80 p-4 sm:p-6 overflow-x-auto max-h-[420px] overflow-y-auto font-mono text-xs">
            <JsonTreeNode name="aerocano_live_root" value={liveDataTree} depth={0} defaultOpen={true} />
          </div>
        </section>

        {/* SECTION: Raw Answer Submissions & Shake Scores */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* LEFT: Raw Survey Submissions */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-md space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-amber-400">
                  Raw Answer Submissions ({responses.length})
                </h2>
                <p className="text-xs text-zinc-500">Live attendee input stream</p>
              </div>

              <button
                onClick={handleClearResponses}
                disabled={clearing || responses.length === 0}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-900/30 disabled:opacity-40 transition"
              >
                Clear Answers
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search raw answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black/60 px-3.5 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-amber-500"
              />
            </div>

            {loading ? (
              <div className="text-center py-10 text-xs text-zinc-600 font-mono">
                Loading responses...
              </div>
            ) : filteredResponses.length === 0 ? (
              <div className="text-center py-10 text-xs text-zinc-600 font-mono border border-dashed border-zinc-800 rounded-2xl">
                No matching submissions.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[480px] overflow-y-auto pr-1">
                {[...filteredResponses].reverse().map((text, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-zinc-800/80 bg-black/40 text-xs text-zinc-300 flex items-start gap-3 hover:border-zinc-700 transition"
                  >
                    <span className="text-[10px] font-mono text-zinc-600 pt-0.5 shrink-0">
                      #{filteredResponses.length - idx}
                    </span>
                    <p className="leading-relaxed flex-1 break-words">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* RIGHT: Live Shake-It Scores Leaderboard */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-md space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-emerald-400">
                  Shake Scores Leaderboard ({scores.length})
                </h2>
                <p className="text-xs text-zinc-500">Live audience shake telemetry</p>
              </div>

              <button
                onClick={handleClearScores}
                disabled={clearing || scores.length === 0}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-900/30 disabled:opacity-40 transition"
              >
                Clear Scores
              </button>
            </div>

            {loading ? (
              <div className="text-center py-10 text-xs text-zinc-600 font-mono">
                Loading leaderboard...
              </div>
            ) : scores.length === 0 ? (
              <div className="text-center py-10 text-xs text-zinc-600 font-mono border border-dashed border-zinc-800 rounded-2xl">
                No shake scores recorded yet.
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 overflow-hidden max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-500 uppercase tracking-wider font-mono text-[10px]">
                      <th className="text-left px-3 py-2.5">Rank</th>
                      <th className="text-left px-3 py-2.5">Name</th>
                      <th className="text-right px-3 py-2.5">Score</th>
                      <th className="text-right px-3 py-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((entry, idx) => (
                      <tr
                        key={entry.ts + idx}
                        className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-900/40 transition"
                      >
                        <td className="px-3 py-2.5 text-zinc-500 font-mono">
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-white">
                          {entry.name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-400 tabular-nums">
                          {entry.score}
                        </td>
                        <td className="px-3 py-2.5 text-right text-zinc-500 font-mono text-[10px]">
                          {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>

      </div>
    </main>
  );
}
