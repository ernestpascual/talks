"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

const EXPERIENCES = [
  {
    title: "5-Wave",
    path: "/experience/5-wave",
    description: "Hand-tracking wave detection",
  },
  {
    title: "Handshake",
    path: "/experience/handshake",
    description: "Two-person grip and motion",
  },
  {
    title: "Hold & Tap",
    path: "/experience/hold-tap",
    description: "Two-person contact hold",
  },
] as const;

function ExperienceQr({ path, title }: { path: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    void QRCode.toCanvas(canvas, `${window.location.origin}${path}`, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#111111", light: "#ffffff" },
    });
  }, [path]);

  return (
    <div className="flex flex-col items-center">
      <div className="rounded-2xl bg-white p-3 shadow-[0_0_40px_rgba(255,255,255,0.12)]">
        <canvas
          ref={canvasRef}
          className="block h-[clamp(120px,16vw,220px)] w-[clamp(120px,16vw,220px)]"
          aria-label={`QR code for ${title}`}
        />
      </div>
      <h2 className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.18em] text-white sm:text-base">
        {title}
      </h2>
      <p className="mt-2 text-center text-xs text-white/55">{path}</p>
      <p className="mt-1 text-center text-[11px] text-white/35">{EXPERIENCES.find((experience) => experience.path === path)?.description}</p>
    </div>
  );
}

export default function SlideIceBreakers() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-10 py-16 text-white sm:px-16">
      <h1 className="mb-12 text-center text-2xl font-semibold tracking-[-0.03em] sm:text-4xl">
        Interactive Ice Breakers
      </h1>
      <div className="grid w-full max-w-5xl grid-cols-3 gap-6 sm:gap-12">
        {EXPERIENCES.map((experience) => (
          <ExperienceQr key={experience.path} {...experience} />
        ))}
      </div>
    </main>
  );
}
