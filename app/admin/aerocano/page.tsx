"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ScoreEntry = { name: string; score: number; ts: number };

export default function AdminAerocanoPage() {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [loadingScores, setLoadingScores] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  async function fetchScores() {
    setLoadingScores(true);
    try {
      const res = await fetch("/api/scores", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setScores(data.scores);
    } finally {
      setLoadingScores(false);
    }
  }

  async function fetchResponses() {
    setLoadingResponses(true);
    try {
      const res = await fetch("/api/survey", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.list) setResponses(data.list);
    } finally {
      setLoadingResponses(false);
    }
  }

  useEffect(() => {
    fetchScores();
    fetchResponses();
  }, []);

  async function handleClearScores() {
    const pw = prompt("Enter admin password to clear all scores:");
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
        setClearMsg("Scores cleared successfully.");
      } else {
        setClearMsg("Failed — wrong password?");
      }
    } catch {
      setClearMsg("Error occurred.");
    } finally {
      setClearing(false);
      setTimeout(() => setClearMsg(null), 4000);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-1 block">
            ← Back to Admin
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">Aerocano Data</h1>
          <p className="text-sm text-zinc-500 mt-1">All scores and survey responses stored in Vercel KV.</p>
        </div>
        <button
          onClick={() => { fetchScores(); fetchResponses(); }}
          className="text-xs px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Scores Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-amber-500">
            Shake Scores ({scores.length})
          </h2>
          <button
            onClick={handleClearScores}
            disabled={clearing || scores.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
          >
            {clearing ? "Clearing..." : "Clear All"}
          </button>
        </div>
        {clearMsg && (
          <p className="text-xs text-zinc-400 mb-3 px-3 py-2 bg-zinc-800 rounded-lg">{clearMsg}</p>
        )}
        {loadingScores ? (
          <div className="text-zinc-600 text-sm py-8 text-center">Loading...</div>
        ) : scores.length === 0 ? (
          <div className="text-zinc-600 text-sm py-8 text-center border border-dashed border-zinc-800 rounded-xl">
            No scores yet.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Name</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Score</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Time</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((entry, idx) => (
                  <tr
                    key={entry.ts}
                    className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-zinc-500 tabular-nums">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{entry.name}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 tabular-nums">
                      {entry.score}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 text-xs tabular-nums">
                      {new Date(entry.ts).toLocaleString("en-PH", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Survey Responses */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-4">
          Survey Responses ({responses.length})
        </h2>
        {loadingResponses ? (
          <div className="text-zinc-600 text-sm py-8 text-center">Loading...</div>
        ) : responses.length === 0 ? (
          <div className="text-zinc-600 text-sm py-8 text-center border border-dashed border-zinc-800 rounded-xl">
            No responses yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[...responses].reverse().map((text, idx) => (
              <div
                key={idx}
                className="px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/30 text-sm text-zinc-300 flex gap-3 items-start"
              >
                <span className="text-zinc-600 text-xs tabular-nums pt-0.5 shrink-0">{responses.length - idx}</span>
                <p className="leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
