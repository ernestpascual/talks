import Link from "next/link";

const PROTOTYPES = [
  { href: "/proto/crowd-test", icon: "◎", name: "Crowd Test", description: "Count visible people live with a collapsible camera counter and OpenCV low-light enhancement." },
  { href: "/proto/camera-sub", icon: "🪵", name: "Camera Substitution", description: "Form the Ram hand seal and disappear in a puff of smoke, leaving a log behind." },
  { href: "/proto/sword", icon: "⚔️", name: "Sword", description: "Track phone motion, gyroscope signals, and slashing gestures." },
  { href: "/proto/sword-2", icon: "🗡️", name: "Sword 2", description: "Control a 3D sword with phone motion while streaming to Sword Control." },
  { href: "/proto/staff", icon: "🪄", name: "Staff", description: "Track gyroscope movement and count full spinning gestures." },
  { href: "/proto/hold", icon: "✋", name: "Hold", description: "Measure press duration, pointer movement, pressure, and motion while holding." },
  { href: "/proto/arrow", icon: "➜", name: "Arrow", description: "Capture target taps, pointer details, and a sensor snapshot." },
  { href: "/proto/lyria", icon: "🎵", name: "Google Lyria", description: "Generate original studio tracks and music clips with Google DeepMind Lyria." },
  { href: "/proto/logo", icon: "◉", name: "Filipino Logo System", description: "Explore 55 bold geometric icons across full, dark, vibrant, and DOT-reference studies." },
];

export default function PrototypeDirectoryPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-400">Prototype lab</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black">Choose an interaction</h1>
            <p className="mt-3 text-zinc-400">Open one of the participant-facing sensor experiences.</p>
          </div>
          <Link href="/proto/admin" className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:border-cyan-300 hover:text-cyan-200">Open controls</Link>
        </div>
        <section className="mt-10 grid gap-5 md:grid-cols-2">
          {PROTOTYPES.map((prototype) => (
            <Link key={prototype.href} href={prototype.href} className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:-translate-y-1 hover:border-cyan-400/60">
              <span className="text-5xl">{prototype.icon}</span>
              <h2 className="mt-5 text-2xl font-black group-hover:text-cyan-300">{prototype.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{prototype.description}</p>
              <span className="mt-5 block font-mono text-xs text-cyan-400">{prototype.href} →</span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
