"use client";

export default function DmapSuccess({ message, onRunAgain }: { message: string; onRunAgain: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/85 p-5 backdrop-blur-md">
      <div className="pointer-events-none absolute h-72 w-72 animate-ping rounded-full border-2 border-emerald-400/35" style={{ animationDuration: "1.4s" }} />
      <div className="pointer-events-none absolute h-96 w-96 animate-pulse rounded-full bg-emerald-400/15 blur-3xl" style={{ animationDuration: ".7s" }} />
      <section className="relative w-full max-w-sm animate-[bounce_.65s_ease-out_1] rounded-3xl border-2 border-emerald-400 bg-[#071a18] p-7 text-center shadow-[0_0_70px_rgba(52,211,153,.55)]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-400/20 text-4xl text-emerald-300 shadow-[0_0_32px_rgba(52,211,153,.55)]">✓</div>
        <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300">Activity complete</p>
        <h2 className="mt-2 text-2xl font-black uppercase text-white">Connection successful!</h2>
        <p className="mt-3 font-mono text-xs leading-relaxed text-white/65">{message}</p>
        <button type="button" onClick={onRunAgain} className="mt-6 w-full rounded-xl bg-emerald-400 px-5 py-3 font-mono text-xs font-black uppercase text-black transition hover:bg-emerald-300">Run activity again</button>
      </section>
    </div>
  );
}
