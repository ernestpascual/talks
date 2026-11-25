import Link from "next/link";
import type { ReactNode } from "react";

export default function DmapFrame({
  accent = "#00F0FF",
  children,
  icon,
  subtitle,
  title,
}: {
  accent?: string;
  children: ReactNode;
  icon: string;
  subtitle: string;
  title: string;
}) {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-black p-3 text-[#F0EEE9] sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(${accent} 1px, transparent 1px)`, backgroundSize: "28px 28px" }} />
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col rounded-3xl border-2 bg-gradient-to-br from-[#0c1033] via-[#050718] to-black p-4 shadow-[0_0_60px_rgba(0,240,255,.22)] sm:min-h-[calc(100dvh-3rem)] sm:p-6" style={{ borderColor: `${accent}99` }}>
        <header className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: accent }}>DMAP Mission Protocol</p>
            <h1 className="mt-2 flex items-center gap-2 text-xl font-black uppercase tracking-tight sm:text-2xl"><span>{icon}</span>{title}</h1>
            <p className="mt-1 font-mono text-xs text-white/55">{subtitle}</p>
          </div>
          <Link href="/experience" className="rounded-full border border-white/20 bg-black/50 px-3 py-2 font-mono text-xs text-white/70 hover:text-white">✕</Link>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </main>
  );
}
