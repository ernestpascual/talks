"use client";

import { useEffect, useState, useCallback } from "react";
import type { Slide } from "@/lib/talks/aerocano/slides";
import Slide4CoffeePour from "./Slide4CoffeePour";
import Slide5AerocanoMake from "./Slide5AerocanoMake";
import Slide6SurveyBento from "./Slide6SurveyBento";
import { SlideCornerLink, SlideCornerQr } from "./SlideCornerChrome";

type ScoreEntry = { name: string; score: number; ts: number };

type SlideContentProps = {
  slide: Slide;
};

const MEDAL = ["🥇", "🥈", "🥉"];

function ShakeItSlide({ text }: { text: string }) {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [clearing, setClearing] = useState(false);
  const [clearPw, setClearPw] = useState("");
  const [showPwPrompt, setShowPwPrompt] = useState(false);
  const [clearMsg, setClearMsg] = useState<"ok" | "fail" | null>(null);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/scores", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setScores(data.scores);
    } catch {}
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => {
      void fetchScores();
    }, 0);
    const iv = setInterval(fetchScores, 3000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(iv);
    };
  }, [fetchScores]);

  const handleClear = async () => {
    if (!clearPw.trim()) return;
    setClearing(true);
    try {
      const res = await fetch("/api/scores", {
        method: "DELETE",
        headers: { "x-admin-password": clearPw },
      });
      const data = await res.json();
      if (data.success) {
        setScores([]);
        setClearMsg("ok");
        setShowPwPrompt(false);
        setClearPw("");
      } else {
        setClearMsg("fail");
      }
    } catch {
      setClearMsg("fail");
    } finally {
      setClearing(false);
      setTimeout(() => setClearMsg(null), 3000);
    }
  };

  const gameUrl = "https://talks.ernestpascual.com/experience/aerocano-shake";

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-black text-left text-white animate-fade-in">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.12),_transparent_36%),linear-gradient(180deg,rgba(24,24,27,0.9),rgba(0,0,0,1))]" />

      <div className="relative z-10 flex items-start justify-between gap-6 px-8 pt-8">
        <SlideCornerLink url={gameUrl} />
        <SlideCornerQr url={gameUrl} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-8 pb-8 pt-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.28em] text-amber-500">
              Interactive Game
            </span>
            <h2 className="mt-3 text-5xl font-black uppercase tracking-tight text-zinc-100">
              {text}
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-light leading-relaxed text-zinc-400">
              Scan the QR code and shake your phone as fast as you can in 15 seconds. Submit your score and see where you rank.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold animate-pulse uppercase tracking-wider">
            Live
          </span>
        </div>

        <div className="flex-1 flex flex-col gap-3 overflow-y-auto rounded-[2rem] border border-zinc-900 bg-zinc-950/75 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          {scores.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-600 gap-3 border border-dashed border-zinc-800 rounded-3xl p-8">
              <span className="text-3xl animate-bounce">☕</span>
              <p className="text-xs font-light">No scores yet. Scan &amp; shake!</p>
            </div>
          ) : (
            scores.map((entry, idx) => (
              <div
                key={entry.ts}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${
                  idx === 0
                    ? "border-amber-500/40 bg-amber-500/10"
                    : idx === 1
                    ? "border-zinc-400/30 bg-zinc-800/40"
                    : idx === 2
                    ? "border-amber-700/30 bg-amber-950/20"
                    : "border-zinc-800/60 bg-zinc-900/20"
                } animate-fade-in`}
              >
                <span className="text-2xl w-8 text-center shrink-0">
                  {idx < 3 ? MEDAL[idx] : `#${idx + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{entry.name}</p>
                </div>
                <span className={`font-black text-2xl font-mono tabular-nums ${
                  idx === 0 ? "text-amber-400" : "text-zinc-300"
                }`}>
                  {entry.score}
                </span>
                <span className="text-zinc-500 text-xs">shakes</span>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-900">
          {!showPwPrompt ? (
            <button
              type="button"
              onClick={() => setShowPwPrompt(true)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-wider"
            >
              Clear all scores
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={clearPw}
                onChange={(e) => setClearPw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleClear()}
                placeholder="Admin password"
                className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-red-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600"
              />
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing || !clearPw.trim()}
                className="px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-600/30 disabled:opacity-40 transition-colors"
              >
                {clearing ? "..." : "Clear"}
              </button>
              <button
                type="button"
                onClick={() => { setShowPwPrompt(false); setClearPw(""); }}
                className="px-3 py-2 rounded-lg text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          )}
          {clearMsg === "ok" && <p className="text-emerald-500 text-xs mt-2">Scores cleared ✓</p>}
          {clearMsg === "fail" && <p className="text-red-400 text-xs mt-2">Wrong password or error.</p>}
        </div>
      </div>
    </div>
  );
}

export default function SlideContent({ slide }: SlideContentProps) {
  const containerClass =
    "flex min-h-screen flex-col items-center justify-center px-12 py-20 text-center animate-fade-in";

  switch (slide.kind) {
    case "title":
      return (
        <div className={`${containerClass} relative overflow-hidden bg-black`}>
          {/* Background Video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-35 z-0 pointer-events-none select-none"
          >
            <source src="/talks/aerocano/slide1.mp4" type="video/mp4" />
          </video>
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/60 z-10 pointer-events-none" />

          {/* Centered Title Image */}
          <div className="relative z-20 flex items-center justify-center w-full">
            <img
              src="/talks/aerocano/slide1-text.png"
              alt="BAKIT MASARAP ANG AEROCANO?"
              className="w-[90%] md:w-[80%] lg:w-[70%] h-auto object-contain select-none pointer-events-none animate-fade-in"
            />
          </div>
        </div>
      );

    case "text": {
      // Custom layouts for text slides to feel premium and avoid generic templates
      if (slide.number === 2) {
        // "i love black coffee"
        return (
          <div className={`${containerClass} relative overflow-hidden bg-black`}>
            {/* Background Video */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-35 z-0 pointer-events-none select-none"
            >
              <source src="/talks/aerocano/slide2.mp4" type="video/mp4" />
            </video>
            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/60 z-10 pointer-events-none" />

            <div className="relative z-20 flex flex-col items-start text-left max-w-3xl w-full">
              <span className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">About me</span>
              <p className="text-7xl md:text-9xl font-light text-zinc-100 tracking-tight leading-none lowercase">
                i love <span className="font-extrabold text-amber-500">black coffee</span>.
              </p>
            </div>
          </div>
        );
      }

      if (slide.number === 3) {
        // "Why am i talking about this?"
        return (
          <div className={`${containerClass} relative overflow-hidden bg-zinc-950`}>
            {/* Background Image */}
            <img
              src="/talks/aerocano/slide3.webp"
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-35 z-0 pointer-events-none select-none"
            />
            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/60 via-zinc-950/30 to-zinc-950/60 z-10 pointer-events-none" />

            <div className="relative z-20 max-w-4xl">
              <h2 className="text-7xl md:text-9xl font-semibold tracking-tight text-white leading-normal italic">
                “Why am i talking about this?”
              </h2>
              <div className="w-24 h-[3px] bg-amber-500 mx-auto mt-10 opacity-60" />
            </div>
          </div>
        );
      }

      return null;
    }

    case "interactive-pour":
      return <Slide4CoffeePour />;

    case "interactive-make":
      return <Slide5AerocanoMake />;

    case "qr-code":
      return <Slide6SurveyBento text={slide.text} />;

    case "shake-it": {
      return <ShakeItSlide text={slide.text} />;
    }

    case "ending":
      return (
        <div className={`${containerClass} relative overflow-hidden bg-black`}>
          {/* Background Video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-35 z-0 pointer-events-none select-none"
          >
            <source src="/talks/aerocano/slide8.mp4" type="video/mp4" />
          </video>
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/60 z-10 pointer-events-none" />

          <div className="relative z-20 space-y-6">
 
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-none">
              TNX KAPE NA ULIT.
            </h2>
          </div>
        </div>
      );

    default:
      return null;
  }
}
