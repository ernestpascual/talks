"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef } from "react";

import { DUNGEON_PUBLIC_ORIGIN, ROLE_DETAILS, type DungeonRole } from "@/lib/dungeons";

export function DungeonShell({
  background,
  children,
}: {
  background: string;
  children: React.ReactNode;
}) {
  return (
    <main className="dungeon-shell" style={{ backgroundImage: `url(${background})` }}>
      {children}
    </main>
  );
}

export function RoleAvatar({ role, size = "md" }: { role: DungeonRole; size?: "sm" | "md" | "lg" }) {
  const detail = ROLE_DETAILS[role];
  const sizing = size === "lg" ? "h-20 w-20 text-4xl" : size === "sm" ? "h-10 w-10 text-xl" : "h-14 w-14 text-2xl";

  return (
    <div
      className={`${sizing} grid shrink-0 place-items-center rounded-full border-2 bg-black/75 shadow-xl`}
      style={{ borderColor: detail.color, color: detail.color, boxShadow: `0 0 24px ${detail.color}38` }}
      aria-label={`${detail.title} avatar`}
    >
      {detail.glyph}
    </div>
  );
}

export function QuestQr({ path, label }: { path: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const publicUrl = `${DUNGEON_PUBLIC_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void QRCode.toCanvas(canvas, publicUrl, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#17130d", light: "#f5e9c6" },
    });
  }, [publicUrl]);

  return (
    <div className="dungeon-panel rounded-2xl p-4 text-center">
      <div className="mx-auto w-fit rounded-xl bg-[#f5e9c6] p-2">
        <canvas ref={canvasRef} className="block h-40 w-40 xl:h-48 xl:w-48" aria-label={label} />
      </div>
      <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#d9bd7d]">Scan to join</p>
      <p className="mt-1 break-all font-mono text-[9px] text-white/45">{publicUrl}</p>
    </div>
  );
}

export function QuestHeader({ chapter, title }: { chapter: string; title: string }) {
  return (
    <header className="text-center">
      <p className="dungeon-kicker">Techeons &amp; Promptons · {chapter}</p>
      <h1 className="dungeon-title mt-2 text-3xl text-[#f6edcf] sm:text-5xl">{title}</h1>
    </header>
  );
}

export function BackToCampaign() {
  return (
    <Link href="/experience/dungeons" className="fixed left-4 top-4 z-50 rounded-full border border-white/15 bg-black/55 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/70 backdrop-blur hover:text-white">
      ← Campaign
    </Link>
  );
}
