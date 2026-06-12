"use client";

import { useState } from "react";

export default function AerocanoSurveyPage() {
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = responseText.trim();
    if (!sanitized) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: sanitized }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || "Failed to submit response");
      }
    } catch (err) {
      setError("Failed to submit response due to network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-zinc-950 px-6 py-12 text-white antialiased">
      <div className="relative rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-8 backdrop-blur-md shadow-2xl">
        {/* Ambient coffee glow */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-500/80">Live Coffee Survey</span>
              <h1 className="text-2xl font-bold tracking-tight">Ano gusto mo sa kape?</h1>
              <p className="text-xs text-zinc-400">Isulat ang iyong sagot sa ibaba (1-2 pangungusap lamang).</p>
            </div>

            <div className="flex flex-col gap-2">
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value.slice(0, 180))}
                className="w-full h-32 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-white focus:border-amber-500 focus:outline-none transition-all placeholder:text-zinc-600 resize-none leading-relaxed"
                placeholder="Hal. Gusto ko matamis at creamy..."
                required
              />
              <div className="flex justify-between items-center px-1 text-[10px] text-zinc-500 font-mono">
                <span>Maximum 180 characters</span>
                <span className={responseText.length >= 170 ? "text-amber-500" : ""}>
                  {responseText.length}/180
                </span>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={!responseText.trim() || submitting}
              className="w-full rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all py-4 text-sm font-bold tracking-wide text-black shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Sending Response...
                </>
              ) : (
                "Submit Response"
              )}
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center text-center py-10 gap-6 animate-fade-in">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Salamat sa sagot!</h2>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
                Naitala na ang iyong sagot. Tingnan ang live visualization sa slides habang lumalabas ang mga sagot ng lahat! ☕✨
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
