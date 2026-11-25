import Image from "next/image";

const CHARACTERS = [
  "anchor",
  "bridge",
  "builder",
  "catalyst",
  "navigator",
  "prism",
  "sentinel",
  "spark",
  "unassigned",
] as const;

const POWERS = [
  "bridge",
  "catalyst",
  "constellation-lock",
  "gravity-lock",
  "prism",
  "pulsar-sight",
  "rift-pivot",
  "spark",
  "starforge",
] as const;

function GifTile({ src, label }: { src: string; label: string }) {
  return (
    <figure className="w-[70%] min-w-0 justify-self-center">
      <Image
        src={src}
        alt={label}
        width={256}
        height={256}
        unoptimized
        className="h-auto w-full object-contain"
      />
    </figure>
  );
}

export default function SlideDmapBattle() {
  return (
    <main className="grid min-h-[100dvh] grid-cols-2 gap-3 bg-black p-8 text-white sm:gap-6 sm:p-12 lg:gap-8 lg:p-20">
      <section className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-2 sm:p-4">
        <h2 className="mb-2 text-center text-[9px] font-semibold uppercase tracking-[0.28em] text-white/60 sm:mb-4 sm:text-xs">
          Characters
        </h2>
        <div className="grid min-h-0 flex-1 grid-cols-3 content-center items-center gap-1 sm:gap-3">
          {CHARACTERS.map((name) => (
            <GifTile
              key={name}
              label={name}
              src={`/talks/bbdo-ai-playday/img/dmap/${name}.gif`}
            />
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-col rounded-xl border border-fuchsia-400/20 bg-fuchsia-950/10 p-2 sm:p-4">
        <h2 className="mb-2 text-center text-[9px] font-semibold uppercase tracking-[0.28em] text-fuchsia-200/70 sm:mb-4 sm:text-xs">
          Powers
        </h2>
        <div className="grid min-h-0 flex-1 grid-cols-3 content-center items-center gap-1 sm:gap-3">
          {POWERS.map((name) => (
            <GifTile
              key={name}
              label={name}
              src={`/talks/bbdo-ai-playday/img/dmap/powers/${name}.gif`}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
