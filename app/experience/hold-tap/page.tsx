"use client";

import { useEffect, useRef, useState } from "react";

import DmapFrame from "@/app/experience/dmap/DmapFrame";
import DmapSuccess from "@/app/experience/dmap/DmapSuccess";
import { useDmapConfig } from "@/app/experience/dmap/useDmapConfig";

export default function HoldTapPage() {
  const config = useDmapConfig().holdTap;
  const [bottomHeld, setBottomHeld] = useState(false);
  const [complete, setComplete] = useState(false);
  const [holdMs, setHoldMs] = useState(0);
  const [severed, setSevered] = useState(false);
  const [topHeld, setTopHeld] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const bothHeld = topHeld && bottomHeld;
  const progress = Math.min(100, holdMs / Math.max(1, config.holdDurationMs) * 100);
  const remaining = Math.max(0, (config.holdDurationMs - holdMs) / 1000);

  useEffect(() => {
    if (!bothHeld || complete) {
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current = performance.now();
    const timer = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt === null) return;
      const next = performance.now() - startedAt;
      setHoldMs(next);
      if (next >= config.holdDurationMs) {
        setComplete(true);
        navigator.vibrate?.([80, 60, 120]);
        window.clearInterval(timer);
      }
    }, Math.max(16, config.tickIntervalMs));
    return () => {
      startedAtRef.current = null;
      window.clearInterval(timer);
    };
  }, [bothHeld, complete, config.holdDurationMs, config.tickIntervalMs]);

  function updateHold(which: "top" | "bottom", held: boolean, pressure: number) {
    const accepted = !held || pressure >= config.minimumPressure || pressure === 0;
    if (!accepted) return;
    if (which === "top") {
      if (held && bottomHeld) setHoldMs(0);
      setTopHeld(held);
    } else {
      if (held && topHeld) setHoldMs(0);
      setBottomHeld(held);
    }

    if (!held && bothHeld && !complete) {
      setHoldMs(0);
      setSevered(true);
      navigator.vibrate?.(80);
      window.setTimeout(() => setSevered(false), 1400);
    }
  }

  function reset() {
    startedAtRef.current = null;
    setHoldMs(0);
    setComplete(false);
    setTopHeld(false);
    setBottomHeld(false);
  }

  return (
    <DmapFrame accent="#C084FC" icon="🫱🏻‍🫲🏽" title="Joint Contact Hold" subtitle="Simultaneous two-person touch link">
      {complete && <DmapSuccess message="Both contact nodes stayed linked for the full hold duration and the alliance is synchronized." onRunAgain={reset} />}
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden px-1 py-1 sm:px-3 sm:py-2">
        {bothHeld && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
            <div className="h-full w-full animate-pulse bg-gradient-to-b from-[#FF007B]/15 via-[#FEE715]/15 to-[#00F0FF]/15 transition-opacity duration-300" style={{ opacity: 0.3 + progress / 100 * 0.7 }} />
            <div className="absolute -top-16 left-1/2 h-72 w-80 -translate-x-1/2 animate-pulse rounded-full bg-[#FF007B]/20 blur-3xl" style={{ animationDuration: ".8s" }} />
            <div className="absolute -bottom-16 left-1/2 h-72 w-80 -translate-x-1/2 animate-pulse rounded-full bg-[#00F0FF]/20 blur-3xl" style={{ animationDuration: ".8s" }} />
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-[#FEE715]/20 blur-2xl" style={{ animationDuration: ".5s" }} />
            <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-[#FEE715]/40" style={{ animationDuration: "1.2s" }} />
            <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 animate-[pulse_.4s_ease-in-out_infinite] rounded-full border border-[#FEE715]/25" />
          </div>
        )}

        <ContactPad color="#FF007B" held={topHeld} label="Partner 1" minimumPressure={config.minimumPressure} onHeld={(held, pressure) => updateHold("top", held, pressure)} rotated />

        <section className="relative z-10 my-4 flex items-center justify-center gap-4 rounded-2xl border border-[#FEE715]/30 bg-black/55 p-4 sm:gap-6">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center sm:h-28 sm:w-28">
            {bothHeld && <div className="absolute -inset-2 animate-[pulse_.35s_ease-in-out_infinite] rounded-full border-2 border-[#FEE715]/60 shadow-[0_0_20px_rgba(254,231,21,.6)]" />}
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,.12)" strokeWidth="8" fill="transparent" />
              <circle cx="50" cy="50" r="40" stroke={complete ? "#34D399" : "#FEE715"} strokeWidth="8" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - progress / 100)} strokeLinecap="round" fill="transparent" className="transition-all duration-75" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full text-center">
              <span className={`font-mono text-xl font-black ${complete ? "text-emerald-400" : "text-[#FEE715]"}`}>{complete ? "✓" : `${remaining.toFixed(1)}s`}</span>
              <span className="font-mono text-[8px] text-white/50">{complete ? "SYNCED" : bothHeld ? `${Math.round(progress)}%` : "STANDBY"}</span>
            </div>
          </div>
          <div className="relative min-w-0 font-mono">
            <p className={`flex items-center gap-2 text-xs font-black uppercase ${complete ? "text-emerald-400" : bothHeld ? "animate-[pulse_.3s_ease-in-out_infinite] text-[#FEE715]" : "text-white"}`}><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${complete ? "bg-emerald-400 shadow-[0_0_12px_#34D399]" : bothHeld ? "animate-pulse bg-[#FEE715] shadow-[0_0_12px_#FEE715]" : topHeld || bottomHeld ? "animate-pulse bg-[#FEE715]" : "bg-[#FEE715]/50"}`} />{complete ? "Connection successful" : bothHeld ? "Connecting..." : topHeld || bottomHeld ? "1/2 contacted..." : "Hold together"}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/55">{complete ? "Alliance link synchronized." : bothHeld ? "Neural link active—keep both fingers down until 100%." : topHeld ? "Waiting for Partner 2 to touch the lower pad." : bottomHeld ? "Waiting for Partner 1 to touch the upper pad." : "Each partner must hold one contact pad."}</p>
            {severed && <p className="mt-2 animate-pulse text-[9px] font-bold text-red-400">⚠ CONNECTION SEVERED — START AGAIN</p>}
          </div>
        </section>

        <ContactPad color="#00F0FF" held={bottomHeld} label="Partner 2" minimumPressure={config.minimumPressure} onHeld={(held, pressure) => updateHold("bottom", held, pressure)} />
      </div>
    </DmapFrame>
  );
}

function ContactPad({ color, held, label, minimumPressure, onHeld, rotated = false }: { color: string; held: boolean; label: string; minimumPressure: number; onHeld: (held: boolean, pressure: number) => void; rotated?: boolean }) {
  return (
    <div className={`relative z-10 flex min-h-36 flex-1 items-stretch ${rotated ? "rotate-180" : ""}`}>
      {held ? (
        <>
          <div className="pointer-events-none absolute -inset-1 z-0 animate-[pulse_.4s_ease-in-out_infinite] rounded-[1.75rem] border-2" style={{ borderColor: color, boxShadow: `0 0 25px ${color}cc` }} />
          <div className="pointer-events-none absolute -inset-3 z-0 animate-ping rounded-[2rem] border" style={{ borderColor: `${color}99`, animationDuration: "1s" }} />
        </>
      ) : (
        <div className="pointer-events-none absolute -inset-0.5 z-0 animate-pulse rounded-3xl border" style={{ borderColor: `${color}59`, animationDuration: "2s" }} />
      )}
      <button
        type="button"
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onHeld(true, event.pressure); }}
        onPointerUp={(event) => onHeld(false, event.pressure)}
        onPointerCancel={(event) => onHeld(false, event.pressure)}
        className={`relative z-10 w-full touch-none select-none overflow-hidden rounded-3xl border-2 px-8 py-8 text-center transition active:scale-[.99] ${held ? "scale-[1.01]" : ""}`}
        style={{ borderColor: color, backgroundColor: `${color}${held ? "40" : "16"}`, boxShadow: held ? `0 0 28px ${color}66` : undefined, color }}
      >
        {held && <span className="absolute inset-0 animate-ping opacity-20" style={{ backgroundColor: color }} />}
        <span className="absolute inset-x-0 top-2 font-mono text-[8px] tracking-[0.2em]">TOUCH & HOLD FIRMLY</span>
        <span className="relative block text-2xl">{held ? "⚡" : "◉"}</span>
        <span className="relative mt-1 block font-mono text-sm font-black uppercase">{held ? `✓ ${label} holding` : label}</span>
        <span className="relative mt-1 block font-mono text-[9px] text-white/60">{minimumPressure > 0 ? `PRESSURE MUST REACH ${minimumPressure.toFixed(2)}` : "TOUCH & HOLD FIRMLY"}</span>
      </button>
    </div>
  );
}
