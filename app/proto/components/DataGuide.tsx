export interface GuideSection {
  title: string;
  items: Array<{ label: string; description: string }>;
}

export function DataGuide({ sections, accent = "cyan" }: { sections: GuideSection[]; accent?: "cyan" | "violet" }) {
  const colors = accent === "violet"
    ? { border: "border-violet-400/20", background: "bg-violet-400/5", heading: "text-violet-200", accent: "text-violet-300" }
    : { border: "border-cyan-400/20", background: "bg-cyan-400/5", heading: "text-cyan-200", accent: "text-cyan-300" };

  return (
    <details className={`group rounded-2xl border p-6 ${colors.border} ${colors.background}`}>
      <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 text-2xl font-black ${colors.heading}`}>
        Complete data legend and ideas
        <span className={`text-sm font-medium group-open:hidden ${colors.accent}`}>Show guide</span>
        <span className={`hidden text-sm font-medium group-open:inline ${colors.accent}`}>Hide guide</span>
      </summary>
      <p className="mt-3 max-w-3xl text-sm text-zinc-400">Each entry explains exactly one value and gives you one practical way to use it.</p>
      <div className="mt-5 space-y-5">
        {sections.map((section) => (
          <section key={section.title} className="rounded-xl bg-zinc-950/80 p-4">
            <h3 className={`text-sm font-black uppercase tracking-wider ${colors.accent}`}>{section.title}</h3>
            <dl className="mt-3 grid gap-3 md:grid-cols-2">
              {section.items.map((item) => (
                <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
                  <dt className="font-mono text-xs font-bold text-zinc-100">{item.label}</dt>
                  <dd className="mt-1 text-xs leading-relaxed text-zinc-400">{item.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </details>
  );
}
