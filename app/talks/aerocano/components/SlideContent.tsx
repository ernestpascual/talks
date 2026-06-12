"use client";

import { useEffect, useState, useCallback } from "react";
import type { Slide } from "@/lib/talks/aerocano/slides";
import Slide4CoffeePour from "./Slide4CoffeePour";
import Slide5AerocanoMake from "./Slide5AerocanoMake";

type ScoreEntry = { name: string; score: number; ts: number };

type SlideContentProps = {
  slide: Slide;
};

// Real scannable QR code using qrserver.com API
function AestheticQrCode({ url }: { url: string }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=400x400&margin=10&color=000000&bgcolor=ffffff&format=png`;
  return (
    <div className="flex flex-col items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
      <div className="bg-white p-3 rounded-2xl w-48 h-48 flex items-center justify-center shadow-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt={`QR code for ${url}`}
          width={180}
          height={180}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="text-center font-mono text-xs text-zinc-400 mt-1 select-all">
        {url}
      </div>
    </div>
  );
}

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
    fetchScores();
    const iv = setInterval(fetchScores, 3000);
    return () => clearInterval(iv);
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

  return (
    <div className="flex min-h-screen flex-col md:flex-row items-stretch bg-black text-left w-full animate-fade-in">
      {/* Left: QR + title */}
      <div className="flex-1 flex flex-col justify-center px-16 py-12 space-y-6 border-r border-zinc-900 bg-zinc-950/20 backdrop-blur">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Interactive Game</span>
        <h2 className="text-5xl font-black tracking-tight text-zinc-100 uppercase">
          {text}
        </h2>
        <p className="text-sm text-zinc-400 font-light leading-relaxed max-w-md">
          Scan the QR code and shake your phone as fast as you can in 15 seconds. Submit your score and see where you rank!
        </p>
        <div className="pt-4">
          <AestheticQrCode url="https://talks.ernestpascual.com/experience/aerocano-shake" />
        </div>
      </div>

      {/* Right: Leaderboard */}
      <div className="w-full md:w-[500px] bg-zinc-950 flex flex-col p-12 justify-center">
        <div className="flex justify-between items-center mb-6">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Leaderboard</span>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold animate-pulse uppercase tracking-wider">
            Live
          </span>
        </div>

        <div className="flex-1 flex flex-col gap-3 max-h-[55vh] overflow-y-auto pr-1">
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

        {/* Clear section */}
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
  const [origin, setOrigin] = useState("");
  const [responses, setResponses] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (slide.kind !== "qr-code") return;

    async function fetchResponses() {
      try {
        const res = await fetch("/api/survey");
        const data = await res.json();
        if (data.success && data.list) {
          setResponses(data.list);
        }
      } catch (err) {
        console.error("Failed to fetch survey responses:", err);
      }
    }

    fetchResponses();
    const interval = setInterval(fetchResponses, 2500);
    return () => clearInterval(interval);
  }, [slide.kind]);

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
      return (
        <div className="flex min-h-screen flex-col md:flex-row items-stretch bg-black text-left w-full animate-fade-in">
          {/* Left panel: Info & QR */}
          <div className="flex-1 flex flex-col justify-center px-16 py-12 space-y-6 border-r border-zinc-900 bg-zinc-950/20 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Live Survey Feedback</span>
            <h2 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
              {slide.text}
            </h2>
            <p className="text-sm text-zinc-400 font-light leading-relaxed max-w-md">
              Scan the QR code to submit what you look for in coffee. Your responses will appear here in real-time!
            </p>
            <div className="pt-4">
              <AestheticQrCode url="https://talks.ernestpascual.com/experience/aerocano-shake" />
            </div>
          </div>

          {/* Right panel: Real-time scrolling responses */}
          <div className="w-full md:w-[500px] bg-zinc-950 flex flex-col p-12 justify-center">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Audience Answers</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold animate-pulse uppercase tracking-wider">
                Live
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4 max-h-[60vh] scrollbar-thin">
              {responses.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-600 gap-3 border border-dashed border-zinc-800 rounded-3xl p-6">
                  <span className="text-3xl animate-bounce">☕</span>
                  <p className="text-xs font-light">Waiting for responses...</p>
                </div>
              ) : (
                responses.slice().reverse().map((text, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border border-zinc-850 bg-zinc-900/30 backdrop-blur shadow-md animate-slide-up flex gap-3.5 items-start"
                  >
                    <span className="text-base mt-0.5">☕</span>
                    <p className="text-sm text-zinc-300 font-light leading-relaxed">
                      {text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      );

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
